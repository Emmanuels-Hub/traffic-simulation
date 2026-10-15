import * as THREE from 'three';
import type { Direction, Junction, TrafficLight, TrafficLightPhase, VehicleType } from '../types';

// ─── City Layout Constants ───────────────────────────────────────
// Units are metres. Origin is the city centre; -Z is north, +X is east.
// Traffic drives on the LEFT: each lane centre is offset LANE_OFFSET to
// the left of the road centre line, relative to the travel direction.

export const ROAD_WIDTH = 8;
export const LANE_OFFSET = 2;
export const SIDEWALK_WIDTH = 1.5;
export const BLOCK_SIZE = 60; // Distance between intersections
export const STOP_LINE_OFFSET = 8; // Stop line distance from junction centre
export const CROSSWALK_START = ROAD_WIDTH / 2 + 0.5;
export const CROSSWALK_END = STOP_LINE_OFFSET - 0.5;
export const JUNCTION_EXIT_OFFSET = ROAD_WIDTH / 2 + 1; // Point where a vehicle's rear has cleared the junction box

/*
  City Layout (top-down view, north up):

   XN1          XN2
    |            |
  XW1 ─ J1 ──── J2 ──── CNE
        |        |        |
        |  CITY  |       J5 ── XE5   (T-junction)
        |        |        |
  XW3 ─ J3 ──── J4 ──── CSE
        |        |
       XS3      UT  (U-turn bulb)
*/

const H = BLOCK_SIZE / 2;
const T_X = BLOCK_SIZE * 1.1;
const EXIT = 75;

export type NodeKind = 'junction' | 'bend' | 'exit' | 'uturn';

export interface NetworkNode {
  id: string;
  kind: NodeKind;
  position: THREE.Vector3;
}

const node = (id: string, kind: NodeKind, x: number, z: number): NetworkNode => ({
  id, kind, position: new THREE.Vector3(x, 0, z),
});

export const NODES: Record<string, NetworkNode> = Object.fromEntries([
  node('J1', 'junction', -H, -H),
  node('J2', 'junction', H, -H),
  node('J3', 'junction', -H, H),
  node('J4', 'junction', H, H),
  node('J5', 'junction', T_X, 0),
  node('CNE', 'bend', T_X, -H),
  node('CSE', 'bend', T_X, H),
  node('UT', 'uturn', H, BLOCK_SIZE),
  node('XW1', 'exit', -EXIT, -H),
  node('XN1', 'exit', -H, -EXIT),
  node('XN2', 'exit', H, -EXIT),
  node('XW3', 'exit', -EXIT, H),
  node('XS3', 'exit', -H, EXIT),
  node('XE5', 'exit', T_X + 40, 0),
].map((n) => [n.id, n]));

// Two-way road segments between nodes (all axis-aligned)
export const EDGES: [string, string][] = [
  ['J1', 'J2'], ['J3', 'J4'], ['J1', 'J3'], ['J2', 'J4'],
  ['J2', 'CNE'], ['CNE', 'J5'], ['J4', 'CSE'], ['CSE', 'J5'],
  ['J5', 'XE5'], ['J4', 'UT'],
  ['J1', 'XW1'], ['J1', 'XN1'], ['J2', 'XN2'], ['J3', 'XW3'], ['J3', 'XS3'],
];

// U-turn turning circle at the end of J4's south arm
export const UTURN_BULB = {
  center: new THREE.Vector3(H, 0, BLOCK_SIZE + 10),
  radius: 10,
  islandRadius: 3.5,
  laneRadius: 6.5,
};

// ─── Direction helpers ───────────────────────────────────────────
export const DIRECTION_VECTORS: Record<Direction, THREE.Vector3> = {
  north: new THREE.Vector3(0, 0, -1),
  south: new THREE.Vector3(0, 0, 1),
  east: new THREE.Vector3(1, 0, 0),
  west: new THREE.Vector3(-1, 0, 0),
};

export function directionName(d: THREE.Vector3): Direction {
  if (Math.abs(d.x) > Math.abs(d.z)) return d.x > 0 ? 'east' : 'west';
  return d.z < 0 ? 'north' : 'south';
}

/** Unit vector pointing to the driver's left for travel direction `d`. */
export function leftOf(d: THREE.Vector3): THREE.Vector3 {
  return new THREE.Vector3(d.z, 0, -d.x);
}

/** Travel directions of traffic entering a junction (one per connected arm). */
export function getJunctionApproaches(junctionId: string): Direction[] {
  const center = NODES[junctionId].position;
  const approaches: Direction[] = [];
  for (const [a, b] of EDGES) {
    const other = a === junctionId ? b : b === junctionId ? a : null;
    if (!other) continue;
    const towardJunction = center.clone().sub(NODES[other].position).normalize();
    approaches.push(directionName(towardJunction));
  }
  return approaches;
}

