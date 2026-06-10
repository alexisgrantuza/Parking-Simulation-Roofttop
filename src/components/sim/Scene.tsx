"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { DECK_TOP, ROOF_LINE_LEN, STALLS, V3, roofDividers } from "@/lib/sim/layout";
import { Engine, Scenario } from "@/lib/sim/engine";

const COL = {
  surround: "#b6b0a2",
  asphalt: "#36322e",
  road: "#45413c",
  wall: "#efe7d8",
  deck: "#e3dbc9",
  column: "#d8d1c1",
  canopy: "#3f3a33",
  frame: "#f6f3ea",
  pad: "#cfc9bb",
  line: "#f5f3ee",
  roofBrown: "#7a6a55",
  rail: "#fafaf7",
  trunk: "#6b4f35",
  leaf1: "#4f7942",
  leaf2: "#5d8a4a",
};

interface Item {
  pos: V3;
  rot?: V3;
  scale?: V3;
}

function InstancedBoxes({
  items,
  size,
  color,
  castShadow = false,
}: {
  items: Item[];
  size: V3;
  color: string;
  castShadow?: boolean;
}) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    items.forEach((it, i) => {
      o.position.set(...it.pos);
      o.rotation.set(it.rot?.[0] ?? 0, it.rot?.[1] ?? 0, it.rot?.[2] ?? 0);
      o.scale.set(it.scale?.[0] ?? 1, it.scale?.[1] ?? 1, it.scale?.[2] ?? 1);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]} castShadow={castShadow}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} />
    </instancedMesh>
  );
}

// ------------------------------------------------------------- ground ----

function Ground() {
  return (
    <group>
      <mesh position={[0, -0.14, 10]} receiveShadow>
        <boxGeometry args={[400, 0.1, 300]} />
        <meshStandardMaterial color={COL.surround} />
      </mesh>
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[100, 0.12, 80]} />
        <meshStandardMaterial color={COL.asphalt} />
      </mesh>
      {/* south road runs directly in front of the house and gate area */}
      <mesh position={[0, -0.08, 44.5]} receiveShadow>
        <boxGeometry args={[400, 0.12, 9]} />
        <meshStandardMaterial color={COL.road} />
      </mesh>
      <mesh position={[0, -0.09, 95]} receiveShadow>
        <boxGeometry args={[11, 0.12, 110]} />
        <meshStandardMaterial color={COL.road} />
      </mesh>
    </group>
  );
}

function Walls() {
  const segs: { pos: V3; size: V3 }[] = [
    { pos: [0, 1.2, -40], size: [100.6, 2.4, 0.6] },
    { pos: [50, 1.2, 0], size: [0.6, 2.4, 80] },
    { pos: [-50, 1.2, 0], size: [0.6, 2.4, 80] },
    { pos: [-39.5, 1.2, 40], size: [21, 2.4, 0.6] },
    { pos: [39.5, 1.2, 40], size: [21, 2.4, 0.6] },
  ];
  return (
    <group>
      {segs.map((s, i) => (
        <mesh key={i} position={s.pos} castShadow receiveShadow>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={COL.wall} />
        </mesh>
      ))}
    </group>
  );
}

function HouseFrontWall() {
  const segments: { pos: V3; size: V3 }[] = [
    { pos: [-16.25, 1.05, 39.15], size: [12.5, 2.1, 0.72] },
    { pos: [16.25, 1.05, 39.15], size: [12.5, 2.1, 0.72] },
  ];
  const caps: V3[] = [
    [-22.5, 1.05, 39.15],
    [-10, 1.05, 39.15],
    [10, 1.05, 39.15],
    [22.5, 1.05, 39.15],
  ];
  return (
    <group>
      {segments.map((s, i) => (
        <mesh key={i} position={s.pos} castShadow receiveShadow>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={COL.wall} />
        </mesh>
      ))}
      {caps.map((pos, i) => (
        <mesh key={i} position={pos} castShadow receiveShadow>
          <cylinderGeometry args={[0.36, 0.36, 2.1, 18]} />
          <meshStandardMaterial color={COL.wall} />
        </mesh>
      ))}
    </group>
  );
}

