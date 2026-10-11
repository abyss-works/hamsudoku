export interface ProbeButtonModel {
  active: boolean;
  toggleLabel: string;
  slotText: string;
}

export function probeButtonPresentation(active: boolean, slots: number): ProbeButtonModel {
  return {
    active,
    toggleLabel: active ? '임시 정답 끄기' : '임시 정답 켜기',
    slotText: `${slots}/3`,
  };
}
