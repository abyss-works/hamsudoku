import { describe, expect, it } from 'vitest';
import { endlessClearModel, endlessHudModel } from './screenModels';

describe('endless screenModels (순수 표시 모델)', () => {
  it('기록 저장 중이거나 결과가 없을 때 pending 상태를 제공한다', () => {
    expect(endlessClearModel({ result: null, error: null, submitting: false, starting: false })).toEqual({
      showConfetti: false,
      title: '기록을 저장하는 중…',
      note: null,
      actionsDisabled: true,
    });
    expect(endlessClearModel({ result: { ok: true, earned: 10 }, error: null, submitting: true, starting: false })).toEqual({
      showConfetti: false,
      title: '기록을 저장하는 중…',
      note: null,
      actionsDisabled: true,
    });
  });

  it('저장 실패 시 에러 메시지 또는 기본 실패 문구를 제공한다', () => {
    expect(endlessClearModel({ result: { ok: false, earned: 0 }, error: '네트워크 연결 실패', submitting: false, starting: false })).toEqual({
      showConfetti: false,
      title: '네트워크 연결 실패',
      note: null,
      actionsDisabled: false,
    });
    expect(endlessClearModel({ result: { ok: false, earned: 0 }, error: null, submitting: false, starting: false })).toEqual({
      showConfetti: false,
      title: '기록을 저장하지 못했어요.',
      note: null,
      actionsDisabled: false,
    });
  });

  it('저장 성공 시 폭죽 표시와 획득 씨앗 문구를 제공하며 earned=0도 보존한다', () => {
    expect(endlessClearModel({ result: { ok: true, earned: 5 }, error: null, submitting: false, starting: false })).toEqual({
      showConfetti: true,
      title: '햄스터를 다 찾았다! 씨앗 5개를 얻었어요',
      note: null,
      actionsDisabled: false,
    });
    expect(endlessClearModel({ result: { ok: true, earned: 0 }, error: null, submitting: false, starting: false })).toEqual({
      showConfetti: true,
      title: '햄스터를 다 찾았다! 씨앗 0개를 얻었어요',
      note: null,
      actionsDisabled: false,
    });
    // 성공했지만 부가 경고 에러가 남은 경우 note로 표시
    expect(endlessClearModel({ result: { ok: true, earned: 3 }, error: '동기화 지연', submitting: false, starting: false })).toEqual({
      showConfetti: true,
      title: '햄스터를 다 찾았다! 씨앗 3개를 얻었어요',
      note: '동기화 지연',
      actionsDisabled: false,
    });
  });

  it('endlessHudModel이 지갑 잔액과 목숨 aria-label을 생성한다', () => {
    expect(endlessHudModel(0, 3)).toEqual({
      balance: 0,
      seeds: 3,
      ariaLabel: '씨앗 0개, 목숨 3개',
    });
    expect(endlessHudModel(12, 1)).toEqual({
      balance: 12,
      seeds: 1,
      ariaLabel: '씨앗 12개, 목숨 1개',
    });
  });
});
