// Geometry layout of the parking facility, derived from the client's renders:
// - Walled lot (100m x 80m) with front/back entrance gates and a west-front exit gate
// - Central elevated parking deck with a ramp on the east side and parking underneath
// - Canopy-covered car stalls along the east wall, motorcycle/bike stalls along the west wall,
//   and open car stalls along the north wall
// - Small office building at the south side between the two gates

export type V3 = [number, number, number];

export const DECK_TOP = 3.4;

export const GATE_IN: V3 = [25, 0, 41];
export const GATE_IN_NORTH: V3 = [39, 0, -41];
export const GATE_OUT: V3 = [-25, 0, 41];
export const SPAWN: V3 = [92, 0, 42.5];
export const SPAWN_NORTH: V3 = [92, 0, -48.5];
export type EntranceId = "east" | "north";

export type StallKind = "wallE" | "wallW" | "wallN" | "under" | "roofE" | "roofW";

export interface StallDef {
  id: number;
  kind: StallKind;
  pos: V3;
  heading: number; // rotation around Y; forward = (sin h, 0, cos h)
  roof: boolean;
  vehicle?: "car" | "motor";
  padX?: number; // roof stalls: x of the stadium pad lane that serves them
}

// Rooftop herringbone: three stadium-shaped drive lanes (pads) with angled
// 45° stalls flanking BOTH sides of each pad (mirrored, forming chevrons,
// like the client's render). Cars drive south down a pad lane to park and
// north back up it to leave.
export const ROOF_PADS = [-13, 0, 13];
export const ROOF_PAD_HALF_W = 2.3; // half-width of a stadium pad
export const ROOF_N = 4; // stalls per flank
export const ROOF_PITCH = 3.2; // stall spacing along z, measured at the pad edge
export const ROOF_Z0 = -17.5; // z of the first (north-most) divider at the pad edge
export const ROOF_DEPTH = 3.6; // stall depth, projected onto x and onto z (45°)
const FLANK_OFFSET = ROOF_PAD_HALF_W + ROOF_DEPTH / 2; // stall-center distance from pad center

function makeStalls(): StallDef[] {
  const out: StallDef[] = [];
  let id = 0;
  for (let i = 0; i < 8; i++)
    out.push({ id: id++, kind: "wallE", pos: [46, 0, -28 + i * 5.5], heading: Math.PI / 2, roof: false });
  for (let i = 0; i < 16; i++)
    out.push({
      id: id++,
      kind: "wallW",
      pos: [-46.7, 0, -30 + i * 2.8],
      heading: -Math.PI / 2,
      roof: false,
      vehicle: "motor",
    });
  for (let i = 0; i < 9; i++)
    out.push({ id: id++, kind: "wallN", pos: [-22 + i * 5.5, 0, -35.5], heading: Math.PI, roof: false });
  for (let i = 0; i < 7; i++)
    out.push({ id: id++, kind: "under", pos: [-16.5 + i * 5.5, 0, 0], heading: Math.PI, roof: false });
  for (const padX of ROOF_PADS) {
    for (let i = 0; i < ROOF_N; i++) {
      // slot i sits between dividers i and i+1; its center is pushed outward
      // and south of the pad-edge by half the stall depth (45° herringbone)
      const zEdge = ROOF_Z0 + (i + 0.5) * ROOF_PITCH;
      const zc = zEdge + ROOF_DEPTH / 2;
      for (const side of [-1, 1] as const) {
        out.push({
          id: id++,
          kind: side < 0 ? "roofW" : "roofE",
          pos: [padX + side * FLANK_OFFSET, DECK_TOP, zc],
          heading: (side * Math.PI) / 4,
          roof: true,
          padX,
        });
      }
    }
  }
  return out;
}

/** Roof stall divider lines, anchored at the pad edge, extending outward
 *  one stall-depth at 45° (so opposite flanks form chevrons at the strip
 *  midline and nothing spills past the pad ends). */
