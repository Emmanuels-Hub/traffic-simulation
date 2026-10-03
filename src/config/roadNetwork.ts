import * as THREE from 'three';
import type { Junction, TrafficLightPhase } from '../types';

// ─── City Layout Constants ───────────────────────────────────────
// The city is laid out on a grid. Units are in "meters" for realism.
// Origin (0,0,0) is the center of the city.

export const ROAD_WIDTH = 8;
export const LANE_WIDTH = 3.5;
export const SIDEWALK_WIDTH = 2;
export const BLOCK_SIZE = 60; // Distance between intersections
export const CITY_BOUNDS = 120; // Half-extent of the city

// ─── Road Path Definitions ──────────────────────────────────────
// Each route is a sequence of waypoints that vehicles follow.
// Roads form a connected network with 4 main junctions + T-junction + U-turn.

/*
  City Layout (top-down view):
  
       N
       |
  W ---+--- E
       |
       S

  Junction layout:
  
  J1 -------- J2
  |            |
  |    CITY    |     J5 (T-junction)
  |            |    /
  J3 -------- J4 --
                \
                 U-turn zone
                 
  J1 = NW intersection (cross)
  J2 = NE intersection (cross)  
  J3 = SW intersection (cross)
  J4 = SE intersection (cross + T-junction connection)
  J5 = T-junction (east side)
  U-turn at the south-east extension
*/

// Junction positions
export const JUNCTION_POSITIONS: Record<string, THREE.Vector3> = {
  J1: new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
  J2: new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
  J3: new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
  J4: new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
  J5: new THREE.Vector3(BLOCK_SIZE * 1.1, 0.01, 0), // T-junction east
};

// ─── Road Segments (center paths for each road) ─────────────────
export interface RoadPath {
  id: string;
  name: string;
  waypoints: THREE.Vector3[];
  bidirectional: boolean;
  speedLimit: number;
  type: 'main' | 'secondary' | 'connector';
}

export const ROAD_PATHS: RoadPath[] = [
  // Main square loop roads (forming the square)
  {
    id: 'R_N', name: 'North Road (J1→J2)',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
    ],
    bidirectional: true, speedLimit: 50, type: 'main',
  },
  {
    id: 'R_S', name: 'South Road (J3→J4)',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
    ],
    bidirectional: true, speedLimit: 50, type: 'main',
  },
  {
    id: 'R_W', name: 'West Road (J1→J3)',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
    ],
    bidirectional: true, speedLimit: 50, type: 'main',
  },
  {
    id: 'R_E', name: 'East Road (J2→J4)',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
    ],
    bidirectional: true, speedLimit: 50, type: 'main',
  },
  // T-junction connector (J2 → J5 and J4 → J5)
  {
    id: 'R_T_TOP', name: 'T-Junction Top (J2→J5)',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE * 1.1, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE * 1.1, 0.01, 0),
    ],
    bidirectional: true, speedLimit: 40, type: 'secondary',
  },
  {
    id: 'R_T_BOT', name: 'T-Junction Bottom (J4→J5)',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE * 1.1, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE * 1.1, 0.01, 0),
    ],
    bidirectional: true, speedLimit: 40, type: 'secondary',
  },
  // U-turn road (south extension from J4)
  {
    id: 'R_UTURN', name: 'U-Turn Road',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE),
      new THREE.Vector3(BLOCK_SIZE / 2 + 15, 0.01, BLOCK_SIZE + 12),
      new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, BLOCK_SIZE),
      new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2),
    ],
    bidirectional: false, speedLimit: 30, type: 'connector',
  },
];

// ─── Route Definitions (sequences of roads vehicles can take) ────
export interface Route {
  id: string;
  name: string;
  // Waypoints the vehicle follows from start to end
  waypoints: THREE.Vector3[];
}