// ─── Junctions & Traffic Lights ──────────────────────────────────
const createPhases = (groups: Direction[][], green = 12): TrafficLightPhase[] =>
  groups.flatMap((dirs) => [
    { state: 'green' as const, duration: green, directions: dirs },
    { state: 'yellow' as const, duration: 3, directions: dirs },
    { state: 'red' as const, duration: 2, directions: [] }, // all-red clearance
  ]);

const makeJunction = (
  id: string,
  type: Junction['type'],
  groups: Direction[][],
  startPhase: number,
  green = 12,
): Junction => {
  const phases = createPhases(groups, green);
  return {
    id,
    type,
    position: NODES[id].position,
    radius: ROAD_WIDTH,
    trafficLight: {
      id: `TL_${id}`,
      junctionId: id,
      phases,
      currentPhaseIndex: startPhase,
      phaseEndsAt: phases[startPhase].duration,
      mode: 'auto',
      position: NODES[id].position.clone(),
    },
  };
};

const NS_EW: Direction[][] = [['north', 'south'], ['east', 'west']];

export const JUNCTIONS: Junction[] = [
  makeJunction('J1', 'cross', NS_EW, 0),
  makeJunction('J2', 'cross', NS_EW, 3),
  makeJunction('J3', 'cross', NS_EW, 3),
  makeJunction('J4', 'cross', NS_EW, 0),
  // T-junction: main road (north/south) vs. the stem from the east (westbound)
  makeJunction('J5', 't-junction', [['north', 'south'], ['west']], 0, 15),
];

export function createInitialTrafficLights(): Map<string, TrafficLight> {
  return new Map(
    JUNCTIONS.map((j) => [j.trafficLight.id, { ...j.trafficLight, position: j.trafficLight.position.clone() }])
  );
}

// ─── Route Definitions (node sequences vehicles drive along) ─────
export interface RouteDef {
  id: string;
  name: string;
  nodes: string[];
}

export const ROUTE_DEFS: RouteDef[] = [
  { id: 'ROUTE_WE_T', name: 'West → East via T-Junction', nodes: ['XW1', 'J1', 'J2', 'CNE', 'J5', 'XE5'] },
  { id: 'ROUTE_EW_T', name: 'East → West via T-Junction', nodes: ['XE5', 'J5', 'CNE', 'J2', 'J1', 'XW1'] },
  { id: 'ROUTE_NS_W', name: 'North → South (West)', nodes: ['XN1', 'J1', 'J3', 'XS3'] },
  { id: 'ROUTE_SN_W', name: 'South → North (West)', nodes: ['XS3', 'J3', 'J1', 'XN1'] },
  { id: 'ROUTE_WE_S', name: 'West → East (South)', nodes: ['XW3', 'J3', 'J4', 'CSE', 'J5', 'XE5'] },
  { id: 'ROUTE_EW_S', name: 'East → West (South)', nodes: ['XE5', 'J5', 'CSE', 'J4', 'J3', 'XW3'] },
  { id: 'ROUTE_CW', name: 'Clockwise Square Loop', nodes: ['XW1', 'J1', 'J2', 'J4', 'J3', 'J1', 'XN1'] },
  { id: 'ROUTE_CCW', name: 'Counter-clockwise Square Loop', nodes: ['XN1', 'J1', 'J3', 'J4', 'J2', 'J1', 'XW1'] },
  { id: 'ROUTE_T_THROUGH', name: 'Through the T-Junction', nodes: ['XW1', 'J1', 'J2', 'CNE', 'J5', 'CSE', 'J4', 'J3', 'XS3'] },
  { id: 'ROUTE_UTURN_A', name: 'U-Turn (from West)', nodes: ['XW3', 'J3', 'J4', 'UT', 'J4', 'J2', 'XN2'] },
  { id: 'ROUTE_UTURN_B', name: 'U-Turn (from North)', nodes: ['XN2', 'J2', 'J4', 'UT', 'J4', 'J3', 'XW3'] },
  { id: 'ROUTE_N2_T', name: 'North → T-Junction', nodes: ['XN2', 'J2', 'CNE', 'J5', 'XE5'] },
  { id: 'ROUTE_T_UTURN', name: 'T-Junction → U-Turn', nodes: ['XE5', 'J5', 'CSE', 'J4', 'UT', 'J4', 'J2', 'XN2'] },
  { id: 'ROUTE_S3_T', name: 'South-West → T-Junction → North', nodes: ['XS3', 'J3', 'J4', 'CSE', 'J5', 'CNE', 'J2', 'XN2'] },
];

// ─── Vehicle Specs (shared by physics and rendering) ─────────────
export interface VehicleSpec {
  length: number;
  width: number;
  maxSpeed: number; // m/s
  acceleration: number; // m/s²
  bodyH: number;
  cabinH: number;
  cabinL: number;
  wheelR: number;
  weight: number; // spawn probability weight
}

