// Traffic-flow engine for the parking simulation.
// All durations are in simulated seconds. The clock wraps every 24h.
// Arrival rates follow the client's schedule:
//   12mn-6am quiet | 6-8am RUSH | 8-11am normal | 11am-1pm RUSH
//   1-3pm normal   | 3-8pm RUSH | 8pm-12mn normal

import {
  EntranceId,
  Route,
  STALLS,
  SPAWN,
  SPAWN_NORTH,
  buildRoute,
  entranceQueuePoint,
  exitQueuePoint,
  inboundWaypoints,
  leaveWaypoints,
  outboundReverse,
  outboundWaypoints,
  routePoint,
  V3,
} from "./layout";

export type CarState = "road" | "queueIn" | "driveIn" | "parked" | "driveOut" | "queueOut" | "leave";
export type Mode = "auto" | "peak" | "off";
export type Phase = "rush" | "normal" | "night";

export interface CarObj {
  id: number;
  color: string;
  state: CarState;
  x: number;
  y: number;
  z: number;
  heading: number;
  legs: { route: Route; rev: boolean }[];
  legIdx: number;
  dist: number;
  stallId: number;
  entrance: EntranceId;
  departAt: number;
}

export interface Snapshot {
  clockMin: number;
  phase: Phase;
  occupied: number;
  totalStalls: number;
  queueIn: number;
  queueOut: number;
  entered: number;
  exited: number;
  timeScale: number;
  paused: boolean;
  mode: Mode;
}

const GATE_SERVICE = 12; // sim seconds per car at a barrier
const RUSH_RATE = 130; // parking arrivals per hour
const NORMAL_RATE = 20;
const NIGHT_RATE = 4;
const ROAD_RUSH_RATE = 900; // passing road cars per hour
const ROAD_NORMAL_RATE = 220;
const ROAD_NIGHT_RATE = 30;
const DRIVE_SPEED = 7; // m per sim second
const REVERSE_SPEED = 2.4;
const QUEUE_SPEED = 4.5;
const MAX_ENTRANCE_QUEUE = 10;
const MAX_ROAD_CARS = 34;

export const RUSH_WINDOWS: [number, number][] = [
  [360, 480], // 6 AM - 8 AM
  [660, 780], // 11 AM - 1 PM
  [900, 1200], // 3 PM - 8 PM
];

const COLORS = [
  "#b8413a", "#3a6fb8", "#d98e2b", "#8a9097", "#3f9c5c", "#e0c23a",
  "#e8e6e1", "#3c4654", "#7d56a8", "#37a394", "#a85a2e", "#c4c7cc",
  "#26303d", "#f4f4f2", "#1d1f22", "#5e7d9c",
];

const ROAD_ROUTES: V3[][] = [
  [
    [96, 0, 42.5],
    [-96, 0, 42.5],
  ],
  [
    [-96, 0, 45.5],
    [96, 0, 45.5],
  ],
  [
    [0, 0, 140],
    [0, 0, 45.5],
    [72, 0, 45.5],
  ],
  [
    [96, 0, -48.5],
    [-96, 0, -48.5],
  ],
  [
    [-96, 0, -45.5],
    [96, 0, -45.5],
  ],
  [
    [72, 0, -148],
    [72, 0, -48.5],
    [-72, 0, -48.5],
  ],
  [
    [75, 0, -48.5],
    [75, 0, -148],
  ],
];

function angleDamp(current: number, target: number, k: number): number {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * Math.min(1, k);
}

export class Engine {
  simTime = 7 * 3600;
  timeScale = 15;
  paused = false;
  mode: Mode = "auto";

  cars: CarObj[] = [];
  stallFree: boolean[] = STALLS.map(() => true);
  entranceQ: CarObj[] = [];
  entranceQNorth: CarObj[] = [];
  exitQ: CarObj[] = [];
  gateInBusyUntil = 0;
  gateInNorthBusyUntil = 0;
  gateOutBusyUntil = 0;
  entered = 0;
  exited = 0;

  version = 0;
  private nextId = 1;
  private listeners = new Set<() => void>();

