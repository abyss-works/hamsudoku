// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useEndlessSession } from '../service/useEndlessSession';

const api = vi.hoisted(() => ({ nextStage: vi.fn(), submitClear: vi.fn(), reportFail: vi.fn() }));
vi.mock('../api/endlessApi', () => ({
  ...api,
  EndlessApiError: class extends Error { status = 500; },
}));
vi.mock('../../../platform/audio/sound', () => ({ playClearSound: vi.fn(), playGameOverSound: vi.fn() }));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it('같은 퍼즐을 다시 발급받아도 이전 시도의 액션은 새 시도를 변경하지 않는다', async () => {
  api.nextStage
    .mockResolvedValueOnce({ stage: { id: 'same-stage', size: 5, regions: '0'.repeat(25) }, solution: [[0, 0]], attemptKey: 'attempt-1' })
    .mockResolvedValueOnce({ stage: { id: 'same-stage', size: 5, regions: '0'.repeat(25) }, solution: [[0, 0]], attemptKey: 'attempt-2' });
  api.submitClear.mockResolvedValue({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
  const { result } = renderHook(() => useEndlessSession());
  await act(async () => result.current.start());
  const previousWrong = result.current.reportWrong;
  const previousFinish = result.current.finish;
  await act(async () => result.current.start());
  act(() => previousWrong());
  await act(async () => previousFinish());
  expect(result.current.seeds).toBe(3);
  expect(api.submitClear).not.toHaveBeenCalled();
});
