// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { EndlessScene } from './EndlessScene';

const api = vi.hoisted(() => ({ nextStage: vi.fn(), submitClear: vi.fn(), reportFail: vi.fn() }));
vi.mock('../features/endless/endlessApi', () => ({
  ...api,
  EndlessApiError: class extends Error { status = 500; },
}));
vi.mock('howler', () => ({
  Howl: vi.fn(function () { return { play: vi.fn(), rate: vi.fn(), volume: vi.fn() }; }),
  Howler: { ctx: null },
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.clearAllMocks(); });

it('클리어 후 다음 판 로드가 실패하면 오류와 다시 시도할 액션을 유지한다', async () => {
  api.nextStage
    .mockResolvedValueOnce({ stage: { id: 'stage-1', size: 1, regions: '0' }, solution: [[0, 0]], attemptKey: 'attempt-1' })
    .mockRejectedValueOnce(new Error('offline'));
  api.submitClear.mockResolvedValue({ ok: false, reason: '기록 확인 실패' });
  render(<EndlessScene onBack={vi.fn()} />);
  fireEvent.doubleClick(await screen.findByRole('button', { name: /빈칸/ }));
  await waitFor(() => expect(screen.getByRole('button', { name: '다음 판' }).hasAttribute('disabled')).toBe(false));
  fireEvent.click(screen.getByRole('button', { name: '다음 판' }));
  await screen.findByText('무한모드를 불러오지 못했어요.');
  expect(screen.getByRole('button', { name: '다음 판' }).hasAttribute('disabled')).toBe(false);
  expect(screen.getByRole('button', { name: '나가기' })).toBeDefined();
});

it('게임오버 후 재도전 로드가 실패하면 오류와 재도전 액션을 유지한다', async () => {
  api.nextStage
    .mockResolvedValueOnce({ stage: { id: 'stage-1', size: 3, regions: '0'.repeat(9) }, solution: [[0, 0], [1, 1], [2, 2]], attemptKey: 'attempt-1' })
    .mockRejectedValueOnce(new Error('offline'));
  api.reportFail.mockResolvedValue({ ok: true });
  render(<EndlessScene onBack={vi.fn()} />);
  const cells = await screen.findAllByRole('button', { name: /빈칸/ });
  fireEvent.doubleClick(cells[1]);
  fireEvent.doubleClick(cells[2]);
  fireEvent.doubleClick(cells[3]);
  fireEvent.click(await screen.findByRole('button', { name: '재도전' }));
  await screen.findByText('무한모드를 불러오지 못했어요.');
  expect(screen.getByRole('button', { name: '재도전' })).toBeDefined();
  expect(screen.getByRole('button', { name: '나가기' })).toBeDefined();
});
