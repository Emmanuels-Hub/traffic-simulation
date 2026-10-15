import * as THREE from 'three';
import type {
  DataPoint,
  SimulationConfig,
  StopReason,
  TrafficLight,
  Vehicle,
  VehicleState,
  VehicleType,
} from '../types';
import { JUNCTIONS, VEHICLE_COLORS, VEHICLE_SPECS } from '../config/roadNetwork';
import {
  ROUTE_PATHS,
  ROUTE_PATH_MAP,
  SAMPLE_STEP,
  headingAt,
  movementsConflict,
  pointAt,
  speedLimitAt,
  type Movement,
  type RoutePath,
  type TurnType,
} from './routeGeometry';
import { getDirectionalSignalState } from './signals';
import { useSimulationStore } from '../store/simulationStore';

// ─── Driver model parameters (Intelligent Driver Model) ──────────
const TIME_HEADWAY = 1.2; // s
const MIN_GAP = 2.0; // m bumper-to-bumper when stopped in a queue
const STOP_LINE_GAP = 0.6; // m between front bumper and stop line when stopped
const COMFORT_BRAKE = 2.5; // m/s²
const YELLOW_STOP_BRAKE = 3.5; // m/s² max braking a driver accepts to stop on yellow
const RED_STOP_BRAKE = 7; // m/s² max braking to stop on red
const MAX_BRAKE = 9; // m/s² physical limit
const LOOKAHEAD = 50; // m of path scanned for obstacles
const YIELD_CHECK_DISTANCE = 30; // m before the stop line where right-of-way is evaluated
const YIELD_HORIZON = 4; // s — yield to priority traffic arriving within this time
const MAX_STEP = 1 / 30; // s — physics sub-step
const STOPPED_SPEED = 0.3;
const QUEUED_SPEED = 1.0;
const ANALYTICS_INTERVAL = 0.5; // s of simulation time
const RATE_WINDOW = 30; // s of simulation time for throughput rates
const MAX_HISTORY = 120;

const WEATHER_FACTORS: Record<SimulationConfig['weatherCondition'], { speed: number; headway: number }> = {
  clear: { speed: 1, headway: 1 },
  rain: { speed: 0.85, headway: 1.3 },
  fog: { speed: 0.7, headway: 1.5 },
};

const TURN_PRIORITY: Record<TurnType, number> = { straight: 2, left: 2, right: 1, uturn: 0 };
const PATIENCE = 12; // s waiting at the head of a queue before other drivers let it go first

// ─── World state ─────────────────────────────────────────────────
export interface World {
  time: number;
  vehicles: Vehicle[];
  lights: Map<string, TrafficLight>;
  lightsChanged: boolean;
}

export interface StepEvents {
  completedTrips: number;
  junctionClears: Record<string, number>;
}

let vehicleIdCounter = 0;
let spawnAccumulator = 0;
let analyticsTimer = 0;
let tripTimes: number[] = [];
let junctionClearTimes: Record<string, number[]> = {};

// ─── Helpers ─────────────────────────────────────────────────────
function idmAccel(
  v: number, v0: number, a: number, headway: number,
  gap: number, vLead: number, s0: number
): number {
  const free = 1 - Math.pow(v / Math.max(v0, 0.1), 4);
  const sStar = s0 + Math.max(0, v * headway + (v * (v - vLead)) / (2 * Math.sqrt(a * COMFORT_BRAKE)));
  const g = Math.max(gap, 0.05);
  return a * (free - (sStar / g) * (sStar / g));
}

function pickVehicleType(): VehicleType {
  const entries = Object.entries(VEHICLE_SPECS) as [VehicleType, (typeof VEHICLE_SPECS)[VehicleType]][];
  const total = entries.reduce((sum, [, s]) => sum + s.weight, 0);
  let r = Math.random() * total;
  for (const [type, spec] of entries) {
    r -= spec.weight;
    if (r <= 0) return type;
  }
  return 'sedan';
}

