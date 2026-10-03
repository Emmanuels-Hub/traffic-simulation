import * as THREE from 'three';

// ─── Road Network Types ──────────────────────────────────────────
export interface RoadSegment {
  id: string;
  start: THREE.Vector3;
  end: THREE.Vector3;
  width: number;
  lanes: number;
  speedLimit: number;
  type: 'straight' | 'curve' | 'uturn';
  controlPoints?: THREE.Vector3[]; // For curves
}

export interface Junction {
  id: string;
  position: THREE.Vector3;
  type: 'cross' | 't-junction' | 'square' | 'uturn';
  connectedRoads: string[];
  trafficLight?: TrafficLight;
  radius: number;
}

export interface Lane {
  roadId: string;
  laneIndex: number;
  direction: THREE.Vector3;
  path: THREE.Vector3[];
}

// ─── Traffic Light Types ─────────────────────────────────────────
export type LightState = 'red' | 'yellow' | 'green';

export interface TrafficLightPhase {
  state: LightState;
  duration: number; // in seconds
  directions: string[]; // which road directions are active
}

export interface TrafficLight {
  id: string;
  junctionId: string;
  phases: TrafficLightPhase[];
  currentPhaseIndex: number;
  timer: number;
  mode: 'auto' | 'manual';
  position: THREE.Vector3;
  rotation: number;
}

// ─── Vehicle Types ──────────────────────────────────────────────
export type VehicleType = 'sedan' | 'suv' | 'truck' | 'bus' | 'sports';

export interface Vehicle {
  id: string;
  type: VehicleType;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  velocity: number;
  maxVelocity: number;
  acceleration: number;
  currentRoadId: string;
  currentLane: number;
  pathProgress: number; // 0-1 along current road
  route: string[]; // sequence of road IDs
  routeIndex: number;
  color: string;
  length: number;
  width: number;
  state: 'moving' | 'stopped' | 'waiting' | 'turning';
  waitTime: number;
  totalDistance: number;
  targetVelocity: number;
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
  throughput: number; // vehicles per minute passing through
  congestionLevel: number; // 0-1
  junctionStats: JunctionStats[];
  speedHistory: DataPoint[];
  vehicleCountHistory: DataPoint[];
  congestionHistory: DataPoint[];
  throughputHistory: DataPoint[];
}

export interface JunctionStats {
  junctionId: string;
  vehiclesWaiting: number;
  avgWaitTime: number;
  throughput: number;
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
  config: SimulationConfig;
  analytics: TrafficAnalytics;
  selectedJunction: string | null;
  selectedVehicle: string | null;
  viewMode: 'simulation' | 'analytics';
  
  // Actions
  setConfig: (config: Partial<SimulationConfig>) => void;
  addVehicle: (vehicle: Vehicle) => void;
  removeVehicle: (id: string) => void;
  updateVehicle: (id: string, updates: Partial<Vehicle>) => void;
  updateTrafficLight: (id: string, updates: Partial<TrafficLight>) => void;
  setSelectedJunction: (id: string | null) => void;
  setSelectedVehicle: (id: string | null) => void;
  setViewMode: (mode: 'simulation' | 'analytics') => void;
  updateAnalytics: (analytics: Partial<TrafficAnalytics>) => void;
  toggleTrafficLightMode: (id: string) => void;
  cycleTrafficLight: (id: string) => void;
  reset: () => void;
}