// Long hip roof: ridge runs along the building's long axis with sloped ends,
// like the client's render.
function HipRoof({ position }: { position: V3 }) {
  const geom = useMemo(() => {
    const w = 12.4; // half length (x)
    const d = 4.5; // half depth (z)
    const h = 2.3; // ridge height
    const r = 7; // half ridge length
    const A: V3 = [-w, 0, -d];
    const B: V3 = [w, 0, -d];
    const C: V3 = [w, 0, d];
    const Dv: V3 = [-w, 0, d];
    const E: V3 = [-r, h, 0];
    const F: V3 = [r, h, 0];
    const tris: V3[] = [
      Dv, C, F, Dv, F, E, // front slope (+z)
      B, A, E, B, E, F, // back slope (-z)
      A, Dv, E, // west hip
      C, B, F, // east hip
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(tris.flat()), 3));
    g.computeVertexNormals();
    return g;
  }, []);
  return (
    <mesh geometry={geom} position={position} castShadow>
      <meshStandardMaterial color={COL.roofBrown} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Office() {
  return (
    <group position={[0, 0, 33.5]} rotation={[0, Math.PI, 0]}>
      <mesh position={[0, 1.6, 0]} castShadow receiveShadow>
        <boxGeometry args={[22, 3.2, 7]} />
        <meshStandardMaterial color={COL.wall} />
      </mesh>
      {/* eave slab + hip roof */}
      <mesh position={[0, 3.28, 0]} castShadow>
        <boxGeometry args={[24.8, 0.22, 9]} />
        <meshStandardMaterial color={COL.roofBrown} />
      </mesh>
      <HipRoof position={[0, 3.38, 0]} />
      {/* door + windows on the front face */}
      <mesh position={[0, 1.15, -3.55]}>
        <boxGeometry args={[1.6, 2.3, 0.1]} />
        <meshStandardMaterial color="#4a4640" />
      </mesh>
      {[-7.5, -4.5, 4.5, 7.5].map((x) => (
        <mesh key={x} position={[x, 1.8, -3.55]}>
          <boxGeometry args={[1.8, 1.1, 0.1]} />
          <meshStandardMaterial color="#7e8894" />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------ canopies ----

function CanopyRows() {
  const posts = useMemo(() => {
    const out: Item[] = [];
    for (let i = 0; i < 9; i++) {
      const z = -30.75 + i * 5.5;
      out.push({ pos: [-48.3, 1.55, z], scale: [1, 3.1, 1] });
      out.push({ pos: [-43.7, 1.18, z], scale: [1, 2.35, 1] });
      out.push({ pos: [48.3, 1.55, z], scale: [1, 3.1, 1] });
      out.push({ pos: [43.7, 1.18, z], scale: [1, 2.35, 1] });
    }
    return out;
  }, []);
  return (
    <group>
      <InstancedBoxes items={posts} size={[0.16, 1, 0.16]} color={COL.frame} />
      <mesh position={[-46, 2.75, -8.75]} rotation={[0, 0, -0.14]} castShadow>
        <boxGeometry args={[5.8, 0.14, 44.5]} />
        <meshStandardMaterial color={COL.canopy} metalness={0.35} roughness={0.6} />
      </mesh>
      <mesh position={[46, 2.75, -8.75]} rotation={[0, 0, 0.14]} castShadow>
        <boxGeometry args={[5.8, 0.14, 44.5]} />
        <meshStandardMaterial color={COL.canopy} metalness={0.35} roughness={0.6} />
      </mesh>
    </group>
  );
}

// ---------------------------------------------------------------- deck ----

function stadiumGeometry(width: number, length: number): THREE.ShapeGeometry {
  const r = width / 2;
  const half = length / 2 - r;
  const shape = new THREE.Shape();
  shape.absarc(0, half, r, 0, Math.PI, false);
  shape.absarc(0, -half, r, Math.PI, Math.PI * 2, false);
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 24);
}

// Three light stadium-shaped drive lanes; angled stalls (drawn by StallLines)
// occupy the dark strips between them, matching the client's render.
function RoofLanes() {
  const geom = useMemo(() => stadiumGeometry(4.6, 18), []);
  // dark V-notch cut into the north end of each pad, as in the render
  const notch = useMemo(() => {
    const s = new THREE.Shape();
    s.moveTo(-2.1, 8.8);
    s.lineTo(2.1, 8.8);
    s.lineTo(0, 4.3);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }, []);
  return (
    <group>
      {[-13, 0, 13].map((x) => (
        <group key={x}>
          <mesh geometry={geom} position={[x, DECK_TOP + 0.03, -10]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={COL.pad} />
          </mesh>
          <mesh geometry={notch} position={[x, DECK_TOP + 0.045, -10]} rotation={[-Math.PI / 2, 0, 0]}>
            <meshStandardMaterial color={COL.asphalt} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function DeckRailings() {
  const posts = useMemo(() => {
    const out: Item[] = [];
    const y = DECK_TOP + 0.52;
    for (let x = -20; x <= 20; x += 2) {
      out.push({ pos: [x, y, -25] });
      out.push({ pos: [x, y, 5] });
    }
    for (let z = -23; z <= 3; z += 2) out.push({ pos: [-20, y, z] });
    for (let z = -23; z <= 3; z += 2) {
      if (z > -19.5 && z < -12.5) continue; // ramp landing gap
      out.push({ pos: [20, y, z] });
    }
    return out;
  }, []);
  const rails: { pos: V3; size: V3 }[] = [
    { pos: [0, DECK_TOP + 1.05, -25], size: [40.2, 0.07, 0.07] },
    { pos: [0, DECK_TOP + 1.05, 5], size: [40.2, 0.07, 0.07] },
    { pos: [-20, DECK_TOP + 1.05, -10], size: [0.07, 0.07, 30.2] },
    { pos: [20, DECK_TOP + 1.05, -22.1], size: [0.07, 0.07, 6] },
    { pos: [20, DECK_TOP + 1.05, -3.9], size: [0.07, 0.07, 18] },
    { pos: [0, DECK_TOP + 0.55, -25], size: [40.2, 0.05, 0.05] },
    { pos: [0, DECK_TOP + 0.55, 5], size: [40.2, 0.05, 0.05] },
    { pos: [-20, DECK_TOP + 0.55, -10], size: [0.05, 0.05, 30.2] },
    { pos: [20, DECK_TOP + 0.55, -22.1], size: [0.05, 0.05, 6] },
    { pos: [20, DECK_TOP + 0.55, -3.9], size: [0.05, 0.05, 18] },
  ];
  return (
    <group>
      <InstancedBoxes items={posts} size={[0.08, 1.05, 0.08]} color={COL.rail} />
      {rails.map((r, i) => (
        <mesh key={i} position={r.pos}>
          <boxGeometry args={r.size} />
          <meshStandardMaterial color={COL.rail} />
        </mesh>
      ))}
    </group>
  );
}

function Stairs() {
  const steps = useMemo(() => {
    const out: { pos: V3; size: V3 }[] = [];
    const n = 10;
    for (let i = 0; i < n; i++) {
      const h = DECK_TOP - 0.34 * i;
      out.push({ pos: [-21.9, h / 2, -5 + 0.95 * (i + 0.5)], size: [3.4, h, 0.95] });
    }
    return out;
  }, []);
  return (
    <group>
      {steps.map((s, i) => (
        <mesh key={i} position={s.pos} castShadow receiveShadow>
          <boxGeometry args={s.size} />
          <meshStandardMaterial color={COL.wall} />
        </mesh>
      ))}
      {/* side wall */}
      <mesh position={[-23.75, 1.9, -0.5]} rotation={[0, 0, 0]} castShadow>
        <boxGeometry args={[0.25, 0.9, 10]} />
        <meshStandardMaterial color={COL.rail} />
      </mesh>
    </group>
  );
}

function Deck() {
  const columns = useMemo(() => {
    // placed on stall-edge x positions so no column blocks a stall approach
    const out: V3[] = [];
    for (const x of [-19.25, -8.25, 8.25, 19.25])
      for (const z of [-23.5, -15, -6.5, 3.5]) out.push([x, 1.42, z]);
    return out;
  }, []);
  return (
    <group>
      <mesh position={[0, 3.12, -10]} castShadow receiveShadow>
        <boxGeometry args={[40, 0.55, 30]} />
        <meshStandardMaterial color={COL.deck} />
      </mesh>
      {/* dark asphalt wearing surface on the deck top */}
      <mesh position={[0, 3.405, -10]} receiveShadow>
        <boxGeometry args={[39.4, 0.02, 29.4]} />
        <meshStandardMaterial color={COL.asphalt} />
      </mesh>
      {columns.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.38, 0.42, 2.85, 12]} />
          <meshStandardMaterial color={COL.column} />
        </mesh>
      ))}
      <RoofLanes />
      <DeckRailings />
      <Stairs />
    </group>
  );
}

// Ramp sits flush against the deck's east face (x 20..28) — no gap.
function Ramp() {
  const slope = Math.atan(3.4 / 26);
  return (
    <group>
      <mesh position={[24, 1.7, 0]} rotation={[slope, 0, 0]} castShadow receiveShadow>
        <boxGeometry args={[8, 0.3, 26.4]} />
        <meshStandardMaterial color={COL.deck} />
      </mesh>
      <mesh position={[24, 1.87, 0]} rotation={[slope, 0, 0]} receiveShadow>
        <boxGeometry args={[7.6, 0.02, 26.2]} />
        <meshStandardMaterial color={COL.asphalt} />
      </mesh>
      {/* outer (east) ramp rail */}
      <mesh position={[27.9, 2.3, 0]} rotation={[slope, 0, 0]}>
        <boxGeometry args={[0.12, 0.9, 26.4]} />
        <meshStandardMaterial color={COL.rail} />
      </mesh>
      {/* landing connecting ramp to deck */}
      <mesh position={[24, 3.12, -16]} castShadow receiveShadow>
        <boxGeometry args={[8, 0.55, 6]} />
        <meshStandardMaterial color={COL.deck} />
      </mesh>
      <mesh position={[24, 3.405, -16]} receiveShadow>
        <boxGeometry args={[7.6, 0.02, 5.8]} />
        <meshStandardMaterial color={COL.asphalt} />
      </mesh>
      <mesh position={[24, 3.85, -19]}>
        <boxGeometry args={[8, 0.9, 0.12]} />
        <meshStandardMaterial color={COL.rail} />
      </mesh>
      <mesh position={[28, 3.85, -16]}>
        <boxGeometry args={[0.12, 0.9, 6]} />
        <meshStandardMaterial color={COL.rail} />
      </mesh>
      {/* supports */}
      {[
        [21, 1.15, -6, 2.3],
        [27, 1.15, -6, 2.3],
        [21, 0.5, 4, 1.0],
        [27, 0.5, 4, 1.0],
        [21, 1.45, -16, 2.9],
        [27, 1.45, -16, 2.9],
      ].map(([x, y, z, h], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[0.3, 0.3, h, 10]} />
          <meshStandardMaterial color={COL.column} />
        </mesh>
      ))}
    </group>
  );
}

// ------------------------------------------------------------ markings ----

function StallLines() {
  const { carItems, motorItems } = useMemo(() => {
    const carItems: Item[] = [];
    const motorItems: Item[] = [];
    for (const s of STALLS) {
      if (s.roof) continue;
      const px = Math.cos(s.heading);
      const pz = -Math.sin(s.heading);
      const isMotor = s.vehicle === "motor";
      const halfWidth = isMotor ? 1.35 : 2.7;
      const items = isMotor ? motorItems : carItems;
      for (const side of [-halfWidth, halfWidth]) {
        items.push({
          pos: [s.pos[0] + px * side, 0.025, s.pos[2] + pz * side],
          rot: [0, s.heading, 0],
        });
      }
    }
    return { carItems, motorItems };
  }, []);
  // Roof: stall dividers anchored at the pad edge, extending one stall-depth
  // outward at 45° so opposite flanks form chevrons at the strip midline and
  // nothing spills past the pad ends (shared geometry with the stalls).
  const roofItems = useMemo<Item[]>(
    () => roofDividers().map((d) => ({ pos: d.pos, rot: [0, d.rotY, 0] })),
    [],
  );
  return (
    <group>
      <InstancedBoxes items={carItems} size={[0.14, 0.02, 5.2]} color={COL.line} />
      <InstancedBoxes items={motorItems} size={[0.1, 0.02, 3.7]} color={COL.line} />
      <InstancedBoxes items={roofItems} size={[0.14, 0.02, ROOF_LINE_LEN]} color={COL.line} />
    </group>
  );
}

// --------------------------------------------------------------- gates ----

function GateArm({
  pivot,
  dir,
  isOpen,
}: {
  pivot: V3;
  dir: 1 | -1;
  isOpen: () => boolean;
}) {
  const arm = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!arm.current) return;
    const target = isOpen() ? -1.32 * dir : 0;
    arm.current.rotation.z += (target - arm.current.rotation.z) * Math.min(1, dt * 5);
  });
  return (
    <group position={pivot}>
      <mesh position={[0, -0.35, 0]}>
        <boxGeometry args={[0.45, 1.5, 0.45]} />
        <meshStandardMaterial color="#5a6068" />
      </mesh>
      <group ref={arm}>
        <mesh position={[-3.5 * dir, 0, 0]}>
          <boxGeometry args={[7, 0.16, 0.16]} />
          <meshStandardMaterial color="#f2f0ea" />
        </mesh>
        <mesh position={[-6.4 * dir, 0, 0]}>
          <boxGeometry args={[1.2, 0.18, 0.18]} />
          <meshStandardMaterial color="#d24034" />
        </mesh>
      </group>
    </group>
  );
}

function Gates({ engine }: { engine: Engine }) {
  return (
    <group>
      {/* booths */}
      <mesh position={[30.8, 1.3, 41]} castShadow>
        <boxGeometry args={[2.2, 2.6, 2.2]} />
        <meshStandardMaterial color={COL.wall} />
      </mesh>
      <mesh position={[-30.8, 1.3, 41]} castShadow>
        <boxGeometry args={[2.2, 2.6, 2.2]} />
        <meshStandardMaterial color={COL.wall} />
      </mesh>
      <GateArm pivot={[28.9, 1.1, 41]} dir={1} isOpen={() => engine.simTime < engine.gateInBusyUntil} />
      <GateArm pivot={[-28.9, 1.1, 41]} dir={-1} isOpen={() => engine.simTime < engine.gateOutBusyUntil} />
    </group>
  );
}

// -------------------------------------------------------------- labels ----

function TextSprite({
  text,
  bg,
  position,
  width = 13,
}: {
  text: string;
  bg: string;
  position: V3;
  width?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 144;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    const r = 28;
    ctx.beginPath();
    ctx.roundRect(6, 6, 500, 132, r);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 76);
    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = 4;
    return tex;
  }, [text, bg]);
  return (
    <sprite position={position} scale={[width, width * 0.28, 1]}>
      <spriteMaterial map={texture} transparent depthWrite={false} />
    </sprite>
  );
}

// --------------------------------------------------------------- trees ----

function Tree({ pos, s = 1 }: { pos: V3; s?: number }) {
  return (
    <group position={pos} scale={s}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.32, 2.8, 8]} />
        <meshStandardMaterial color={COL.trunk} />
      </mesh>
      <mesh position={[0, 3.6, 0]} castShadow>
        <sphereGeometry args={[1.9, 12, 10]} />
        <meshStandardMaterial color={COL.leaf1} />
      </mesh>
      <mesh position={[1.1, 2.9, 0.4]} castShadow>
        <sphereGeometry args={[1.2, 10, 8]} />
        <meshStandardMaterial color={COL.leaf2} />
      </mesh>
      <mesh position={[-0.9, 3.0, -0.5]} castShadow>
        <sphereGeometry args={[1.3, 10, 8]} />
        <meshStandardMaterial color={COL.leaf2} />
      </mesh>
    </group>
  );
}