function createVehicle(path: RoutePath, s: number, velocityFactor: number): Vehicle {
  const type = pickVehicleType();
  const spec = VEHICLE_SPECS[type];
  const desired = spec.maxSpeed * (0.9 + Math.random() * 0.2); // driver variability
  const nextMovementIndex = path.movements.findIndex((m) => m.exitS >= s - spec.length / 2);
  return {
    id: `v_${vehicleIdCounter++}`,
    type,
    position: pointAt(path, s).setY(0),
    rotation: new THREE.Euler(0, headingAt(path, s), 0),
    velocity: Math.min(desired, speedLimitAt(path, s)) * velocityFactor,
    maxVelocity: desired,
    acceleration: spec.acceleration,
    currentAccel: 0,
    routeId: path.id,
    pathDistance: s,
    nextMovementIndex: nextMovementIndex === -1 ? path.movements.length : nextMovementIndex,
    committedMovementIndex: -1,
    color: VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)],
    length: spec.length,
    width: spec.width,
    state: 'moving',
    waitTime: 0,
    lineWait: 0,
    totalDistance: 0,
    targetVelocity: desired,
    stopReason: null,
    blockedBy: null,
  };
}

function isClear(world: World, pos: THREE.Vector3, radius: number): boolean {
  return world.vehicles.every(
    (v) => v.position.distanceTo(pos) > radius + v.length / 2
  );
}

// ─── Traffic lights ──────────────────────────────────────────────
function advanceLights(world: World): void {
  for (const [id, light] of world.lights) {
    if (light.mode !== 'auto' || world.time < light.phaseEndsAt) continue;
    let index = light.currentPhaseIndex;
    let endsAt = light.phaseEndsAt;
    while (world.time >= endsAt) {
      index = (index + 1) % light.phases.length;
      endsAt += light.phases[index].duration;
    }
    if (!world.lightsChanged) {
      world.lights = new Map(world.lights);
      world.lightsChanged = true;
    }
    world.lights.set(id, { ...light, currentPhaseIndex: index, phaseEndsAt: endsAt });
  }
}

// ─── Perception ──────────────────────────────────────────────────
interface Obstacle {
  ctx: Ctx;
  gap: number; // free distance from my front bumper to the obstacle's rear (along my path)
  rearS: number; // obstacle rear projected onto my path
  crossing: boolean; // obstacle heading differs strongly from my path
}

interface Ctx {
  v: Vehicle;
  path: RoutePath;
  front: number;
  rear: number;
  heading: THREE.Vector3;
  movementIndex: number;
  movement: Movement | null;
  inBox: boolean;
  claimed: boolean; // committed to entering its junction this step (visible to later vehicles)
  obstacles: Obstacle[];
}

function buildContext(v: Vehicle): Ctx | null {
  const path = ROUTE_PATH_MAP.get(v.routeId);
  if (!path) return null;
  const half = v.length / 2;
  const front = v.pathDistance + half;
  const rear = v.pathDistance - half;
  const movement = path.movements[v.nextMovementIndex] ?? null;
  return {
    v,
    path,
    front,
    rear,
    heading: new THREE.Vector3(Math.sin(v.rotation.y), 0, Math.cos(v.rotation.y)),
    movementIndex: v.nextMovementIndex,
    movement,
    inBox: !!movement && front > movement.stopS && rear < movement.exitS,
    claimed: false,
    obstacles: [],
  };
}

const CORRIDOR_MARGIN = 0.35; // m of clearance kept beside the vehicle's swept path

/** Points covering a vehicle's footprint: the four corners plus its centre line. */
function footprint(v: Vehicle): { x: number; z: number }[] {
  const fx = Math.sin(v.rotation.y);
  const fz = Math.cos(v.rotation.y);
  const hl = v.length / 2;
  const hw = v.width / 2;
  const pts: { x: number; z: number }[] = [];
  const n = Math.max(2, Math.ceil(v.length / 1.2));
  for (let i = 0; i <= n; i++) {
    const t = -hl + (i / n) * v.length;
    pts.push({ x: v.position.x + fx * t, z: v.position.z + fz * t });
  }
  for (const sl of [-1, 1]) {
    for (const sw of [-1, 1]) {
      pts.push({ x: v.position.x + fx * hl * sl + fz * hw * sw, z: v.position.z + fz * hl * sl - fx * hw * sw });
    }
  }
  return pts;
}

/**
 * Does `b`'s footprint intrude into the corridor `a` will sweep along its path
 * ahead? Returns the free distance from `a`'s front bumper to the first intrusion.
 */
