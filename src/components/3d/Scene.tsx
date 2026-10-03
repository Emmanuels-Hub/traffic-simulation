import React, { useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CityEnvironment } from './CityEnvironment';
import { Vehicle } from './Vehicle';
import { TrafficLight3D } from './TrafficLight3D';
import { useSimulationStore } from '../../store/simulationStore';
import {
  simulationTick,
  initializeTrafficLights,
} from '../../engine/SimulationEngine';

// ─── Simulation Loop Component ───────────────────────────────────
const SimulationLoop: React.FC = () => {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      initializeTrafficLights();
    }
  }, []);

  useFrame((_, delta) => {
    // Clamp delta to prevent huge jumps when tab is inactive
    const clampedDelta = Math.min(delta, 0.1);
    simulationTick(clampedDelta);
  });

  return null;
};

// ─── Vehicles Renderer ───────────────────────────────────────────
const VehiclesRenderer: React.FC = () => {
  const vehicles = useSimulationStore((s) => s.vehicles);
  const selectedVehicle = useSimulationStore((s) => s.selectedVehicle);
  const setSelectedVehicle = useSimulationStore((s) => s.setSelectedVehicle);

  return (
    <group>
      {Array.from(vehicles.values()).map((vehicle) => (
        <Vehicle
          key={vehicle.id}
          vehicle={vehicle}
          isSelected={vehicle.id === selectedVehicle}
          onClick={() => setSelectedVehicle(
            vehicle.id === selectedVehicle ? null : vehicle.id
          )}
        />
      ))}
    </group>
  );
};

// ─── Traffic Lights Renderer ─────────────────────────────────────
const TrafficLightsRenderer: React.FC = () => {
  const trafficLights = useSimulationStore((s) => s.trafficLights);
  const selectedJunction = useSimulationStore((s) => s.selectedJunction);
  const setSelectedJunction = useSimulationStore((s) => s.setSelectedJunction);

  return (
    <group>
      {Array.from(trafficLights.values()).map((tl) => (
        <TrafficLight3D
          key={tl.id}
          trafficLight={tl}
          isSelected={tl.junctionId === selectedJunction}
          onClick={() => setSelectedJunction(
            tl.junctionId === selectedJunction ? null : tl.junctionId
          )}
        />
      ))}
    </group>
  );
};

// ─── Fog and atmosphere ──────────────────────────────────────────
const Atmosphere: React.FC = () => {
  const timeOfDay = useSimulationStore((s) => s.config.timeOfDay);
  const weather = useSimulationStore((s) => s.config.weatherCondition);

  const sunPosition = React.useMemo(() => {
    const angle = ((timeOfDay - 6) / 12) * Math.PI;
    return [
      Math.cos(angle) * 100,
      Math.sin(angle) * 100,
      50,
    ] as [number, number, number];
  }, [timeOfDay]);

  const isNight = timeOfDay < 6 || timeOfDay > 20;

  return (
    <>
      {!isNight && (
        <Sky
          sunPosition={sunPosition}
          turbidity={weather === 'fog' ? 20 : weather === 'rain' ? 15 : 8}
          rayleigh={weather === 'clear' ? 2 : 1}
          mieCoefficient={weather === 'fog' ? 0.1 : 0.005}
          mieDirectionalG={0.8}
        />
      )}
      {isNight && <Stars radius={300} depth={60} count={1500} factor={4} fade speed={1} />}

      {/* Ambient light based on time */}
      <ambientLight intensity={isNight ? 0.15 : 0.4} color={isNight ? '#1a237e' : '#ffffff'} />

      {/* Main directional light (sun/moon) */}
      <directionalLight
        position={isNight ? [0, 50, 30] : sunPosition}
        intensity={isNight ? 0.3 : 1.2}
        color={isNight ? '#b0bec5' : '#fff8e1'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
      />

      {/* Hemisphere light for ambient fill */}
      <hemisphereLight
        color={isNight ? '#1a237e' : '#87CEEB'}
        groundColor={isNight ? '#000' : '#4a7c3f'}
        intensity={isNight ? 0.1 : 0.5}
      />

      {/* Fog */}
      {weather === 'fog' && (
        <fog attach="fog" args={['#c0c0c0', 20, 120]} />
      )}
    </>
  );
};

// ─── Main Scene Component ────────────────────────────────────────
export const Scene: React.FC = () => {
  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <PerspectiveCamera
        makeDefault
        position={[80, 60, 80]}
        fov={50}
        near={0.1}
        far={500}
      />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={15}
        maxDistance={200}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={[0, 0, 0]}
      />

      <Atmosphere />
      <CityEnvironment />
      <VehiclesRenderer />
      <TrafficLightsRenderer />
      <SimulationLoop />
    </Canvas>
  );
};