export const ROOF_LINE_LEN = ROOF_DEPTH * Math.SQRT2;
export function roofDividers(): { pos: V3; rotY: number }[] {
  const out: { pos: V3; rotY: number }[] = [];
  for (const padX of ROOF_PADS) {
    for (const side of [-1, 1] as const) {
      const xe = padX + side * ROOF_PAD_HALF_W;
      for (let k = 0; k <= ROOF_N; k++) {
        const zd = ROOF_Z0 + k * ROOF_PITCH;
        out.push({
          pos: [xe + (side * ROOF_DEPTH) / 2, DECK_TOP + 0.025, zd + ROOF_DEPTH / 2],
          rotY: (side * Math.PI) / 4,
        });
      }
    }
  }
  return out;
}

export const STALLS: StallDef[] = makeStalls();

// ---------------------------------------------------------------- routes ----

export interface Route {
  pts: V3[];
  cum: number[];
  len: number;
}

function lerp3(a: V3, b: V3, t: number): V3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}
function dist3(a: V3, b: V3): number {
  return Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
}

/** Polyline through waypoints with rounded corners (quadratic bezier blends). */
export function buildRoute(wps: V3[], radius = 3.5): Route {
  const pts: V3[] = [wps[0]];
  for (let i = 1; i < wps.length - 1; i++) {
    const p = wps[i];
    const a = wps[i - 1];
    const b = wps[i + 1];
    const la = dist3(a, p);
    const lb = dist3(p, b);
    if (la < 1e-4 || lb < 1e-4) continue;
    const r = Math.min(radius, la * 0.45, lb * 0.45);
    const pin = lerp3(p, a, r / la);
    const pout = lerp3(p, b, r / lb);
    pts.push(pin);
    for (let k = 1; k < 7; k++) {
      const t = k / 7;
      pts.push(lerp3(lerp3(pin, p, t), lerp3(p, pout, t), t));
    }
    pts.push(pout);
  }
  pts.push(wps[wps.length - 1]);
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + dist3(pts[i - 1], pts[i]));
  return { pts, cum, len: cum[cum.length - 1] };
}

export function routePoint(r: Route, d: number): V3 {
  if (d <= 0) return r.pts[0];
  if (d >= r.len) return r.pts[r.pts.length - 1];
  let lo = 0;
  let hi = r.cum.length - 1;
  while (lo + 1 < hi) {
    const m = (lo + hi) >> 1;
    if (r.cum[m] <= d) lo = m;
    else hi = m;
  }
  const span = r.cum[hi] - r.cum[lo] || 1;
  return lerp3(r.pts[lo], r.pts[hi], (d - r.cum[lo]) / span);
}

const Y = 0;
const D = DECK_TOP;
// pad lanes are two-way: enter southbound on the west side, leave
// northbound on the east side; separate in/out bands at the north edge
const BAND_IN = -22.8;
const BAND_OUT = -20.4;

/** Driving route from a point outside the entrance gate to the assigned stall. */
export function inboundWaypoints(s: StallDef, from: V3, entrance: EntranceId = "east"): V3[] {
  const head: V3[] =
    entrance === "north"
      ? [from, GATE_IN_NORTH, [39, Y, -32]]
      : [from, GATE_IN, [25, Y, 34], [30, Y, 28], [35, Y, 18]];
  const [sx, , sz] = s.pos;
  switch (s.kind) {
    case "wallE":
      return entrance === "north"
        ? [...head, [35, Y, -30], [35, Y, sz], [sx, Y, sz]]
        : [...head, [35, Y, sz], [sx, Y, sz]];
    case "wallN":
      return entrance === "north"
        ? [...head, [sx, Y, -32], [sx, Y, sz]]
        : [...head, [35, Y, -30], [sx, Y, -30], [sx, Y, sz]];
    case "wallW":
      return entrance === "north"
        ? [...head, [-35, Y, -30], [-35, Y, sz], [sx, Y, sz]]
        : [...head, [35, Y, -30], [-35, Y, -30], [-35, Y, sz], [sx, Y, sz]];
    case "under":
      return entrance === "north"
        ? [...head, [35, Y, -16], [18, Y, 8], [sx, Y, 8], [sx, Y, sz]]
        : [from, GATE_IN, [25, Y, 32], [19, Y, 20], [17, Y, 8], [sx, Y, 8], [sx, Y, sz]];
    case "roofE":
    case "roofW": {
      const lane = (s.padX ?? 0) - 1.1;
      return [
        ...head,
        entrance === "north" ? [39, Y, -28] : [26, Y, 13],
        [26, Y, 13],
        [26, D, -13.5],
        [24, D, -18],
        [20, D, BAND_IN],
        [lane, D, BAND_IN],
        [lane, D, sz - 6],
        [sx, D, sz],
      ];
    }
  }
}