function StaticCar({ pos, heading, color }: { pos: V3; heading: number; color: string }) {
  return (
    <group position={pos} rotation={[0, heading, 0]}>
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[1.85, 0.6, 4.3]} />
        <meshStandardMaterial color={color} metalness={0.25} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.12, -0.25]} castShadow>
        <boxGeometry args={[1.6, 0.52, 2.1]} />
        <meshStandardMaterial color="#2b3138" metalness={0.4} roughness={0.25} />
      </mesh>
      {([
        [-0.92, 1.35],
        [0.92, 1.35],
        [-0.92, -1.35],
        [0.92, -1.35],
      ] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 0.34, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.34, 0.34, 0.26, 12]} />
          <meshStandardMaterial color="#15161a" />
        </mesh>
      ))}
    </group>
  );
}

function IllegalParking() {
  const cars: { pos: V3; heading: number; color: string }[] = [
    { pos: [-42, 0, 39.6], heading: Math.PI / 2, color: "#c43a30" },
    { pos: [-34, 0, 49.8], heading: -Math.PI / 2, color: "#e0c23a" },
    { pos: [-18, 0, 39.6], heading: Math.PI / 2, color: "#37a394" },
    { pos: [10, 0, 49.8], heading: -Math.PI / 2, color: "#f4f4f2" },
    { pos: [26, 0, 39.6], heading: Math.PI / 2, color: "#3a6fb8" },
    { pos: [44, 0, 49.8], heading: -Math.PI / 2, color: "#8a9097" },
    { pos: [-2.8, 0, 72], heading: 0, color: "#3f9c5c" },
    { pos: [2.8, 0, 87], heading: Math.PI, color: "#d98e2b" },
  ];
  return (
    <group>
      {cars.map((car, i) => (
        <StaticCar key={i} {...car} />
      ))}
    </group>
  );
}

