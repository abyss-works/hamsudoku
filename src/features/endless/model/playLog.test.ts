import { describe, expect, it } from 'vitest';
import { PLAY_LOG_MAX_EVENTS, playLogSchema } from '../../../shared/endless';
import { createPlayRecorder, transitionEvents } from './playLog';

describe('transitionEvents', () => {
  it('탭 조작의 결과는 칸 좌표와 함께 이벤트가 된다', () => {
    expect(transitionEvents({ type: 'tap', r: 2, c: 5, kind: 'double' }, ['correct'])).toEqual([['correct', 2, 5]]);
    expect(transitionEvents({ type: 'tap', r: 1, c: 0, kind: 'double' }, ['wrong'])).toEqual([['wrong', 1, 0]]);
    expect(transitionEvents({ type: 'tap', r: 0, c: 0, kind: 'single' }, ['mark'])).toEqual([['mark', 0, 0]]);
  });

  it('한 번의 탭에서 난 여러 결과를 순서대로 남긴다', () => {
    expect(transitionEvents({ type: 'tap', r: 3, c: 3, kind: 'double' }, ['erase', 'correct'])).toEqual([
      ['erase', 3, 3],
      ['correct', 3, 3],
    ]);
  });

  it('끌기 조작의 표시·지우기는 좌표 없이 남긴다', () => {
    expect(transitionEvents({ type: 'enter', r: 4, c: 1 }, ['mark', 'mark'])).toEqual([['mark'], ['mark']]);
    expect(transitionEvents({ type: 'enter', r: 4, c: 2 }, ['erase'])).toEqual([['erase']]);
  });

  it('탐침 전환과 초기화를 남긴다', () => {
    expect(transitionEvents({ type: 'probe', on: true }, [])).toEqual([['probe-on']]);
    expect(transitionEvents({ type: 'probe', on: false }, [])).toEqual([['probe-off']]);
    expect(transitionEvents({ type: 'reset' }, ['reset'])).toEqual([['reset']]);
  });

  it('결과가 없는 조작은 이벤트를 만들지 않는다', () => {
    expect(transitionEvents({ type: 'tap', r: 0, c: 0, kind: 'single' }, [])).toEqual([]);
    expect(transitionEvents({ type: 'begin', r: 0, c: 0 }, [])).toEqual([]);
    expect(transitionEvents({ type: 'end' }, [])).toEqual([]);
    expect(transitionEvents({ type: 'resetMarks' }, [])).toEqual([]);
  });
});

describe('createPlayRecorder', () => {
  function clock(start = 1000) {
    let value = start;
    return { now: () => value, advance: (ms: number) => { value += ms; } };
  }

  it('기록기를 만든 시점부터의 경과 밀리초를 정수로 남긴다', () => {
    const time = clock(5000.25);
    const recorder = createPlayRecorder(time.now);
    time.advance(120.4);
    recorder.record({ type: 'tap', r: 0, c: 1, kind: 'double' }, ['correct']);
    time.advance(380.3);
    recorder.record({ type: 'enter', r: 1, c: 1 }, ['mark']);
    time.advance(0.6);
    recorder.record({ type: 'probe', on: true }, []);

    const log = recorder.snapshot();
    expect(log).toEqual({ version: 1, events: [[120, 'correct', 0, 1], [501, 'mark'], [501, 'probe-on']] });
    expect(playLogSchema.safeParse(log).success).toBe(true);
  });

  it('스냅샷은 이후 기록의 영향을 받지 않는다', () => {
    const time = clock();
    const recorder = createPlayRecorder(time.now);
    recorder.record({ type: 'tap', r: 0, c: 0, kind: 'single' }, ['mark']);
    const first = recorder.snapshot();
    recorder.record({ type: 'tap', r: 0, c: 0, kind: 'single' }, ['erase']);
    expect(first.events).toEqual([[0, 'mark', 0, 0]]);
    expect(recorder.snapshot().events).toHaveLength(2);
  });

  it('상한을 넘으면 상한보다 하나 많은 이벤트에서 기록을 멈춰 상한 초과를 드러낸다', () => {
    const time = clock();
    const recorder = createPlayRecorder(time.now);
    for (let i = 0; i < PLAY_LOG_MAX_EVENTS + 50; i += 1) {
      time.advance(10);
      recorder.record({ type: 'enter', r: 0, c: 0 }, ['mark']);
    }
    const log = recorder.snapshot();
    expect(log.events).toHaveLength(PLAY_LOG_MAX_EVENTS + 1);
    expect(log.events.at(-1)).toEqual([(PLAY_LOG_MAX_EVENTS + 1) * 10, 'mark']);
    expect(playLogSchema.safeParse(log).success).toBe(false);
  });

  it('상한까지는 형식에 맞는 기록이다', () => {
    const time = clock();
    const recorder = createPlayRecorder(time.now);
    for (let i = 0; i < PLAY_LOG_MAX_EVENTS; i += 1) recorder.record({ type: 'enter', r: 0, c: 0 }, ['mark']);
    expect(playLogSchema.safeParse(recorder.snapshot()).success).toBe(true);
  });
});
