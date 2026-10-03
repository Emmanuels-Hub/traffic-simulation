import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { TrafficLight as TLType } from '../../types';

interface TrafficLightProps {
  trafficLight: TLType;
  onClick?: () => void;
  isSelected?: boolean;
}

// Compute exact directional signal color for a specific direction
export function getDirectionalSignalState(
  light: TLType,
  dir: 'north' | 'south' | 'east' | 'west'
): 'red' | 'yellow' | 'green' {
  const currentPhase = light.phases[light.currentPhaseIndex];
  if (!currentPhase) return 'red';

  const isDirectionActive = currentPhase.directions.includes(dir);
  if (isDirectionActive) {
    return currentPhase.state; // 'green' or 'yellow'
  }
  return 'red'; // Inactive directions are RED
}

export const TrafficLight3D: React.FC<TrafficLightProps> = React.memo(({ trafficLight, onClick, isSelected }) => {
  const glowRef = useRef<THREE.PointLight>(null!);

  const currentPhase = trafficLight.phases[trafficLight.currentPhaseIndex];
  const activeDirections = currentPhase?.directions || [];
  const phaseState = currentPhase?.state || 'red';

  // 4 corner signal posts mapped to incoming traffic directions
  const signals: { x: number; z: number; rotY: number; dir: 'north' | 'south' | 'east' | 'west' }[] = [
    { x: 5.5, z: 5.5, rotY: 0, dir: 'north' },                  // Facing Northbound traffic
    { x: -5.5, z: 5.5, rotY: Math.PI / 2, dir: 'east' },       // Facing Eastbound traffic
    { x: -5.5, z: -5.5, rotY: Math.PI, dir: 'south' },          // Facing Southbound traffic
    { x: 5.5, z: -5.5, rotY: (Math.PI * 3) / 2, dir: 'west' },  // Facing Westbound traffic
  ];

  const pos = trafficLight.position;

  return (
    <group onClick={(e) => { e.stopPropagation(); onClick?.(); }}>
      {/* 4 Directional Signal Posts */}
      {signals.map((sig, idx) => {
        const sigState = getDirectionalSignalState(trafficLight, sig.dir);

        const colors = {
          red: sigState === 'red' ? '#ff1a1a' : '#2b0000',
          yellow: sigState === 'yellow' ? '#ffcc00' : '#2b2b00',
          green: sigState === 'green' ? '#00ff44' : '#002b0d',
        };

        const emissiveIntensity = {
          red: sigState === 'red' ? 5.0 : 0.05,
          yellow: sigState === 'yellow' ? 5.0 : 0.05,
          green: sigState === 'green' ? 5.0 : 0.05,
        };

        return (
          <group
            key={idx}
            position={[pos.x + sig.x, 0, pos.z + sig.z]}
            rotation={[0, sig.rotY + (trafficLight.rotation || 0), 0]}
          >
            {/* Vertical Heavy Pole */}
            <mesh position={[0, 3.8, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.28, 7.6, 12]} />
              <meshStandardMaterial color="#1f242d" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Safety Yellow Collar */}
            <mesh position={[0, 0.5, 0]}>
              <cylinderGeometry args={[0.32, 0.36, 1, 12]} />
              <meshStandardMaterial color="#f39c12" metalness={0.4} roughness={0.4} />
            </mesh>

            {/* Overhead Cantilever Arm (Extending over lane) */}
            <mesh position={[0, 7.2, -2]} rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.15, 0.18, 4.2, 10]} />
              <meshStandardMaterial color="#1f242d" metalness={0.8} roughness={0.2} />
            </mesh>

            {/* Signal Housing Box (Overhead) */}
            <group position={[0, 7.0, -3.8]}>
              {/* Backplate */}
              <mesh castShadow>
                <boxGeometry args={[1.3, 3.4, 0.45]} />
                <meshStandardMaterial color="#0c0e14" metalness={0.6} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0, -0.02]}>
                <boxGeometry args={[1.45, 3.55, 0.4]} />
                <meshStandardMaterial color="#f39c12" metalness={0.5} roughness={0.4} />
              </mesh>

              {/* Visors */}
              {[-1.0, 0, 1.0].map((yOffset, i) => (
                <mesh key={i} position={[0, yOffset + 0.15, -0.3]} rotation={[-0.3, 0, 0]}>
                  <cylinderGeometry args={[0.38, 0.42, 0.35, 12, 1, true, 0, Math.PI]} />
                  <meshStandardMaterial color="#1a1a1a" side={THREE.DoubleSide} />
                </mesh>
              ))}

              {/* RED Lamp (Top) */}
              <mesh position={[0, 1.0, -0.24]}>
                <sphereGeometry args={[0.34, 24, 24]} />
                <meshStandardMaterial
                  color={colors.red}
                  emissive={colors.red}
                  emissiveIntensity={emissiveIntensity.red}
                  roughness={0.1}
                />
              </mesh>

              {/* YELLOW Lamp (Middle) */}
              <mesh position={[0, 0, -0.24]}>
                <sphereGeometry args={[0.34, 24, 24]} />
                <meshStandardMaterial
                  color={colors.yellow}
                  emissive={colors.yellow}
                  emissiveIntensity={emissiveIntensity.yellow}
                  roughness={0.1}
                />
              </mesh>

              {/* GREEN Lamp (Bottom) */}
              <mesh position={[0, -1.0, -0.24]}>
                <sphereGeometry args={[0.34, 24, 24]} />
                <meshStandardMaterial
                  color={colors.green}
                  emissive={colors.green}
                  emissiveIntensity={emissiveIntensity.green}
                  roughness={0.1}
                />
              </mesh>
            </group>
          </group>
        );
      })}

      {/* Floating 3D Junction Status Tag */}
      <Html
        position={[pos.x, 10.5, pos.z]}
        center
        distanceFactor={45}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            background: 'rgba(15, 18, 28, 0.92)',
            backdropFilter: 'blur(8px)',
            border: `2px solid ${activeDirections.length > 0 ? (phaseState === 'green' ? '#2ecc71' : '#ffd11a') : '#ff4d4d'}`,
            borderRadius: '12px',
            padding: '6px 14px',
            color: '#ffffff',
            fontFamily: 'Inter, system-ui, sans-serif',
            fontSize: '13px',
            fontWeight: '700',
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
              backgroundColor: activeDirections.length > 0 ? (phaseState === 'green' ? '#2ecc71' : '#ffd11a') : '#ff4d4d',
              boxShadow: `0 0 10px ${activeDirections.length > 0 ? (phaseState === 'green' ? '#2ecc71' : '#ffd11a') : '#ff4d4d'}`,
            }}
          />
          <span>{trafficLight.junctionId}</span>
          <span style={{ fontSize: '11px', opacity: 0.85, textTransform: 'uppercase' }}>
            {activeDirections.length > 0 ? `${activeDirections.join('/')} ${phaseState}` : 'ALL RED'}
          </span>
        </div>
      </Html>

      {/* Selection Ring */}
      {isSelected && (
        <mesh position={[pos.x, 0.08, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[8.5, 9.8, 48]} />
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
