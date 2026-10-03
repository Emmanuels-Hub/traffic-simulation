import React, { useState, useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { CityEnvironment } from '../3d/CityEnvironment';
import { Vehicle as Vehicle3D } from '../3d/Vehicle';
import { TrafficLight3D } from '../3d/TrafficLight3D';
import { useSimulationStore } from '../../store/simulationStore';
import { JUNCTIONS } from '../../config/roadNetwork';
import './CameraOverlay.css';

type CameraMode = 'follow' | 'driver' | 'J1' | 'J2' | 'J3' | 'J4' | 'J5' | 'overhead';

// ─── Camera Controller Component ─────────────────────────────────
const CameraController: React.FC<{
  mode: CameraMode;
  targetVehicleId: string | null;
}> = ({ mode, targetVehicleId }) => {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const currentPos = useRef(new THREE.Vector3(50, 40, 50));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(() => {
    if (!cameraRef.current) return;

    const vehicles = useSimulationStore.getState().vehicles;
    let targetVehicle = targetVehicleId ? vehicles.get(targetVehicleId) : null;

    // Fallback to first vehicle if selected vehicle disappeared
    if (!targetVehicle && vehicles.size > 0) {
      targetVehicle = Array.from(vehicles.values())[0];
    }

    let desiredPos = new THREE.Vector3(0, 50, 0);
    let desiredLookAt = new THREE.Vector3(0, 0, 0);

    if (mode === 'follow' && targetVehicle) {
      const angle = targetVehicle.rotation.y;
      const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      desiredPos = targetVehicle.position.clone().sub(forward.clone().multiplyScalar(12)).add(new THREE.Vector3(0, 5, 0));
      desiredLookAt = targetVehicle.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    } else if (mode === 'driver' && targetVehicle) {
      const angle = targetVehicle.rotation.y;
      const forward = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
      desiredPos = targetVehicle.position.clone().add(forward.clone().multiplyScalar(0.4)).add(new THREE.Vector3(0, 1.3, 0));
      desiredLookAt = targetVehicle.position.clone().add(forward.clone().multiplyScalar(20)).add(new THREE.Vector3(0, 1.3, 0));
    } else if (mode.startsWith('J')) {
      const junc = JUNCTIONS.find((j) => j.id === mode);
      if (junc) {
        desiredPos = junc.position.clone().add(new THREE.Vector3(14, 16, 14));
        desiredLookAt = junc.position.clone();
      }
    } else if (mode === 'overhead') {
      desiredPos = new THREE.Vector3(0, 95, 0.1);
      desiredLookAt = new THREE.Vector3(0, 0, 0);
    } else {
      // Default isometric view
      desiredPos = new THREE.Vector3(60, 45, 60);
      desiredLookAt = new THREE.Vector3(0, 0, 0);
    }

    // Smooth lerp camera movement
    currentPos.current.lerp(desiredPos, 0.1);
    currentLookAt.current.lerp(desiredLookAt, 0.1);

    cameraRef.current.position.copy(currentPos.current);
    cameraRef.current.lookAt(currentLookAt.current);
  });

  return <PerspectiveCamera ref={cameraRef} makeDefault fov={mode === 'driver' ? 65 : 45} near={0.1} far={400} />;
};

// ─── Simplified Scene Renderer for PIP ───────────────────────────
const PIPScene: React.FC<{ mode: CameraMode; targetVehicleId: string | null }> = ({ mode, targetVehicleId }) => {
  const vehicles = useSimulationStore((s) => s.vehicles);
  const trafficLights = useSimulationStore((s) => s.trafficLights);

  return (
    <>
      <CameraController mode={mode} targetVehicleId={targetVehicleId} />

      <ambientLight intensity={0.5} />
      <directionalLight position={[40, 60, 40]} intensity={1.0} castShadow />
      <hemisphereLight color="#87CEEB" groundColor="#4a7c3f" intensity={0.4} />

      <CityEnvironment />

      <group>
        {Array.from(vehicles.values()).map((vehicle) => (
          <Vehicle3D
            key={vehicle.id}
            vehicle={vehicle}
            isSelected={vehicle.id === targetVehicleId}
          />
        ))}
      </group>

      <group>
        {Array.from(trafficLights.values()).map((tl) => (
          <TrafficLight3D key={tl.id} trafficLight={tl} />
        ))}
      </group>
    </>
  );
};

// ─── Camera Overlay Main Component ───────────────────────────────
export const CameraOverlay: React.FC = () => {
  const [cameraMode, setCameraMode] = useState<CameraMode>('follow');
  const [sizeMode, setSizeMode] = useState<'normal' | 'large' | 'minimized'>('normal');

  const selectedVehicle = useSimulationStore((s) => s.selectedVehicle);
  const setSelectedVehicle = useSimulationStore((s) => s.setSelectedVehicle);
  const vehicles = useSimulationStore((s) => s.vehicles);

  const activeVehicle = useMemo(() => {
    if (selectedVehicle) {
      return vehicles.get(selectedVehicle) || null;
    }
    return vehicles.size > 0 ? Array.from(vehicles.values())[0] : null;
  }, [selectedVehicle, vehicles]);

  const handleNextVehicle = () => {
    const vArray = Array.from(vehicles.values());
    if (vArray.length === 0) return;
    const currentIndex = vArray.findIndex((v) => v.id === selectedVehicle);
    const nextVehicle = vArray[(currentIndex + 1) % vArray.length];
    setSelectedVehicle(nextVehicle.id);
  };

  if (sizeMode === 'minimized') {
    return (
      <button
        className="pip-minimized-btn"
        onClick={() => setSizeMode('normal')}
        title="Open Camera View"
      >
        📷 Camera View
      </button>
    );
  }

  return (
    <div className={`pip-camera-container ${sizeMode}`}>
      {/* Header Bar */}
      <div className="pip-header">
        <div className="pip-title">
          <span className="rec-dot">●</span>
          <span className="pip-label">
            {cameraMode === 'follow'
              ? 'CHASE CAM'
              : cameraMode === 'driver'
              ? 'DASHCAM POV'
              : cameraMode === 'overhead'
              ? 'DRONE OVERHEAD'
              : `CCTV ${cameraMode}`}
          </span>
        </div>

        <div className="pip-controls">
          <select
            className="pip-select"
            value={cameraMode}
            onChange={(e) => setCameraMode(e.target.value as CameraMode)}
          >
            <option value="follow">🚗 Chase Cam</option>
            <option value="driver">🛞 Dashcam POV</option>
            <option value="J1">🚦 CCTV J1 (NW)</option>
            <option value="J2">🚦 CCTV J2 (NE)</option>
            <option value="J3">🚦 CCTV J3 (SW)</option>
            <option value="J4">🚦 CCTV J4 (SE)</option>
            <option value="J5">🚦 CCTV J5 (East)</option>
            <option value="overhead">🚁 Drone Overhead</option>
          </select>

          <button
            className="pip-btn"
            onClick={() => setSizeMode(sizeMode === 'normal' ? 'large' : 'normal')}
            title={sizeMode === 'normal' ? 'Enlarge' : 'Shrink'}
          >
            {sizeMode === 'normal' ? '⤢' : '⤡'}
          </button>

          <button
            className="pip-btn"
            onClick={() => setSizeMode('minimized')}
            title="Minimize"
          >
            ─
          </button>
        </div>
      </div>

      {/* 3D Viewport Inset */}
      <div className="pip-viewport">
        <Canvas gl={{ antialias: true }} style={{ width: '100%', height: '100%' }}>
          <PIPScene mode={cameraMode} targetVehicleId={activeVehicle?.id || null} />
        </Canvas>

        {/* Crosshair / View HUD overlay */}
        {cameraMode === 'driver' && <div className="dashcam-hud-reticle" />}

        {/* Info Banner at Bottom of Inset */}
        {(cameraMode === 'follow' || cameraMode === 'driver') && activeVehicle && (
          <div className="pip-info-overlay">
            <div className="pip-vehicle-badge" style={{ backgroundColor: activeVehicle.color }}>
              {activeVehicle.type.toUpperCase()} #{activeVehicle.id.slice(-4)}
            </div>
            <div className="pip-speed">
              {(activeVehicle.velocity * 3.6).toFixed(0)} <span className="unit">km/h</span>
            </div>
            <button className="pip-cycle-btn" onClick={handleNextVehicle} title="Switch Target Vehicle">
              Next ⏭
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
