// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { encryptSolution } from '../server/crypto';
import { PUZZLES } from '../game/puzzles';
import { EndlessGameScreen } from './EndlessGameScreen';

const PUZZLE = PUZZLES[0];
const SOLUTION_TEXT = PUZZLE.solution.map(([r, c]) => `${r},${c}`).join(';');
const SOLUTION_INDEXES = PUZZLE.solution.map(([r, c]) => r * PUZZLE.size + c);

function stubFetch(
  clearResponse: () => Response | Promise<Response> = () =>
    Response.json({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false }),
) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url === '/api/endless/next') {
        const { clientPublicKey } = JSON.parse(String(init?.body)) as { clientPublicKey: string };
        const enc = await encryptSolution(clientPublicKey, SOLUTION_TEXT);
        return Response.json({
          stage: { id: 'e-1', size: PUZZLE.size, regions: PUZZLE.islands.flat().join('') },
          ...enc,
          attemptKey: 'k1',
        });
      }
      if (url === '/api/endless/clear') return clearResponse();
      if (url === '/api/endless/fail') return Response.json({ ok: true });
      throw new Error(`unexpected ${url}`);
    }),
  );
  return calls;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe('EndlessGameScreen', () => {
  it('판이 오기 전에는 보드를 그리지 않는다', async () => {
    vi.useFakeTimers();
    try {
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: string) => {
          if (url === '/api/endless/next') return new Promise<Response>(() => {});
          if (url === '/api/endless/fail') return Response.json({ ok: true });
          throw new Error(`unexpected ${url}`);
        }),
      );
      const { container } = render(<EndlessGameScreen onBack={() => {}} />);
      await act(async () => {});
      expect(container.querySelector('.board')).toBeNull();
      expect(screen.queryByRole('status', { name: '불러오는 중' })).toBeNull();
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(screen.getByRole('status', { name: '불러오는 중' })).toBeTruthy();
      expect(container.querySelector('.board')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('시작하면 보드와 씨앗 3이 보인다', async () => {
    stubFetch();
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    expect(await screen.findByRole('status', { name: '씨앗 3/3' })).toBeTruthy();
    expect(container.querySelectorAll('.board .cell')).toHaveLength(25);
  });

  it('오답 3번이면 게임오버 오버레이가 뜬다', async () => {
    stubFetch();
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    await screen.findByRole('status', { name: '씨앗 3/3' });
    const cells = Array.from(container.querySelectorAll('.board .cell'));
    for (const i of [1, 2, 3]) fireEvent.dblClick(cells[i]);
    expect(await screen.findByRole('dialog', { name: '게임오버' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '재도전' })).toBeTruthy();
  });

  it('정답을 다 놓으면 클리어 오버레이와 적립 문구가 뜬다', async () => {
    const calls = stubFetch();
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    await screen.findByRole('status', { name: '씨앗 3/3' });
    const cells = Array.from(container.querySelectorAll('.board .cell'));
    for (const i of SOLUTION_INDEXES) fireEvent.dblClick(cells[i]);
    expect(await screen.findByRole('dialog', { name: '클리어' })).toBeTruthy();
    expect(screen.getByText(/씨앗 3개를 얻었어요/)).toBeTruthy();
    expect(calls).toContain('/api/endless/clear');
  });

  it('무효 응답이면 실패 문구가 뜬다', async () => {
    stubFetch(() => Response.json({ ok: false, reason: '정답이 맞지 않아요.' }));
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    await screen.findByRole('status', { name: '씨앗 3/3' });
    const cells = Array.from(container.querySelectorAll('.board .cell'));
    for (const i of SOLUTION_INDEXES) fireEvent.dblClick(cells[i]);
    expect(await screen.findByText('정답이 맞지 않아요.')).toBeTruthy();
    expect(screen.queryByText(/씨앗 3개를 얻었어요/)).toBeNull();
  });

  it('저장 중에는 다음 판이 잠기고 재시도로 완료된다', async () => {
    let first = true;
    stubFetch(() => {
      if (first) {
        first = false;
        throw new TypeError('network');
      }
      return Response.json({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
    });
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    await screen.findByRole('status', { name: '씨앗 3/3' });
    const cells = Array.from(container.querySelectorAll('.board .cell'));
    for (const i of SOLUTION_INDEXES) fireEvent.dblClick(cells[i]);
    expect(await screen.findByText('기록을 저장하는 중…')).toBeTruthy();
    expect((screen.getByRole('button', { name: '다음 판' }) as HTMLButtonElement).disabled).toBe(true);
    await waitFor(() => expect(screen.getByText(/씨앗 3개를 얻었어요/)).toBeTruthy(), { timeout: 6000 });
  });

  it('다음 판 로드가 실패하면 오버레이가 잠기지 않고 오류를 보여준다', async () => {
    let nextCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url === '/api/endless/next') {
          nextCalls += 1;
          if (nextCalls > 1) throw new TypeError('network');
          const { clientPublicKey } = JSON.parse(String(init?.body)) as { clientPublicKey: string };
          const enc = await encryptSolution(clientPublicKey, SOLUTION_TEXT);
          return Response.json({
            stage: { id: 'e-1', size: PUZZLE.size, regions: PUZZLE.islands.flat().join('') },
            ...enc,
            attemptKey: 'k1',
          });
        }
        if (url === '/api/endless/clear') return Response.json({ ok: true, earned: 3, balance: 3, streak: 1, suspicious: false });
        if (url === '/api/endless/fail') return Response.json({ ok: true });
        throw new Error(`unexpected ${url}`);
      }),
    );
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    await screen.findByRole('status', { name: '씨앗 3/3' });
    const cells = Array.from(container.querySelectorAll('.board .cell'));
    for (const i of SOLUTION_INDEXES) fireEvent.dblClick(cells[i]);
    await screen.findByText(/씨앗 3개를 얻었어요/);
    fireEvent.click(screen.getByRole('button', { name: '다음 판' }));
    expect(await screen.findByText('무한모드를 불러오지 못했어요.')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('button', { name: '다음 판' }) as HTMLButtonElement).disabled).toBe(false));
  });

  it('씨앗은 컨테이너 씨앗 박스에 보인다', async () => {
    stubFetch();
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    expect(await screen.findByRole('status', { name: '씨앗 3/3' })).toBeTruthy();
    expect(container.querySelector('.mode-status .seed-box')).toBeTruthy();
  });

  it('리셋은 임시마커만 지우고 햄스터는 남긴다', async () => {
    stubFetch();
    const { container } = render(<EndlessGameScreen onBack={() => {}} />);
    await screen.findByRole('status', { name: '씨앗 3/3' });
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    const sol = new Set(SOLUTION_INDEXES);
    const at = (c: Element) => Number(c.getAttribute('data-r')) * PUZZLE.size + Number(c.getAttribute('data-c'));
    fireEvent.dblClick(cells()[SOLUTION_INDEXES[0]]);
    expect(await screen.findByRole('button', { name: /햄스터/ })).toBeTruthy();
    const markCell = cells().find((c) => c.getAttribute('data-state') === 'empty' && !sol.has(at(c)));
    expect(markCell).toBeTruthy();
    fireEvent.click(markCell as Element);
    expect(await screen.findAllByRole('button', { name: /X 표시/ })).not.toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: '리셋' }));
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /X 표시/ })).toHaveLength(0));
    expect(screen.getAllByRole('button', { name: /햄스터/ })).not.toHaveLength(0);
  });
});
