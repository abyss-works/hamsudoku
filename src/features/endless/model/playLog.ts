import { PLAY_LOG_MAX_EVENTS, PLAY_LOG_VERSION, type PlayEvent, type PlayEventCode, type PlayLog } from '../../../shared/endless';
import type { GameAction, GameSound } from '../../sudoku/model/gameTransition';

/** 시각을 붙이기 전의 이벤트. 탭 조작의 결과만 칸 좌표를 담는다. */
export type PlayEventBody = [PlayEventCode] | [PlayEventCode, number, number];

/**
 * 보드 조작 하나의 결과를 기록 이벤트로 바꾼다. 결과는 보드 전이가 낸 소리 순서를 따른다.
 * 탭의 결과는 탭한 칸 좌표를 담고, 끌기의 표시·지우기는 좌표 없이 남긴다. 탐침 전환은 켜짐·꺼짐으로 남긴다.
 */
export function transitionEvents(action: GameAction, sounds: readonly GameSound[]): PlayEventBody[] {
  if (action.type === 'probe') return [[action.on ? 'probe-on' : 'probe-off']];
  if (action.type === 'tap') return sounds.map((sound) => [sound, action.r, action.c]);
  return sounds.map((sound) => [sound]);
}

export interface PlayRecorder {
  record(action: GameAction, sounds: readonly GameSound[]): void;
  /** 지금까지의 기록 사본. 이후 기록은 반환한 값에 반영되지 않는다. */
  snapshot(): PlayLog;
}

/**
 * 판 하나의 조작 기록기. 시각은 기록기를 만든 시점부터의 경과 밀리초(정수)다.
 * 이벤트가 상한을 넘으면 상한보다 하나 많은 개수에서 기록을 멈춘다. 전송량을 제한하면서 서버가 상한 초과로 판정하게 한다.
 */
export function createPlayRecorder(now: () => number): PlayRecorder {
  const origin = now();
  const events: PlayEvent[] = [];
  return {
    record(action, sounds) {
      for (const body of transitionEvents(action, sounds)) {
        if (events.length > PLAY_LOG_MAX_EVENTS) return;
        const t = Math.max(0, Math.round(now() - origin));
        events.push([t, ...body] as PlayEvent);
      }
    },
    snapshot() {
      return { version: PLAY_LOG_VERSION, events: events.map((event) => [...event] as PlayEvent) };
    },
  };
}