function detectOnPath(a: Ctx, b: Ctx): Obstacle | null {
  const dx = b.v.position.x - a.v.position.x;
  const dz = b.v.position.z - a.v.position.z;
  const reach = LOOKAHEAD + 10;
  if (dx * dx + dz * dz > reach * reach) return null;

  const pathDir = a.path.samples;
  const kStart = Math.floor(a.v.pathDistance / SAMPLE_STEP);
  const kEnd = Math.min(pathDir.length - 1, Math.floor((a.v.pathDistance + LOOKAHEAD) / SAMPLE_STEP));
  if (kEnd <= kStart) return null;

  // Oncoming traffic in its own lane never blocks — only inside junctions can paths cross
  const nearK = Math.min(kEnd, kStart + 1);
  const tx0 = pathDir[Math.min(nearK + 1, kEnd)].x - pathDir[nearK - 1 >= 0 ? nearK - 1 : nearK].x;
  const tz0 = pathDir[Math.min(nearK + 1, kEnd)].z - pathDir[nearK - 1 >= 0 ? nearK - 1 : nearK].z;
  const t0 = Math.hypot(tx0, tz0) || 1;
  const oncoming = (tx0 * b.heading.x + tz0 * b.heading.z) / t0 < -0.7;
  if (oncoming && !a.inBox && !b.inBox) return null;

  const halfCorridor = a.v.width / 2 + CORRIDOR_MARGIN;
  const bx = b.v.position.x;
  const bz = b.v.position.z;

  // Coarse pass: nearest sample to b's centre; skip if b can't reach the corridor
  let centreBest = Infinity;
  let centreK = -1;
  for (let k = kStart; k <= kEnd; k++) {
    const q = pathDir[k];
    const d2 = (q.x - bx) * (q.x - bx) + (q.z - bz) * (q.z - bz);
    if (d2 < centreBest) {
      centreBest = d2;
      centreK = k;
    }
  }
  const reachB = halfCorridor + Math.hypot(b.v.length, b.v.width) / 2 + SAMPLE_STEP;
  if (centreK < 0 || centreBest > reachB * reachB) return null;

  // Fine pass: every footprint point against the nearby stretch of path
  const window = Math.ceil(b.v.length / 2 / SAMPLE_STEP) + 3;
  const kLo = Math.max(kStart, centreK - window);
  const kHi = Math.min(kEnd, centreK + window);
  let firstS = Infinity;
  for (const p of footprint(b.v)) {
    let best = Infinity;
    let bestK = -1;
    for (let k = kLo; k <= kHi; k++) {
      const q = pathDir[k];
      const d2 = (q.x - p.x) * (q.x - p.x) + (q.z - p.z) * (q.z - p.z);
      if (d2 < best) {
        best = d2;
        bestK = k;
      }
    }
    if (bestK < 0 || best > (halfCorridor + SAMPLE_STEP) ** 2) continue;
    const k0 = Math.max(0, bestK - 1);
    const k1 = Math.min(pathDir.length - 1, bestK + 1);
    const tx = pathDir[k1].x - pathDir[k0].x;
    const tz = pathDir[k1].z - pathDir[k0].z;
    const tl = Math.hypot(tx, tz) || 1;
    const rx = p.x - pathDir[bestK].x;
    const rz = p.z - pathDir[bestK].z;
    const lateral = Math.abs(rx * tz - rz * tx) / tl;
    if (lateral > halfCorridor) continue;
    const sHit = bestK * SAMPLE_STEP + (rx * tx + rz * tz) / tl;
    if (sHit > a.v.pathDistance && sHit < firstS) firstS = sHit; // ignore points beside/behind a's centre
  }
  if (firstS === Infinity) return null;

  const cos = Math.abs(tx0 * b.heading.x + tz0 * b.heading.z) / t0;
  return {
    ctx: b,
    gap: firstS - a.front,
    rearS: firstS,
    crossing: cos < 0.7,
  };
}

function signalAllows(ctx: Ctx, lights: Map<string, TrafficLight>): boolean {
  const m = ctx.movement!;
  const light = lights.get(m.lightId);
  if (!light) return true;
  const signal = getDirectionalSignalState(light, m.approach);
  return signal === 'green' || ctx.v.committedMovementIndex === ctx.movementIndex;
}