  constructor() {
    this.jumpTo(7 * 60);
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getVersion = (): number => this.version;

  private bump() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  clockSec(): number {
    return ((this.simTime % 86400) + 86400) % 86400;
  }

  phase(): Phase {
    if (this.mode === "peak") return "rush";
    if (this.mode === "off") return "normal";
    const min = this.clockSec() / 60;
    if (min < 360) return "night";
    if (RUSH_WINDOWS.some(([a, b]) => min >= a && min < b)) return "rush";
    return "normal";
  }

  private arrivalRate(): number {
    const p = this.phase();
    return p === "rush" ? RUSH_RATE : p === "normal" ? NORMAL_RATE : NIGHT_RATE;
  }

  private roadRate(): number {
    const p = this.phase();
    return p === "rush" ? ROAD_RUSH_RATE : p === "normal" ? ROAD_NORMAL_RATE : ROAD_NIGHT_RATE;
  }

  private dwellSec(): number {
    return (20 + Math.random() * 55) * 60;
  }

  private freeStallIds(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.stallFree.length; i++) if (this.stallFree[i]) out.push(i);
    return out;
  }

  private pickStall(): number | null {
    const free = this.freeStallIds();
    if (free.length === 0) return null;
    const ground = free.filter((i) => !STALLS[i].roof);
    const roof = free.filter((i) => STALLS[i].roof);
    const pool = ground.length && (roof.length === 0 || Math.random() < 0.68) ? ground : roof;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  private makeCar(state: CarState, pos: V3, heading: number): CarObj {
    return {
      id: this.nextId++,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      state,
      x: pos[0],
      y: pos[1],
      z: pos[2],
      heading,
      legs: [],
      legIdx: 0,
      dist: 0,
      stallId: -1,
      entrance: "east",
      departAt: 0,
    };
  }

  private spawnParkingArrival() {
    const entrance = this.pickEntrance();
    const car = this.makeCar("queueIn", entrance === "north" ? SPAWN_NORTH : SPAWN, -Math.PI / 2);
    car.entrance = entrance;
    this.cars.push(car);
    this.entranceQueue(entrance).push(car);
    this.bump();
  }

  private entranceQueue(entrance: EntranceId): CarObj[] {
    return entrance === "north" ? this.entranceQNorth : this.entranceQ;
  }

  private pickEntrance(): EntranceId {
    const eastLoad = this.entranceQ.length + (this.simTime < this.gateInBusyUntil ? 1 : 0);
    const northLoad = this.entranceQNorth.length + (this.simTime < this.gateInNorthBusyUntil ? 1 : 0);
    if (eastLoad === northLoad) return Math.random() < 0.5 ? "east" : "north";
    return northLoad < eastLoad ? "north" : "east";
  }

  private spawnRoadCar() {
    const pts = ROAD_ROUTES[Math.floor(Math.random() * ROAD_ROUTES.length)];
    this.cars.push(this.makeRoadCar(pts));
    this.bump();
  }

  private makeRoadCar(pts: V3[], dist = 0): CarObj {
    const next = pts[1];
    const start = pts[0];
    const car = this.makeCar("road", start, Math.atan2(next[0] - start[0], next[2] - start[2]));
    const route = buildRoute(pts, 6);
    car.legs = [{ route, rev: false }];
    car.dist = Math.min(dist, Math.max(0, route.len - 1));
    if (car.dist > 0) {
      const p = routePoint(route, car.dist);
      const q = routePoint(route, Math.min(route.len, car.dist + 1));
      car.x = p[0];
      car.y = p[1];
      car.z = p[2];
      car.heading = Math.atan2(q[0] - p[0], q[2] - p[2]);
    }
    return car;
  }

  private seedRoadTraffic(phase: Phase) {
    const count = phase === "rush" ? 18 : phase === "normal" ? 8 : 3;
    for (let i = 0; i < count; i++) {
      const pts = ROAD_ROUTES[i % ROAD_ROUTES.length];
      const route = buildRoute(pts, 6);
      this.cars.push(this.makeRoadCar(pts, Math.random() * route.len * 0.92));
    }
  }

  /** Jump the clock to a minute-of-day and reseed a plausible lot state. */
  jumpTo(minOfDay: number) {
    const day = Math.floor(this.simTime / 86400);
    this.simTime = day * 86400 + minOfDay * 60;
    if (this.simTime < 0) this.simTime += 86400;
    this.cars = [];
    this.entranceQ = [];
    this.entranceQNorth = [];
    this.exitQ = [];
    this.stallFree = STALLS.map(() => true);
    this.gateInBusyUntil = 0;
    this.gateInNorthBusyUntil = 0;
    this.gateOutBusyUntil = 0;

    const p = this.phase();
    const fill = p === "rush" ? 0.78 : p === "normal" ? 0.34 : 0.08;
    for (const s of STALLS) {
      if (Math.random() < fill) {
        const car = this.makeCar("parked", s.pos, s.heading);
        car.stallId = s.id;
        car.departAt = this.simTime + this.dwellSec() * (0.15 + Math.random() * 0.85);
        this.stallFree[s.id] = false;
        this.cars.push(car);
      }
    }
    if (p === "rush") {
      for (let i = 0; i < 4; i++) {
        const entrance: EntranceId = i % 2 === 0 ? "east" : "north";
        const pt = entranceQueuePoint(Math.floor(i / 2), entrance);
        const car = this.makeCar("queueIn", pt, -Math.PI / 2);
        car.entrance = entrance;
        this.cars.push(car);
        this.entranceQueue(entrance).push(car);
      }
    }
    this.seedRoadTraffic(p);
    this.bump();
  }

  tick(dtReal: number) {
    if (this.paused || dtReal <= 0) return;
    const dt = dtReal * this.timeScale;
    this.simTime += dt;

    // Poisson-ish parking arrivals: road cars that turn into the entrance.
    const lambda = this.arrivalRate() / 3600;
    if (
      Math.random() < lambda * dt &&
      this.entranceQ.length + this.entranceQNorth.length < MAX_ENTRANCE_QUEUE * 2 &&
      this.cars.length < 90
    ) {
      this.spawnParkingArrival();
    }

    // Separate through-traffic so the outside road stays busy even when only
    // some passing cars decide to park.
    const roadLambda = this.roadRate() / 3600;
    const roadCars = this.cars.filter((car) => car.state === "road").length;
    if (Math.random() < roadLambda * dt && roadCars < MAX_ROAD_CARS) {
      this.spawnRoadCar();
    }

    this.processGates();
    for (const car of [...this.cars]) this.updateCar(car, dt, dtReal);
  }

  private near(car: CarObj, p: V3, eps: number): boolean {
    return Math.hypot(car.x - p[0], car.z - p[2]) < eps;
  }

  private processGates() {
    this.processEntranceGate("east");
    this.processEntranceGate("north");
    const ofront = this.exitQ[0];
    if (ofront && this.simTime >= this.gateOutBusyUntil && this.near(ofront, exitQueuePoint(0), 1.6)) {
      this.exitQ.shift();
      ofront.legs = [{ route: buildRoute(leaveWaypoints([ofront.x, 0, ofront.z])), rev: false }];
      ofront.legIdx = 0;
      ofront.dist = 0;
      ofront.state = "leave";
      this.gateOutBusyUntil = this.simTime + GATE_SERVICE;
    }
  }

  private processEntranceGate(entrance: EntranceId) {
    const queue = this.entranceQueue(entrance);
    const gateBusyUntil = entrance === "north" ? this.gateInNorthBusyUntil : this.gateInBusyUntil;
    const front = queue[0];
    if (front && this.simTime >= gateBusyUntil && this.near(front, entranceQueuePoint(0, entrance), 1.6)) {
      const stallId = this.pickStall();
      if (stallId !== null) {
        const s = STALLS[stallId];
        this.stallFree[stallId] = false;
        queue.shift();
        front.legs = [{ route: buildRoute(inboundWaypoints(s, [front.x, 0, front.z], entrance)), rev: false }];
        front.legIdx = 0;
        front.dist = 0;
        front.stallId = stallId;
        front.state = "driveIn";
        if (entrance === "north") this.gateInNorthBusyUntil = this.simTime + GATE_SERVICE;
        else this.gateInBusyUntil = this.simTime + GATE_SERVICE;
        this.entered++;
      }
    }
  }

  private moveTowards(car: CarObj, target: V3, speed: number, dt: number, dtReal: number) {
    const dx = target[0] - car.x;
    const dz = target[2] - car.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.06) return;
    const step = Math.min(d, speed * dt);
    car.x += (dx / d) * step;
    car.z += (dz / d) * step;
    car.heading = angleDamp(car.heading, Math.atan2(dx, dz), dtReal * 6);
  }