// Pre-computed routes through the city
export const ROUTES: Route[] = [
  // Clockwise loop around the square
  {
    id: 'ROUTE_CW',
    name: 'Clockwise Square Loop',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 20, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 20, 0.01, -BLOCK_SIZE / 2 - 2),
    ],
  },
  // Counter-clockwise loop
  {
    id: 'ROUTE_CCW',
    name: 'Counter-clockwise Square Loop',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 20, 0.01, -BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 20, 0.01, -BLOCK_SIZE / 2 + 2),
    ],
  },
  // North to South through-route (West side)
  {
    id: 'ROUTE_NS_W',
    name: 'North-South West',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2 - 25),
      new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2 + 25),
    ],
  },
  // South to North through-route (West side)
  {
    id: 'ROUTE_SN_W',
    name: 'South-North West',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2 + 25),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2 - 25),
    ],
  },
  // West to East through-route (North side)
  {
    id: 'ROUTE_WE_N',
    name: 'West-East North',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, -BLOCK_SIZE / 2 - 2),
    ],
  },
  // East to West through-route (North side)
  {
    id: 'ROUTE_EW_N',
    name: 'East-West North',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, -BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, -BLOCK_SIZE / 2 + 2),
    ],
  },
  // West to T-junction route
  {
    id: 'ROUTE_W_TO_T',
    name: 'West to T-Junction',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 4),
      new THREE.Vector3(BLOCK_SIZE * 1.1 - 2, 0.01, -BLOCK_SIZE / 4),
      new THREE.Vector3(BLOCK_SIZE * 1.1 - 2, 0.01, 0),
      new THREE.Vector3(BLOCK_SIZE * 1.1, 0.01, 2),
      new THREE.Vector3(BLOCK_SIZE * 1.1 + 2, 0.01, 0),
      new THREE.Vector3(BLOCK_SIZE * 1.1 + 2, 0.01, BLOCK_SIZE / 4),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 4),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, BLOCK_SIZE / 2 + 2),
    ],
  },
  // U-turn route from J4
  {
    id: 'ROUTE_UTURN',
    name: 'U-Turn Route',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE + 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 12, 0.01, BLOCK_SIZE + 15),
      new THREE.Vector3(BLOCK_SIZE / 2 + 27, 0.01, BLOCK_SIZE + 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 27, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, -BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, -BLOCK_SIZE / 2 - 2),
    ],
  },
  // North to South through East side
  {
    id: 'ROUTE_NS_E',
    name: 'North-South East',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2 - 25),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, BLOCK_SIZE / 2 + 25),
    ],
  },
  // South to North through East side
  {
    id: 'ROUTE_SN_E',
    name: 'South-North East',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2 + 25),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2),
      new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, -BLOCK_SIZE / 2 - 25),
    ],
  },
  // West to East through South side
  {
    id: 'ROUTE_WE_S',
    name: 'West-East South',
    waypoints: [
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 - 2),
      new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, BLOCK_SIZE / 2 - 2),
    ],
  },
  // East to West through South side
  {
    id: 'ROUTE_EW_S',
    name: 'East-West South',
    waypoints: [
      new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2, 0.01, BLOCK_SIZE / 2 + 2),
      new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, BLOCK_SIZE / 2 + 2),
    ],
  },
];

// ─── Junction Definitions ────────────────────────────────────────
const createPhases = (dirs: string[][]): TrafficLightPhase[] => [
  { state: 'green', duration: 12, directions: dirs[0] },
  { state: 'yellow', duration: 3, directions: dirs[0] },
  { state: 'red', duration: 2, directions: [] },
  { state: 'green', duration: 12, directions: dirs[1] },
  { state: 'yellow', duration: 3, directions: dirs[1] },
  { state: 'red', duration: 2, directions: [] },
];

export const JUNCTIONS: Junction[] = [
  {
    id: 'J1', position: JUNCTION_POSITIONS.J1,
    type: 'cross', connectedRoads: ['R_N', 'R_W'], radius: ROAD_WIDTH,
    trafficLight: {
      id: 'TL_J1', junctionId: 'J1',
      phases: createPhases([['north', 'south'], ['east', 'west']]),
      currentPhaseIndex: 0, timer: 12, mode: 'auto',
      position: JUNCTION_POSITIONS.J1.clone(), rotation: 0,
    },
  },
  {
    id: 'J2', position: JUNCTION_POSITIONS.J2,
    type: 'cross', connectedRoads: ['R_N', 'R_E', 'R_T_TOP'], radius: ROAD_WIDTH,
    trafficLight: {
      id: 'TL_J2', junctionId: 'J2',
      phases: createPhases([['north', 'south'], ['east', 'west']]),
      currentPhaseIndex: 3, timer: 12, mode: 'auto',
      position: JUNCTION_POSITIONS.J2.clone(), rotation: 0,
    },
  },
  {
    id: 'J3', position: JUNCTION_POSITIONS.J3,
    type: 'cross', connectedRoads: ['R_S', 'R_W'], radius: ROAD_WIDTH,
    trafficLight: {
      id: 'TL_J3', junctionId: 'J3',
      phases: createPhases([['north', 'south'], ['east', 'west']]),
      currentPhaseIndex: 3, timer: 12, mode: 'auto',
      position: JUNCTION_POSITIONS.J3.clone(), rotation: 0,
    },
  },
  {
    id: 'J4', position: JUNCTION_POSITIONS.J4,
    type: 'cross', connectedRoads: ['R_S', 'R_E', 'R_T_BOT', 'R_UTURN'], radius: ROAD_WIDTH,
    trafficLight: {
      id: 'TL_J4', junctionId: 'J4',
      phases: createPhases([['north', 'south'], ['east', 'west']]),
      currentPhaseIndex: 0, timer: 12, mode: 'auto',
      position: JUNCTION_POSITIONS.J4.clone(), rotation: 0,
    },
  },
  {
    id: 'J5', position: JUNCTION_POSITIONS.J5,
    type: 't-junction', connectedRoads: ['R_T_TOP', 'R_T_BOT'], radius: ROAD_WIDTH,
    trafficLight: {
      id: 'TL_J5', junctionId: 'J5',
      phases: [
        { state: 'green', duration: 15, directions: ['north'] },
        { state: 'yellow', duration: 3, directions: ['north'] },
        { state: 'red', duration: 2, directions: [] },
        { state: 'green', duration: 15, directions: ['south'] },
        { state: 'yellow', duration: 3, directions: ['south'] },
        { state: 'red', duration: 2, directions: [] },
      ],
      currentPhaseIndex: 0, timer: 15, mode: 'auto',
      position: JUNCTION_POSITIONS.J5.clone(), rotation: Math.PI / 2,
    },
  },
];

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
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  type: 'residential' | 'commercial' | 'office' | 'park';
}

