import React, { useMemo } from 'react';
import * as THREE from 'three';
import {
  ROAD_WIDTH,
  BLOCK_SIZE,
  BUILDINGS,
  TREE_POSITIONS,
  JUNCTION_POSITIONS,
} from '../../config/roadNetwork';

// ─── Road Surface Component ──────────────────────────────────────
const RoadSurface: React.FC = () => {
  // Create road segments as planes
  const roadGeometries = useMemo(() => {
    const roads: { pos: [number, number, number]; size: [number, number]; rot: number }[] = [];

    // Main square roads
    // North road (J1 to J2) - horizontal
    roads.push({
      pos: [0, 0.02, -BLOCK_SIZE / 2],
      size: [BLOCK_SIZE + ROAD_WIDTH * 2, ROAD_WIDTH],
      rot: 0,
    });
    // South road (J3 to J4) - horizontal
    roads.push({
      pos: [0, 0.02, BLOCK_SIZE / 2],
      size: [BLOCK_SIZE + ROAD_WIDTH * 2, ROAD_WIDTH],
      rot: 0,
    });
    // West road (J1 to J3) - vertical
    roads.push({
      pos: [-BLOCK_SIZE / 2, 0.02, 0],
      size: [ROAD_WIDTH, BLOCK_SIZE + ROAD_WIDTH * 2],
      rot: 0,
    });
    // East road (J2 to J4) - vertical
    roads.push({
      pos: [BLOCK_SIZE / 2, 0.02, 0],
      size: [ROAD_WIDTH, BLOCK_SIZE + ROAD_WIDTH * 2],
      rot: 0,
    });

    // T-junction connector - horizontal from J2 right area to J5
    const tJuncX = (BLOCK_SIZE / 2 + BLOCK_SIZE * 1.1) / 2;
    roads.push({
      pos: [tJuncX, 0.02, -BLOCK_SIZE / 2],
      size: [BLOCK_SIZE * 1.1 - BLOCK_SIZE / 2 + ROAD_WIDTH, ROAD_WIDTH],
      rot: 0,
    });
    roads.push({
      pos: [tJuncX, 0.02, BLOCK_SIZE / 2],
      size: [BLOCK_SIZE * 1.1 - BLOCK_SIZE / 2 + ROAD_WIDTH, ROAD_WIDTH],
      rot: 0,
    });

    // T-junction vertical road (connecting the two horizontal connectors)
    roads.push({
      pos: [BLOCK_SIZE * 1.1, 0.02, 0],
      size: [ROAD_WIDTH, BLOCK_SIZE + ROAD_WIDTH],
      rot: 0,
    });

    // U-turn road extension from J4
    roads.push({
      pos: [BLOCK_SIZE / 2, 0.02, BLOCK_SIZE / 2 + BLOCK_SIZE / 4],
      size: [ROAD_WIDTH, BLOCK_SIZE / 2],
      rot: 0,
    });
    // U-turn curve area
    roads.push({
      pos: [BLOCK_SIZE / 2 + 12.5, 0.02, BLOCK_SIZE + 8],
      size: [33, ROAD_WIDTH + 10],
      rot: 0,
    });
    roads.push({
      pos: [BLOCK_SIZE / 2 + 25, 0.02, BLOCK_SIZE / 2 + BLOCK_SIZE / 4],
      size: [ROAD_WIDTH, BLOCK_SIZE / 2],
      rot: 0,
    });
    // Connect u-turn back
    roads.push({
      pos: [BLOCK_SIZE / 2 + 12.5, 0.02, BLOCK_SIZE / 2],
      size: [25 + ROAD_WIDTH, ROAD_WIDTH],
      rot: 0,
    });

    // Extension roads going off-map (entry/exit points)
    // West extensions
    roads.push({
      pos: [-BLOCK_SIZE / 2 - 15, 0.02, -BLOCK_SIZE / 2],
      size: [30, ROAD_WIDTH], rot: 0,
    });
    roads.push({
      pos: [-BLOCK_SIZE / 2 - 15, 0.02, BLOCK_SIZE / 2],
      size: [30, ROAD_WIDTH], rot: 0,
    });
    // East extensions
    roads.push({
      pos: [BLOCK_SIZE / 2 + 15, 0.02, -BLOCK_SIZE / 2],
      size: [30, ROAD_WIDTH], rot: 0,
    });
    roads.push({
      pos: [BLOCK_SIZE / 2 + 15, 0.02, BLOCK_SIZE / 2],
      size: [30, ROAD_WIDTH], rot: 0,
    });
    // North extensions
    roads.push({
      pos: [-BLOCK_SIZE / 2, 0.02, -BLOCK_SIZE / 2 - 15],
      size: [ROAD_WIDTH, 30], rot: 0,
    });
    roads.push({
      pos: [BLOCK_SIZE / 2, 0.02, -BLOCK_SIZE / 2 - 15],
      size: [ROAD_WIDTH, 30], rot: 0,
    });
    // South extensions
    roads.push({
      pos: [-BLOCK_SIZE / 2, 0.02, BLOCK_SIZE / 2 + 15],
      size: [ROAD_WIDTH, 30], rot: 0,
    });
    roads.push({
      pos: [BLOCK_SIZE / 2, 0.02, BLOCK_SIZE / 2 + 15],
      size: [ROAD_WIDTH, 30], rot: 0,
    });

    return roads;
  }, []);

  return (
    <group>
      {roadGeometries.map((road, i) => (
        <mesh
          key={`road-${i}`}
          position={road.pos}
          rotation={[-Math.PI / 2, 0, road.rot]}
          receiveShadow
        >
          <planeGeometry args={road.size} />
          <meshStandardMaterial
            color="#2d2d2d"
            roughness={0.9}
            metalness={0.1}
          />
        </mesh>
      ))}
    </group>
  );
};

