import React, { useEffect, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sky, Stars, PerspectiveCamera, Line } from '@react-three/drei';
import { useShallow } from 'zustand/react/shallow';
import * as THREE from 'three';
import { CityEnvironment } from './CityEnvironment';
import { Vehicle } from './Vehicle';
import { TrafficLight3D } from './TrafficLight3D';
import { useSimulationStore } from '../../store/simulationStore';
import { simulationTick, initializeSimulation } from '../../engine/SimulationEngine';
import { ROUTE_PATHS, pointAt } from '../../engine/routeGeometry';
import { getDirectionalSignalState } from '../../engine/signals';

// ─── Shared helpers ──────────────────────────────────────────────
const isNightTime = (t: number) => t < 6 || t > 18.5;

/** Sun direction for a time of day; elevation is clamped so it never lights from below ground. */
function sunPositionFor(timeOfDay: number): [number, number, number] {
  const angle = ((timeOfDay - 6) / 12) * Math.PI;
  return [Math.cos(angle) * 100, Math.max(Math.sin(angle), 0.05) * 100, 50];
}

// ─── Simulation Loop ─────────────────────────────────────────────
const SimulationLoop: React.FC = () => {
  useEffect(() => {
    initializeSimulation();
  }, []);

  useFrame((_, delta) => {
    simulationTick(delta);
  });

  return null;
};

// ─── Vehicles ────────────────────────────────────────────────────
export const VehiclesRenderer: React.FC<{ interactive?: boolean; highlightId?: string | null }> = ({
  interactive = true,
  highlightId,
}) => {
  // Re-render only when the set of vehicles changes; motion is applied per frame
  const ids = useSimulationStore(useShallow((s) => Array.from(s.vehicles.keys())));
  const selectedVehicle = useSimulationStore((s) => s.selectedVehicle);
  const setSelectedVehicle = useSimulationStore((s) => s.setSelectedVehicle);
  const highlighted = highlightId !== undefined ? highlightId : selectedVehicle;

  const onSelect = useMemo(
    () => (interactive ? (id: string) => setSelectedVehicle(id === useSimulationStore.getState().selectedVehicle ? null : id) : undefined),
    [interactive, setSelectedVehicle]
  );

  return (
    <group>
      {ids.map((id) => (
        <Vehicle key={id} vehicleId={id} isSelected={id === highlighted} onSelect={onSelect} />
      ))}
    </group>
  );
};

// ─── Traffic Lights ──────────────────────────────────────────────
export const TrafficLightsRenderer: React.FC<{ interactive?: boolean; showLabels?: boolean }> = ({
  interactive = true,
  showLabels = true,
}) => {
  const trafficLights = useSimulationStore((s) => s.trafficLights);
  const selectedJunction = useSimulationStore((s) => s.selectedJunction);
  const setSelectedJunction = useSimulationStore((s) => s.setSelectedJunction);

  const onSelect = useMemo(
    () => (interactive ? (id: string) => setSelectedJunction(id === useSimulationStore.getState().selectedJunction ? null : id) : undefined),
    [interactive, setSelectedJunction]
  );

  return (
    <group>
      {Array.from(trafficLights.values()).map((tl) => (
        <TrafficLight3D
          key={tl.id}
          trafficLight={tl}
          isSelected={interactive && tl.junctionId === selectedJunction}
          onSelect={onSelect}
          showLabel={showLabels}
        />
      ))}
    </group>
  );
};

// ─── Rain ────────────────────────────────────────────────────────
const RAIN_COUNT = 4000;
const RAIN_AREA = 200;
const RAIN_HEIGHT = 60;

function createRainGeometry(): THREE.BufferGeometry {
  const positions = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i++) {
    positions[i * 3] = (Math.random() - 0.5) * RAIN_AREA;
    positions[i * 3 + 1] = Math.random() * RAIN_HEIGHT;
    positions[i * 3 + 2] = (Math.random() - 0.5) * RAIN_AREA;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  return g;
}