/** Must `ctx` give way before entering movement `m`? */
function mustYield(ctx: Ctx, m: Movement, all: Ctx[], lights: Map<string, TrafficLight>): Ctx | null {
  for (const o of all) {
    if (o === ctx || !o.movement) continue;
    const om = o.movement;
    if (om.junctionId !== m.junctionId || om.approach === m.approach) continue;
    if (!movementsConflict(m, om)) continue;

    // Never enter while a conflicting vehicle occupies (or has just claimed) the junction
    if (o.inBox || o.claimed) return o;
    if (!signalAllows(o, lights)) continue;

    // Queue heads that have waited too long go first, longest wait first. Ranking
    // all such deferrals by one order keeps them from ever forming a cycle.
    if (canDeferTo(o) && outranks(o, ctx)) return o;

    const dist = om.stopS - o.front;
    const speed = o.v.velocity;
    const arriving = speed > QUEUED_SPEED && dist / speed < YIELD_HORIZON;

    if (isImpatient(ctx)) {
      // An impatient driver still won't pull out in front of someone who can't brake comfortably
      if (arriving && (speed * speed) / (2 * COMFORT_BRAKE) > dist - 1) return o;
      continue;
    }

    // Normal right-of-way: turning traffic gives way to straight/left traffic
    if (TURN_PRIORITY[om.turn] > TURN_PRIORITY[m.turn] && arriving) return o;
  }
  return null;
}

function isImpatient(ctx: Ctx): boolean {
  return ctx.v.lineWait > PATIENCE;
}

/** A long-waiting queue head that could go if others let it (not blocked by a full exit). */
function canDeferTo(o: Ctx): boolean {
  return isImpatient(o) && o.v.stopReason !== 'blocked-exit' && o.movement!.stopS - o.front < 3;
}

function outranks(a: Ctx, b: Ctx): boolean {
  return a.v.lineWait > b.v.lineWait || (a.v.lineWait === b.v.lineWait && a.v.id < b.v.id);
}

/**
 * "Don't block the box": only enter when there is guaranteed room beyond the
 * junction to clear it completely — even if the vehicle ahead brakes to a stop.
 */
function exitRoom(ctx: Ctx, m: Movement): { room: number; by: Ctx | null } {
  const needed = m.exitS + ctx.v.length + MIN_GAP;
  let room = Infinity;
  let by: Ctx | null = null;
  for (const o of ctx.obstacles) {
    if (o.crossing || o.rearS < m.stopS) continue;
    const vLead = o.ctx.v.velocity;
    const leadWillStopAt = o.rearS + (vLead * vLead) / (2 * COMFORT_BRAKE * 1.5);
    if (leadWillStopAt - needed < room) {
      room = leadWillStopAt - needed;
      by = o.ctx;
    }
  }
  return { room, by };
}

/**
 * Merge fairness: when the exit lane only has room for about one more vehicle,
 * let the queue head from another approach that has waited longer take it.
 */
function exitContested(ctx: Ctx, m: Movement, room: number, all: Ctx[]): Ctx | null {
  if (room > ctx.v.length + MIN_GAP + 4) return null;
  for (const o of all) {
    if (o === ctx || !o.movement) continue;
    const om = o.movement;
    if (om.junctionId !== m.junctionId || om.approach === m.approach || om.exit !== m.exit) continue;
    if (canDeferTo(o) && outranks(o, ctx)) return o;
  }
  return null;
}