// ─── Lane Markings ───────────────────────────────────────────────
const LaneMarkings: React.FC = () => {
  const markings = useMemo(() => {
    const lines: { pos: [number, number, number]; size: [number, number]; rot: number }[] = [];
    const dashLength = 2;
    const gapLength = 2;

    // Dashed center lines for each road
    // North road center line
    for (let x = -BLOCK_SIZE / 2; x < BLOCK_SIZE / 2; x += dashLength + gapLength) {
      lines.push({
        pos: [x + dashLength / 2, 0.025, -BLOCK_SIZE / 2],
        size: [dashLength, 0.15],
        rot: 0,
      });
    }
    // South road center line
    for (let x = -BLOCK_SIZE / 2; x < BLOCK_SIZE / 2; x += dashLength + gapLength) {
      lines.push({
        pos: [x + dashLength / 2, 0.025, BLOCK_SIZE / 2],
        size: [dashLength, 0.15],
        rot: 0,
      });
    }
    // West road center line
    for (let z = -BLOCK_SIZE / 2; z < BLOCK_SIZE / 2; z += dashLength + gapLength) {
      lines.push({
        pos: [-BLOCK_SIZE / 2, 0.025, z + dashLength / 2],
        size: [0.15, dashLength],
        rot: 0,
      });
    }
    // East road center line
    for (let z = -BLOCK_SIZE / 2; z < BLOCK_SIZE / 2; z += dashLength + gapLength) {
      lines.push({
        pos: [BLOCK_SIZE / 2, 0.025, z + dashLength / 2],
        size: [0.15, dashLength],
        rot: 0,
      });
    }

    // Stop lines at junctions
    Object.values(JUNCTION_POSITIONS).forEach((jPos) => {
      // North approach
      lines.push({ pos: [jPos.x, 0.025, jPos.z - ROAD_WIDTH / 2 - 0.5], size: [ROAD_WIDTH - 1, 0.3], rot: 0 });
      // South approach
      lines.push({ pos: [jPos.x, 0.025, jPos.z + ROAD_WIDTH / 2 + 0.5], size: [ROAD_WIDTH - 1, 0.3], rot: 0 });
      // East approach
      lines.push({ pos: [jPos.x + ROAD_WIDTH / 2 + 0.5, 0.025, jPos.z], size: [0.3, ROAD_WIDTH - 1], rot: 0 });
      // West approach
      lines.push({ pos: [jPos.x - ROAD_WIDTH / 2 - 0.5, 0.025, jPos.z], size: [0.3, ROAD_WIDTH - 1], rot: 0 });
    });

    // Crosswalk markings at junctions
    Object.values(JUNCTION_POSITIONS).forEach((jPos) => {
      for (let i = -3; i <= 3; i += 1.2) {
        // North crosswalk
        lines.push({
          pos: [jPos.x + i, 0.025, jPos.z - ROAD_WIDTH / 2 - 1.5],
          size: [0.5, 2],
          rot: 0,
        });
        // South crosswalk
        lines.push({
          pos: [jPos.x + i, 0.025, jPos.z + ROAD_WIDTH / 2 + 1.5],
          size: [0.5, 2],
          rot: 0,
        });
      }
    });

    return lines;
  }, []);

  return (
    <group>
      {markings.map((mark, i) => (
        <mesh
          key={`mark-${i}`}
          position={mark.pos}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={mark.size} />
          <meshStandardMaterial color="#f0f0f0" roughness={0.6} />
        </mesh>
      ))}
    </group>
  );
};

