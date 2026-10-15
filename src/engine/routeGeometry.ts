import * as THREE from 'three';
import type { Direction } from '../types';
import {
  NODES,
  ROUTE_DEFS,
  LANE_OFFSET,
  STOP_LINE_OFFSET,
  JUNCTION_EXIT_OFFSET,
  UTURN_BULB,
  directionName,
  leftOf,
} from '../config/roadNetwork';

// ─── Geometry tuning ─────────────────────────────────────────────
// Turn radii are chosen so a lane's arc stays on the pavement and
// opposing lanes on a bend never overlap (left/inner and right/outer
// arcs are concentric).
const LEFT_TURN_RADIUS = 3.5;
const RIGHT_TURN_RADIUS = 6;
const BEND_INNER_RADIUS = 3.5;
const BEND_OUTER_RADIUS = BEND_INNER_RADIUS + 2 * LANE_OFFSET;
const ARC_SEGMENTS = 12;
export const SAMPLE_STEP = 1; // metres between path samples used for look-ahead
export const LATERAL_ACCEL = 4; // m/s² comfortable cornering acceleration
export const COMFORT_DECEL = 2.5; // m/s² used to build the curve speed envelope
const CONFLICT_DISTANCE = 2.6; // in-junction paths closer than this conflict

export type TurnType = 'straight' | 'left' | 'right' | 'uturn';

export interface Movement {
  key: string; // junctionId:approach:exit — identical for every route making this movement
  junctionId: string;
  lightId: string;
  approach: Direction; // travel direction when entering the junction
  exit: Direction; // travel direction when leaving the junction
  turn: TurnType;
  stopS: number; // arc length of the stop line on the route
  exitS: number; // arc length where the vehicle has cleared the junction
}

export interface RoutePath {
  id: string;
  name: string;
  points: THREE.Vector3[];
  cum: number[]; // cumulative arc length at each point
  length: number;
  samples: THREE.Vector3[]; // points every SAMPLE_STEP metres
  speedEnvelope: number[]; // max speed allowed at each sample (curves + braking into them)
  movements: Movement[];
}

// ─── Builders ────────────────────────────────────────────────────
function classifyTurn(dIn: THREE.Vector3, dOut: THREE.Vector3): TurnType {
  const dot = dIn.dot(dOut);
  if (dot > 0.5) return 'straight';
  if (dot < -0.5) return 'uturn';
  return leftOf(dIn).dot(dOut) > 0 ? 'left' : 'right';
}

function cubicPoints(
  p0: THREE.Vector3, c0: THREE.Vector3, c1: THREE.Vector3, p1: THREE.Vector3, segments: number
): THREE.Vector3[] {
  const curve = new THREE.CubicBezierCurve3(p0, c0, c1, p1);
  return curve.getPoints(segments);
}

/** Quarter-circle arc between two perpendicular lane lines meeting at corner K. */
function cornerArc(K: THREE.Vector3, dIn: THREE.Vector3, dOut: THREE.Vector3, r: number): THREE.Vector3[] {
  const k = 0.5523 * r; // cubic Bézier handle length for a circular quarter arc
  const A = K.clone().addScaledVector(dIn, -r);
  const B = K.clone().addScaledVector(dOut, r);
  return cubicPoints(A, A.clone().addScaledVector(dIn, k), B.clone().addScaledVector(dOut, -k), B, ARC_SEGMENTS);
}

/** Lollipop turnaround: S-curve onto the bulb's circle, half circle, S-curve back. */
function uturnPoints(P: THREE.Vector3, dIn: THREE.Vector3): THREE.Vector3[] {
  const l = leftOf(dIn);
  const C = UTURN_BULB.center;
  const R = UTURN_BULB.laneRadius;
  const pts: THREE.Vector3[] = [];

  const entry = P.clone().addScaledVector(l, LANE_OFFSET);
  const onCircle = C.clone().addScaledVector(l, R);
  const k = entry.distanceTo(onCircle) / 3;
  pts.push(...cubicPoints(entry, entry.clone().addScaledVector(dIn, k), onCircle.clone().addScaledVector(dIn, -k), onCircle, 10));

  for (let i = 1; i <= 24; i++) {
    const phi = (i / 24) * Math.PI;
    pts.push(C.clone().addScaledVector(l, R * Math.cos(phi)).addScaledVector(dIn, R * Math.sin(phi)));
  }

  const offCircle = C.clone().addScaledVector(l, -R);
  const exitPt = P.clone().addScaledVector(l, -LANE_OFFSET);
  const k2 = offCircle.distanceTo(exitPt) / 3;
  pts.push(...cubicPoints(offCircle, offCircle.clone().addScaledVector(dIn, -k2), exitPt.clone().addScaledVector(dIn, k2), exitPt, 10).slice(1));
  return pts;
}

