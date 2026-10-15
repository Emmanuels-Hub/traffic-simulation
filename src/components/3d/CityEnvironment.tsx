import React, { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import {
  ROAD_WIDTH,
  SIDEWALK_WIDTH,
  STOP_LINE_OFFSET,
  CROSSWALK_START,
  CROSSWALK_END,
  BUILDINGS,
  TREE_POSITIONS,
  STREET_LAMPS,
  NODES,
  EDGES,
  JUNCTIONS,
  UTURN_BULB,
  DIRECTION_VECTORS,
  getJunctionApproaches,
  leftOf,
  type NetworkNode,
} from '../../config/roadNetwork';

type Rect = { pos: [number, number, number]; size: [number, number] };
type Box = { pos: [number, number, number]; size: [number, number, number] };

// ─── Instanced helpers: one draw call per material for repeated geometry ─
const FLAT_PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
const UNIT_BOX = new THREE.BoxGeometry(1, 1, 1);
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);

/** Flat rectangles on the ground (markings, road surfaces). */
const FlatRects: React.FC<{ rects: Rect[]; color: string; roughness?: number }> = ({ rects, color, roughness = 0.6 }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    rects.forEach((r, i) => {
      m.compose(new THREE.Vector3(...r.pos), new THREE.Quaternion(), new THREE.Vector3(r.size[0], 1, r.size[1]));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [rects]);
  return (
    <instancedMesh ref={ref} args={[FLAT_PLANE, undefined, rects.length]} receiveShadow>
      <meshStandardMaterial color={color} roughness={roughness} metalness={0.1} />
    </instancedMesh>
  );
};

type Placement = { pos: [number, number, number]; scale: [number, number, number]; rotY?: number };

/** Instanced boxes or vertical planes with per-instance position/scale/rotation. */
const Instances: React.FC<{
  items: Placement[];
  geometry: THREE.BufferGeometry;
  castShadow?: boolean;
  children: React.ReactNode;
}> = ({ items, geometry, castShadow, children }) => {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.rotY ?? 0);
      m.compose(new THREE.Vector3(...it.pos), q, new THREE.Vector3(...it.scale));
      mesh.setMatrixAt(i, m);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [items]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} castShadow={castShadow} receiveShadow>
      {children}
    </instancedMesh>
  );
};

const ROAD_Y = 0.02;
const MARK_Y = 0.03;
const CURB_H = 0.15;

/** Axis-aligned rectangle (in the XZ plane) spanning `from`→`to` with the given width. */
function stripRect(from: THREE.Vector3, to: THREE.Vector3, width: number, y: number): Rect {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const len = from.distanceTo(to);
  const alongX = Math.abs(to.x - from.x) > Math.abs(to.z - from.z);
  return { pos: [mid.x, y, mid.z], size: alongX ? [len, width] : [width, len] };
}

function edgeGeometry(a: NetworkNode, b: NetworkNode) {
  const d = b.position.clone().sub(a.position).normalize();
  return { d, len: a.position.distanceTo(b.position) };
}

/** Directions (unit vectors) of all roads leaving a node. */
function nodeArms(nodeId: string): THREE.Vector3[] {
  const arms: THREE.Vector3[] = [];
  for (const [a, b] of EDGES) {
    if (a === nodeId) arms.push(NODES[b].position.clone().sub(NODES[a].position).normalize());
    if (b === nodeId) arms.push(NODES[a].position.clone().sub(NODES[b].position).normalize());
  }
  return arms;
}

const hasArm = (arms: THREE.Vector3[], dir: THREE.Vector3) => arms.some((v) => v.dot(dir) > 0.9);

