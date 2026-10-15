import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/simulationStore';
import { VEHICLE_SPECS } from '../../config/roadNetwork';

interface VehicleProps {
  vehicleId: string;
  onSelect?: (id: string) => void;
  isSelected?: boolean;
}

const TAIL_OFF = new THREE.Color('#8B0000');
const TAIL_ON = new THREE.Color('#ff1a1a');

// Low-poly 3D vehicle. The model's front faces local +Z, matching the
// engine's heading convention (rotation.y = atan2(dir.x, dir.z)).
export const Vehicle: React.FC<VehicleProps> = React.memo(({ vehicleId, onSelect, isSelected }) => {
  const groupRef = useRef<THREE.Group>(null);
  const tailMaterials = useRef<THREE.MeshStandardMaterial[]>([]);

  // Static attributes — selected as primitives so per-frame motion doesn't re-render
  const type = useSimulationStore((s) => s.vehicles.get(vehicleId)?.type ?? 'sedan');
  const colorHex = useSimulationStore((s) => s.vehicles.get(vehicleId)?.color ?? '#ffffff');
  const isNight = useSimulationStore((s) => s.config.timeOfDay < 6 || s.config.timeOfDay > 18.5);

  const spec = VEHICLE_SPECS[type];
  const dims = {
    bodyL: spec.length,
    bodyW: spec.width,
    bodyH: spec.bodyH,
    cabinH: spec.cabinH,
    cabinL: spec.cabinL,
    wheelR: spec.wheelR,
  };
  const rideHeight = dims.wheelR + dims.bodyH / 2;

  const color = useMemo(() => new THREE.Color(colorHex), [colorHex]);
  const darkColor = useMemo(() => new THREE.Color(colorHex).multiplyScalar(0.6), [colorHex]);

  // Pose and brake lights follow the simulation every frame
  useFrame(() => {
    const v = useSimulationStore.getState().vehicles.get(vehicleId);
    const group = groupRef.current;
    if (!v || !group) return;
    group.position.set(v.position.x, rideHeight, v.position.z);
    group.rotation.y = v.rotation.y;
    const braking = v.velocity < 0.3 || v.currentAccel < -0.8;
    for (const m of tailMaterials.current) {
      m.emissive.copy(braking ? TAIL_ON : TAIL_OFF);
      m.emissiveIntensity = braking ? 1.8 : 0.3;
    }
  });

  const initial = useSimulationStore.getState().vehicles.get(vehicleId);
  const cabinZ = type === 'truck' ? dims.bodyL / 2 - dims.cabinL / 2 - 0.3 : type === 'bus' ? 0 : 0.2;

  return (
    <group
      ref={groupRef}
      position={[initial?.position.x ?? 0, rideHeight, initial?.position.z ?? 0]}
      rotation={[0, initial?.rotation.y ?? 0, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect?.(vehicleId);
      }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, dims.bodyH + dims.cabinH + 1, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.4, 0.8, 4]} />
          <meshStandardMaterial color="#f39c12" emissive="#f39c12" emissiveIntensity={0.8} />
        </mesh>
      )}

      {/* Main body */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[dims.bodyW, dims.bodyH, dims.bodyL]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Cabin / Windows */}
      <mesh position={[0, dims.bodyH / 2 + dims.cabinH / 2, cabinZ]} castShadow>
        <boxGeometry args={[dims.bodyW - 0.2, dims.cabinH, dims.cabinL]} />
        <meshStandardMaterial color="#87CEEB" metalness={0.8} roughness={0.1} transparent opacity={0.6} />
      </mesh>

      {/* Truck bed (behind the cab) */}
      {type === 'truck' && (
        <mesh position={[0, dims.bodyH / 2 + 0.3, -dims.bodyL / 2 + 1.7]} castShadow>
          <boxGeometry args={[dims.bodyW, 0.6, 3]} />
          <meshStandardMaterial color={darkColor} metalness={0.4} roughness={0.5} />
        </mesh>
      )}

      {/* Headlights (front, +Z) */}
      {[-1, 1].map((side) => (
        <mesh key={`head-${side}`} position={[side * (dims.bodyW / 2 - 0.25), 0, dims.bodyL / 2 + 0.01]}>
          <boxGeometry args={[0.3, 0.2, 0.05]} />
          <meshStandardMaterial color="#FFF9C4" emissive="#FFF9C4" emissiveIntensity={isNight ? 2.5 : 0.5} />
        </mesh>
      ))}

      {/* Tail / brake lights (rear, -Z) */}
      {[-1, 1].map((side, i) => (
        <mesh key={`tail-${side}`} position={[side * (dims.bodyW / 2 - 0.25), 0, -dims.bodyL / 2 - 0.01]}>
          <boxGeometry args={[0.3, 0.2, 0.05]} />
          <meshStandardMaterial
            ref={(m) => {
              if (m) tailMaterials.current[i] = m;
            }}
            color="#8B0000"
            emissive="#8B0000"
            emissiveIntensity={0.3}
          />
        </mesh>
      ))}

      {/* Wheels */}
      {[
        [-dims.bodyW / 2, -dims.bodyH / 2, dims.bodyL / 3],
        [dims.bodyW / 2, -dims.bodyH / 2, dims.bodyL / 3],
        [-dims.bodyW / 2, -dims.bodyH / 2, -dims.bodyL / 3],
        [dims.bodyW / 2, -dims.bodyH / 2, -dims.bodyL / 3],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[dims.wheelR, dims.wheelR, 0.25, 12]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}

      {/* Bus side windows */}
      {type === 'bus' &&
        [-1, 1].map((side) =>
          [0, 1, 2, 3].map((i) => (
            <mesh
              key={`bus-win-${side}-${i}`}
              position={[side * (dims.bodyW / 2 - 0.08), dims.bodyH / 2 + dims.cabinH / 2, -dims.cabinL / 2 + 0.9 + i * 1.4]}
              rotation={[0, (side * Math.PI) / 2, 0]}
            >
              <planeGeometry args={[1.1, 0.7]} />
              <meshStandardMaterial color="#cfefff" emissive="#87CEEB" emissiveIntensity={isNight ? 0.6 : 0.1} side={THREE.DoubleSide} />
            </mesh>
          ))
        )}
    </group>
  );
});

Vehicle.displayName = 'Vehicle';