// ─── Sidewalks ───────────────────────────────────────────────────
const Sidewalks: React.FC = () => {
  const sidewalks = useMemo(() => {
    const walks: { pos: [number, number, number]; size: [number, number, number] }[] = [];
    const sw = 1.5; // sidewalk width
    const sh = 0.15; // sidewalk height

    // Along north road
    walks.push({
      pos: [0, sh / 2, -BLOCK_SIZE / 2 - ROAD_WIDTH / 2 - sw / 2],
      size: [BLOCK_SIZE + ROAD_WIDTH * 2 + sw * 2, sh, sw],
    });
    walks.push({
      pos: [0, sh / 2, -BLOCK_SIZE / 2 + ROAD_WIDTH / 2 + sw / 2],
      size: [BLOCK_SIZE - ROAD_WIDTH, sh, sw],
    });

    // Along south road
    walks.push({
      pos: [0, sh / 2, BLOCK_SIZE / 2 + ROAD_WIDTH / 2 + sw / 2],
      size: [BLOCK_SIZE + ROAD_WIDTH * 2 + sw * 2, sh, sw],
    });
    walks.push({
      pos: [0, sh / 2, BLOCK_SIZE / 2 - ROAD_WIDTH / 2 - sw / 2],
      size: [BLOCK_SIZE - ROAD_WIDTH, sh, sw],
    });

    // Along west road
    walks.push({
      pos: [-BLOCK_SIZE / 2 - ROAD_WIDTH / 2 - sw / 2, sh / 2, 0],
      size: [sw, sh, BLOCK_SIZE - ROAD_WIDTH],
    });
    walks.push({
      pos: [-BLOCK_SIZE / 2 + ROAD_WIDTH / 2 + sw / 2, sh / 2, 0],
      size: [sw, sh, BLOCK_SIZE - ROAD_WIDTH],
    });

    // Along east road
    walks.push({
      pos: [BLOCK_SIZE / 2 + ROAD_WIDTH / 2 + sw / 2, sh / 2, 0],
      size: [sw, sh, BLOCK_SIZE - ROAD_WIDTH],
    });
    walks.push({
      pos: [BLOCK_SIZE / 2 - ROAD_WIDTH / 2 - sw / 2, sh / 2, 0],
      size: [sw, sh, BLOCK_SIZE - ROAD_WIDTH],
    });

    return walks;
  }, []);

  return (
    <group>
      {sidewalks.map((sw, i) => (
        <mesh key={`sw-${i}`} position={sw.pos} receiveShadow castShadow>
          <boxGeometry args={sw.size} />
          <meshStandardMaterial color="#8e8e8e" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
};

// ─── Building Component ──────────────────────────────────────────
const Building: React.FC<{
  position: [number, number, number];
  size: [number, number, number];
  color: string;
  type: string;
}> = ({ position, size, color, type }) => {
  const windowColor = type === 'park' ? '#27ae60' : '#b8d4e3';

  return (
    <group position={[position[0], 0, position[2]]}>
      {/* Main structure */}
      <mesh castShadow receiveShadow position={[0, size[1] / 2, 0]}>
        <boxGeometry args={size} />
        <meshStandardMaterial
          color={type === 'park' ? '#27ae60' : color}
          roughness={type === 'park' ? 0.9 : 0.5}
          metalness={type === 'park' ? 0.0 : 0.2}
        />
      </mesh>

      {/* Windows (for non-park buildings) */}
      {type !== 'park' && (
        <>
          {/* Front windows */}
          {Array.from({ length: Math.floor(size[0] / 3) }).map((_, col) =>
            Array.from({ length: Math.floor(size[1] / 2.5) }).map((_, row) => (
              <mesh
                key={`fw-${col}-${row}`}
                position={[
                  -size[0] / 2 + 1.5 + col * 3,
                  1.5 + row * 2.5,
                  size[2] / 2 + 0.01,
                ]}
              >
                <planeGeometry args={[1.2, 1.5]} />
                <meshStandardMaterial
                  color={windowColor}
                  emissive={windowColor}
                  emissiveIntensity={0.15}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            ))
          )}
          {/* Side windows */}
          {Array.from({ length: Math.floor(size[2] / 3) }).map((_, col) =>
            Array.from({ length: Math.floor(size[1] / 2.5) }).map((_, row) => (
              <mesh
                key={`sw-${col}-${row}`}
                position={[
                  size[0] / 2 + 0.01,
                  1.5 + row * 2.5,
                  -size[2] / 2 + 1.5 + col * 3,
                ]}
                rotation={[0, Math.PI / 2, 0]}
              >
                <planeGeometry args={[1.2, 1.5]} />
                <meshStandardMaterial
                  color={windowColor}
                  emissive={windowColor}
                  emissiveIntensity={0.15}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            ))
          )}
        </>
      )}

      {/* Roof */}
      {type !== 'park' && (
        <mesh position={[0, size[1] + 0.1, 0]} castShadow>
          <boxGeometry args={[size[0] + 0.3, 0.2, size[2] + 0.3]} />
          <meshStandardMaterial color="#555555" roughness={0.7} metalness={0.3} />
        </mesh>
      )}
    </group>
  );
};

// ─── Tree Component ──────────────────────────────────────────────
const Tree: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const height = 2 + Math.random() * 2;
  const crownSize = 1.5 + Math.random() * 1;

  return (
    <group position={position}>
      {/* Trunk */}
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.2, height, 6]} />
        <meshStandardMaterial color="#5D4037" roughness={0.9} />
      </mesh>
      {/* Crown */}
      <mesh position={[0, height + crownSize * 0.4, 0]} castShadow>
        <sphereGeometry args={[crownSize, 8, 8]} />
        <meshStandardMaterial color="#2E7D32" roughness={0.8} />
      </mesh>
      {/* Second smaller crown */}
      <mesh position={[0.3, height + crownSize * 0.8, 0.2]} castShadow>
        <sphereGeometry args={[crownSize * 0.6, 8, 8]} />
        <meshStandardMaterial color="#388E3C" roughness={0.8} />
      </mesh>
    </group>
  );
};

// ─── Street Lamp Component ───────────────────────────────────────
const StreetLamp: React.FC<{ position: [number, number, number] }> = ({ position }) => (
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
      <meshStandardMaterial
        color="#FFF9C4"
        emissive="#FFF9C4"
        emissiveIntensity={0.4}
      />
    </mesh>
    <pointLight position={[0.8, 4.7, 0]} color="#FFF9C4" intensity={0.5} distance={10} decay={2} />
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
    {/* U-turn arrow (simplified) */}
    <mesh position={[0, 3.2, 0.03]}>
      <ringGeometry args={[0.2, 0.35, 16, 1, 0, Math.PI]} />
      <meshStandardMaterial color="white" side={THREE.DoubleSide} />
    </mesh>
  </group>
);

// ─── Main City Environment ───────────────────────────────────────
export const CityEnvironment: React.FC = React.memo(() => {
  return (
    <group>
      {/* Ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[300, 300]} />
        <meshStandardMaterial color="#4a7c3f" roughness={0.9} />
      </mesh>

      {/* Road surfaces */}
      <RoadSurface />

      {/* Lane markings */}
      <LaneMarkings />

      {/* Sidewalks */}
      <Sidewalks />

      {/* Buildings */}
      {BUILDINGS.map((building, i) => (
        <Building
          key={`building-${i}`}
          position={building.position}
          size={building.size}
          color={building.color}
          type={building.type}
        />
      ))}

      {/* Trees */}
      {TREE_POSITIONS.map((pos, i) => (
        <Tree key={`tree-${i}`} position={pos} />
      ))}

      {/* Street lamps */}
      {[
        [-BLOCK_SIZE / 2 - 5, 0, -BLOCK_SIZE / 2 - 5],
        [BLOCK_SIZE / 2 + 5, 0, -BLOCK_SIZE / 2 - 5],
        [-BLOCK_SIZE / 2 - 5, 0, BLOCK_SIZE / 2 + 5],
        [BLOCK_SIZE / 2 + 5, 0, BLOCK_SIZE / 2 + 5],
        [-BLOCK_SIZE / 2 - 5, 0, 0],
        [BLOCK_SIZE / 2 + 5, 0, 0],
        [0, 0, -BLOCK_SIZE / 2 - 5],
        [0, 0, BLOCK_SIZE / 2 + 5],
        [BLOCK_SIZE * 1.1 + 5, 0, -5],
        [BLOCK_SIZE * 1.1 + 5, 0, 5],
      ].map((pos, i) => (
        <StreetLamp key={`lamp-${i}`} position={pos as [number, number, number]} />
      ))}

      {/* U-Turn sign */}
      <UTurnSign position={[BLOCK_SIZE / 2 + 5, 0, BLOCK_SIZE + 5]} />

      {/* Junction labels (floating text using sprites would be ideal, but for now use simple markers) */}
      {Object.entries(JUNCTION_POSITIONS).map(([id, pos]) => (
        <mesh key={`jlabel-${id}`} position={[pos.x, 0.03, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1, 16]} />
          <meshStandardMaterial
            color={id === 'J5' ? '#e67e22' : '#3498db'}
            transparent
            opacity={0.3}
          />
        </mesh>
      ))}
    </group>
  );
});

CityEnvironment.displayName = 'CityEnvironment';
