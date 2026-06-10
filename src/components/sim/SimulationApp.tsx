"use client";

import { useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Engine, Mode, Phase, Scenario, Snapshot } from "@/lib/sim/engine";
import Scene from "./Scene";
import { Cars, DayNight, Ticker } from "./Cars";

function fmtClock(min: number): string {
  const h24 = Math.floor(min / 60);
  const m = min % 60;
  const ampm = h24 < 12 ? "AM" : "PM";
  const h = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
}

const PHASE_UI: Record<Phase, { label: string; cls: string }> = {
  rush: { label: "PEAK / RUSH HOURS", cls: "bg-red-500/90 text-white" },
  normal: { label: "NON-PEAK (NORMAL)", cls: "bg-emerald-500/90 text-white" },
  night: { label: "LATE NIGHT (QUIET)", cls: "bg-indigo-500/90 text-white" },
};

const SCHEDULE: { from: number; to: number; label: string; phase: Phase }[] = [
  { from: 0, to: 360, label: "12 MN – 6 AM", phase: "night" },
  { from: 360, to: 480, label: "6 AM – 8 AM", phase: "rush" },
  { from: 480, to: 660, label: "8 AM – 11 AM", phase: "normal" },
  { from: 660, to: 780, label: "11 AM – 1 PM", phase: "rush" },
  { from: 780, to: 900, label: "1 PM – 3 PM", phase: "normal" },
  { from: 900, to: 1200, label: "3 PM – 8 PM", phase: "rush" },
  { from: 1200, to: 1440, label: "8 PM – 12 MN", phase: "normal" },
];

const JUMPS: { label: string; min: number }[] = [
  { label: "1 AM", min: 60 },
  { label: "7 AM", min: 420 },
  { label: "9 AM", min: 540 },
  { label: "12 NN", min: 720 },
  { label: "5 PM", min: 1020 },
  { label: "9 PM", min: 1260 },
];

