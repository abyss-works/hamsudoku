import { describe, expect, it } from 'vitest';
import {
  createInitialOverlayState,
  openOverlay,
  closeOverlay,
  setScope,
  expireScope,
} from './overlayState';

describe('OverlayState pure state transitions', () => {
  it('기본 상태에서 오버레이를 열면 default 슬롯에 활성화된다', () => {
    const s0 = createInitialOverlayState();
    const s1 = openOverlay(s0, { type: 'settings' });

    expect(s1.activeBySlot['default']).toEqual({
      type: 'settings',
      slot: 'default',
    });
  });

  it('동일 슬롯의 새 요청은 기존 오버레이를 원자적으로 교체한다', () => {
    const s0 = createInitialOverlayState();
    const s1 = openOverlay(s0, { type: 'settings' });
    const s2 = openOverlay(s1, { type: 'profile', data: { userId: 'u1' } });

    expect(s2.activeBySlot['default']).toEqual({
      type: 'profile',
      slot: 'default',
      data: { userId: 'u1' },
    });
  });

  it('서로 다른 슬롯의 오버레이는 독립적으로 유지된다', () => {
    const s0 = createInitialOverlayState();
    const s1 = openOverlay(s0, { type: 'hud', slot: 'board' });
    const s2 = openOverlay(s1, { type: 'dialog', slot: 'default' });

    expect(s2.activeBySlot['board']?.type).toBe('hud');
    expect(s2.activeBySlot['default']?.type).toBe('dialog');
  });

  it('오버레이를 닫으면 해당 슬롯이 null로 정리된다', () => {
    const s0 = createInitialOverlayState();
    const s1 = openOverlay(s0, { type: 'settings' });
    const s2 = closeOverlay(s1, 'settings');

    expect(s2.activeBySlot['default']).toBeNull();
  });

  it('다른 타입으로 닫기를 시도하면 현재 오버레이가 보존된다', () => {
    const s0 = createInitialOverlayState();
    const s1 = openOverlay(s0, { type: 'profile' });
    const s2 = closeOverlay(s1, 'settings');

    expect(s2.activeBySlot['default']?.type).toBe('profile');
  });

  it('스코프 전환 시 이전 스코프의 오버레이가 닫히고 이전 스코프는 만료된다', () => {
    const s0 = createInitialOverlayState('home');
    const s1 = openOverlay(s0, { type: 'settings', scopeId: 'home' });
    expect(s1.activeBySlot['default']?.type).toBe('settings');

    // 화면 또는 판이 game으로 전환
    const s2 = setScope(s1, 'game');
    expect(s2.activeScopeId).toBe('game');
    expect(s2.activeBySlot['default']).toBeNull();
    expect(s2.expiredScopes).toContain('home');
  });

  it('만료된 스코프에서 발생한 지연 콜백 요청은 무시된다', () => {
    const s0 = createInitialOverlayState('stage-1');
    const s1 = setScope(s0, 'stage-2');

    // stage-1 시절의 오래된 비동기 콜백이 뒤늦게 오버레이를 열려고 시도
    const s2 = openOverlay(s1, { type: 'clear-dialog', scopeId: 'stage-1' });

    expect(s2.activeBySlot['default']).toBeFalsy();
  });

  it('명시적 expireScope 호출 시 해당 스코프의 오버레이가 닫히고 만료 목록에 추가된다', () => {
    const s0 = createInitialOverlayState('session-1');
    const s1 = openOverlay(s0, { type: 'game-over', scopeId: 'session-1', slot: 'board' });
    const s2 = expireScope(s1, 'session-1');

    expect(s2.activeBySlot['board']).toBeNull();
    expect(s2.expiredScopes).toContain('session-1');
  });

  it('동일한 내용의 중복 요청은 불필요한 상태 갱신을 일으키지 않는다', () => {
    const s0 = createInitialOverlayState();
    const s1 = openOverlay(s0, { type: 'settings', slot: 'default' });
    const s2 = openOverlay(s1, { type: 'settings', slot: 'default' });

    expect(s2).toBe(s1);
  });

  it('동일한 scopeId 이름이 나중에 재사용될 때, 이전 수명 인스턴스의 지연 액션은 차단되고 새 수명 인스턴스는 정상 동작한다', () => {
    // 세션 1: stage-1 시작 (인스턴스 토큰 1)
    const s0 = createInitialOverlayState();
    const s1 = setScope(s0, 'stage-1', 'inst-1');
    const s2 = openOverlay(s1, { type: 'hint', scopeId: 'stage-1', scopeToken: 'inst-1' });
    expect(s2.activeBySlot['default']?.type).toBe('hint');

    // 세션 1 종료 및 stage-2로 전환
    const s3 = setScope(s2, 'stage-2', 'inst-2');
    expect(s3.activeBySlot['default']).toBeNull();

    // 나중에 다시 stage-1로 재진입 (인스턴스 토큰 3)
    const s4 = setScope(s3, 'stage-1', 'inst-3');

    // 이전 세션 1 (inst-1) 시절의 오래된 지연 요청 -> 차단되어야 한다!
    const s5 = openOverlay(s4, { type: 'clear', scopeId: 'stage-1', scopeToken: 'inst-1' });
    expect(s5.activeBySlot['default']).toBeNull();

    // 새 세션 3 (inst-3)의 액션 -> 정상 동작해야 한다!
    const s6 = openOverlay(s5, { type: 'clear', scopeId: 'stage-1', scopeToken: 'inst-3' });
    expect(s6.activeBySlot['default']?.type).toBe('clear');
  });

  it('순수 상태 전이 함수(closeOverlay, setScope, expireScope)는 외부 콜백을 호출하지 않는다', () => {
    let callCount = 0;
    const callback = () => {
      callCount += 1;
    };

    const s0 = createInitialOverlayState('scope-a', 'token-a');
    // onClose가 포함된 요청으로 오버레이 등록
    const s1 = openOverlay(s0, {
      type: 'test',
      scopeId: 'scope-a',
      scopeToken: 'token-a',
      onClose: callback,
    } as any);

    // 1. closeOverlay 실행 시 콜백 호출이 없어야 한다
    closeOverlay(s1, 'test');
    expect(callCount).toBe(0);

    // 2. setScope 실행 시 콜백 호출이 없어야 한다
    setScope(s1, 'scope-b', 'token-b');
    expect(callCount).toBe(0);

    // 3. expireScope 실행 시 콜백 호출이 없어야 한다
    expireScope(s1, 'scope-a', 'token-a');
    expect(callCount).toBe(0);
  });
});

