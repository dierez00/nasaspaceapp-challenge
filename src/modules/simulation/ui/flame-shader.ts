/** A ray-marched artistic density field, not a fluid/combustion solver. */
export const flameVertex = `
varying vec3 vOrigin;
varying vec3 vPosition;
void main() {
  vOrigin = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;
export const flameFragment = `
precision highp float;
varying vec3 vOrigin;
varying vec3 vPosition;
uniform float uTime;
uniform float uGravity;
uniform float uEnvelope;
uniform float uOxygen;
uniform float uPressure;
uniform float uSteps;
float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float field(vec3 p) {
  float h=clamp((p.y+.82)/1.65,0.0,1.0);
  vec3 advect=vec3(p.x*3.1,p.y*3.0-uTime*1.45,p.z*3.1);
  float n=noise(advect)*.65+noise(advect*2.05+uTime*.2)*.35;
  float sway=sin(p.y*4.0-uTime*2.3)*.10*h*uGravity;
  vec2 radial=p.xz-vec2(sway,cos(uTime*1.6+p.y*3.)*.055*h*uGravity);
  float sphere=1.0-length((p-vec3(0,-.06,0))/vec3(.73,.73,.73));
  float radius=mix(.52,.06,pow(h,.85));
  float column=(radius-length(radial))*2.0;
  column*=smoothstep(-.92,-.65,p.y)*(1.0-smoothstep(.65,.95,p.y));
  float shape=mix(sphere,column,uGravity);
  return max(0.,shape+(n-.5)*.38)*smoothstep(-.05,.12,shape)*smoothstep(-.95,-.75,p.y)*(1.-smoothstep(.70,.97,p.y));
}
void main() {
  if(uEnvelope<.002 || uPressure<=0.) discard;
  vec3 ray=normalize(vPosition-vOrigin);
  vec3 inv=1.0/ray;
  vec3 t0=(-vec3(1.)-vOrigin)*inv, t1=(vec3(1.)-vOrigin)*inv;
  vec3 mn=min(t0,t1), mx=max(t0,t1);
  float nearT=max(max(mn.x,mn.y),mn.z), farT=min(min(mx.x,mx.y),mx.z);
  if(nearT>farT) discard;
  nearT=max(nearT,0.);
  float stepSize=(farT-nearT)/uSteps;
  vec4 accumulated=vec4(0.);
  for(int i=0;i<40;i++) {
    if(float(i)>=uSteps) break;
    vec3 p=vOrigin+ray*(nearT+(float(i)+.5)*stepSize);
    float density=field(p);
    float alpha=clamp(density*stepSize*5.0*uEnvelope*mix(.7,1.2,uPressure)*mix(.8,1.15,uOxygen),0.,.7);
    vec3 outer=mix(vec3(.16,.22,1.),vec3(1.,.095,.008),uGravity);
    vec3 inner=mix(vec3(.65,.54,1.),vec3(1.,.56,.08),uGravity);
    vec3 color=mix(outer,inner,smoothstep(.05,.25,density));
    color=mix(color,vec3(1.,.94,.72),smoothstep(.32,.72,density));
    accumulated.rgb+=(1.-accumulated.a)*color*alpha*1.25;
    accumulated.a+=(1.-accumulated.a)*alpha;
    if(accumulated.a>.98) break;
  }
  gl_FragColor=vec4(accumulated.rgb,accumulated.a);
}`;
