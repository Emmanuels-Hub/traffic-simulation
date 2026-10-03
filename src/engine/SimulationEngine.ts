import * as THREE from 'three';
import type { Vehicle, TrafficLight, DataPoint } from '../types';
import { ROUTES, JUNCTIONS, VEHICLE_COLORS } from '../config/roadNetwork';
import { useSimulationStore } from '../store/simulationStore';

let vehicleIdCounter = 0;
let lastSpawnTime = 10;
let analyticsTimer = 0;
let throughputCounter = 0;
let lastThroughputTime = Date.now() / 1000;

// ─── Junction zones for traffic light enforcement ────────────────
interface JunctionZone {
  id: string;
  center: THREE.Vector3;
  radius: number;
  trafficLightId: string;
}

const JUNCTION_ZONES: JunctionZone[] = JUNCTIONS.map((j) => ({
  id: j.id,
  center: j.position.clone(),
  radius: j.radius + 4,
  trafficLightId: j.trafficLight!.id,
}));

// ─── Initialize traffic lights in the store ──────────────────────
export function initializeTrafficLights(): void {
  const lightsMap = new Map<string, TrafficLight>();
  JUNCTIONS.forEach((junction) => {
    if (junction.trafficLight) {
      lightsMap.set(junction.trafficLight.id, { ...junction.trafficLight });
    }
  });
  useSimulationStore.setState({ trafficLights: lightsMap });

  // Seed initial vehicles spread along fixed road routes
  const store = useSimulationStore.getState();
  if (store.vehicles.size === 0) {
    const initialVehicles = new Map<string, Vehicle>();
    const routeKeys = ROUTES;
    for (let i = 0; i < 8; i++) {
      const route = routeKeys[i % routeKeys.length];
      const color = VEHICLE_COLORS[i % VEHICLE_COLORS.length];
      const types = ['sedan', 'suv', 'truck', 'bus', 'sports'] as const;
      const vType = types[i % types.length];
      const id = `v_init_${i}`;

      const waypoints = route.waypoints;
      const progress = 0.05 + (i * 0.12);
      const totalSegments = waypoints.length - 1;
      const progressScaled = progress * totalSegments;
      const segmentIndex = Math.min(Math.floor(progressScaled), totalSegments - 1);
      const segmentProgress = progressScaled - segmentIndex;
      const startPt = waypoints[segmentIndex];
      const endPt = waypoints[Math.min(segmentIndex + 1, waypoints.length - 1)];
      const startPos = new THREE.Vector3().lerpVectors(startPt, endPt, segmentProgress);
      startPos.y = 0.01;

      const dir = new THREE.Vector3().subVectors(endPt, startPt).normalize();
      const angle = Math.atan2(dir.x, dir.z);

      const v: Vehicle = {
        id,
        type: vType,
        position: startPos,
        rotation: new THREE.Euler(0, angle, 0),
        velocity: 8 + Math.random() * 3,
        maxVelocity: 12,
        acceleration: 4,
        currentRoadId: route.id,
        currentLane: 0,
        pathProgress: progress,
        route: [route.id],
        routeIndex: 0,
        color,
        length: vType === 'bus' ? 8 : vType === 'truck' ? 6.5 : 4.5,
        width: 2,
        state: 'moving',
        waitTime: 0,
        totalDistance: 0,
        targetVelocity: 12,
      };
      initialVehicles.set(id, v);
    }
    useSimulationStore.setState({ vehicles: initialVehicles });
  }
}

// ─── Update traffic lights ───────────────────────────────────────
export function updateTrafficLights(delta: number): void {
  const store = useSimulationStore.getState();
  const lights = new Map(store.trafficLights);
  let changed = false;

  lights.forEach((light, id) => {
    if (light.mode === 'auto') {
      const newTimer = light.timer - delta;
      if (newTimer <= 0) {
        const nextIndex = (light.currentPhaseIndex + 1) % light.phases.length;
        lights.set(id, {
          ...light,
          currentPhaseIndex: nextIndex,
          timer: light.phases[nextIndex].duration,
        });
        changed = true;
      } else {
        lights.set(id, { ...light, timer: newTimer });
        changed = true;
      }
    }
  });

  if (changed) {
    useSimulationStore.setState({ trafficLights: lights });
  }
}

// ─── Directional Signal Logic (Real-World Traffic Signal Rules) ────
export function getDirectionalSignalState(
  light: TrafficLight,
  dir: 'north' | 'south' | 'east' | 'west'
): 'red' | 'yellow' | 'green' {
  const currentPhase = light.phases[light.currentPhaseIndex];
  if (!currentPhase) return 'red';

  const isDirectionActive = currentPhase.directions.includes(dir);
  if (isDirectionActive) {
    return currentPhase.state; // returns 'green' or 'yellow'
  }
  return 'red'; // Inactive directions are RED!
}

