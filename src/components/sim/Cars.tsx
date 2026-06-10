"use client";

import { useRef, useSyncExternalStore } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { CarObj, Engine } from "@/lib/sim/engine";
import { STALLS } from "@/lib/sim/layout";

function CarMesh({ car }: { car: CarObj }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(car.x, car.y, car.z);
    grp.rotation.y = car.heading;
  });
  return (
    <group ref={g}>
      {/* body */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.85, 0.6, 4.3]} />
        <meshStandardMaterial color={car.color} metalness={0.25} roughness={0.5} />
      </mesh>
      {/* cabin */}
      <mesh position={[0, 1.12, -0.25]} castShadow>
        <boxGeometry args={[1.6, 0.52, 2.1]} />
        <meshStandardMaterial color="#2b3138" metalness={0.4} roughness={0.25} />
      </mesh>
      {/* wheels */}
      {([
        [-0.92, 1.35],
        [0.92, 1.35],
        [-0.92, -1.35],
        [0.92, -1.35],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.34, 0.34, 0.26, 12]} />
          <meshStandardMaterial color="#15161a" />
        </mesh>
      ))}
    </group>
  );
}

function MotorMesh({ car }: { car: CarObj }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(car.x, car.y, car.z);
    grp.rotation.y = car.heading;
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.54, 0]} castShadow>
        <boxGeometry args={[0.36, 0.28, 1.35]} />
        <meshStandardMaterial color={car.color} metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.74, -0.18]} castShadow>
        <boxGeometry args={[0.5, 0.18, 0.62]} />
        <meshStandardMaterial color="#24282f" metalness={0.35} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.83, 0.72]} castShadow>
        <boxGeometry args={[0.9, 0.06, 0.08]} />
        <meshStandardMaterial color="#17191c" />
      </mesh>
      {([-0.82, 0.82] as const).map((z) => (
        <mesh key={z} position={[0, 0.34, z]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.28, 0.055, 8, 18]} />
          <meshStandardMaterial color="#111216" />
        </mesh>
      ))}
    </group>
  );
}

export function Cars({ engine }: { engine: Engine }) {
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  return (
    <>
      {engine.cars.map((c) =>
        c.stallId >= 0 && STALLS[c.stallId]?.vehicle === "motor" ? (
          <MotorMesh key={c.id} car={c} />
        ) : (
          <CarMesh key={c.id} car={c} />
        ),
      )}
    </>
  );
}

/** Advances the simulation every rendered frame. */
export function Ticker({ engine }: { engine: Engine }) {
  useFrame((_, delta) => {
    engine.tick(Math.min(delta, 0.06));
  });
  return null;
}

const NIGHT = new THREE.Color("#0d1422");
const DAY = new THREE.Color("#a8ddf7");
const DUSK = new THREE.Color("#f0b27a");

/** Sun/sky tied to the simulated clock. */
export function DayNight({ engine }: { engine: Engine }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  const amb = useRef<THREE.AmbientLight>(null);
  const hemi = useRef<THREE.HemisphereLight>(null);
  const bg = useRef(new THREE.Color());

  useFrame(({ scene }) => {
    const h = engine.clockSec() / 3600;
    const dayF = Math.max(0, Math.sin((Math.PI * (h - 6)) / 13));
    const twil =
      Math.max(0, 1 - Math.abs(h - 6.3) / 1.4) + Math.max(0, 1 - Math.abs(h - 18.7) / 1.4);

    if (sun.current) {
      const t = Math.min(1, Math.max(0, (h - 6) / 13));
      sun.current.position.set(-90 + 180 * t, 25 + 105 * dayF, 55);
      sun.current.intensity = 0.25 + 2.6 * dayF;
      sun.current.color.setHSL(0.1, twil * 0.55, 0.55 + 0.45 * (1 - twil * 0.5));
    }
    if (amb.current) amb.current.intensity = 0.3 + 0.45 * dayF;
    if (hemi.current) hemi.current.intensity = 0.22 + 0.38 * dayF;

    bg.current.copy(NIGHT).lerp(DAY, dayF);
    bg.current.lerp(DUSK, Math.min(1, twil) * 0.55 * (0.3 + dayF));
    scene.background = bg.current;
  });

  return (
    <>
      <ambientLight ref={amb} intensity={0.6} />
      <hemisphereLight ref={hemi} args={["#cfe8ff", "#8a8273", 0.5]} />
      <directionalLight
        ref={sun}
        position={[60, 90, 55]}
        intensity={2.4}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-110}
        shadow-camera-right={110}
        shadow-camera-top={110}
        shadow-camera-bottom={-110}
        shadow-camera-far={400}
        shadow-bias={-0.0004}
      />
    </>
  );
}