  private followLegs(car: CarObj, dt: number, dtReal: number): boolean {
    const leg = car.legs[car.legIdx];
    if (!leg) return true;
    const base = leg.rev ? REVERSE_SPEED : DRIVE_SPEED;
    const isLastLeg = car.legIdx === car.legs.length - 1;
    const rem = leg.route.len - car.dist;
    const ease = isLastLeg ? Math.max(0.32, Math.min(1, rem / 7 + 0.2)) : 1;
    car.dist += base * ease * dt;

    if (car.dist >= leg.route.len) {
      const end = leg.route.pts[leg.route.pts.length - 1];
      car.x = end[0];
      car.y = end[1];
      car.z = end[2];
      car.legIdx++;
      car.dist = 0;
      return car.legIdx >= car.legs.length;
    }
    const p = routePoint(leg.route, car.dist);
    const q = routePoint(leg.route, Math.min(leg.route.len, car.dist + 0.8));
    car.x = p[0];
    car.y = p[1];
    car.z = p[2];
    let dx = q[0] - p[0];
    let dz = q[2] - p[2];
    if (leg.rev) {
      dx = -dx;
      dz = -dz;
    }
    if (Math.hypot(dx, dz) > 1e-4) {
      car.heading = angleDamp(car.heading, Math.atan2(dx, dz), dtReal * 8);
    }
    return false;
  }