// ─── Road Surface ────────────────────────────────────────────────
const RoadSurface: React.FC = () => {
  const roads = useMemo(() => {
    return EDGES.map(([ia, ib]) => {
      const a = NODES[ia];
      const b = NODES[ib];
      const { d } = edgeGeometry(a, b);
      // Extend into junctions/bends so the corner squares are paved
      const extA = a.kind === 'exit' ? 0 : ROAD_WIDTH / 2;
      const extB = b.kind === 'exit' ? 0 : ROAD_WIDTH / 2;
      return stripRect(
        a.position.clone().addScaledVector(d, -extA),
        b.position.clone().addScaledVector(d, extB),
        ROAD_WIDTH,
        ROAD_Y
      );
    });
  }, []);

  const c = UTURN_BULB.center;
  return (
    <group>
      <FlatRects rects={roads} color="#2d2d2d" roughness={0.9} />

      {/* U-turn bulb with central island */}
      <mesh position={[c.x, ROAD_Y, c.z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[UTURN_BULB.radius, 48]} />
        <meshStandardMaterial color="#2d2d2d" roughness={0.9} metalness={0.1} />
      </mesh>
      <mesh position={[c.x, CURB_H / 2, c.z]} receiveShadow castShadow>
        <cylinderGeometry args={[UTURN_BULB.islandRadius, UTURN_BULB.islandRadius, CURB_H, 32]} />
        <meshStandardMaterial color="#8e8e8e" roughness={0.8} />
      </mesh>
      <mesh position={[c.x, CURB_H + 0.01, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[UTURN_BULB.islandRadius - 0.3, 32]} />
        <meshStandardMaterial color="#3e8e41" roughness={0.9} />
      </mesh>
    </group>
  );
};

// ─── Lane Markings ───────────────────────────────────────────────
const LaneMarkings: React.FC = () => {
  const { dashes, stopLines, crosswalks } = useMemo(() => {
    const dashes: Rect[] = [];
    const stopLines: Rect[] = [];
    const crosswalks: Rect[] = [];
    const dashLength = 2;
    const gapLength = 2;

    const trimFor = (n: NetworkNode) =>
      n.kind === 'junction' ? STOP_LINE_OFFSET + 0.5 : n.kind === 'bend' ? ROAD_WIDTH / 2 : 0;

    // Dashed centre line on every road
    for (const [ia, ib] of EDGES) {
      const a = NODES[ia];
      const b = NODES[ib];
      const { d, len } = edgeGeometry(a, b);
      const start = trimFor(a);
      const end = len - trimFor(b);
      for (let t = start; t + dashLength <= end; t += dashLength + gapLength) {
        dashes.push(stripRect(
          a.position.clone().addScaledVector(d, t),
          a.position.clone().addScaledVector(d, t + dashLength),
          0.15,
          MARK_Y
        ));
      }
    }

    for (const junction of JUNCTIONS) {
      const center = junction.position;
      for (const dir of getJunctionApproaches(junction.id)) {
        const f = DIRECTION_VECTORS[dir];
        const l = leftOf(f);
        // Stop line across the approach half of the road only
        const stopCenter = center.clone().addScaledVector(f, -STOP_LINE_OFFSET).addScaledVector(l, ROAD_WIDTH / 4);
        stopLines.push(stripRect(
          stopCenter.clone().addScaledVector(l, -(ROAD_WIDTH / 4 - 0.2)),
          stopCenter.clone().addScaledVector(l, ROAD_WIDTH / 4 - 0.2),
          0.4,
          MARK_Y
        ));
        // Zebra crosswalk across the whole arm
        for (let off = -ROAD_WIDTH / 2 + 0.75; off <= ROAD_WIDTH / 2 - 0.5; off += 1.0) {
          const base = center.clone().addScaledVector(l, off);
          crosswalks.push(stripRect(
            base.clone().addScaledVector(f, -CROSSWALK_START),
            base.clone().addScaledVector(f, -CROSSWALK_END),
            0.5,
            MARK_Y
          ));
        }
      }
    }
    return { dashes, stopLines, crosswalks };
  }, []);

  return (
    <group>
      <FlatRects rects={dashes} color="#e8c547" />
      <FlatRects rects={[...stopLines, ...crosswalks]} color="#f2f2f2" />
    </group>
  );
};

// ─── Sidewalks ───────────────────────────────────────────────────
const Sidewalks: React.FC = () => {
  const walks = useMemo(() => {
    const out: Box[] = [];
    const offset = ROAD_WIDTH / 2 + SIDEWALK_WIDTH / 2;

    // How far to trim a sidewalk at node `n` on the side `side`:
    // stop at a crossing road, wrap around the outside of a bend, else run to the node.
    const trimAt = (n: NetworkNode, side: THREE.Vector3): number => {
      if (n.kind === 'exit') return 0;
      if (n.kind === 'uturn') return -1.2;
      const arms = nodeArms(n.id);
      if (hasArm(arms, side)) return ROAD_WIDTH / 2;
      if (n.kind === 'bend') return -(ROAD_WIDTH / 2 + SIDEWALK_WIDTH);
      return 0;
    };

    for (const [ia, ib] of EDGES) {
      const a = NODES[ia];
      const b = NODES[ib];
      const { d, len } = edgeGeometry(a, b);
      for (const sign of [-1, 1]) {
        const side = leftOf(d).multiplyScalar(sign);
        const start = trimAt(a, side);
        const end = len - trimAt(b, side);
        if (end <= start) continue;
        const from = a.position.clone().addScaledVector(d, start).addScaledVector(side, offset);
        const to = a.position.clone().addScaledVector(d, end).addScaledVector(side, offset);
        const r = stripRect(from, to, SIDEWALK_WIDTH, CURB_H / 2);
        out.push({ pos: r.pos, size: [r.size[0], CURB_H, r.size[1]] });
      }
    }
    return out;
  }, []);

  const c = UTURN_BULB.center;
  const mouth = Math.asin((ROAD_WIDTH / 2) / (UTURN_BULB.radius + SIDEWALK_WIDTH / 2)) + 0.05;
  return (
    <group>
      <Instances items={walks.map((w) => ({ pos: w.pos, scale: w.size }))} geometry={UNIT_BOX}>
        <meshStandardMaterial color="#8e8e8e" roughness={0.8} />
      </Instances>
      {/* Kerb around the U-turn bulb, open where the road enters */}
      <mesh position={[c.x, CURB_H, c.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[UTURN_BULB.radius, UTURN_BULB.radius + SIDEWALK_WIDTH, 48, 1, Math.PI / 2 + mouth, Math.PI * 2 - 2 * mouth]} />
        <meshStandardMaterial color="#8e8e8e" roughness={0.8} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};

// ─── Buildings (bodies + all windows instanced) ──────────────────
const Buildings: React.FC<{ isNight: boolean }> = ({ isNight }) => {
  const { bodies, roofs, windows } = useMemo(() => {
    const bodies: { pos: [number, number, number]; size: [number, number, number]; color: string; park: boolean }[] = [];
    const roofs: Placement[] = [];
    const windows: Placement[] = [];
    for (const b of BUILDINGS) {
      const [bx, bz] = b.position;
      const size = b.size;
      bodies.push({ pos: [bx, size[1] / 2, bz], size, color: b.color, park: b.type === 'park' });
      if (b.type === 'park') continue;
      roofs.push({ pos: [bx, size[1] + 0.1, bz], scale: [size[0] + 0.3, 0.2, size[2] + 0.3] });
      const floors = Math.floor(size[1] / 2.5);
      for (let face = 0; face < 4; face++) {
        const alongX = face % 2 === 0;
        const span = alongX ? size[0] : size[2];
        const depth = (alongX ? size[2] : size[0]) / 2 + 0.01;
        const sign = face < 2 ? 1 : -1;
        const cols = Math.floor(span / 3);
        for (let col = 0; col < cols; col++) {
          for (let row = 0; row < floors; row++) {
            const t = -span / 2 + 1.5 + col * 3 + (span - cols * 3) / 2;
            const y = 1.5 + row * 2.5;
            const pos: [number, number, number] = alongX ? [bx + t, y, bz + sign * depth] : [bx + sign * depth, y, bz + t];
            const rotY = alongX ? (sign > 0 ? 0 : Math.PI) : (sign > 0 ? Math.PI / 2 : -Math.PI / 2);
            windows.push({ pos, scale: [1.2, 1.5, 1], rotY });
          }
        }
      }
    }
    return { bodies, roofs, windows };
  }, []);

  return (
    <group>
      {bodies.map((b, i) => (
        <mesh key={`bld-${i}`} position={b.pos} castShadow={!b.park} receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.park ? '#27ae60' : b.color} roughness={b.park ? 0.95 : 0.5} metalness={b.park ? 0 : 0.2} />
        </mesh>
      ))}
      <Instances items={roofs} geometry={UNIT_BOX} castShadow>
        <meshStandardMaterial color="#555555" roughness={0.7} metalness={0.3} />
      </Instances>
      <Instances items={windows} geometry={UNIT_PLANE}>
        <meshStandardMaterial
          color="#b8d4e3"
          emissive={isNight ? '#ffd27f' : '#b8d4e3'}
          emissiveIntensity={isNight ? 0.9 : 0.15}
        />
      </Instances>
    </group>
  );
};

// ─── Tree (deterministic size so it never changes between renders) ─
const pseudoRandom = (seed: number) => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

const Tree: React.FC<{ position: [number, number, number]; seed: number }> = ({ position, seed }) => {
  const height = 2 + pseudoRandom(seed) * 2;
  const crownSize = 1.5 + pseudoRandom(seed + 1) * 1;
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, height, 6]} />
        <meshStandardMaterial color="#5D4037" roughness={0.9} />
      </mesh>
      <mesh position={[0, height + crownSize * 0.4, 0]} castShadow>
        <sphereGeometry args={[crownSize, 8, 8]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.8} />
      </mesh>
      <mesh position={[0.3, height + crownSize * 0.8, 0.2]} castShadow>
        <sphereGeometry args={[crownSize * 0.6, 8, 8]} />
        <meshStandardMaterial color="#388E3C" roughness={0.8} />
      </mesh>
    </group>
  );
};