function buildRoute(id: string, name: string, nodeIds: string[]): RoutePath {
  const nodes = nodeIds.map((n) => NODES[n]);
  const dirs = nodes.slice(0, -1).map((n, i) =>
    nodes[i + 1].position.clone().sub(n.position).normalize()
  );

  const points: THREE.Vector3[] = [];
  const marks: { junctionId: string; approach: Direction; exit: Direction; turn: TurnType; stopIdx: number; exitIdx: number }[] = [];

  points.push(nodes[0].position.clone().addScaledVector(leftOf(dirs[0]), LANE_OFFSET));

  for (let i = 1; i < nodes.length - 1; i++) {
    const n = nodes[i];
    const dIn = dirs[i - 1];
    const dOut = dirs[i];
    const P = n.position;

    if (n.kind === 'uturn') {
      points.push(...uturnPoints(P, dIn));
      continue;
    }

    const turn = classifyTurn(dIn, dOut);
    const lIn = leftOf(dIn);
    const lOut = leftOf(dOut);
    const K = P.clone().addScaledVector(lIn, LANE_OFFSET).addScaledVector(lOut, LANE_OFFSET);

    let stopIdx = -1;
    if (n.kind === 'junction') {
      stopIdx = points.length;
      points.push(P.clone().addScaledVector(dIn, -STOP_LINE_OFFSET).addScaledVector(lIn, LANE_OFFSET));
    }

    if (turn === 'left' || turn === 'right') {
      const r = n.kind === 'bend'
        ? (turn === 'left' ? BEND_INNER_RADIUS : BEND_OUTER_RADIUS)
        : (turn === 'left' ? LEFT_TURN_RADIUS : RIGHT_TURN_RADIUS);
      points.push(...cornerArc(K, dIn, dOut, r));
    }

    if (n.kind === 'junction') {
      const exitIdx = points.length;
      points.push(P.clone().addScaledVector(dOut, JUNCTION_EXIT_OFFSET).addScaledVector(lOut, LANE_OFFSET));
      marks.push({ junctionId: n.id, approach: directionName(dIn), exit: directionName(dOut), turn, stopIdx, exitIdx });
    }
  }

  const last = nodes[nodes.length - 1];
  points.push(last.position.clone().addScaledVector(leftOf(dirs[dirs.length - 1]), LANE_OFFSET));

  // Drop duplicate consecutive points (zero-length segments)
  const cleaned: THREE.Vector3[] = [];
  const remap: number[] = [];
  for (const p of points) {
    if (cleaned.length === 0 || cleaned[cleaned.length - 1].distanceTo(p) > 1e-4) cleaned.push(p);
    remap.push(cleaned.length - 1);
  }

  const cum = [0];
  for (let i = 1; i < cleaned.length; i++) cum.push(cum[i - 1] + cleaned[i].distanceTo(cleaned[i - 1]));
  const length = cum[cum.length - 1];

  const movements: Movement[] = marks.map((m) => ({
    key: `${m.junctionId}:${m.approach}:${m.exit}`,
    junctionId: m.junctionId,
    lightId: `TL_${m.junctionId}`,
    approach: m.approach,
    exit: m.exit,
    turn: m.turn,
    stopS: cum[remap[m.stopIdx]],
    exitS: cum[remap[m.exitIdx]],
  }));

  const path: RoutePath = { id, name, points: cleaned, cum, length, samples: [], speedEnvelope: [], movements };

  // Uniform samples for look-ahead and the curve speed envelope
  const sampleCount = Math.floor(length / SAMPLE_STEP) + 1;
  for (let i = 0; i < sampleCount; i++) path.samples.push(pointAt(path, i * SAMPLE_STEP));

  const curveLimit = path.samples.map((_, i) => {
    if (i === 0 || i >= sampleCount - 1) return Infinity;
    const a = path.samples[i].clone().sub(path.samples[i - 1]);
    const b = path.samples[i + 1].clone().sub(path.samples[i]);
    const angle = a.angleTo(b);
    const curvature = angle / SAMPLE_STEP;
    return curvature > 1e-3 ? Math.sqrt(LATERAL_ACCEL / curvature) : Infinity;
  });
  const envelope = new Array<number>(sampleCount).fill(Infinity);
  for (let i = sampleCount - 1; i >= 0; i--) {
    const next = i + 1 < sampleCount ? envelope[i + 1] : Infinity;
    envelope[i] = Math.min(curveLimit[i], Math.sqrt(next * next + 2 * COMFORT_DECEL * SAMPLE_STEP));
  }
  path.speedEnvelope = envelope;

  return path;
}

