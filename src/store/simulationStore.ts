import { create } from 'zustand';
import * as THREE from 'three';
import type {
  SimulationStore,
  SimulationConfig,
  TrafficAnalytics,
  Vehicle,
  TrafficLight,
} from '../types';

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
  speedHistory: [],
  vehicleCountHistory: [],
  congestionHistory: [],
  throughputHistory: [],
};

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  vehicles: new Map<string, Vehicle>(),
  trafficLights: new Map<string, TrafficLight>(),
  config: defaultConfig,
  analytics: defaultAnalytics,
  selectedJunction: null,
  selectedVehicle: null,
  viewMode: 'simulation',

  setConfig: (updates) =>
    set((state) => ({
      config: { ...state.config, ...updates },
    })),

  addVehicle: (vehicle) =>
    set((state) => {
      const newVehicles = new Map(state.vehicles);
      newVehicles.set(vehicle.id, vehicle);
      return { vehicles: newVehicles };
    }),

  removeVehicle: (id) =>
    set((state) => {
      const newVehicles = new Map(state.vehicles);
      newVehicles.delete(id);
      return { vehicles: newVehicles };
    }),

  updateVehicle: (id, updates) =>
    set((state) => {
      const newVehicles = new Map(state.vehicles);
      const vehicle = newVehicles.get(id);
      if (vehicle) {
        newVehicles.set(id, { ...vehicle, ...updates });
      }
      return { vehicles: newVehicles };
    }),

  updateTrafficLight: (id, updates) =>
    set((state) => {
      const newLights = new Map(state.trafficLights);
      const light = newLights.get(id);
      if (light) {
        newLights.set(id, { ...light, ...updates });
      }
      return { trafficLights: newLights };
    }),

  setSelectedJunction: (id) => set({ selectedJunction: id }),
  setSelectedVehicle: (id) => set({ selectedVehicle: id }),
  setViewMode: (mode) => set({ viewMode: mode }),

  updateAnalytics: (updates) =>
    set((state) => ({
      analytics: { ...state.analytics, ...updates },
    })),

  toggleTrafficLightMode: (id) =>
    set((state) => {
      const newLights = new Map(state.trafficLights);
      const light = newLights.get(id);
      if (light) {
        newLights.set(id, {
          ...light,
          mode: light.mode === 'auto' ? 'manual' : 'auto',
        });
      }
      return { trafficLights: newLights };
    }),

  cycleTrafficLight: (id) =>
    set((state) => {
      const newLights = new Map(state.trafficLights);
      const light = newLights.get(id);
      if (light && light.mode === 'manual') {
        const nextIndex = (light.currentPhaseIndex + 1) % light.phases.length;
        newLights.set(id, {
          ...light,
          currentPhaseIndex: nextIndex,
          timer: light.phases[nextIndex].duration,
        });
      }
      return { trafficLights: newLights };
    }),

  reset: () =>
    set({
      vehicles: new Map(),
      analytics: defaultAnalytics,
      selectedJunction: null,
      selectedVehicle: null,
    }),
}));