  private updateCar(car: CarObj, dt: number, dtReal: number) {
    switch (car.state) {
      case "road": {
        if (this.followLegs(car, dt, dtReal)) {
          const i = this.cars.indexOf(car);
          if (i >= 0) this.cars.splice(i, 1);
          this.bump();
        }
        break;
      }
      case "queueIn": {
        const queue = this.entranceQueue(car.entrance);
        const idx = queue.indexOf(car);
        if (idx >= 0) this.moveTowards(car, entranceQueuePoint(idx, car.entrance), QUEUE_SPEED, dt, dtReal);
        break;
      }
      case "driveIn": {
        if (this.followLegs(car, dt, dtReal)) {
          const s = STALLS[car.stallId];
          car.x = s.pos[0];
          car.y = s.pos[1];
          car.z = s.pos[2];
          car.heading = s.heading;
          car.state = "parked";
          car.departAt = this.simTime + this.dwellSec();
        }
        break;
      }
      case "parked": {
        if (this.simTime >= car.departAt) {
          const s = STALLS[car.stallId];
          this.stallFree[s.id] = true;
          car.legs = [
            { route: buildRoute(outboundReverse(s), 1), rev: true },
            { route: buildRoute(outboundWaypoints(s)), rev: false },
          ];
          car.legIdx = 0;
          car.dist = 0;
          car.state = "driveOut";
        }
        break;
      }
      case "driveOut": {
        if (this.followLegs(car, dt, dtReal)) {
          car.state = "queueOut";
          this.exitQ.push(car);
        }
        break;
      }
      case "queueOut": {
        const idx = this.exitQ.indexOf(car);
        if (idx >= 0) this.moveTowards(car, exitQueuePoint(idx), QUEUE_SPEED, dt, dtReal);
        break;
      }
      case "leave": {
        if (this.followLegs(car, dt, dtReal)) {
          const i = this.cars.indexOf(car);
          if (i >= 0) this.cars.splice(i, 1);
          this.exited++;
          this.bump();
        }
        break;
      }
    }
  }

  snapshot(): Snapshot {
    return {
      clockMin: Math.floor(this.clockSec() / 60),
      phase: this.phase(),
      occupied: this.stallFree.filter((f) => !f).length,
      totalStalls: STALLS.length,
      queueIn: this.entranceQ.length + this.entranceQNorth.length,
      queueOut: this.exitQ.length,
      entered: this.entered,
      exited: this.exited,
      timeScale: this.timeScale,
      paused: this.paused,
      mode: this.mode,
    };
  }
}
