import type { Direction, LightState, TrafficLight } from '../types';

/**
 * Signal shown to traffic travelling in `dir` (the direction a vehicle is
 * moving as it enters the junction). Directions not served by the current
 * phase are red.
 */
export function getDirectionalSignalState(light: TrafficLight, dir: Direction): LightState {
  const phase = light.phases[light.currentPhaseIndex];
  if (!phase) return 'red';
  return phase.directions.includes(dir) ? phase.state : 'red';
}
