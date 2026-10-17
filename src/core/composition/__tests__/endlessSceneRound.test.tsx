// @vitest-environment jsdom
import { StrictMode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EndlessScene } from '../EndlessScene';

const api = vi.hoisted(() => ({ nextStage: vi.fn(), submitClear: vi.fn(), reportFail: vi.fn() }));
vi.mock('../../../features/endless/api/endlessApi', () => ({
  ...api,
  EndlessApiError: class extends Error { status = 500; },
}));
vi.mock('howler', () => ({
  Howl: vi.fn(function () { return { play: vi.fn(), rate: vi.fn(), volume: vi.fn() }; }),
  Howler: { ctx: null },
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it('StrictMode에서 같은 퍼즐을 재발급받으면 새 보드가 시작되고 최초 요청은 중복되지 않는다', async () => {
  api.nextStage
    .mockResolvedValueOnce({ stage: { id: 'same-stage', size: 1, regions: '0' }, solution: [[0, 0]], attemptKey: 'attempt-1' })
    .mockResolvedValueOnce({ stage: { id: 'same-stage', size: 1, regions: '0' }, solution: [[0, 0]], attemptKey: 'attempt-2' });
  api.submitClear.mockResolvedValue({ ok: false, reason: '기록 확인 실패' });
  render(<StrictMode><EndlessScene onBack={vi.fn()} /></StrictMode>);
  const initialCell = await screen.findByRole('button', { name: /빈칸/ });
  expect(api.nextStage).toHaveBeenCalledTimes(1);
  fireEvent.doubleClick(initialCell);
  await waitFor(() => expect(screen.getByRole('button', { name: '다음 판' }).hasAttribute('disabled')).toBe(false), { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name: '다음 판' }));
  await waitFor(() => expect(api.nextStage).toHaveBeenCalledTimes(2), { timeout: 5000 });
  await waitFor(() => expect(screen.queryByRole('dialog', { name: '클리어' })).toBeNull(), { timeout: 5000 });
  expect(await screen.findByRole('button', { name: /빈칸/ })).toBeDefined();
  expect(screen.getByRole('status', { name: '씨앗 0개, 목숨 3개' }).tagName).toBe('SPAN');
});

it('판마다 새 기록을 시작해 클리어 제출에 그 판의 조작만 싣는다', async () => {
  api.nextStage
    .mockResolvedValueOnce({ stage: { id: 'stage-a', size: 1, regions: '0' }, solution: [[0, 0]], attemptKey: 'attempt-1' })
    .mockResolvedValueOnce({ stage: { id: 'stage-b', size: 1, regions: '0' }, solution: [[0, 0]], attemptKey: 'attempt-2' });
  api.submitClear.mockResolvedValue({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
  render(<EndlessScene onBack={vi.fn()} />);
  fireEvent.click(await screen.findByRole('button', { name: /빈칸/ }));
  fireEvent.doubleClick(await screen.findByRole('button', { name: /X 표시/ }, { timeout: 5000 }));
  await waitFor(() => expect(api.submitClear).toHaveBeenCalledTimes(1), { timeout: 5000 });
  await waitFor(() => expect(screen.getByRole('button', { name: '다음 판' }).hasAttribute('disabled')).toBe(false), { timeout: 5000 });
  fireEvent.click(screen.getByRole('button', { name: '다음 판' }));
  await waitFor(() => expect(api.nextStage).toHaveBeenCalledTimes(2), { timeout: 5000 });
  fireEvent.doubleClick(await screen.findByRole('button', { name: /빈칸/ }, { timeout: 5000 }));
  await waitFor(() => expect(api.submitClear).toHaveBeenCalledTimes(2), { timeout: 5000 });

  const [first, second] = api.submitClear.mock.calls.map(([input]) => input);
  expect(first).toMatchObject({ attemptKey: 'attempt-1', log: { version: 1 } });
  expect(first.log.events.map(([, code]: [number, string]) => code)).toEqual(['mark', 'correct']);
  expect(second).toMatchObject({ attemptKey: 'attempt-2', log: { version: 1 } });
  expect(second.log.events).toEqual([[expect.any(Number), 'correct', 0, 0]]);
});