export const BUILDINGS: BuildingConfig[] = [
  // Inner block (between the 4 junctions)
  { position: [-10, 0, -10], size: [12, 8, 12], color: '#7f8c8d', type: 'office' },
  { position: [10, 0, -8], size: [10, 6, 14], color: '#95a5a6', type: 'commercial' },
  { position: [-8, 0, 10], size: [14, 10, 10], color: '#bdc3c7', type: 'office' },
  { position: [10, 0, 10], size: [10, 7, 10], color: '#7f8c8d', type: 'residential' },
  { position: [0, 0, 0], size: [8, 4, 8], color: '#27ae60', type: 'park' },
  
  // Outer buildings - North West
  { position: [-BLOCK_SIZE / 2 - 18, 4.5, -BLOCK_SIZE / 2 - 18], size: [14, 9, 14], color: '#8e99a4', type: 'residential' },
  { position: [-BLOCK_SIZE / 2 - 35, 3, -BLOCK_SIZE / 2 - 12], size: [10, 6, 10], color: '#a4b0be', type: 'commercial' },
  
  // Outer buildings - North East
  { position: [BLOCK_SIZE / 2 + 18, 5, -BLOCK_SIZE / 2 - 18], size: [12, 10, 12], color: '#636e72', type: 'office' },
  
  // Outer buildings - South West
  { position: [-BLOCK_SIZE / 2 - 18, 3.5, BLOCK_SIZE / 2 + 18], size: [12, 7, 14], color: '#b2bec3', type: 'residential' },
  { position: [-BLOCK_SIZE / 2 - 35, 4, BLOCK_SIZE / 2 + 12], size: [10, 8, 10], color: '#dfe6e9', type: 'commercial' },
  
  // Outer buildings - South East
  { position: [BLOCK_SIZE / 2 + 18, 4, BLOCK_SIZE / 2 + 18], size: [10, 8, 10], color: '#636e72', type: 'office' },
  
  // T-junction area buildings
  { position: [BLOCK_SIZE * 1.1 + 15, 3, -10], size: [10, 6, 14], color: '#95a5a6', type: 'commercial' },
  { position: [BLOCK_SIZE * 1.1 + 15, 4, 10], size: [12, 8, 12], color: '#7f8c8d', type: 'residential' },
  
  // U-turn area
  { position: [BLOCK_SIZE / 2 + 12, 2.5, BLOCK_SIZE + 20], size: [8, 5, 8], color: '#a4b0be', type: 'commercial' },
];

// ─── Tree Positions ──────────────────────────────────────────────
export const TREE_POSITIONS: [number, number, number][] = [
  [-5, 0, -22], [5, 0, -22], [-22, 0, -5], [-22, 0, 5],
  [22, 0, -5], [22, 0, 5], [-5, 0, 22], [5, 0, 22],
  [-BLOCK_SIZE / 2 - 10, 0, -BLOCK_SIZE / 2 + 8],
  [BLOCK_SIZE / 2 + 10, 0, -BLOCK_SIZE / 2 + 8],
  [-BLOCK_SIZE / 2 - 10, 0, BLOCK_SIZE / 2 - 8],
  [BLOCK_SIZE / 2 + 10, 0, BLOCK_SIZE / 2 - 8],
  [BLOCK_SIZE * 1.1 + 5, 0, -15],
  [BLOCK_SIZE * 1.1 + 5, 0, 15],
  [0, 0, -3], [0, 0, 3], [-3, 0, 0], [3, 0, 0],
];

// ─── Spawn / Despawn points (edges of the map) ──────────────────
export const SPAWN_POINTS: THREE.Vector3[] = [
  new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, -BLOCK_SIZE / 2 - 2),
  new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, -BLOCK_SIZE / 2 + 2),
  new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, BLOCK_SIZE / 2 - 2),
  new THREE.Vector3(-BLOCK_SIZE / 2 - 25, 0.01, BLOCK_SIZE / 2 + 2),
  new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, -BLOCK_SIZE / 2 - 2),
  new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, -BLOCK_SIZE / 2 + 2),
  new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, BLOCK_SIZE / 2 - 2),
  new THREE.Vector3(BLOCK_SIZE / 2 + 25, 0.01, BLOCK_SIZE / 2 + 2),
  new THREE.Vector3(-BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2 - 25),
  new THREE.Vector3(-BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2 + 25),
  new THREE.Vector3(BLOCK_SIZE / 2 + 2, 0.01, -BLOCK_SIZE / 2 - 25),
  new THREE.Vector3(BLOCK_SIZE / 2 - 2, 0.01, BLOCK_SIZE / 2 + 25),
];