// Classify vehicle's travel direction based on next path waypoint
function getVehicleTravelDirection(
  vehicle: Vehicle,
  waypoints: THREE.Vector3[]
): 'north' | 'south' | 'east' | 'west' {
  const waypointsCount = waypoints.length;
  const nextWaypointIdx = Math.min(
    Math.floor(vehicle.pathProgress * (waypointsCount - 1)) + 1,
    waypointsCount - 1
  );

  const pos = vehicle.position;
  const nextWP = waypoints[nextWaypointIdx];
  const dx = nextWP.x - pos.x;
  const dz = nextWP.z - pos.z;

  if (Math.abs(dz) > Math.abs(dx)) {
    return dz < 0 ? 'north' : 'south';
  } else {
    return dx > 0 ? 'east' : 'west';
  }
}

// Check if vehicle must stop for RED / YELLOW directional traffic light
function checkTrafficLightStop(
  vehicle: Vehicle,
  waypoints: THREE.Vector3[]
): boolean {
  const pos = vehicle.position;

  for (const zone of JUNCTION_ZONES) {
    const distToCenter = pos.distanceTo(zone.center);
    const stopLineRadius = zone.radius + 1.8; // Intersection stop bar line

    // Approaching intersection stop bar line
    if (distToCenter < zone.radius + 12 && distToCenter > stopLineRadius - 3.0) {
      const travelDir = getVehicleTravelDirection(vehicle, waypoints);
      const store = useSimulationStore.getState();
      const light = store.trafficLights.get(zone.trafficLightId);

      if (light) {
        const signalColor = getDirectionalSignalState(light, travelDir);

        if (signalColor === 'red') {
          // RED LIGHT: Must stop completely before the stop line
          if (distToCenter >= stopLineRadius - 2.5) {
            return true;
          }
        } else if (signalColor === 'yellow') {
          // YELLOW LIGHT: Stop if vehicle has not crossed stop line yet
          if (distToCenter >= stopLineRadius) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

// ─── Obstacle & Lead Vehicle Queueing ─────────────────────────────
function getObstacleAhead(
  vehicle: Vehicle,
  allVehicles: Map<string, Vehicle>
): { distance: number; mustStop: boolean; leadSpeed: number } | null {
  const pos = vehicle.position;
  const facingDir = new THREE.Vector3(
    Math.sin(vehicle.rotation.y),
    0,
    Math.cos(vehicle.rotation.y)
  ).normalize();

  let minDistance = Infinity;
  let mustStop = false;
  let leadSpeed = 0;

  for (const [otherId, other] of allVehicles) {
    if (otherId === vehicle.id) continue;

    const toOther = new THREE.Vector3(
      other.position.x - pos.x,
      0,
      other.position.z - pos.z
    );
    const dist = toOther.length();
    const dot = toOther.clone().normalize().dot(facingDir);

    // Forward path check (~160 degree cone)
    if (dist < 22 && dot > 0.2) {
      const minSafeGap = (vehicle.length + other.length) / 2 + 2.5;

      if (dist <= minSafeGap + 1.2) {
        minDistance = Math.min(minDistance, dist);
        mustStop = true;
        leadSpeed = other.velocity;
      } else if (dist < 15.0) {
        minDistance = Math.min(minDistance, dist);
        leadSpeed = other.velocity;
      }
    }
  }

  if (minDistance < Infinity) {
    return { distance: minDistance, mustStop, leadSpeed };
  }
  return null;
}

// ─── Spawn a new vehicle ─────────────────────────────────────────
export function spawnVehicle(): Vehicle | null {
  const store = useSimulationStore.getState();
  if (store.vehicles.size >= store.config.maxVehicles) return null;

  const route = ROUTES[Math.floor(Math.random() * ROUTES.length)];
  const color = VEHICLE_COLORS[Math.floor(Math.random() * VEHICLE_COLORS.length)];
  const startPos = route.waypoints[0].clone();

  // Ensure spawn point is clear of existing cars
  for (const [, v] of store.vehicles) {
    const dist = startPos.distanceTo(v.position);
    if (dist < 12) return null; // Spawn point occupied
  }

  const rand = Math.random();
  const vehicleType: Vehicle['type'] =
    rand < 0.35 ? 'sedan' :
    rand < 0.60 ? 'suv' :
    rand < 0.75 ? 'truck' :
    rand < 0.85 ? 'bus' : 'sports';

  const dims: Record<string, { l: number; w: number; speed: number }> = {
    sedan: { l: 4.5, w: 1.8, speed: 12 },
    suv: { l: 5, w: 2, speed: 11 },
    truck: { l: 6.5, w: 2.2, speed: 9.5 },
    bus: { l: 8, w: 2.5, speed: 8.5 },
    sports: { l: 4.2, w: 1.9, speed: 14 },
  };

  const d = dims[vehicleType];
  const id = `v_${vehicleIdCounter++}`;

  const vehicle: Vehicle = {
    id,
    type: vehicleType,
    position: startPos,
    rotation: new THREE.Euler(0, 0, 0),
    velocity: 8,
    maxVelocity: d.speed,
    acceleration: 4,
    currentRoadId: route.id,
    currentLane: 0,
    pathProgress: 0,
    route: [route.id],
    routeIndex: 0,
    color,
    length: d.l,
    width: d.w,
    state: 'moving',
    waitTime: 0,
    totalDistance: 0,
    targetVelocity: d.speed,
  };

  return vehicle;
}

// ─── Update a single vehicle ─────────────────────────────────────
export function updateVehicle(
  vehicle: Vehicle,
  delta: number,
  allVehicles: Map<string, Vehicle>
): Vehicle | null {
  const route = ROUTES.find((r) => r.id === vehicle.currentRoadId);
  if (!route) return null;

  const waypoints = route.waypoints;
  const totalSegments = waypoints.length - 1;

  // Strict 3D path position interpolation along road centerline waypoints
  const progressScaled = vehicle.pathProgress * totalSegments;
  const segmentIndex = Math.min(Math.floor(progressScaled), totalSegments - 1);
  const segmentProgress = progressScaled - segmentIndex;

  const startPt = waypoints[segmentIndex];
  const endPt = waypoints[Math.min(segmentIndex + 1, waypoints.length - 1)];

  const newPos = new THREE.Vector3().lerpVectors(startPt, endPt, segmentProgress);
  newPos.y = 0.01; // Asphalt level

  const dir = new THREE.Vector3().subVectors(endPt, startPt).normalize();
  const angle = Math.atan2(dir.x, dir.z);

  // Check Directional Red / Yellow traffic light stop
  const mustStopAtLight = checkTrafficLightStop({ ...vehicle, position: newPos }, waypoints);

  // Check obstacle / queue ahead
  const obstacle = getObstacleAhead({ ...vehicle, position: newPos }, allVehicles);

  let targetSpeed = vehicle.maxVelocity;

  if (mustStopAtLight) {
    targetSpeed = 0; // RED LIGHT DEAD STOP!
  } else if (obstacle) {
    if (obstacle.mustStop) {
      targetSpeed = 0; // STOP BEHIND LEAD CAR!
    } else {
      const gap = obstacle.distance - 6.0;
      const ratio = Math.max(0, Math.min(1, gap / 9.0));
      targetSpeed = obstacle.leadSpeed + ratio * (vehicle.maxVelocity - obstacle.leadSpeed);
    }
  }

  // Velocity update physics
  let newVelocity = vehicle.velocity;

  if (targetSpeed === 0) {
    // Decelerate firmly to a complete standstill (0 m/s)
    newVelocity = Math.max(0, newVelocity - 10.0 * delta);
  } else if (newVelocity > targetSpeed) {
    newVelocity = Math.max(targetSpeed, newVelocity - 5.0 * delta);
  } else {
    newVelocity = Math.min(targetSpeed, newVelocity + vehicle.acceleration * delta);
  }

  // Dead stop check
  if (newVelocity < 0.1 && targetSpeed === 0) {
    newVelocity = 0;
  }

  const isStopped = newVelocity === 0;

  // Calculate distance & progress
  let totalLength = 0;
  for (let i = 0; i < totalSegments; i++) {
    totalLength += waypoints[i].distanceTo(waypoints[i + 1]);
  }

  const distanceDelta = newVelocity * delta;
  const progressDelta = distanceDelta / Math.max(totalLength, 1);
  const newProgress = vehicle.pathProgress + progressDelta;

  // Despawn when vehicle reaches end of path
  if (newProgress >= 1) {
    return null;
  }

  return {
    ...vehicle,
    position: newPos,
    rotation: new THREE.Euler(0, angle, 0),
    velocity: newVelocity,
    pathProgress: newProgress,
    state: isStopped ? 'stopped' : newVelocity < vehicle.maxVelocity * 0.5 ? 'waiting' : 'moving',
    waitTime: isStopped ? vehicle.waitTime + delta : 0,
    totalDistance: vehicle.totalDistance + distanceDelta,
    targetVelocity: targetSpeed,
  };
}

// ─── Main simulation tick ────────────────────────────────────────
export function simulationTick(delta: number): void {
  const config = useSimulationStore.getState().config;
  if (config.isPaused) return;

  const adjustedDelta = delta * config.simulationSpeed;

  // Update traffic lights
  updateTrafficLights(adjustedDelta);

  // Spawn vehicles
  lastSpawnTime += adjustedDelta;
  const spawnInterval = 1 / Math.max(config.spawnRate, 0.1);
  if (lastSpawnTime >= spawnInterval) {
    lastSpawnTime = 0;
    const newVehicle = spawnVehicle();
    if (newVehicle) {
      useSimulationStore.getState().addVehicle(newVehicle);
    }
  }

  // Update vehicles
  const currentVehicles = useSimulationStore.getState().vehicles;
  const vehiclesMap = new Map(currentVehicles);
  const updatedVehicles = new Map<string, Vehicle>();

  vehiclesMap.forEach((vehicle, id) => {
    const updated = updateVehicle(vehicle, adjustedDelta, vehiclesMap);
    if (updated !== null) {
      updatedVehicles.set(id, updated);
    } else {
      throughputCounter++;
    }
  });

  useSimulationStore.setState({ vehicles: updatedVehicles });

  // Update analytics periodically
  analyticsTimer += adjustedDelta;
  if (analyticsTimer >= 0.5) {
    analyticsTimer = 0;
    updateAnalytics(updatedVehicles);
  }
}

// ─── Analytics computation ───────────────────────────────────────
function updateAnalytics(vehicles: Map<string, Vehicle>): void {
  const store = useSimulationStore.getState();
  const now = Date.now() / 1000;

  let totalSpeed = 0;
  let totalWaitTime = 0;
  let stoppedCount = 0;
  const vehicleCount = vehicles.size;

  vehicles.forEach((v) => {
    totalSpeed += v.velocity;
    totalWaitTime += v.waitTime;
    if (v.state === 'stopped') stoppedCount++;
  });

  const avgSpeed = vehicleCount > 0 ? totalSpeed / vehicleCount : 0;
  const avgWaitTime = vehicleCount > 0 ? totalWaitTime / vehicleCount : 0;
  const congestion = vehicleCount > 0 ? stoppedCount / vehicleCount : 0;

  const timeSinceLastTP = now - lastThroughputTime;
  let throughput = store.analytics.throughput;
  if (timeSinceLastTP >= 5) {
    throughput = (throughputCounter / Math.max(timeSinceLastTP, 1)) * 60;
    throughputCounter = 0;
    lastThroughputTime = now;
  }

  const junctionStats = JUNCTIONS.map((junction) => {
    let waiting = 0;
    let jWaitTime = 0;
    let jCount = 0;

    vehicles.forEach((v) => {
      const dist = v.position.distanceTo(junction.position);
      if (dist < junction.radius + 10) {
        jCount++;
        if (v.state === 'stopped' || v.state === 'waiting') {
          waiting++;
          jWaitTime += v.waitTime;
        }
      }
    });

    return {
      junctionId: junction.id,
      vehiclesWaiting: waiting,
      avgWaitTime: waiting > 0 ? jWaitTime / waiting : 0,
      throughput: 0,
      congestionLevel: jCount > 0 ? waiting / jCount : 0,
    };
  });

  const maxHistory = 60;
  const timeLabel = Math.floor(now) % 3600;

  const addDataPoint = (arr: DataPoint[], value: number): DataPoint[] => {
    const newArr = [...arr, { time: timeLabel, value }];
    if (newArr.length > maxHistory) newArr.shift();
    return newArr;
  };

  store.updateAnalytics({
    totalVehicles: vehicleCount,
    avgSpeed: Math.round(avgSpeed * 10) / 10,
    avgWaitTime: Math.round(avgWaitTime * 10) / 10,
    throughput: Math.round(throughput * 10) / 10,
    congestionLevel: Math.round(congestion * 100) / 100,
    junctionStats,
    speedHistory: addDataPoint(store.analytics.speedHistory, avgSpeed),
    vehicleCountHistory: addDataPoint(store.analytics.vehicleCountHistory, vehicleCount),
    congestionHistory: addDataPoint(store.analytics.congestionHistory, congestion * 100),
    throughputHistory: addDataPoint(store.analytics.throughputHistory, throughput),
  });
}

// ─── Reset simulation state ─────────────────────────────────────
export function resetSimulation(): void {
  vehicleIdCounter = 0;
  lastSpawnTime = 10;
  analyticsTimer = 0;
  throughputCounter = 0;
  lastThroughputTime = Date.now() / 1000;
  useSimulationStore.getState().reset();
  initializeTrafficLights();
}
