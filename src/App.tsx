import React from 'react';
import { Scene } from './components/3d/Scene';
import { ControlPanel } from './components/ui/ControlPanel';
import { AnalyticsDashboard } from './components/ui/AnalyticsDashboard';
import { useSimulationStore } from './store/simulationStore';
import './App.css';

const App: React.FC = () => {
  const viewMode = useSimulationStore((s) => s.viewMode);

  return (
    <div className="app">
      {/* 3D Viewport */}
      <div className="viewport">
        <Scene />
      </div>

      {/* Analytics overlay */}
      {viewMode === 'analytics' && <AnalyticsDashboard />}

      {/* Control Panel (always visible) */}
      <ControlPanel />

      {/* Keyboard shortcuts hint */}
      <div className="keyboard-hint">
        <span>Scroll to zoom</span>
        <span>•</span>
        <span>Click + drag to orbit</span>
        <span>•</span>
        <span>Right-click + drag to pan</span>
      </div>
    </div>
  );
};

export default App;
