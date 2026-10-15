import React, { useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { Direction, TrafficLight as TLType } from '../../types';
import {
  DIRECTION_VECTORS,
  LANE_OFFSET,
  ROAD_WIDTH,
  STOP_LINE_OFFSET,
  getJunctionApproaches,
  leftOf,
} from '../../config/roadNetwork';
import { getDirectionalSignalState } from '../../engine/signals';

interface TrafficLightProps {
  trafficLight: TLType;
  onSelect?: (junctionId: string) => void;
  isSelected?: boolean;
  showLabel?: boolean;
}

const LAMP_COLORS = {
  red: { on: '#ff1a1a', off: '#2b0000' },
  yellow: { on: '#ffcc00', off: '#2b2b00' },
  green: { on: '#00ff44', off: '#002b0d' },
} as const;

const POLE_KERB_OFFSET = ROAD_WIDTH / 2 + 0.9;
const ARM_REACH = POLE_KERB_OFFSET - LANE_OFFSET; // pole → centre of the approach lane

interface SignalPost {
  dir: Direction;
  position: [number, number, number];
  rotationY: number;
}

/** One signal post per approach, on the driver's (left) kerb just before the stop line. */
function buildPosts(junctionId: string, center: THREE.Vector3): SignalPost[] {
  return getJunctionApproaches(junctionId).map((dir) => {
    const f = DIRECTION_VECTORS[dir];
    const p = center.clone()
      .addScaledVector(f, -(STOP_LINE_OFFSET + 0.6))
      .addScaledVector(leftOf(f), POLE_KERB_OFFSET);
    // Local +Z faces approaching drivers (-f); local +X then points from the kerb over the lane
    return { dir, position: [p.x, 0, p.z], rotationY: Math.atan2(-f.x, -f.z) };
  });
}

const SignalHead: React.FC<{ post: SignalPost; light: TLType }> = ({ post, light }) => {
  const state = getDirectionalSignalState(light, post.dir);
  const lamps: { key: 'red' | 'yellow' | 'green'; y: number }[] = [
    { key: 'red', y: 0.9 },
    { key: 'yellow', y: 0 },
    { key: 'green', y: -0.9 },
  ];

  return (
    <group position={post.position} rotation={[0, post.rotationY, 0]}>
      {/* Pole */}
      <mesh position={[0, 3.3, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.2, 6.6, 12]} />
        <meshStandardMaterial color="#1f242d" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Safety collar */}
      <mesh position={[0, 0.4, 0]}>
        <cylinderGeometry args={[0.25, 0.28, 0.8, 12]} />
        <meshStandardMaterial color="#f39c12" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* Cantilever arm over the approach lane */}
      <mesh position={[ARM_REACH / 2, 6.4, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.09, 0.11, ARM_REACH + 0.3, 10]} />
        <meshStandardMaterial color="#1f242d" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Signal housing hanging over the lane, lamps facing traffic (+Z) */}
      <group position={[ARM_REACH, 5.2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[1.0, 2.8, 0.4]} />
          <meshStandardMaterial color="#0c0e14" metalness={0.6} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.05]}>
          <boxGeometry args={[1.25, 3.05, 0.3]} />
          <meshStandardMaterial color="#f39c12" metalness={0.5} roughness={0.4} />
        </mesh>
        {lamps.map(({ key, y }) => {
          const on = state === key;
          return (
            <React.Fragment key={key}>
              {/* Visor: top half of an open cylinder pointing at traffic */}
              <mesh position={[0, y, 0.38]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.36, 0.36, 0.35, 12, 1, true, Math.PI / 2, Math.PI]} />
                <meshStandardMaterial color="#111" side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, y, 0.2]}>
                <sphereGeometry args={[0.3, 20, 20]} />
                <meshStandardMaterial
                  color={on ? LAMP_COLORS[key].on : LAMP_COLORS[key].off}
                  emissive={on ? LAMP_COLORS[key].on : LAMP_COLORS[key].off}
                  emissiveIntensity={on ? 5 : 0.05}
                  roughness={0.1}
                />
              </mesh>
            </React.Fragment>
          );
        })}
      </group>
    </group>
  );
};

export const TrafficLight3D: React.FC<TrafficLightProps> = React.memo(({ trafficLight, onSelect, isSelected, showLabel = true }) => {
  const pos = trafficLight.position;
  const posts = useMemo(() => buildPosts(trafficLight.junctionId, pos), [trafficLight.junctionId, pos]);

  const currentPhase = trafficLight.phases[trafficLight.currentPhaseIndex];
  const activeDirections = currentPhase?.directions ?? [];
  const phaseState = currentPhase?.state ?? 'red';
  const tagColor = activeDirections.length > 0 ? (phaseState === 'green' ? '#2ecc71' : '#ffd11a') : '#ff4d4d';

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect?.(trafficLight.junctionId); }}>
      {posts.map((post) => (
        <SignalHead key={post.dir} post={post} light={trafficLight} />
      ))}

      {/* Floating junction status tag */}
      {showLabel && (
        <Html position={[pos.x, 10.5, pos.z]} center distanceFactor={45} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              background: 'rgba(15, 18, 28, 0.92)',
              backdropFilter: 'blur(8px)',
              border: `2px solid ${tagColor}`,
              borderRadius: '12px',
              padding: '6px 14px',
              color: '#ffffff',
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: '13px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
              whiteSpace: 'nowrap',
            }}
          >
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: tagColor,
                boxShadow: `0 0 10px ${tagColor}`,
              }}
            />
            <span>{trafficLight.junctionId}</span>
            <span style={{ fontSize: '11px', opacity: 0.85, textTransform: 'uppercase' }}>
              {activeDirections.length > 0
                ? `${activeDirections.join('/')}bound ${phaseState}${trafficLight.mode === 'manual' ? ' · manual' : ''}`
                : 'ALL RED'}
            </span>
          </div>
        </Html>
      )}

      {/* Selection ring */}
      {isSelected && (
        <mesh position={[pos.x, 0.08, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[9.5, 10.8, 48]} />
          <meshStandardMaterial
            color="#f39c12"
            emissive="#f39c12"
            emissiveIntensity={1.5}
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
});

TrafficLight3D.displayName = 'TrafficLight3D';
