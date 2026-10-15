import { create } from 'zustand';
import type {
  SimulationStore,
  SimulationConfig,
  TrafficAnalytics,
  Vehicle,
} from '../types';
import { createInitialTrafficLights } from '../config/roadNetwork';

const defaultConfig: SimulationConfig = {
  maxVehicles: 30,
  spawnRate: 0.5,
  simulationSpeed: 1,
  isPaused: false,
  showDebugInfo: false,
  timeOfDay: 14,
  weatherCondition: 'clear',
};

const defaultAnalytics: TrafficAnalytics = {
  totalVehicles: 0,
  avgSpeed: 0,
  avgWaitTime: 0,
  throughput: 0,
  congestionLevel: 0,
  junctionStats: [],
  vehicleTypeCounts: { sedan: 0, suv: 0, truck: 0, bus: 0, sports: 0 },
  vehicleStateCounts: { moving: 0, stopped: 0, waiting: 0, turning: 0 },
  speedHistory: [],
  vehicleCountHistory: [],
  congestionHistory: [],
  throughputHistory: [],
};

export const useSimulationStore = create<SimulationStore>((set) => ({
  vehicles: new Map<string, Vehicle>(),
  trafficLights: createInitialTrafficLights(),
  simTime: 0,
  config: defaultConfig,
  analytics: defaultAnalytics,
  selectedJunction: null,
  selectedVehicle: null,
  viewMode: 'simulation',

  setConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),

  setSelectedJunction: (id) => set({ selectedJunction: id }),
  setSelectedVehicle: (id) => set({ selectedVehicle: id }),
  setViewMode: (mode) => set({ viewMode: mode }),

  updateAnalytics: (updates) =>
    set((state) => ({
      analytics: { ...state.analytics, ...updates },
    })),

  toggleTrafficLightMode: (id) =>
    set((state) => {
      const light = state.trafficLights.get(id);
      if (!light) return {};
      const newLights = new Map(state.trafficLights);
      const toAuto = light.mode === 'manual';
      newLights.set(id, {
        ...light,
        mode: toAuto ? 'auto' : 'manual',
        // Resuming auto restarts the current phase so it gets its full duration
        phaseEndsAt: toAuto
          ? state.simTime + light.phases[light.currentPhaseIndex].duration
          : light.phaseEndsAt,
      });
      return { trafficLights: newLights };
    }),

  cycleTrafficLight: (id) =>
    set((state) => {
      const light = state.trafficLights.get(id);
      if (!light || light.mode !== 'manual') return {};
      const newLights = new Map(state.trafficLights);
      const nextIndex = (light.currentPhaseIndex + 1) % light.phases.length;
      newLights.set(id, {
        ...light,
        currentPhaseIndex: nextIndex,
        phaseEndsAt: state.simTime + light.phases[nextIndex].duration,
      });
      return { trafficLights: newLights };
    }),

  reset: () =>
    set({
      vehicles: new Map(),
      trafficLights: createInitialTrafficLights(),
      simTime: 0,
      analytics: defaultAnalytics,
      selectedJunction: null,
      selectedVehicle: null,
    }),
}));
