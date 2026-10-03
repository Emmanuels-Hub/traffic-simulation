import React from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { useSimulationStore } from '../../store/simulationStore';
import './AnalyticsDashboard.css';

export const AnalyticsDashboard: React.FC = () => {
  const analytics = useSimulationStore((s) => s.analytics);
  const vehicles = useSimulationStore((s) => s.vehicles);

  // Vehicle type distribution
  const typeDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {
      sedan: 0, suv: 0, truck: 0, bus: 0, sports: 0,
    };
    vehicles.forEach((v) => {
      counts[v.type] = (counts[v.type] || 0) + 1;
    });
    return Object.entries(counts).map(([type, count]) => ({
      type: type.charAt(0).toUpperCase() + type.slice(1),
      count,
    }));
  }, [vehicles]);

  // Vehicle state distribution
  const stateDistribution = React.useMemo(() => {
    const counts: Record<string, number> = {
      moving: 0, stopped: 0, waiting: 0, turning: 0,
    };
    vehicles.forEach((v) => {
      counts[v.state] = (counts[v.state] || 0) + 1;
    });
    return Object.entries(counts).map(([state, count]) => ({
      state: state.charAt(0).toUpperCase() + state.slice(1),
      count,
    }));
  }, [vehicles]);

  const customTooltipStyle = {
    backgroundColor: 'rgba(12, 14, 22, 0.95)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: '8px',
    padding: '8px 12px',
    color: '#ccc',
    fontSize: '11px',
  };

  return (
    <div className="analytics-dashboard">
      <div className="analytics-header">
        <h2>📊 Traffic Analytics</h2>
        <span className="live-badge">● LIVE</span>
      </div>

      {/* Summary Cards */}
      <div className="analytics-cards">
        <div className="analytics-card">
          <div className="ac-icon" style={{ color: '#3498db' }}>🚗</div>
          <div className="ac-content">
            <span className="ac-value">{analytics.totalVehicles}</span>
            <span className="ac-label">Active Vehicles</span>
          </div>
        </div>
        <div className="analytics-card">
          <div className="ac-icon" style={{ color: '#2ecc71' }}>⚡</div>
          <div className="ac-content">
            <span className="ac-value">{analytics.avgSpeed.toFixed(1)}</span>
            <span className="ac-label">Avg Speed (m/s)</span>
          </div>
        </div>
        <div className="analytics-card">
          <div className="ac-icon" style={{ color: '#e74c3c' }}>⏱️</div>
          <div className="ac-content">
            <span className="ac-value">{analytics.avgWaitTime.toFixed(1)}s</span>
            <span className="ac-label">Avg Wait Time</span>
          </div>
        </div>
        <div className="analytics-card">
          <div className="ac-icon" style={{ color: '#f39c12' }}>📈</div>
          <div className="ac-content">
            <span className="ac-value">{analytics.throughput.toFixed(0)}</span>
            <span className="ac-label">Throughput/min</span>
          </div>
        </div>
        <div className="analytics-card wide">
          <div className="ac-icon" style={{ color: analytics.congestionLevel > 0.5 ? '#e74c3c' : '#2ecc71' }}>🚦</div>
          <div className="ac-content">
            <span className="ac-value">{(analytics.congestionLevel * 100).toFixed(0)}%</span>
            <span className="ac-label">Congestion Level</span>
          </div>
          <div className="congestion-bar-bg">
            <div
              className="congestion-bar-fill"
              style={{
                width: `${analytics.congestionLevel * 100}%`,
                background: analytics.congestionLevel > 0.7
                  ? 'linear-gradient(90deg, #f39c12, #e74c3c)'
                  : analytics.congestionLevel > 0.4
                  ? 'linear-gradient(90deg, #2ecc71, #f39c12)'
                  : 'linear-gradient(90deg, #2ecc71, #3498db)',
              }}
            />
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {/* Vehicle Count Over Time */}
        <div className="chart-container">
          <h3>Vehicle Count</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={analytics.vehicleCountHistory}>
              <defs>
                <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={false} stroke="rgba(255,255,255,0.1)" />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#6366f1" fill="url(#colorCount)" strokeWidth={2} name="Vehicles" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Average Speed Over Time */}
        <div className="chart-container">
          <h3>Average Speed</h3>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={analytics.speedHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={false} stroke="rgba(255,255,255,0.1)" />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Line type="monotone" dataKey="value" stroke="#2ecc71" strokeWidth={2} dot={false} name="Speed (m/s)" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Congestion Over Time */}
        <div className="chart-container">
          <h3>Congestion Level</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={analytics.congestionHistory}>
              <defs>
                <linearGradient id="colorCongestion" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e74c3c" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#e74c3c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={false} stroke="rgba(255,255,255,0.1)" />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#666', fontSize: 10 }} domain={[0, 100]} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#e74c3c" fill="url(#colorCongestion)" strokeWidth={2} name="Congestion %" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Throughput Over Time */}
        <div className="chart-container">
          <h3>Throughput</h3>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={analytics.throughputHistory}>
              <defs>
                <linearGradient id="colorTP" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f39c12" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f39c12" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="time" tick={false} stroke="rgba(255,255,255,0.1)" />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Area type="monotone" dataKey="value" stroke="#f39c12" fill="url(#colorTP)" strokeWidth={2} name="Vehicles/min" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle Type Distribution */}
        <div className="chart-container">
          <h3>Vehicle Types</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={typeDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="type" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#888', fontSize: 10 }} />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Vehicle State Distribution */}
        <div className="chart-container">
          <h3>Vehicle States</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stateDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="state" stroke="rgba(255,255,255,0.1)" tick={{ fill: '#888', fontSize: 10 }} />
              <YAxis stroke="rgba(255,255,255,0.1)" tick={{ fill: '#666', fontSize: 10 }} />
              <Tooltip contentStyle={customTooltipStyle} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Count">
                {stateDistribution.map((entry, idx) => {
                  const colors = ['#2ecc71', '#e74c3c', '#f39c12', '#3498db'];
                  return <rect key={idx} fill={colors[idx % colors.length]} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Junction Performance Table */}
        <div className="chart-container wide">
          <h3>Junction Performance</h3>
          <div className="junction-table">
            <table>
              <thead>
                <tr>
                  <th>Junction</th>
                  <th>Waiting</th>
                  <th>Avg Wait (s)</th>
                  <th>Congestion</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {analytics.junctionStats.map((js) => (
                  <tr key={js.junctionId}>
                    <td className="jt-id">{js.junctionId}</td>
                    <td>{js.vehiclesWaiting}</td>
                    <td>{js.avgWaitTime.toFixed(1)}</td>
                    <td>
                      <div className="jt-bar-bg">
                        <div
                          className="jt-bar"
                          style={{
                            width: `${Math.min(js.congestionLevel * 100, 100)}%`,
                            background: js.congestionLevel > 0.7
                              ? '#e74c3c'
                              : js.congestionLevel > 0.4
                              ? '#f39c12'
                              : '#2ecc71',
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <span
                        className="jt-status"
                        style={{
                          color: js.congestionLevel > 0.7
                            ? '#e74c3c'
                            : js.congestionLevel > 0.4
                            ? '#f39c12'
                            : '#2ecc71',
                        }}
                      >
                        {js.congestionLevel > 0.7
                          ? 'Heavy'
                          : js.congestionLevel > 0.4
                          ? 'Moderate'
                          : 'Clear'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
