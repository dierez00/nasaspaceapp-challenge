"use client";

import React, { useEffect, useRef } from "react";
import * as THREE from "three";

// ----------------------------------------------------------------------------
// Capa Base de Estrellas Nítidas con Parpadeo Dinámico (Equivalente Drei Stars)
// ----------------------------------------------------------------------------
function createStarsPoints(
  radius = 50,
  depth = 40,
  count = 4500,
  factor = 3.5,
  saturation = 0.2,
  speed = 1.5
) {
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const color = new THREE.Color();
  const spherical = new THREE.Spherical();
  const vec = new THREE.Vector3();
  const increment = depth / count;
  let r = radius + depth;

  for (let i = 0; i < count; i++) {
    r -= increment * Math.random();
    spherical.set(
      r,
      Math.acos(1 - Math.random() * 2),
      Math.random() * 2 * Math.PI
    );
    vec.setFromSpherical(spherical);
    positions[i * 3] = vec.x;
    positions[i * 3 + 1] = vec.y;
    positions[i * 3 + 2] = vec.z;

    color.setHSL(i / count, saturation, 0.98);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = (0.5 + 0.5 * Math.random()) * factor;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      speed: { value: speed },
    },
    vertexShader: `
      uniform float time;
      uniform float speed;
      attribute float size;
      varying vec3 vColor;
      void main() {
        vColor = color;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        float twinkle = 2.0 + 1.8 * sin(time * 1.5 + position.x * 12.0 + position.y * 7.0);
        gl_PointSize = size * (60.0 / -mvPosition.z) * twinkle;
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5, 0.5));
        if (d > 0.5) discard;
        float opacity = 1.0 / (1.0 + exp(16.0 * (d - 0.25)));
        gl_FragColor = vec4(vColor, opacity);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
  });

  const points = new THREE.Points(geometry, material);
  return { points, geometry, material };
}

// ----------------------------------------------------------------------------
// Capa de Estrellas Destellantes en Primer/Medio Plano (Equivalente Drei Sparkles)
// ----------------------------------------------------------------------------
function createSparklesPoints(
  count = 180,
  scale = [28, 16, 15],
  size = 2.2,
  _speed = 0,
  opacity = 0.9,
  hexColor = "#e0f2fe"
) {
  void _speed;
  const positions = new Float32Array(count * 3);
  const opacities = new Float32Array(count);
  const noises = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * scale[0];
    positions[i * 3 + 1] = (Math.random() - 0.5) * scale[1];
    positions[i * 3 + 2] = (Math.random() - 0.5) * scale[2];

    opacities[i] = opacity;
    noises[i * 3] = Math.random();
    noises[i * 3 + 1] = Math.random();
    noises[i * 3 + 2] = Math.random();
    sizes[i] = size * (0.6 + Math.random() * 0.8);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("opacity", new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute("noise", new THREE.BufferAttribute(noises, 3));
  geometry.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const baseColor = new THREE.Color(hexColor);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      time: { value: 0 },
      color: { value: baseColor },
    },
    vertexShader: `
      uniform float time;
      attribute float opacity;
      attribute vec3 noise;
      attribute float size;
      varying float vOpacity;
      void main() {
        // Posición completamente estática en el espacio (sin deriva ni traslación)
        vec4 modelPosition = modelMatrix * vec4(position, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = size * (45.0 / -viewPosition.z);
        // Exclusivamente pulsación y destello de brillo en su lugar
        vOpacity = opacity * (0.35 + 0.65 * sin(time * 2.0 + noise.z * 100.0));
      }
    `,
    fragmentShader: `
      uniform vec3 color;
      varying float vOpacity;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        if (d > 0.5) discard;
        float strength = max(0.0, 0.05 / d - 0.1);
        gl_FragColor = vec4(color, strength * vOpacity);
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  return { points, geometry, material };
}

export function SpaceBackdrop3D() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Configuración de Escena, Cámara y Renderer
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#02040a");

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setSize(width, height);
    // Resolución nativa Retina / HiDPI [1, 2] para máxima nitidez de estrellas
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    // Insertar el canvas
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.pointerEvents = "none";
    container.appendChild(renderer.domElement);

    // 2. Iluminación Cinematográfica Aeroespacial
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.14);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
    sunLight.position.set(15, 3.5, 4.5);
    scene.add(sunLight);

    const flameGlowLight = new THREE.PointLight(0x38bdf8, 1.1, 8);
    flameGlowLight.position.set(0, 0, 1.2);
    scene.add(flameGlowLight);

    // 3. Cargador de Texturas PBR
    const textureLoader = new THREE.TextureLoader();

    // Textura Skybox (Estrellas / Vía Láctea): esfera gigante ampliada a r=180 para envolver detrás de las estrellas
    const starsTexture = textureLoader.load("/textures/2k_stars_milky_way.jpg");
    starsTexture.colorSpace = THREE.SRGBColorSpace;
    const skyboxGeo = new THREE.SphereGeometry(180, 32, 32);
    const skyboxMat = new THREE.MeshBasicMaterial({
      map: starsTexture,
      side: THREE.BackSide,
      transparent: true,
      opacity: 0.6,
      color: new THREE.Color("#ffffff"),
    });
    const skybox = new THREE.Mesh(skyboxGeo, skyboxMat);
    scene.add(skybox);

    // 4. Capas Vectoriales Nítidas de Alta Densidad (Completamente Estáticas en su Lugar)
    // Capa base masiva: 14,000 estrellas nítidas de alta dispersión (radius 100, depth 50, factor 4, saturation 0)
    const stars = createStarsPoints(100, 50, 14000, 4.0, 0, 0);
    scene.add(stars.points);

    // Capa de Sparkles 1: 350 destellos principales en primer/medio plano
    const sparkles1 = createSparklesPoints(350, [40, 25, 25], 2.5, 0, 1.0, "#f0f9ff");
    scene.add(sparkles1.points);

    // Capa de Sparkles 2: 150 destellos secundarios de refuerzo
    const sparkles2 = createSparklesPoints(150, [35, 20, 20], 4.0, 0, 0.8, "#dbeafe");
    scene.add(sparkles2.points);

    // 5. La Tierra (Lejana) — Renderizado PBR Fotorrealista
    const earthDayMap = textureLoader.load("/textures/2k_earth_daymap.jpg");
    earthDayMap.colorSpace = THREE.SRGBColorSpace;

    // Los mapas de normales y especular deben ser lineales (NoColorSpace) para no distorsionar el relieve
    const earthNormalMap = textureLoader.load("/textures/2k_earth_normal_map.png");
    earthNormalMap.colorSpace = THREE.NoColorSpace;
    earthNormalMap.anisotropy = 8;

    const earthSpecularMap = textureLoader.load("/textures/2k_earth_specular_map.png");
    earthSpecularMap.colorSpace = THREE.NoColorSpace;
    earthSpecularMap.anisotropy = 8;

    const earthGeo = new THREE.SphereGeometry(0.75, 64, 64);
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthDayMap,
      normalMap: earthNormalMap,
      normalScale: new THREE.Vector2(0.6, 0.6),
      roughnessMap: earthSpecularMap, // Los océanos reflejan y los continentes quedan mates
      roughness: 0.75,                // Acabado mate natural para roca y vegetación terrestre
      metalness: 0.05,                // Cero brillo metálico artificial
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.position.set(4.2, 2.0, -6.5);
    earth.rotation.set(0.35, 0, 0);

    // Halo Atmosférico Exterior (Fresnel / Glow con mezcla aditiva)
    const atmosphereGeo = new THREE.SphereGeometry(0.75, 64, 64);
    const atmosphereMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#38bdf8"),
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const atmosphere = new THREE.Mesh(atmosphereGeo, atmosphereMat);
    atmosphere.scale.set(1.025, 1.025, 1.025);
    earth.add(atmosphere);

    // Halo tenue exterior adicional para suave difusión mesosférica
    const glowGeo = new THREE.SphereGeometry(0.75, 64, 64);
    const glowMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#0ea5e9"),
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.scale.set(1.06, 1.06, 1.06);
    earth.add(glow);

    scene.add(earth);

    // 6. La Luna — Horizonte Planetario Ancho de Órbita Baja (Ecuador centrado, sin distorsión polar)
    const moonTexture = textureLoader.load("/textures/2k_moon.jpg");
    moonTexture.colorSpace = THREE.SRGBColorSpace;
    moonTexture.anisotropy = 16;
    moonTexture.wrapS = THREE.RepeatWrapping;
    moonTexture.wrapT = THREE.RepeatWrapping;

    // Radio de 15 para abarcar el horizonte de lado a lado
    const moonGeo = new THREE.SphereGeometry(15, 128, 128);
    const moonMat = new THREE.MeshStandardMaterial({
      map: moonTexture,
      bumpMap: moonTexture,
      bumpScale: 0.08,
      roughness: 0.95,
      color: new THREE.Color("#cbd5e1"),
      metalness: 0.02,
    });
    const moon = new THREE.Mesh(moonGeo, moonMat);
    // Posición Y=-16.5, Z=-2
    moon.position.set(0, -16.5, -2);
    // Rotación de 90° en Z para exponer el ecuador de la textura (cero deformación polar)
    moon.rotation.set(0.2, 0, Math.PI / 2);
    scene.add(moon);

    // 7. Bucle de Animación y Control de Framerate con Reloj Three.js
    let animationFrameId: number;
    let isVisible = true;
    const clock = new THREE.Clock();

    const animate = () => {
      if (isVisible) {
        const delta = clock.getDelta();
        const elapsed = clock.getElapsedTime();

        // Rotación de los cuerpos celestes: la Luna gira sobre su eje X
        earth.rotation.y += delta * 0.05;
        moon.rotation.x += delta * 0.015;

        // Actualización de tiempos para parpadeo de estrellas y sparkles
        stars.material.uniforms.time.value = elapsed;
        sparkles1.material.uniforms.time.value = elapsed;
        sparkles2.material.uniforms.time.value = elapsed;

        renderer.render(scene, camera);
      }
      animationFrameId = requestAnimationFrame(animate);
    };
    animate();

    // 8. Optimización GPU: IntersectionObserver para pausar render al scrollear
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        isVisible = entry.isIntersecting;
        if (isVisible) {
          clock.getDelta(); // reset delta para evitar saltos bruscos
        }
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // 9. Manejo de Redimensionamiento (Resize)
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener("resize", handleResize);

    // 10. Limpieza estricta de memoria WebGL al desmontar
    return () => {
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      cancelAnimationFrame(animationFrameId);

      // Disponer geometrías y materiales
      skyboxGeo.dispose();
      skyboxMat.dispose();
      earthGeo.dispose();
      earthMat.dispose();
      atmosphereGeo.dispose();
      atmosphereMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      moonGeo.dispose();
      moonMat.dispose();

      stars.geometry.dispose();
      stars.material.dispose();
      sparkles1.geometry.dispose();
      sparkles1.material.dispose();
      sparkles2.geometry.dispose();
      sparkles2.material.dispose();

      starsTexture.dispose();
      earthDayMap.dispose();
      earthNormalMap.dispose();
      earthSpecularMap.dispose();
      moonTexture.dispose();

      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-0 bg-[#02040a] overflow-hidden pointer-events-none select-none"
    />
  );
}

export default SpaceBackdrop3D;
