import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vehicle as VehicleType } from '../../types';

interface VehicleProps {
  vehicle: VehicleType;
  onClick?: () => void;
  isSelected?: boolean;
}

// Low-poly 3D car model using primitives
export const Vehicle: React.FC<VehicleProps> = React.memo(({ vehicle, onClick, isSelected }) => {
  const groupRef = useRef<THREE.Group>(null!);
  const targetPos = useRef(vehicle.position.clone());
  const targetRot = useRef(vehicle.rotation.clone());

  // Smooth interpolation for visual movement
  useFrame(() => {
    if (!groupRef.current) return;
    
    targetPos.current.copy(vehicle.position);
    targetRot.current.copy(vehicle.rotation);

    groupRef.current.position.lerp(targetPos.current, 0.3);
    
    // Smooth rotation
    const currentY = groupRef.current.rotation.y;
    let targetY = targetRot.current.y;
    
    // Handle angle wrapping
    let diff = targetY - currentY;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    
    groupRef.current.rotation.y = currentY + diff * 0.15;
  });

  const color = useMemo(() => new THREE.Color(vehicle.color), [vehicle.color]);
  const darkColor = useMemo(() => new THREE.Color(vehicle.color).multiplyScalar(0.6), [vehicle.color]);
  const glassColor = useMemo(() => new THREE.Color('#87CEEB'), []);

  // Vehicle dimensions based on type
  const dims = useMemo(() => {
    switch (vehicle.type) {
      case 'sedan':
        return { bodyL: 4.2, bodyW: 1.8, bodyH: 0.9, cabinH: 0.7, cabinL: 2.2, wheelR: 0.35 };
      case 'suv':
        return { bodyL: 4.8, bodyW: 2.0, bodyH: 1.1, cabinH: 0.8, cabinL: 2.6, wheelR: 0.4 };
      case 'truck':
        return { bodyL: 6.0, bodyW: 2.2, bodyH: 1.3, cabinH: 1.0, cabinL: 1.8, wheelR: 0.45 };
      case 'bus':
        return { bodyL: 7.5, bodyW: 2.4, bodyH: 1.2, cabinH: 1.2, cabinL: 5.5, wheelR: 0.45 };
      case 'sports':
        return { bodyL: 4.0, bodyW: 1.9, bodyH: 0.7, cabinH: 0.5, cabinL: 1.8, wheelR: 0.3 };
      default:
        return { bodyL: 4.2, bodyW: 1.8, bodyH: 0.9, cabinH: 0.7, cabinL: 2.2, wheelR: 0.35 };
    }
  }, [vehicle.type]);

  const isBraking = vehicle.state === 'stopped' || vehicle.state === 'waiting';

  return (
    <group
      ref={groupRef}
      position={[vehicle.position.x, vehicle.position.y + dims.wheelR + dims.bodyH / 2, vehicle.position.z]}
      rotation={[vehicle.rotation.x, vehicle.rotation.y, vehicle.rotation.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {/* Selection indicator */}
      {isSelected && (
        <mesh position={[0, dims.bodyH + dims.cabinH + 1, 0]}>
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
      <mesh
        position={[0, dims.bodyH / 2 + dims.cabinH / 2, vehicle.type === 'truck' ? -dims.bodyL / 2 + dims.cabinL / 2 + 0.3 : -0.2]}
        castShadow
      >
        <boxGeometry args={[dims.bodyW - 0.2, dims.cabinH, dims.cabinL]} />
        <meshStandardMaterial color={glassColor} metalness={0.8} roughness={0.1} transparent opacity={0.6} />
      </mesh>

      {/* Truck bed */}
      {vehicle.type === 'truck' && (
        <mesh position={[0, dims.bodyH / 2 + 0.3, dims.bodyL / 2 - 1.5]} castShadow>
          <boxGeometry args={[dims.bodyW, 0.6, 3]} />
          <meshStandardMaterial color={darkColor} metalness={0.4} roughness={0.5} />
        </mesh>
      )}

      {/* Headlights */}
      <mesh position={[-dims.bodyW / 2 + 0.2, 0, -dims.bodyL / 2 - 0.01]}>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial 
          color="#FFF9C4" 
          emissive="#FFF9C4" 
          emissiveIntensity={0.5} 
        />
      </mesh>
      <mesh position={[dims.bodyW / 2 - 0.2, 0, -dims.bodyL / 2 - 0.01]}>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial 
          color="#FFF9C4" 
          emissive="#FFF9C4" 
          emissiveIntensity={0.5} 
        />
      </mesh>

      {/* Tail lights */}
      <mesh position={[-dims.bodyW / 2 + 0.2, 0, dims.bodyL / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial
          color={isBraking ? '#ff0000' : '#8B0000'}
          emissive={isBraking ? '#ff0000' : '#8B0000'}
          emissiveIntensity={isBraking ? 1.5 : 0.3}
        />
      </mesh>
      <mesh position={[dims.bodyW / 2 - 0.2, 0, dims.bodyL / 2 + 0.01]}>
        <boxGeometry args={[0.3, 0.2, 0.05]} />
        <meshStandardMaterial
          color={isBraking ? '#ff0000' : '#8B0000'}
          emissive={isBraking ? '#ff0000' : '#8B0000'}
          emissiveIntensity={isBraking ? 1.5 : 0.3}
        />
      </mesh>

      {/* Wheels */}
      {[
        [-dims.bodyW / 2, -dims.bodyH / 2, -dims.bodyL / 3],
        [dims.bodyW / 2, -dims.bodyH / 2, -dims.bodyL / 3],
        [-dims.bodyW / 2, -dims.bodyH / 2, dims.bodyL / 3],
        [dims.bodyW / 2, -dims.bodyH / 2, dims.bodyL / 3],
      ].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[dims.wheelR, dims.wheelR, 0.25, 8]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.7} />
        </mesh>
      ))}

      {/* Bus windows */}
      {vehicle.type === 'bus' && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <React.Fragment key={`bus-win-${i}`}>
              <mesh position={[dims.bodyW / 2 + 0.01, dims.bodyH / 2 + dims.cabinH / 2, -dims.cabinL / 2 + 0.5 + i * 1.3]}>
                <planeGeometry args={[0.01, 0.6, 0.8]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[-dims.bodyW / 2 - 0.01, dims.bodyH / 2 + dims.cabinH / 2, -dims.cabinL / 2 + 0.5 + i * 1.3]}>
                <planeGeometry args={[0.01, 0.6, 0.8]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} side={THREE.DoubleSide} />
              </mesh>
            </React.Fragment>
          ))}
        </>
      )}
    </group>
  );
});

Vehicle.displayName = 'Vehicle';
