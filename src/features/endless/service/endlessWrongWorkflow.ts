import { playGameOverSound } from '../../../platform/audio/sound';
import { applyFail } from '../../../shared/endlessMirrorRules';
import type { EndlessMirror } from '../../../shared/endless';
import { reportFail } from '../api/endlessApi';
import { onReportWrong, type EndlessSessionState } from '../model/endlessSessionState';

export interface WrongContext {
  activeRef: { current: boolean };
  seedRef: { current: number };
  stageRef: { current: string | null };
  roundRef?: { current: number };
  attemptKeyRef: { current: string | null };
  mirrorRef: { current: EndlessMirror };
  setMirrorBoth: (next: EndlessMirror) => void;
  updateState: (updater: (prev: EndlessSessionState) => EndlessSessionState) => void;
}

export function runWrongWorkflow(
  ctx: WrongContext,
  boundStageId: string | null,
  boundRoundId?: number,
): void {
  if (!ctx.activeRef.current) return;
  if (!boundStageId || boundStageId !== ctx.stageRef.current) return;
  if (boundRoundId !== undefined && (boundRoundId === 0 || boundRoundId !== ctx.roundRef?.current)) return;
  if (ctx.seedRef.current <= 0) return;

  const nextSeeds = ctx.seedRef.current - 1;
  ctx.seedRef.current = nextSeeds;

  if (nextSeeds === 0) {
    playGameOverSound();
    const nextMirror = applyFail(ctx.mirrorRef.current);
    ctx.setMirrorBoth(nextMirror);
    ctx.updateState((prev) => onReportWrong(prev, 0, true, nextMirror));

    const key = ctx.attemptKeyRef.current;
    if (key) void reportFail(key);
  } else {
    ctx.updateState((prev) => onReportWrong(prev, nextSeeds, false));
  }
}