export const VEHICLE_SPECS: Record<VehicleType, VehicleSpec> = {
  sedan: { length: 4.5, width: 1.8, maxSpeed: 13.9, acceleration: 2.0, bodyH: 0.9, cabinH: 0.7, cabinL: 2.2, wheelR: 0.35, weight: 35 },
  suv: { length: 4.8, width: 2.0, maxSpeed: 13.0, acceleration: 1.8, bodyH: 1.1, cabinH: 0.8, cabinL: 2.6, wheelR: 0.4, weight: 25 },
  truck: { length: 6.5, width: 2.3, maxSpeed: 11.1, acceleration: 1.2, bodyH: 1.3, cabinH: 1.0, cabinL: 1.8, wheelR: 0.45, weight: 15 },
  bus: { length: 8.0, width: 2.5, maxSpeed: 11.1, acceleration: 1.0, bodyH: 1.2, cabinH: 1.2, cabinL: 6.0, wheelR: 0.45, weight: 10 },
  sports: { length: 4.2, width: 1.9, maxSpeed: 15.3, acceleration: 3.0, bodyH: 0.7, cabinH: 0.5, cabinL: 1.8, wheelR: 0.3, weight: 15 },
};

// ─── Vehicle Colors Palette ──────────────────────────────────────
export const VEHICLE_COLORS = [
  '#e74c3c', // Red
  '#3498db', // Blue
  '#2ecc71', // Green
  '#f39c12', // Orange
  '#9b59b6', // Purple
  '#1abc9c', // Teal
  '#e67e22', // Dark Orange
  '#34495e', // Dark Blue
  '#ecf0f1', // White
  '#2c3e50', // Navy
  '#f1c40f', // Yellow
  '#e91e63', // Pink
];

// ─── Building Positions ──────────────────────────────────────────
export interface BuildingConfig {
  position: [number, number];
  size: [number, number, number];
  color: string;
  type: 'residential' | 'commercial' | 'office' | 'park';
}

export const BUILDINGS: BuildingConfig[] = [
  // Inner block (between the 4 junctions)
  { position: [-10, -10], size: [12, 8, 12], color: '#7f8c8d', type: 'office' },
  { position: [10, -8], size: [10, 6, 14], color: '#95a5a6', type: 'commercial' },
  { position: [-8, 10], size: [14, 10, 10], color: '#bdc3c7', type: 'office' },
  { position: [10, 10], size: [10, 7, 10], color: '#7f8c8d', type: 'residential' },
  { position: [0, 0], size: [8, 0.2, 8], color: '#27ae60', type: 'park' },

  // North West
  { position: [-H - 18, -H - 18], size: [14, 9, 14], color: '#8e99a4', type: 'residential' },
  { position: [-H - 35, -H - 12], size: [10, 6, 10], color: '#a4b0be', type: 'commercial' },
  // North East
  { position: [H + 18, -H - 18], size: [12, 10, 12], color: '#636e72', type: 'office' },
  // South West
  { position: [-H - 18, H + 18], size: [12, 7, 14], color: '#b2bec3', type: 'residential' },
  { position: [-H - 35, H + 12], size: [10, 8, 10], color: '#dfe6e9', type: 'commercial' },
  // South East
  { position: [H + 18, H + 18], size: [10, 8, 10], color: '#636e72', type: 'office' },
  // T-junction area (clear of the stem road at z = 0)
  { position: [T_X + 15, -14], size: [10, 6, 12], color: '#95a5a6', type: 'commercial' },
  { position: [T_X + 15, 15], size: [12, 8, 12], color: '#7f8c8d', type: 'residential' },
  // U-turn area
  { position: [H + 20, BLOCK_SIZE + 18], size: [8, 5, 8], color: '#a4b0be', type: 'commercial' },
];

// ─── Tree Positions ──────────────────────────────────────────────
export const TREE_POSITIONS: [number, number, number][] = [
  [-5, 0, -22], [5, 0, -22], [-22, 0, -5], [-22, 0, 5],
  [22, 0, -5], [22, 0, 5], [-5, 0, 22], [5, 0, 22],
  [-H - 10, 0, -H + 8],
  [H + 10, 0, -H + 8],
  [-H - 10, 0, H - 8],
  [H + 10, 0, H - 8],
  [T_X + 8, 0, -20],
  [T_X + 8, 0, 22],
  [-2.5, 0, -2.5], [2.5, 0, 2.5], [-2.5, 0, 2.5], [2.5, 0, -2.5],
];

// ─── Street Lamp Positions ───────────────────────────────────────
export const STREET_LAMPS: [number, number, number][] = [
  [-H - 6, 0, -H - 6],
  [H + 6, 0, -H - 6],
  [-H - 6, 0, H + 6],
  [H + 6, 0, H + 6],
  [-H - 6, 0, 0],
  [H + 6, 0, 0],
  [0, 0, -H - 6],
  [0, 0, H + 6],
  [T_X + 8, 0, -7],
  [T_X + 8, 0, 7],
];