function Btn({
  active,
  onClick,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-amber-400 text-zinc-900"
          : "bg-white/10 text-zinc-200 hover:bg-white/20"
      }`}
    >
      {children}
    </button>
  );
}

export default function SimulationApp() {
  // The engine is seeded with random data, so it must only exist on the
  // client — creating it during SSR causes hydration mismatches.
  const [engine, setEngine] = useState<Engine | null>(null);
  useEffect(() => {
    const id = window.setTimeout(() => setEngine(new Engine()), 0);
    return () => window.clearTimeout(id);
  }, []);
  if (!engine) return <div className="h-dvh w-full bg-black" />;
  return <SimulationView engine={engine} />;
}

function SimulationView({ engine }: { engine: Engine }) {
  const [snap, setSnap] = useState<Snapshot>(() => engine.snapshot());

  useEffect(() => {
    const id = setInterval(() => setSnap(engine.snapshot()), 200);
    return () => clearInterval(id);
  }, [engine]);

  const setMode = (m: Mode) => {
    engine.setMode(m);
  };
  const setScenario = (s: Scenario) => {
    engine.setScenario(s);
  };
  const setSpeed = (s: number) => {
    engine.setSpeed(s);
  };

  const occPct = snap.totalStalls > 0 ? Math.round((snap.occupied / snap.totalStalls) * 100) : 0;
  const phaseUi = PHASE_UI[snap.phase];

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-black">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [85, 68, 95], fov: 42, near: 1, far: 1200 }}
      >
        <DayNight engine={engine} />
        <Scene engine={engine} scenario={snap.scenario} />
        <Cars engine={engine} />
        <Ticker engine={engine} />
        <OrbitControls
          target={[0, 0, 2]}
          maxPolarAngle={Math.PI * 0.46}
          minDistance={25}
          maxDistance={280}
          enableDamping
        />
      </Canvas>

      {/* ----- left control panel ----- */}
      <div className="absolute left-4 top-4 w-80 max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl bg-zinc-950/75 p-4 text-white shadow-2xl backdrop-blur-md">
        <div>
          <h1 className="text-sm font-bold tracking-wide">
            PARKING AREA — 3D TRAFFIC FLOW SIMULATION
          </h1>
          <p className="text-[11px] text-zinc-400">
            Daloy ng mga sasakyang papasok at lalabas — peak at non-peak hours
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="font-mono text-3xl font-bold tabular-nums">
            {fmtClock(snap.clockMin)}
          </div>
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold ${phaseUi.cls}`}>
            {phaseUi.label}
          </span>
        </div>

        {/* occupancy */}
        <div>
          <div className="mb-1 flex justify-between text-[11px] text-zinc-300">
            <span>Occupied stalls</span>
            <span className="font-mono">
              {snap.occupied}/{snap.totalStalls} ({occPct}%)
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-all ${
                occPct > 85 ? "bg-red-500" : occPct > 60 ? "bg-amber-400" : "bg-emerald-400"
              }`}
              style={{ width: `${occPct}%` }}
            />
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Scenario</div>
          <div className="flex gap-1.5">
            <Btn active={snap.scenario === "after"} onClick={() => setScenario("after")}>
              With parking
            </Btn>
            <Btn active={snap.scenario === "before"} onClick={() => setScenario("before")}>
              Before lot
            </Btn>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Queue in", snap.queueIn],
            ["Queue out", snap.queueOut],
            ["Entered", snap.entered],
            ["Exited", snap.exited],
          ].map(([label, value]) => (
            <div key={label as string} className="rounded-lg bg-white/5 px-1 py-1.5">
              <div className="font-mono text-base font-bold tabular-nums">{value}</div>
              <div className="text-[9px] uppercase tracking-wide text-zinc-400">{label}</div>
            </div>
          ))}
        </div>

        {/* speed */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">
            Simulation speed
          </div>
          <div className="flex gap-1.5">
            <Btn active={snap.paused} onClick={() => engine.togglePaused()}>
              {snap.paused ? "▶ Play" : "⏸ Pause"}
            </Btn>
            {[5, 15, 60].map((s) => (
              <Btn key={s} active={!snap.paused && snap.timeScale === s} onClick={() => setSpeed(s)}>
                ×{s}
              </Btn>
            ))}
          </div>
        </div>

        {/* mode */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Traffic mode</div>
          <div className="flex gap-1.5">
            <Btn active={snap.mode === "auto"} onClick={() => setMode("auto")}>
              Auto (clock)
            </Btn>
            <Btn active={snap.mode === "peak"} onClick={() => setMode("peak")}>
              Force peak
            </Btn>
            <Btn active={snap.mode === "off"} onClick={() => setMode("off")}>
              Force off-peak
            </Btn>
          </div>
        </div>

        {/* jump */}
        <div className="space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400">Jump to time</div>
          <div className="flex flex-wrap gap-1.5">
            {JUMPS.map((j) => (
              <Btn key={j.label} onClick={() => engine.jumpTo(j.min)}>
                {j.label}
              </Btn>
            ))}
          </div>
        </div>
      </div>

      {/* ----- schedule card ----- */}
      <div className="absolute right-4 top-4 hidden w-56 rounded-2xl bg-zinc-950/75 p-4 text-white shadow-2xl backdrop-blur-md sm:block">
        <h2 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-300">
          Daily schedule
        </h2>
        <ul className="space-y-1">
          {SCHEDULE.map((row) => {
            const active = snap.clockMin >= row.from && snap.clockMin < row.to;
            return (
              <li
                key={row.label}
                className={`flex items-center justify-between rounded-md px-2 py-1 text-[11px] ${
                  active ? "bg-white/15 font-semibold" : "text-zinc-400"
                }`}
              >
                <span className="font-mono">{row.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                    row.phase === "rush"
                      ? "bg-red-500/80 text-white"
                      : row.phase === "normal"
                        ? "bg-emerald-500/70 text-white"
                        : "bg-indigo-500/70 text-white"
                  }`}
                >
                  {row.phase === "rush" ? "RUSH" : row.phase === "normal" ? "NORMAL" : "QUIET"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ----- hint ----- */}
      <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-zinc-950/60 px-4 py-1.5 text-[11px] text-zinc-300 backdrop-blur">
        Drag to orbit · scroll to zoom · right-drag to pan
      </div>
    </div>
  );
}