function VacantLot() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]} receiveShadow>
        <boxGeometry args={[92, 0.02, 72]} />
        <meshStandardMaterial color="#2f2c28" roughness={0.85} />
      </mesh>
      <InstancedBoxes
        items={[
          { pos: [-46, 0.04, 0] },
          { pos: [46, 0.04, 0] },
          { pos: [0, 0.04, -36], rot: [0, Math.PI / 2, 0] },
        ]}
        size={[0.08, 0.03, 72]}
        color="#d8d1c1"
      />
      <IllegalParking />
      <Tree pos={[-44, 0, -34]} s={1.1} />
      <Tree pos={[44, 0, -34]} />
      <Tree pos={[-44, 0, 30]} s={0.95} />
      <Tree pos={[44, 0, 30]} s={1.05} />
    </group>
  );
}

export default function Scene({ engine, scenario }: { engine: Engine; scenario: Scenario }) {
  if (scenario === "before") {
    return (
      <group>
        <Ground />
        <VacantLot />
      </group>
    );
  }
  return (
    <group>
      <Ground />
      <Walls />
      <Office />
      <HouseFrontWall />
      <CanopyRows />
      <Deck />
      <Ramp />
      <StallLines />
      <Gates engine={engine} />
      <TextSprite text="ENTRANCE" bg="#1f8a4c" position={[25, 5.6, 44]} width={8.5} />
      <TextSprite text="EXIT" bg="#c43a30" position={[-25, 5.15, 44]} width={5.6} />
      <Tree pos={[-44, 0, -34]} s={1.1} />
      <Tree pos={[44, 0, -34]} />
      <Tree pos={[-44, 0, 30]} s={0.95} />
      <Tree pos={[44, 0, 30]} s={1.05} />
      <Tree pos={[16, 0, 33.5]} s={0.8} />
      <Tree pos={[-16, 0, 33.5]} s={0.85} />
    </group>
  );
}
