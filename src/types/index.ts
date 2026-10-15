import * as THREE from 'three';

// ─── Road Network Types ──────────────────────────────────────────
export type Direction = 'north' | 'south' | 'east' | 'west';

export interface Junction {
  id: string;
  position: THREE.Vector3;
  type: 'cross' | 't-junction';
  trafficLight: TrafficLight;
  radius: number;
}

// ─── Traffic Light Types ─────────────────────────────────────────
export type LightState = 'red' | 'yellow' | 'green';

export interface TrafficLightPhase {
  state: LightState;
  duration: number; // in seconds
  directions: Direction[]; // travel directions that get this phase's state (others are red)
}

export interface TrafficLight {
  id: string;
  junctionId: string;
  phases: TrafficLightPhase[];
  currentPhaseIndex: number;
  phaseEndsAt: number; // simulation time (s) when the current phase ends in auto mode
  mode: 'auto' | 'manual';
  position: THREE.Vector3;
}

// ─── Vehicle Types ──────────────────────────────────────────────
export type VehicleType = 'sedan' | 'suv' | 'truck' | 'bus' | 'sports';
export type VehicleState = 'moving' | 'stopped' | 'waiting' | 'turning';
export type StopReason = 'signal' | 'yield' | 'blocked-exit' | 'vehicle' | 'curve' | null;

export interface Vehicle {
  id: string;
  type: VehicleType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: number; // m/s
  maxVelocity: number; // desired free-road speed (m/s)
  acceleration: number; // max acceleration (m/s²)
  currentAccel: number; // acceleration applied in the last step (m/s², negative = braking)
  routeId: string;
  pathDistance: number; // arc length travelled along the route path (m)
  nextMovementIndex: number; // first junction movement on the route not yet cleared
  committedMovementIndex: number; // movement the vehicle decided to proceed through on yellow/red (-1 = none)
  color: string;
  length: number;
  width: number;
  state: VehicleState;
  waitTime: number; // accumulated time spent queued during this trip (s)
  lineWait: number; // continuous time spent stopped at the head of a junction queue (s)
  totalDistance: number;
  targetVelocity: number;
  stopReason: StopReason; // constraint currently limiting the vehicle's speed
  blockedBy: string | null; // vehicle responsible for the constraint, if any
}

// ─── Simulation Types ───────────────────────────────────────────
export interface SimulationConfig {
  maxVehicles: number;
  spawnRate: number; // vehicles per second
  simulationSpeed: number; // multiplier
  isPaused: boolean;
  showDebugInfo: boolean;
  timeOfDay: number; // 0-24
  weatherCondition: 'clear' | 'rain' | 'fog';
}

export interface TrafficAnalytics {
  totalVehicles: number;
  avgSpeed: number;
  avgWaitTime: number;
  throughput: number; // vehicles per minute completing their trip
  congestionLevel: number; // 0-1
  junctionStats: JunctionStats[];
  vehicleTypeCounts: Record<VehicleType, number>;
  vehicleStateCounts: Record<VehicleState, number>;
  speedHistory: DataPoint[];
  vehicleCountHistory: DataPoint[];
  congestionHistory: DataPoint[];
  throughputHistory: DataPoint[];
}

export interface JunctionStats {
  junctionId: string;
  vehiclesWaiting: number;
  avgWaitTime: number;
  throughput: number; // vehicles per minute clearing the junction
  congestionLevel: number;
}

export interface DataPoint {
  time: number;
  value: number;
}

// ─── Store Types ─────────────────────────────────────────────────
export interface SimulationStore {
  // State
  vehicles: Map<string, Vehicle>;
  trafficLights: Map<string, TrafficLight>;
  simTime: number;
  config: SimulationConfig;
  analytics: TrafficAnalytics;
  selectedJunction: string | null;
  selectedVehicle: string | null;
  viewMode: 'simulation' | 'analytics';

  // Actions
  setConfig: (config: Partial<SimulationConfig>) => void;
  setSelectedJunction: (id: string | null) => void;
  setSelectedVehicle: (id: string | null) => void;
  setViewMode: (mode: 'simulation' | 'analytics') => void;
  updateAnalytics: (analytics: Partial<TrafficAnalytics>) => void;
  toggleTrafficLightMode: (id: string) => void;
  cycleTrafficLight: (id: string) => void;
  reset: () => void;
}