// ─── Vehicle update ──────────────────────────────────────────────
function updateVehicle(
  ctx: Ctx,
  all: Ctx[],
  world: World,
  dt: number,
  config: SimulationConfig,
  events: StepEvents
): Vehicle | null {
  const { v, path } = ctx;
  const weather = WEATHER_FACTORS[config.weatherCondition];
  const headway = TIME_HEADWAY * weather.headway;
  const speed = v.velocity;
  const desired = v.maxVelocity * weather.speed;
  const curveLimit = speedLimitAt(path, v.pathDistance) * weather.speed;
  const v0 = Math.min(desired, curveLimit);

  let accel = idmAccel(speed, v0, v.acceleration, headway, Infinity, speed, MIN_GAP);
  let reason: StopReason = curveLimit < desired ? 'curve' : null;
  let blockedBy: string | null = null;
  let committed = v.committedMovementIndex;

  // Vehicles ahead on the path
  for (const o of ctx.obstacles) {
    const a = idmAccel(speed, v0, v.acceleration, headway, o.gap, o.ctx.v.velocity, MIN_GAP);
    if (a < accel) {
      accel = a;
      reason = 'vehicle';
      blockedBy = o.ctx.v.id;
    }
  }

  // Traffic signals and right-of-way at upcoming junctions
  for (let mi = v.nextMovementIndex; mi < path.movements.length; mi++) {
    const m = path.movements[mi];
    const dist = m.stopS - ctx.front;
    if (dist < 0) continue; // front bumper past the stop line: committed to clearing
    if (dist > LOOKAHEAD) break;

    let stop: StopReason = null;
    let stopBy: Ctx | null = null;
    const light = world.lights.get(m.lightId);
    const signal = light ? getDirectionalSignalState(light, m.approach) : 'green';

    if (committed !== mi && signal !== 'green') {
      const brake = signal === 'yellow' ? YELLOW_STOP_BRAKE : RED_STOP_BRAKE;
      if ((speed * speed) / (2 * brake) <= dist + 0.5) stop = 'signal';
      else committed = mi; // too close to stop safely — proceed through
    }

    const ownMovement = mi === ctx.movementIndex;
    if (!stop && ownMovement && dist < YIELD_CHECK_DISTANCE) {
      const canStop = (speed * speed) / (2 * RED_STOP_BRAKE) <= dist + 0.5;
      const exit = canStop ? exitRoom(ctx, m) : { room: Infinity, by: null };
      if (exit.room < 0) {
        stop = 'blocked-exit';
        stopBy = exit.by;
      } else if (canStop && (stopBy = mustYield(ctx, m, all, world.lights) ?? exitContested(ctx, m, exit.room, all))) {
        stop = 'yield';
      } else if (dist < Math.max(2, speed * 0.6)) {
        ctx.claimed = true;
      }
    }

    if (stop) {
      const a = idmAccel(speed, v0, v.acceleration, headway, dist, 0, STOP_LINE_GAP);
      if (a < accel) {
        accel = a;
        reason = stop;
        blockedBy = stopBy ? stopBy.v.id : null;
      }
      break;
    }
  }

  accel = Math.max(-MAX_BRAKE, Math.min(v.acceleration, accel));

  // Integrate (ballistic update that never reverses)
  let newSpeed = speed + accel * dt;
  let ds: number;
  if (newSpeed <= 0) {
    ds = accel < 0 ? (speed * speed) / (-2 * accel) : 0;
    newSpeed = 0;
  } else {
    ds = ((speed + newSpeed) / 2) * dt;
  }
  const s = v.pathDistance + ds;

  if (s >= path.length) {
    events.completedTrips++;
    return null;
  }

  // Advance past cleared junction movements
  let nextIdx = v.nextMovementIndex;
  const rear = s - v.length / 2;
  while (nextIdx < path.movements.length && path.movements[nextIdx].exitS < rear) {
    const jid = path.movements[nextIdx].junctionId;
    events.junctionClears[jid] = (events.junctionClears[jid] ?? 0) + 1;
    if (committed === nextIdx) committed = -1;
    nextIdx++;
  }

  const movement = path.movements[nextIdx];
  const front = s + v.length / 2;
  const atLine = !!movement && front <= movement.stopS && movement.stopS - front < 3;
  const turning = !!movement && movement.turn !== 'straight' && front > movement.stopS && rear < movement.exitS;

  let state: VehicleState;
  if (newSpeed < STOPPED_SPEED) state = 'stopped';
  else if (turning) state = 'turning';
  else if (reason && reason !== 'curve' && newSpeed < desired * 0.5) state = 'waiting';
  else state = 'moving';

  return {
    ...v,
    position: pointAt(path, s).setY(0),
    rotation: new THREE.Euler(0, headingAt(path, s), 0),
    velocity: newSpeed,
    currentAccel: accel,
    pathDistance: s,
    nextMovementIndex: nextIdx,
    committedMovementIndex: committed,
    state,
    waitTime: v.waitTime + (newSpeed < QUEUED_SPEED ? dt : 0),
    lineWait: atLine && newSpeed < QUEUED_SPEED ? v.lineWait + dt : 0,
    totalDistance: v.totalDistance + ds,
    targetVelocity: v0,
    stopReason: reason,
    blockedBy,
  };
}