// ─── Path queries ────────────────────────────────────────────────
function segmentIndexAt(path: RoutePath, s: number): number {
  const { cum } = path;
  let lo = 0;
  let hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function pointAt(path: RoutePath, s: number, target = new THREE.Vector3()): THREE.Vector3 {
  const clamped = Math.max(0, Math.min(path.length, s));
  const i = segmentIndexAt(path, clamped);
  const segLen = path.cum[i + 1] - path.cum[i];
  const t = segLen > 0 ? (clamped - path.cum[i]) / segLen : 0;
  return target.lerpVectors(path.points[i], path.points[i + 1], t);
}

/** Smoothed heading (radians, three.js Y rotation) from a central difference. */
export function headingAt(path: RoutePath, s: number): number {
  const a = pointAt(path, s - 1.5);
  const b = pointAt(path, s + 1.5);
  return Math.atan2(b.x - a.x, b.z - a.z);
}

export function speedLimitAt(path: RoutePath, s: number): number {
  const i = Math.max(0, Math.min(path.speedEnvelope.length - 1, Math.round(s / SAMPLE_STEP)));
  return path.speedEnvelope[i];
}

// ─── Precomputed network ─────────────────────────────────────────
export const ROUTE_PATHS: RoutePath[] = ROUTE_DEFS.map((r) => buildRoute(r.id, r.name, r.nodes));
export const ROUTE_PATH_MAP = new Map(ROUTE_PATHS.map((r) => [r.id, r]));

// Conflicting movement pairs: in-junction paths from different approaches that come close
function movementSamples(path: RoutePath, m: Movement): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  for (let s = m.stopS; s <= m.exitS; s += 0.5) pts.push(pointAt(path, s));
  return pts;
}

const CONFLICTS = new Set<string>();
(() => {
  const unique = new Map<string, THREE.Vector3[]>();
  const meta = new Map<string, Movement>();
  for (const path of ROUTE_PATHS) {
    for (const m of path.movements) {
      if (!unique.has(m.key)) {
        unique.set(m.key, movementSamples(path, m));
        meta.set(m.key, m);
      }
    }
  }
  const keys = Array.from(unique.keys());
  for (let i = 0; i < keys.length; i++) {
    for (let j = i + 1; j < keys.length; j++) {
      const a = meta.get(keys[i])!;
      const b = meta.get(keys[j])!;
      if (a.junctionId !== b.junctionId || a.approach === b.approach) continue;
      const pa = unique.get(keys[i])!;
      const pb = unique.get(keys[j])!;
      const close = pa.some((p) => pb.some((q) => p.distanceTo(q) < CONFLICT_DISTANCE));
      if (close) {
        CONFLICTS.add(`${keys[i]}|${keys[j]}`);
        CONFLICTS.add(`${keys[j]}|${keys[i]}`);
      }
    }
  }
})();

export function movementsConflict(a: Movement, b: Movement): boolean {
  return CONFLICTS.has(`${a.key}|${b.key}`);
}