const Rain: React.FC = () => {
  const geometry = useMemo(() => createRainGeometry(), []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((_, delta) => {
    const attr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const fall = Math.min(delta, 0.1) * 35;
    for (let i = 1; i < arr.length; i += 3) {
      arr[i] -= fall;
      if (arr[i] < 0) arr[i] += RAIN_HEIGHT;
    }
    attr.needsUpdate = true;
  });

  return (
    <points geometry={geometry}>
      <pointsMaterial color="#a8c8ff" size={0.25} transparent opacity={0.6} depthWrite={false} />
    </points>
  );
};

// ─── Debug overlay: lane paths and stop lines coloured by signal ─
const DebugOverlay: React.FC = () => {
  const trafficLights = useSimulationStore((s) => s.trafficLights);

  const paths = useMemo(
    () => ROUTE_PATHS.map((r, i) => ({
      id: r.id,
      color: new THREE.Color().setHSL(i / ROUTE_PATHS.length, 0.8, 0.55),
      points: r.samples.map((p) => [p.x, 0.12, p.z] as [number, number, number]),
    })),
    []
  );

  const stops = useMemo(() => {
    const seen = new Map<string, { pos: THREE.Vector3; lightId: string; approach: Parameters<typeof getDirectionalSignalState>[1] }>();
    for (const r of ROUTE_PATHS) {
      for (const m of r.movements) {
        const key = `${m.junctionId}:${m.approach}`;
        if (!seen.has(key)) seen.set(key, { pos: pointAt(r, m.stopS), lightId: m.lightId, approach: m.approach });
      }
    }
    return Array.from(seen.entries());
  }, []);

  return (
    <group>
      {paths.map((p) => (
        <Line key={p.id} points={p.points} color={p.color} lineWidth={1.5} transparent opacity={0.7} />
      ))}
      {stops.map(([key, s]) => {
        const light = trafficLights.get(s.lightId);
        const state = light ? getDirectionalSignalState(light, s.approach) : 'green';
        const color = state === 'green' ? '#2ecc71' : state === 'yellow' ? '#f1c40f' : '#e74c3c';
        return (
          <mesh key={key} position={[s.pos.x, 0.3, s.pos.z]}>
            <sphereGeometry args={[0.45, 12, 12]} />
            <meshBasicMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
};

// ─── Atmosphere: sky, lights, fog ────────────────────────────────
const Atmosphere: React.FC = () => {
  const timeOfDay = useSimulationStore((s) => s.config.timeOfDay);
  const weather = useSimulationStore((s) => s.config.weatherCondition);

  const sunPosition = useMemo(() => sunPositionFor(timeOfDay), [timeOfDay]);
  const isNight = isNightTime(timeOfDay);
  const elevation = Math.max(0, Math.sin(((timeOfDay - 6) / 12) * Math.PI));
  const overcast = weather === 'clear' ? 1 : weather === 'rain' ? 0.55 : 0.7;
  const sunIntensity = (0.35 + 1.0 * elevation) * overcast;

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
      {isNight && <color attach="background" args={['#05070f']} />}
      {isNight && weather === 'clear' && <Stars radius={300} depth={60} count={1500} factor={4} fade speed={1} />}

      <ambientLight intensity={isNight ? 0.15 : 0.4 * overcast} color={isNight ? '#1a237e' : '#ffffff'} />

      <directionalLight
        position={isNight ? [30, 60, 40] : sunPosition}
        intensity={isNight ? 0.25 : sunIntensity}
        color={isNight ? '#b0bec5' : '#fff8e1'}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={300}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
      />

      <hemisphereLight
        color={isNight ? '#1a237e' : '#87CEEB'}
        groundColor={isNight ? '#000' : '#4a7c3f'}
        intensity={isNight ? 0.1 : 0.5}
      />

      {weather === 'fog' && <fog attach="fog" args={[isNight ? '#1a1d26' : '#c0c0c0', 20, 120]} />}
      {weather === 'rain' && <fog attach="fog" args={[isNight ? '#10131a' : '#8a929c', 60, 260]} />}
      {weather === 'rain' && <Rain />}
    </>
  );
};

const City: React.FC = () => {
  const isNight = useSimulationStore((s) => isNightTime(s.config.timeOfDay));
  return <CityEnvironment isNight={isNight} />;
};

const Debug: React.FC = () => {
  const show = useSimulationStore((s) => s.config.showDebugInfo);
  return show ? <DebugOverlay /> : null;
};

// ─── Main Scene Component ────────────────────────────────────────
const CONTROLS_TARGET: [number, number, number] = [10, 0, 5];

export const Scene: React.FC = () => {
  return (
    <Canvas
      shadows="percentage"
      gl={{
        antialias: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.2,
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <PerspectiveCamera makeDefault position={[90, 70, 90]} fov={50} near={0.1} far={600} />

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.05}
        minDistance={15}
        maxDistance={220}
        maxPolarAngle={Math.PI / 2 - 0.05}
        target={CONTROLS_TARGET}
      />

      <Atmosphere />
      <City />
      <VehiclesRenderer />
      <TrafficLightsRenderer />
      <Debug />
      <SimulationLoop />
    </Canvas>
  );
};