// ─── Spawning ────────────────────────────────────────────────────
function trySpawn(world: World, config: SimulationConfig): void {
  if (world.vehicles.length >= config.maxVehicles) return;
  const path = ROUTE_PATHS[Math.floor(Math.random() * ROUTE_PATHS.length)];
  const start = path.samples[0];
  if (!isClear(world, start, 8)) return; // entry lane backed up
  const nearby = !isClear(world, start, 25);
  world.vehicles.push(createVehicle(path, 0, nearby ? 0.3 : 0.8));
}

/** Place a few vehicles mid-route so the city isn't empty at start. */
function seedVehicles(world: World, count: number): void {
  let attempts = 0;
  while (world.vehicles.length < count && attempts < count * 20) {
    attempts++;
    const path = ROUTE_PATHS[Math.floor(Math.random() * ROUTE_PATHS.length)];
    const s = 10 + Math.random() * (path.length * 0.7);
    const nearJunction = path.movements.some((m) => s > m.stopS - 15 && s < m.exitS + 8);
    if (nearJunction) continue;
    const pos = pointAt(path, s);
    if (!isClear(world, pos, 12)) continue;
    world.vehicles.push(createVehicle(path, s, 0.6));
  }
}

// ─── Pure simulation step (no store access — testable) ───────────
export function stepWorld(world: World, dt: number, config: SimulationConfig): StepEvents {
  const events: StepEvents = { completedTrips: 0, junctionClears: {} };
  world.time += dt;
  advanceLights(world);

  spawnAccumulator += dt;
  const spawnInterval = 1 / Math.max(config.spawnRate, 0.1);
  while (spawnAccumulator >= spawnInterval) {
    spawnAccumulator -= spawnInterval;
    trySpawn(world, config);
  }

  const contexts = world.vehicles.map(buildContext).filter((c): c is Ctx => c !== null);

  // Perception: vehicles on each path ahead
  for (const a of contexts) {
    for (const b of contexts) {
      if (a === b) continue;
      const o = detectOnPath(a, b);
      if (o) a.obstacles.push(o);
    }
  }

  // Resolve mutual detections (both see each other, e.g. crossing paths):
  // the vehicle already inside the junction — or else the one closer to the
  // conflict — proceeds, so two vehicles can never wait on each other forever.
  for (const a of contexts) {
    a.obstacles = a.obstacles.filter((o) => {
      const back = o.ctx.obstacles.find((x) => x.ctx === a);
      if (!back) return true;
      if (a.inBox !== o.ctx.inBox) return !a.inBox;
      if (Math.abs(o.gap - back.gap) > 0.01) return o.gap > back.gap;
      return a.v.id > o.ctx.v.id;
    });
  }

  const next: Vehicle[] = [];
  for (const ctx of contexts) {
    const updated = updateVehicle(ctx, contexts, world, dt, config, events);
    if (updated) next.push(updated);
  }
  world.vehicles = next;
  return events;
}

export function createWorld(lights: Map<string, TrafficLight>, seedCount = 10): World {
  const world: World = { time: 0, vehicles: [], lights, lightsChanged: false };
  seedVehicles(world, seedCount);
  return world;
}

// ─── Store integration ───────────────────────────────────────────
export function initializeSimulation(): void {
  const store = useSimulationStore.getState();
  if (store.vehicles.size > 0) return;
  const world = createWorld(store.trafficLights);
  useSimulationStore.setState({ vehicles: new Map(world.vehicles.map((v) => [v.id, v])) });
}

export function simulationTick(delta: number): void {
  const store = useSimulationStore.getState();
  const { config } = store;
  if (config.isPaused) return;

  const total = Math.min(delta, 0.1) * config.simulationSpeed;
  if (total <= 0) return;
  const steps = Math.ceil(total / MAX_STEP);
  const dt = total / steps;

  const world: World = {
    time: store.simTime,
    vehicles: Array.from(store.vehicles.values()),
    lights: store.trafficLights,
    lightsChanged: false,
  };

  for (let i = 0; i < steps; i++) {
    const events = stepWorld(world, dt, config);
    for (let t = 0; t < events.completedTrips; t++) tripTimes.push(world.time);
    for (const [jid, n] of Object.entries(events.junctionClears)) {
      const list = (junctionClearTimes[jid] ??= []);
      for (let t = 0; t < n; t++) list.push(world.time);
    }
  }

  const vehicles = new Map(world.vehicles.map((v) => [v.id, v]));
  const update: Partial<ReturnType<typeof useSimulationStore.getState>> = {
    vehicles,
    simTime: world.time,
  };
  if (world.lightsChanged) update.trafficLights = world.lights;
  if (store.selectedVehicle && !vehicles.has(store.selectedVehicle)) update.selectedVehicle = null;
  useSimulationStore.setState(update);

  analyticsTimer += total;
  if (analyticsTimer >= ANALYTICS_INTERVAL) {
    analyticsTimer = 0;
    updateAnalytics(world);
  }
}

