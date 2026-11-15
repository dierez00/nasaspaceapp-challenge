/** Artistic emission and density only: never a calibrated combustion solver. */
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
float hash(vec3 p) { return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453); }
float noise(vec3 p) {
  vec3 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
  return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec2 densityField(vec3 p) {
  float h=clamp((p.y+.82)/1.65,0.0,1.0);
  // Quiet cellular drift in the sphere, directional flow in the rising column.
  float flow=mix(.18,1.25,uGravity);
  vec3 advect=p*3.8-vec3(sin(uTime*.4)*.2,uTime*flow,cos(uTime*.3)*.2);
  float turbulence=noise(advect)*.68+noise(advect*2.37+vec3(uTime*.13))*.32;
  float sway=sin(p.y*4.5-uTime*2.1)*.085*h*uGravity;
  vec2 radial=p.xz-vec2(sway,cos(uTime*1.4+p.y*3.)*.045*h*uGravity);
  float sphere=length((p-vec3(0,-.08,0))/vec3(.67,.66,.67));
  float radius=mix(.46,.035,pow(h,.72));
  float column=length(radial)/max(radius,.035);
  float contour=mix(sphere,column,uGravity);
  float boundary=1.-contour+(turbulence-.5)*.22;
  float mask=smoothstep(-.08,.12,boundary)*smoothstep(-.91,-.73,p.y)*(1.-smoothstep(.70,.94,p.y));
  float band=clamp(1.-abs(contour-.78)*3.8,0.,1.);
  float shell=band*band*(3.-2.*band);
  float density=(.2+shell*.7+boundary*.4)*mask;
  density*=mix(.65,1.12,turbulence);
  return vec2(max(0.,density),clamp(shell*.6+turbulence*.4,0.,1.));
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
  for(int i=0;i<48;i++) {
    if(float(i)>=uSteps) break;
    vec3 p=vOrigin+ray*(nearT+(float(i)+.5)*stepSize);
    vec2 field=densityField(p);
    float density=field.x;
    float alpha=clamp(density*stepSize*3.8*uEnvelope*mix(.7,1.1,uPressure)*mix(.8,1.12,uOxygen),0.,.75);
    vec3 edge=mix(vec3(.025,.15,.72),vec3(.76,.075,.012),uGravity);
    vec3 body=mix(vec3(.05,.43,1.),vec3(1.,.38,.035),uGravity);
    vec3 core=mix(vec3(.55,.83,1.),vec3(1.,.88,.48),uGravity);
    vec3 color=mix(edge,body,smoothstep(.1,.65,field.y));
    color=mix(color,core,smoothstep(.6,.95,field.y)*.7);
    accumulated.rgb+=(1.-accumulated.a)*color*alpha;
    accumulated.a+=(1.-accumulated.a)*alpha;
    if(accumulated.a>.97) break;
  }
  if(accumulated.a<.005) discard;
  gl_FragColor=vec4(accumulated.rgb/max(accumulated.a,.001),accumulated.a);
}`;
