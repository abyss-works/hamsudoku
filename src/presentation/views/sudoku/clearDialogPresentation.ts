export interface ClearDialogModel {
  title: string;
  partyIndices: number[];
}

export function clearDialogPresentation(total: number): ClearDialogModel {
  return {
    title: `햄스터 ${total}마리를 다 찾았다!`,
    partyIndices: [0, 1, 2, 3, 4],
  };
}
