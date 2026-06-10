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

function TricycleMesh({ car }: { car: CarObj }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(car.x, car.y, car.z);
    grp.rotation.y = car.heading;
  });
  return (
    <group ref={g}>
      {/* motorcycle body and front fork */}
      <mesh position={[-0.42, 0.56, 0.25]} rotation={[0, 0.12, 0]} castShadow>
        <boxGeometry args={[0.36, 0.24, 1.55]} />
        <meshStandardMaterial color="#1b1f25" metalness={0.35} roughness={0.35} />
      </mesh>
      <mesh position={[-0.42, 0.76, -0.3]} castShadow>
        <boxGeometry args={[0.46, 0.16, 0.62]} />
        <meshStandardMaterial color={car.color} metalness={0.25} roughness={0.45} />
      </mesh>
      <mesh position={[-0.42, 0.94, 0.92]} castShadow>
        <boxGeometry args={[0.82, 0.06, 0.08]} />
        <meshStandardMaterial color="#111216" />
      </mesh>

      {/* sidecar cab */}
      <mesh position={[0.58, 0.74, -0.15]} castShadow>
        <boxGeometry args={[1.02, 0.78, 1.38]} />
        <meshStandardMaterial color="#2a2d32" metalness={0.3} roughness={0.38} />
      </mesh>
      <mesh position={[0.58, 0.9, 0.43]} castShadow>
        <boxGeometry args={[0.9, 0.36, 0.1]} />
        <meshStandardMaterial color="#101214" metalness={0.2} roughness={0.2} />
      </mesh>
      <mesh position={[0.06, 0.74, -0.08]} rotation={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.08, 0.68, 1.16]} />
        <meshStandardMaterial color="#d95b2a" roughness={0.42} />
      </mesh>
      <mesh position={[0.06, 0.78, -0.08]} rotation={[0, 0.18, 0]} castShadow>
        <boxGeometry args={[0.09, 0.38, 0.66]} />
        <meshStandardMaterial color="#f16a2f" roughness={0.35} />
      </mesh>

      {/* canopy roof and supports */}
      <mesh position={[0.15, 1.44, -0.12]} rotation={[0, 0, -0.08]} castShadow>
        <boxGeometry args={[1.85, 0.08, 1.72]} />
        <meshStandardMaterial color="#202936" metalness={0.35} roughness={0.3} />
      </mesh>
      {([
        [-0.5, -0.72],
        [0.95, -0.72],
        [-0.5, 0.58],
        [0.95, 0.58],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.08, z]} castShadow>
          <cylinderGeometry args={[0.025, 0.025, 0.7, 6]} />
          <meshStandardMaterial color="#d8d1c1" metalness={0.5} roughness={0.28} />
        </mesh>
      ))}

      {/* wheels */}
      {([
        [-0.42, 1.0],
        [0.78, -0.78],
        [0.78, 0.72],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.32, z]} rotation={[0, Math.PI / 2, 0]} castShadow>
          <torusGeometry args={[0.24, 0.05, 8, 16]} />
          <meshStandardMaterial color="#111216" />
        </mesh>
      ))}
    </group>
  );
}

function PublicTransportMesh({ car }: { car: CarObj }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(car.x, car.y, car.z);
    grp.rotation.y = car.heading;
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.78, 0]} castShadow>
        <boxGeometry args={[2.15, 1.0, 5.6]} />
        <meshStandardMaterial color={car.color} metalness={0.2} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.22, -0.15]} castShadow>
        <boxGeometry args={[1.9, 0.36, 4.2]} />
        <meshStandardMaterial color="#e8e6e1" roughness={0.35} />
      </mesh>
      {([-1.08, 1.08] as const).flatMap((x) =>
        ([-1.65, 1.65] as const).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.36, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.36, 0.36, 0.28, 12]} />
            <meshStandardMaterial color="#15161a" />
          </mesh>
        )),
      )}
    </group>
  );
}

function OtherVehicleMesh({ car }: { car: CarObj }) {
  const g = useRef<THREE.Group>(null);
  useFrame(() => {
    const grp = g.current;
    if (!grp) return;
    grp.position.set(car.x, car.y, car.z);
    grp.rotation.y = car.heading;
  });
  return (
    <group ref={g}>
      <mesh position={[0, 0.74, 0]} castShadow>
        <boxGeometry args={[2.05, 0.86, 4.9]} />
        <meshStandardMaterial color={car.color} metalness={0.22} roughness={0.55} />
      </mesh>
      <mesh position={[0, 1.18, 0.55]} castShadow>
        <boxGeometry args={[1.75, 0.46, 2.1]} />
        <meshStandardMaterial color="#2b3138" metalness={0.35} roughness={0.3} />
      </mesh>
      {([-1.02, 1.02] as const).flatMap((x) =>
        ([-1.45, 1.45] as const).map((z) => (
          <mesh key={`${x}-${z}`} position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.34, 0.34, 0.28, 12]} />
            <meshStandardMaterial color="#15161a" />
          </mesh>
        )),
      )}
    </group>
  );
}

function VehicleMesh({ car }: { car: CarObj }) {
  if (car.stallId >= 0 && STALLS[car.stallId]?.vehicle === "motor") return <MotorMesh car={car} />;
  if (car.vehicleKind === "motorcycle") return <MotorMesh car={car} />;
  if (car.vehicleKind === "tricycle") return <TricycleMesh car={car} />;
  if (car.vehicleKind === "public") return <PublicTransportMesh car={car} />;
  if (car.vehicleKind === "other") return <OtherVehicleMesh car={car} />;
  return <CarMesh car={car} />;
}

export function Cars({ engine }: { engine: Engine }) {
  useSyncExternalStore(engine.subscribe, engine.getVersion, engine.getVersion);
  return (
    <>
      {engine.cars.map((c) => (
        <VehicleMesh key={c.id} car={c} />
      ))}
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