// ─── Analytics ───────────────────────────────────────────────────
function ratePerMinute(times: number[], now: number): number {
  const windowStart = now - RATE_WINDOW;
  while (times.length > 0 && times[0] < windowStart) times.shift();
  const span = Math.min(RATE_WINDOW, Math.max(now, 1));
  return (times.length / span) * 60;
}

function updateAnalytics(world: World): void {
  const store = useSimulationStore.getState();
  const vehicles = world.vehicles;
  const count = vehicles.length;

  let totalSpeed = 0;
  let totalWait = 0;
  let stopped = 0;
  const vehicleTypeCounts: Record<VehicleType, number> = { sedan: 0, suv: 0, truck: 0, bus: 0, sports: 0 };
  const vehicleStateCounts: Record<VehicleState, number> = { moving: 0, stopped: 0, waiting: 0, turning: 0 };

  for (const v of vehicles) {
    totalSpeed += v.velocity;
    totalWait += v.waitTime;
    if (v.state === 'stopped') stopped++;
    vehicleTypeCounts[v.type]++;
    vehicleStateCounts[v.state]++;
  }

  const avgSpeed = count > 0 ? totalSpeed / count : 0;
  const avgWaitTime = count > 0 ? totalWait / count : 0;
  const congestion = count > 0 ? stopped / count : 0;
  const throughput = ratePerMinute(tripTimes, world.time);

  const junctionStats = JUNCTIONS.map((junction) => {
    let approaching = 0;
    let waiting = 0;
    let waitSum = 0;
    for (const v of vehicles) {
      const path = ROUTE_PATH_MAP.get(v.routeId);
      const m = path?.movements[v.nextMovementIndex];
      if (!m || m.junctionId !== junction.id) continue;
      if (m.stopS - (v.pathDistance + v.length / 2) > 40) continue;
      approaching++;
      if (v.velocity < QUEUED_SPEED) {
        waiting++;
        waitSum += v.waitTime;
      }
    }
    return {
      junctionId: junction.id,
      vehiclesWaiting: waiting,
      avgWaitTime: waiting > 0 ? Math.round((waitSum / waiting) * 10) / 10 : 0,
      throughput: Math.round(ratePerMinute((junctionClearTimes[junction.id] ??= []), world.time) * 10) / 10,
      congestionLevel: approaching > 0 ? waiting / approaching : 0,
    };
  });

  const time = Math.round(world.time * 10) / 10;
  const addDataPoint = (arr: DataPoint[], value: number): DataPoint[] => {
    const out = [...arr, { time, value: Math.round(value * 10) / 10 }];
    return out.length > MAX_HISTORY ? out.slice(out.length - MAX_HISTORY) : out;
  };

  store.updateAnalytics({
    totalVehicles: count,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    avgWaitTime: Math.round(avgWaitTime * 10) / 10,
    throughput: Math.round(throughput * 10) / 10,
    congestionLevel: Math.round(congestion * 100) / 100,
    junctionStats,
    vehicleTypeCounts,
    vehicleStateCounts,
    speedHistory: addDataPoint(store.analytics.speedHistory, avgSpeed),
    vehicleCountHistory: addDataPoint(store.analytics.vehicleCountHistory, count),
    congestionHistory: addDataPoint(store.analytics.congestionHistory, congestion * 100),
    throughputHistory: addDataPoint(store.analytics.throughputHistory, throughput),
  });
}

// ─── Reset simulation state ─────────────────────────────────────
export function resetSimulation(): void {
  vehicleIdCounter = 0;
  spawnAccumulator = 0;
  analyticsTimer = 0;
  tripTimes = [];
  junctionClearTimes = {};
  useSimulationStore.getState().reset();
  initializeSimulation();
}