/** Short reversing leg: backing out of the stall onto the aisle. */
export function outboundReverse(s: StallDef): V3[] {
  const [sx, , sz] = s.pos;
  switch (s.kind) {
    case "wallE":
      return [s.pos, [36.5, Y, sz]];
    case "wallW":
      return [s.pos, [-36.5, Y, sz]];
    case "wallN":
      return [s.pos, [sx, Y, -29]];
    case "under":
      return [s.pos, [sx, Y, 7.5]];
    case "roofE":
    case "roofW": {
      // back out along the 45° stall axis onto the adjacent pad lane
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      return [s.pos, [sx - fx * 5.2, D, sz - fz * 5.2]];
    }
  }
}

/** Forward route from the back-out point to the inside end of the exit queue. */
export function outboundWaypoints(s: StallDef): V3[] {
  const [sx, , sz] = s.pos;
  const tail: V3[] = [
    [-35, Y, 8],
    [-33, Y, 14],
    [-26, Y, 16],
  ];
  switch (s.kind) {
    case "wallE":
      return [[36.5, Y, sz], [35, Y, sz - 4], [35, Y, -30], [-35, Y, -30], ...tail];
    case "wallN":
      return [[sx, Y, -29], [-35, Y, -30], ...tail];
    case "wallW":
      return [[-36.5, Y, sz], [-35, Y, sz + 4], ...tail];
    case "under":
      return [
        [sx, Y, 7.5],
        [-22, Y, 9],
        [-26, Y, 16],
      ];
    case "roofE":
    case "roofW": {
      // drive north up the pad lane's east side, east along the out band,
      // then down the ramp
      const fx = Math.sin(s.heading);
      const fz = Math.cos(s.heading);
      const lane = (s.padX ?? 0) + 1.1;
      return [
        [sx - fx * 5.2, D, sz - fz * 5.2],
        [lane, D, -18.7],
        [16, D, BAND_OUT],
        [20.5, D, -17.5],
        [22, D, -14.5],
        [22, Y, 13],
        [22, Y, 20],
        [0, Y, 23],
        [-20, Y, 21],
        [-26, Y, 15],
      ];
    }
  }
}

export function leaveWaypoints(from: V3): V3[] {
  return [from, GATE_OUT, [-25, Y, 48], [-94, Y, 48]];
}

// --------------------------------------------------------------- queues ----

const ENTRANCE_QUEUE_POLY: V3[] = [
  [25, 0, 42.5],
  [92, 0, 42.5],
];
const ENTRANCE_QUEUE_NORTH_POLY: V3[] = [
  [39, 0, -42.5],
  [39, 0, -48.5],
  [92, 0, -48.5],
];

function pointAlongPoly(poly: V3[], d: number): V3 {
  let rem = d;
  for (let i = 1; i < poly.length; i++) {
    const seg = dist3(poly[i - 1], poly[i]);
    if (rem <= seg) return lerp3(poly[i - 1], poly[i], rem / seg);
    rem -= seg;
  }
  return poly[poly.length - 1];
}

export function entranceQueuePoint(i: number, entrance: EntranceId = "east"): V3 {
  return pointAlongPoly(entrance === "north" ? ENTRANCE_QUEUE_NORTH_POLY : ENTRANCE_QUEUE_POLY, 4 + 7 * i);
}

export function exitQueuePoint(i: number): V3 {
  return [-25, 0, 36 - 7 * i];
}