// ─── Street Lamp ─────────────────────────────────────────────────
const StreetLamp: React.FC<{ position: [number, number, number]; isNight: boolean }> = ({ position, isNight }) => (
  <group position={position}>
    <mesh position={[0, 2.5, 0]} castShadow>
      <cylinderGeometry args={[0.06, 0.08, 5, 6]} />
      <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0.4, 5, 0]}>
      <boxGeometry args={[1, 0.08, 0.3]} />
      <meshStandardMaterial color="#555" metalness={0.8} roughness={0.2} />
    </mesh>
    <mesh position={[0.8, 4.9, 0]}>
      <sphereGeometry args={[0.2, 8, 8]} />
      <meshStandardMaterial color="#FFF9C4" emissive="#FFE082" emissiveIntensity={isNight ? 3 : 0.2} />
    </mesh>
    {isNight && <pointLight position={[0.8, 4.6, 0]} color="#FFE0A0" intensity={30} distance={22} decay={2} />}
  </group>
);

// ─── U-Turn Sign ─────────────────────────────────────────────────
const UTurnSign: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    <mesh position={[0, 1.5, 0]} castShadow>
      <cylinderGeometry args={[0.05, 0.05, 3, 6]} />
      <meshStandardMaterial color="#888" metalness={0.8} />
    </mesh>
    <mesh position={[0, 3.2, 0]} castShadow>
      <boxGeometry args={[1.2, 1.2, 0.05]} />
      <meshStandardMaterial color="#1565C0" />
    </mesh>
    <mesh position={[0, 3.2, 0.03]}>
      <ringGeometry args={[0.2, 0.35, 16, 1, 0, Math.PI]} />
      <meshStandardMaterial color="white" side={THREE.DoubleSide} />
    </mesh>
  </group>
);

// ─── Main City Environment ───────────────────────────────────────
export const CityEnvironment: React.FC<{ isNight?: boolean }> = React.memo(({ isNight = false }) => {
  const ut = NODES.UT.position;
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[320, 320]} />
        <meshStandardMaterial color="#4a7c3f" roughness={0.9} />
      </mesh>

      <RoadSurface />
      <LaneMarkings />
      <Sidewalks />

      <Buildings isNight={isNight} />

      {TREE_POSITIONS.map((pos, i) => (
        <Tree key={`tree-${i}`} position={pos} seed={i} />
      ))}

      {STREET_LAMPS.map((pos, i) => (
        <StreetLamp key={`lamp-${i}`} position={pos} isNight={isNight} />
      ))}

      <UTurnSign position={[ut.x + ROAD_WIDTH / 2 + 2.5, 0, ut.z - 6]} />
    </group>
  );
});

CityEnvironment.displayName = 'CityEnvironment';
