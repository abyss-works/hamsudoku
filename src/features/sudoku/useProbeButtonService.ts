import { probeButtonModel } from './model/boardProjection';

export function useProbeButtonService(active: boolean, slots: number) {
  return probeButtonModel(active, slots);
}
