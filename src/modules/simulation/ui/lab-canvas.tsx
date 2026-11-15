"use client";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
  type RefObject,
} from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, View } from "@react-three/drei";
import {
  BackSide,
  CanvasTexture,
  DoubleSide,
  MathUtils,
  RepeatWrapping,
  ShaderMaterial,
  type Mesh,
  type PointLight,
  type PerspectiveCamera as ThreeCamera,
} from "three";
type OrbitControlsImpl = ComponentRef<typeof OrbitControls>;
import { useSimulation } from "../application/simulation-provider";
import { flameEnvelope, type SimulationScenario } from "../domain/scenario";
import type { SimulationClock } from "../application/clock";
import { gravityScenarios } from "../domain/comparison";
import { flameFragment, flameVertex } from "./flame-shader";

type Pose = {
  position: [number, number, number];
  target: [number, number, number];
  source: string;
  revision: number;
};
const initialPose = (): Pose => ({
  position: [2.8, 1.8, 4.4],
  target: [0, 0.75, 0],
  source: "reset",
  revision: 0,
});
function makeTexture(textile: boolean) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext("2d")!;
  context.fillStyle = textile ? "#b9af95" : "#a9bbc6";
  context.fillRect(0, 0, 64, 64);
  if (textile)
    for (let i = 0; i < 64; i += 4) {
      context.fillStyle = i % 8 === 0 ? "#8d826b" : "#d6cbb5";
      context.fillRect(i, 0, 1, 64);
      context.fillRect(0, i, 64, 1);
    }
  else {
    context.fillStyle = "#d6e0e5";
    context.fillRect(0, 0, 64, 2);
  }
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.repeat.set(8, 2);
  return texture;
}
function Specimen({
  scenario,
  clock,
  low,
  active,
  reduced,
}: {
  scenario: SimulationScenario;
  clock: SimulationClock;
  low: boolean;
  active: boolean;
  reduced: boolean;
}) {
  const { invalidate } = useThree();
  const flame = useRef<Mesh>(null),
    char = useRef<Mesh>(null),
    light = useRef<PointLight>(null);
  const textile = !["PMMA", "Polietileno"].includes(scenario.material);
  const texture = useMemo(() => makeTexture(textile), [textile]);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: flameVertex,
        fragmentShader: flameFragment,
        transparent: true,
        depthWrite: false,
        side: BackSide,
        uniforms: {
          uTime: { value: 0 },
          uGravity: { value: 0 },
          uEnvelope: { value: 0 },
          uOxygen: { value: 0.5 },
          uPressure: { value: 0.5 },
          uSteps: { value: low ? 20 : 32 },
        },
      }),
    [low],
  );
  useEffect(
    () => () => {
      texture.dispose();
    },
    [texture],
  );
  useEffect(() => () => material.dispose(), [material]);
  const targetGravity =
    scenario.gravity === "micro" ? 0 : scenario.gravity === "lunar" ? 0.45 : 1;
  useFrame((_, delta) => {
    const envelope = flameEnvelope(
      scenario.flameState,
      clock.time,
      scenario.pressure,
    );
    if (!flame.current) return;
    const uniforms = (flame.current.material as ShaderMaterial).uniforms;
    uniforms.uTime.value = clock.time;
    uniforms.uGravity.value = reduced
      ? targetGravity
      : MathUtils.damp(uniforms.uGravity.value, targetGravity, 7, delta);
    if (
      active &&
      !reduced &&
      Math.abs(uniforms.uGravity.value - targetGravity) > 0.002
    )
      invalidate();
    uniforms.uEnvelope.value = envelope;
    uniforms.uPressure.value = scenario.pressure / 16;
    uniforms.uOxygen.value = (scenario.oxygen - 18) / 32;
    if (flame.current) {
      const size = 0.8 + ((scenario.oxygen - 18) / 32) * 0.22;
      flame.current.scale.set(size, size * (0.9 + targetGravity * 0.25), size);
      flame.current.position.x =
        scenario.flameState === "propagation"
          ? -1.05 + (clock.time / 8) * 2.1
          : 0;
      flame.current.visible = envelope > 0;
    }
    if (light.current)
      light.current.intensity =
        envelope * (scenario.gravity === "micro" ? 3 : 5);
    if (char.current) {
      char.current.scale.x =
        scenario.flameState === "propagation"
          ? 0.05 + (clock.time / 8) * 2.15
          : 0.3 + (clock.time / 8) * 0.4;
      char.current.visible = scenario.pressure > 0 && clock.time > 0.1;
    }
  });
  return (
    <group>
      <mesh position={[0, -0.23, 0]}>
        <cylinderGeometry args={[2.5, 2.55, 0.12, 64]} />
        <meshStandardMaterial
          color="#172439"
          metalness={0.75}
          roughness={0.34}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.162, 0]}>
        <ringGeometry args={[2.34, 2.35, 96]} />
        <meshBasicMaterial color="#365c83" side={DoubleSide} />
      </mesh>

      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[3, 0.16, 0.75]} />
        <meshStandardMaterial color="#364657" metalness={0.8} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.065, 0]}>
        <boxGeometry args={[2.6, textile ? 0.035 : 0.07, 0.58]} />
        <meshStandardMaterial
          map={texture}
          roughness={textile ? 0.95 : 0.25}
          metalness={textile ? 0 : 0.12}
        />
      </mesh>
      <mesh ref={char} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.103, 0]}>
        <planeGeometry args={[1, 0.46]} />
        <meshStandardMaterial
          color="#19191b"
          roughness={1}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={flame} position={[0, 0.93, 0]} material={material}>
        <boxGeometry args={[2, 2, 2]} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 1, 0]}
        color={scenario.gravity === "micro" ? "#4d9cff" : "#ff7738"}
        intensity={4}
        distance={5}
      />
    </group>
  );
}
function Scene({
  scenario,
  slot,
  poseRef,
  clock,
  low,
  active,
}: {
  scenario: SimulationScenario;
  slot: string;
  poseRef: RefObject<Pose>;
  clock: SimulationClock;
  low: boolean;
  active: boolean;
}) {
  const { reduced } = useSimulation();
  const { events } = useThree();
  const camera = useRef<ThreeCamera>(null),
    controls = useRef<OrbitControlsImpl>(null);
  const syncing = useRef(false),
    seen = useRef(-1);
  useFrame(() => {
    if (
      poseRef.current.revision !== seen.current &&
      camera.current &&
      controls.current
    ) {
      seen.current = poseRef.current.revision;
      if (poseRef.current.source !== slot) {
        syncing.current = true;
        camera.current.position.fromArray(poseRef.current.position);
        controls.current.target.fromArray(poseRef.current.target);
        controls.current.update();
        syncing.current = false;
      }
      if (events.connected instanceof HTMLElement)
        events.connected.setAttribute(
          "data-camera-position",
          camera.current.position
            .toArray()
            .map((value) => value.toFixed(3))
            .join(","),
        );
    }
  });
  return (
    <>
      <color attach="background" args={["#070f1d"]} />
      <PerspectiveCamera
        ref={camera}
        makeDefault
        position={[2.8, 1.8, 4.4]}
        fov={36}
      />
      <OrbitControls
        ref={controls}
        makeDefault
        target={[0, 0.75, 0]}
        enablePan={false}
        enableDamping={false}
        enabled={active}
        minDistance={3.6}
        maxDistance={8}
        minPolarAngle={Math.PI * 0.25}
        maxPolarAngle={Math.PI * 0.51}
        minAzimuthAngle={-0.85}
        maxAzimuthAngle={0.85}
        onChange={() => {
          if (syncing.current || !camera.current || !controls.current) return;
          poseRef.current = {
            position: camera.current.position.toArray(),
            target: controls.current.target.toArray(),
            source: slot,
            revision: poseRef.current.revision + 1,
          };
        }}
      />
      <ambientLight intensity={0.8} />
      <directionalLight position={[3, 5, 4]} intensity={2} color="#b1c9eb" />
      <Specimen
        scenario={scenario}
        clock={clock}
        low={low}
        active={active}
        reduced={reduced}
      />
    </>
  );
}
function RenderLoop({
  active,
  clock,
  onLoss,
  onQuality,
}: {
  active: boolean;
  clock: SimulationClock;
  onLoss: () => void;
  onQuality: () => void;
}) {
  const { gl, invalidate } = useThree();
  const frames = useRef(0),
    start = useRef(0),
    reported = useRef(false);
  useEffect(() => {
    const lost = (event: Event) => {
      event.preventDefault();
      onLoss();
    };
    gl.domElement.addEventListener("webglcontextlost", lost);
    return () => gl.domElement.removeEventListener("webglcontextlost", lost);
  }, [gl, onLoss]);
  useEffect(
    () =>
      clock.subscribe(() => {
        if (active) invalidate();
      }),
    [clock, active, invalidate],
  );
  useEffect(() => {
    if (active) invalidate();
  }, [active, invalidate]);
  // Scissor bounds change when the instrument scrolls, even while time is paused.
  useEffect(() => {
    const refresh = () => {
      if (active) invalidate();
    };
    document.addEventListener("scroll", refresh, true);
    window.addEventListener("resize", refresh);
    return () => {
      document.removeEventListener("scroll", refresh, true);
      window.removeEventListener("resize", refresh);
    };
  }, [active, invalidate]);
  useFrame(() => {
    if (!active) return;
    gl.setScissorTest(false);
    gl.setClearColor("#070f1d", 0);
    gl.clear(true, true, true);
    gl.info.reset();
    if (clock.playing) {
      invalidate();
      frames.current++;
      const now = performance.now();
      if (!start.current) start.current = now;
      if (now - start.current > 2000) {
        const fps = (frames.current * 1000) / (now - start.current);
        gl.domElement.setAttribute("data-fps", fps.toFixed(1));
        if (fps < 32 && !reported.current) {
          reported.current = true;
          onQuality();
        }
        frames.current = 0;
        start.current = now;
      }
    } else {
      start.current = 0;
      frames.current = 0;
    }
  });
  useFrame(() => {
    gl.domElement.setAttribute("data-draw-calls", String(gl.info.render.calls));
  }, 3);
  return null;
}
export default function LabCanvas({
  host,
  viewA,
  viewB,
  viewC,
  threeGravities,
  mobile,
  onLoss,
}: {
  host: RefObject<HTMLDivElement | null>;
  viewA: RefObject<HTMLDivElement | null>;
  viewB: RefObject<HTMLDivElement | null>;
  viewC: RefObject<HTMLDivElement | null>;
  threeGravities: boolean;
  mobile: boolean;
  onLoss: () => void;
}) {
  const { state, clock, active } = useSimulation();
  const poseRef = useRef<Pose>(initialPose());
  const [degraded, setDegraded] = useState(false);
  const low = mobile || degraded || threeGravities;
  const comparisons = gravityScenarios(state.scenarios.A);
  useEffect(() => {
    poseRef.current = {
      ...initialPose(),
      revision: poseRef.current.revision + 1,
    };
    clock.seek(clock.time);
  }, [state.cameraRevision, clock]);
  return (
    <Canvas
      className="laboratory-canvas"
      frameloop="demand"
      dpr={low ? 1 : 1.5}
      gl={{
        antialias: !low,
        alpha: true,
        powerPreference: "high-performance",
      }}
      eventSource={host as RefObject<HTMLElement>}
      eventPrefix="client"
      onCreated={({ gl }) => {
        gl.info.autoReset = false;
        gl.domElement.dataset.renderer = "webgl";
      }}
    >
      {(threeGravities
        ? [
            { slot: "A", track: viewA, scenario: comparisons[0] },
            { slot: "B", track: viewB, scenario: comparisons[1] },
            { slot: "C", track: viewC, scenario: comparisons[2] },
          ]
        : [
            { slot: "A", track: viewA, scenario: state.scenarios.A },
            ...(state.compare
              ? [{ slot: "B", track: viewB, scenario: state.scenarios.B }]
              : []),
          ]
      ).map(({ slot, track, scenario }, index) => (
        <View
          key={slot}
          track={track as RefObject<HTMLElement>}
          visible={
            threeGravities ||
            !mobile ||
            state.activeSlot === slot ||
            !state.compare
          }
          index={index + 1}
        >
          <Scene
            scenario={scenario}
            slot={slot}
            poseRef={poseRef}
            clock={clock}
            low={low}
            active={active}
          />
        </View>
      ))}
      <RenderLoop
        active={active}
        clock={clock}
        onLoss={onLoss}
        onQuality={() => setDegraded(true)}
      />
    </Canvas>
  );
}
