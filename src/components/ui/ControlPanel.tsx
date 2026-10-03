import React, { useState } from 'react';
import { useSimulationStore } from '../../store/simulationStore';
import { resetSimulation } from '../../engine/SimulationEngine';
import { JUNCTIONS } from '../../config/roadNetwork';
import './ControlPanel.css';

export const ControlPanel: React.FC = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'controls' | 'traffic' | 'environment'>('controls');

  const config = useSimulationStore((s) => s.config);
  const setConfig = useSimulationStore((s) => s.setConfig);
  const vehicles = useSimulationStore((s) => s.vehicles);
  const trafficLights = useSimulationStore((s) => s.trafficLights);
  const analytics = useSimulationStore((s) => s.analytics);
  const selectedJunction = useSimulationStore((s) => s.selectedJunction);
  const setSelectedJunction = useSimulationStore((s) => s.setSelectedJunction);
  const toggleTrafficLightMode = useSimulationStore((s) => s.toggleTrafficLightMode);
  const cycleTrafficLight = useSimulationStore((s) => s.cycleTrafficLight);
  const viewMode = useSimulationStore((s) => s.viewMode);
  const setViewMode = useSimulationStore((s) => s.setViewMode);

  const selectedJunctionData = selectedJunction
    ? JUNCTIONS.find((j) => j.id === selectedJunction)
    : null;
  const selectedTL = selectedJunctionData?.trafficLight
    ? trafficLights.get(selectedJunctionData.trafficLight.id)
    : null;

  return (
    <div className={`control-panel ${isCollapsed ? 'collapsed' : ''}`}>
      {/* Toggle button */}
      <button
        className="panel-toggle"
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? 'Expand Panel' : 'Collapse Panel'}
      >
        {isCollapsed ? '◀' : '▶'}
      </button>

      {!isCollapsed && (
        <>
          {/* Header */}
          <div className="panel-header">
            <div className="panel-logo">
              <div className="logo-icon">🚦</div>
              <div>
                <h1>TrafficSim</h1>
                <span className="panel-subtitle">3D Traffic Simulator</span>
              </div>
            </div>
          </div>

          {/* View Mode Toggle */}
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'simulation' ? 'active' : ''}`}
              onClick={() => setViewMode('simulation')}
            >
              🎮 Simulation
            </button>
            <button
              className={`view-btn ${viewMode === 'analytics' ? 'active' : ''}`}
              onClick={() => setViewMode('analytics')}
            >
              📊 Analytics
            </button>
          </div>

          {/* Quick Stats */}
          <div className="quick-stats">
            <div className="stat-card">
              <span className="stat-value">{vehicles.size}</span>
              <span className="stat-label">Vehicles</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analytics.avgSpeed.toFixed(1)}</span>
              <span className="stat-label">Avg Speed</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{(analytics.congestionLevel * 100).toFixed(0)}%</span>
              <span className="stat-label">Congestion</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{analytics.throughput.toFixed(0)}</span>
              <span className="stat-label">Flow/min</span>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="tab-nav">
            <button
              className={`tab-btn ${activeTab === 'controls' ? 'active' : ''}`}
              onClick={() => setActiveTab('controls')}
            >
              ⚙️ Controls
            </button>
            <button
              className={`tab-btn ${activeTab === 'traffic' ? 'active' : ''}`}
              onClick={() => setActiveTab('traffic')}
            >
              🚥 Traffic
            </button>
            <button
              className={`tab-btn ${activeTab === 'environment' ? 'active' : ''}`}
              onClick={() => setActiveTab('environment')}
            >
              🌤️ Environment
            </button>
          </div>

          {/* Tab content */}
          <div className="tab-content">
            {activeTab === 'controls' && (
              <div className="controls-tab">
                {/* Simulation Controls */}
                <div className="control-group">
                  <label className="control-label">Simulation</label>
                  <div className="button-row">
                    <button
                      className={`ctrl-btn ${config.isPaused ? 'play' : 'pause'}`}
                      onClick={() => setConfig({ isPaused: !config.isPaused })}
                    >
                      {config.isPaused ? '▶ Play' : '⏸ Pause'}
                    </button>
                    <button className="ctrl-btn reset" onClick={resetSimulation}>
                      🔄 Reset
                    </button>
                  </div>
                </div>

                {/* Speed Control */}
                <div className="control-group">
                  <label className="control-label">
                    Speed: <span className="value-badge">{config.simulationSpeed.toFixed(1)}x</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="5"
                    step="0.1"
                    value={config.simulationSpeed}
                    onChange={(e) => setConfig({ simulationSpeed: parseFloat(e.target.value) })}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>0.1x</span>
                    <span>5x</span>
                  </div>
                </div>

                {/* Max Vehicles */}
                <div className="control-group">
                  <label className="control-label">
                    Max Vehicles: <span className="value-badge">{config.maxVehicles}</span>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    step="1"
                    value={config.maxVehicles}
                    onChange={(e) => setConfig({ maxVehicles: parseInt(e.target.value) })}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>1</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Spawn Rate */}
                <div className="control-group">
                  <label className="control-label">
                    Spawn Rate: <span className="value-badge">{config.spawnRate.toFixed(1)}/s</span>
                  </label>
                  <input
                    type="range"
                    min="0.1"
                    max="3"
                    step="0.1"
                    value={config.spawnRate}
                    onChange={(e) => setConfig({ spawnRate: parseFloat(e.target.value) })}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>0.1/s</span>
                    <span>3/s</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'traffic' && (
              <div className="traffic-tab">
                <div className="control-group">
                  <label className="control-label">Junction Control</label>
                  <p className="help-text">Click a junction in the 3D view or select below:</p>

                  <div className="junction-grid">
                    {JUNCTIONS.map((junction) => {
                      const tl = junction.trafficLight
                        ? trafficLights.get(junction.trafficLight.id)
                        : null;
                      const phase = tl ? tl.phases[tl.currentPhaseIndex] : null;

                      return (
                        <button
                          key={junction.id}
                          className={`junction-btn ${selectedJunction === junction.id ? 'selected' : ''}`}
                          onClick={() =>
                            setSelectedJunction(
                              selectedJunction === junction.id ? null : junction.id
                            )
                          }
                        >
                          <span className="junction-id">{junction.id}</span>
                          <span className="junction-type">{junction.type}</span>
                          {phase && (
                            <span className={`light-indicator ${phase.state}`}>
                              ●
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Selected Junction Controls */}
                {selectedJunctionData && selectedTL && (
                  <div className="control-group junction-detail">
                    <label className="control-label">
                      {selectedJunctionData.id} — {selectedJunctionData.type}
                    </label>

                    <div className="tl-status">
                      <div className="tl-display">
                        <div className={`tl-light red ${selectedTL.phases[selectedTL.currentPhaseIndex].state === 'red' ? 'active' : ''}`} />
                        <div className={`tl-light yellow ${selectedTL.phases[selectedTL.currentPhaseIndex].state === 'yellow' ? 'active' : ''}`} />
                        <div className={`tl-light green ${selectedTL.phases[selectedTL.currentPhaseIndex].state === 'green' ? 'active' : ''}`} />
                      </div>
                      <div className="tl-info">
                        <div className="tl-state">
                          {selectedTL.phases[selectedTL.currentPhaseIndex].directions.length > 0
                            ? `${selectedTL.phases[selectedTL.currentPhaseIndex].directions.join('/').toUpperCase()} ${selectedTL.phases[selectedTL.currentPhaseIndex].state.toUpperCase()}`
                            : 'ALL RED CLEARANCE'}
                        </div>
                        <div className="tl-timer">{selectedTL.timer.toFixed(1)}s remaining</div>
                        <div className="tl-dirs">
                          {selectedTL.phases[selectedTL.currentPhaseIndex].directions.length > 0
                            ? `🟢 Active: ${selectedTL.phases[selectedTL.currentPhaseIndex].directions.join(', ').toUpperCase()} | 🔴 Red: ${['north','south','east','west'].filter(d => !selectedTL.phases[selectedTL.currentPhaseIndex].directions.includes(d)).join(', ').toUpperCase()}`
                            : '🔴 All Directions RED (Clearance)'}
                        </div>
                      </div>
                    </div>

                    <div className="button-row">
                      <button
                        className={`ctrl-btn ${selectedTL.mode === 'manual' ? 'manual-active' : ''}`}
                        onClick={() => toggleTrafficLightMode(selectedTL.id)}
                      >
                        {selectedTL.mode === 'auto' ? '🤖 Auto' : '✋ Manual'}
                      </button>
                      {selectedTL.mode === 'manual' && (
                        <button
                          className="ctrl-btn cycle"
                          onClick={() => cycleTrafficLight(selectedTL.id)}
                        >
                          🔄 Cycle
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* All Junctions Status */}
                <div className="control-group">
                  <label className="control-label">Junction Analytics</label>
                  <div className="junction-stats-list">
                    {analytics.junctionStats.map((js) => (
                      <div key={js.junctionId} className="junction-stat-row">
                        <span className="js-id">{js.junctionId}</span>
                        <div className="js-bar-container">
                          <div
                            className="js-bar"
                            style={{
                              width: `${Math.min(js.congestionLevel * 100, 100)}%`,
                              backgroundColor: js.congestionLevel > 0.7
                                ? '#e74c3c'
                                : js.congestionLevel > 0.4
                                ? '#f39c12'
                                : '#2ecc71',
                            }}
                          />
                        </div>
                        <span className="js-waiting">{js.vehiclesWaiting} waiting</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'environment' && (
              <div className="environment-tab">
                {/* Time of Day */}
                <div className="control-group">
                  <label className="control-label">
                    Time of Day: <span className="value-badge">
                      {Math.floor(config.timeOfDay).toString().padStart(2, '0')}:
                      {Math.floor((config.timeOfDay % 1) * 60).toString().padStart(2, '0')}
                    </span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="24"
                    step="0.5"
                    value={config.timeOfDay}
                    onChange={(e) => setConfig({ timeOfDay: parseFloat(e.target.value) })}
                    className="slider"
                  />
                  <div className="slider-labels">
                    <span>🌙 00:00</span>
                    <span>☀️ 12:00</span>
                    <span>🌙 24:00</span>
                  </div>
                </div>

                {/* Weather */}
                <div className="control-group">
                  <label className="control-label">Weather</label>
                  <div className="weather-btns">
                    {(['clear', 'rain', 'fog'] as const).map((w) => (
                      <button
                        key={w}
                        className={`weather-btn ${config.weatherCondition === w ? 'active' : ''}`}
                        onClick={() => setConfig({ weatherCondition: w })}
                      >
                        {w === 'clear' && '☀️ Clear'}
                        {w === 'rain' && '🌧️ Rain'}
                        {w === 'fog' && '🌫️ Fog'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Debug Mode */}
                <div className="control-group">
                  <label className="control-label toggle-label">
                    <span>Show Debug Info</span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={config.showDebugInfo}
                        onChange={(e) => setConfig({ showDebugInfo: e.target.checked })}
                      />
                      <span className="switch-slider" />
                    </label>
                  </label>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
