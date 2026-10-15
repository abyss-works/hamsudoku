export function stageHudModel(stageCode: string, elapsedText: string, hamsterCount: number, puzzleSize: number) {
  return {
    hudText: `${stageCode} · ${elapsedText}`,
    hamsterDotsLabel: `햄스터 ${hamsterCount}/${puzzleSize}`,
    dots: Array.from({ length: puzzleSize }, (_, i) => ({
      id: i,
      on: i < hamsterCount,
    })),
  };
}
