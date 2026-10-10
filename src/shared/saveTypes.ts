export interface ClearEntry {
  stageCode: string;
  clearedAt: string;
  elapsedSec: number;
  attempts: number;
}

export interface SaveV1 {
  v: 1;
  clears: ClearEntry[];
  settings: { sound: boolean; vibration: boolean };
  updatedAt: string;
}
