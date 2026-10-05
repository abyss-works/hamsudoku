// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { SelectScreen } from './screens/SelectScreen';
import { LEVELS } from './game/levels.generated';
import { PUZZLES } from './game/puzzles';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
});

const stubFetch = (handler: (url: string) => Promise<Response>) => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => handler(url)),
  );
};

const solutionOf = (code: string): number[] => {
  const lv = LEVELS.find((l) => l.code === code);
  if (!lv) throw new Error(`no level ${code}`);
  return lv.puzzle.solution.map(([r, c]) => r * lv.puzzle.size + c);
};

describe('화면 전환', () => {
  it('홈 스테이지 버튼은 선택화면으로 간다', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    expect(await screen.findByText('레벨 선택')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1' })).toBeTruthy();
  });

  it('1-1 정답 클릭으로 클리어된다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    solutionOf('1-1').forEach((i) => fireEvent.dblClick(cells()[i]));
    expect(screen.getByRole('dialog', { name: '클리어' })).toBeTruthy();
  });

  it('다시하기로 재클리어하면 attempts가 오른다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    solutionOf('1-1').forEach((i) => fireEvent.dblClick(cells()[i]));
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    solutionOf('1-1').forEach((i) => fireEvent.dblClick(cells()[i]));
    const saved = JSON.parse(localStorage.getItem('hamsudoku:save:v1') ?? '{}');
    expect(saved.clears.find((c: { stageCode: string }) => c.stageCode === '1-1')?.attempts).toBe(2);
  });

  it('클리어하면 기록이 1건만 쌓이고 선택화면에 표시된다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    solutionOf('1-1').forEach((i) => fireEvent.dblClick(cells()[i]));
    fireEvent.click(screen.getByRole('button', { name: '스테이지로' }));
    const btn = await screen.findByRole('button', { name: '1' });
    expect(btn.textContent).toMatch(/\d+:\d\d/);
  });

  it('마지막 스테이지 클리어 후 다음 맵은 홈으로 돌아간다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '레벨 3' }));
    fireEvent.click(screen.getByRole('button', { name: '10' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    solutionOf('3-10').forEach((i) => fireEvent.dblClick(cells()[i]));
    fireEvent.click(screen.getByRole('button', { name: '다음 맵' }));
    expect(await screen.findByRole('button', { name: '이어하기' })).toBeTruthy();
  });

  it('이어하기는 최대 클리어의 다음으로 진입한다', async () => {
    localStorage.setItem(
      'hamsudoku:save:v1',
      JSON.stringify({
        v: 1,
        clears: [{ stageCode: '2-1', clearedAt: 't', elapsedSec: 30, attempts: 1 }],
        settings: { sound: true, vibration: true },
        updatedAt: 't',
      }),
    );
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '이어하기' }));
    expect(container.querySelector('.board')).toBeTruthy();
    expect(container.querySelectorAll('.board .cell')).toHaveLength(36);
  });

  it('기어는 설정 껍데기를 열고 닫는다', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    expect(screen.getByRole('dialog', { name: '설정' })).toBeTruthy();
    expect(screen.getAllByText('준비중')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: '설정' })).toBeNull();
  });

  it('로그인 화면이 열리고 닫힌다', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    expect(await screen.findByRole('button', { name: '가입하기' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(await screen.findByRole('button', { name: '이어하기' })).toBeTruthy();
  });

  it('세션 만료 때 로그인 화면으로 간다', async () => {
    stubFetch(async (url: string) => {
      if (url.endsWith('/api/auth/me')) return Response.json({ uid: 'u1', email: 'e@x.y' });
      if (url.endsWith('/api/records')) return new Response(null, { status: 401 });
      throw new Error(`unexpected ${url}`);
    });
    render(<App />);
    expect(await screen.findByRole('button', { name: '가입하기' })).toBeTruthy();
  });

  it('로그인하면 게스트 기록 대신 계정 기록으로 바뀐다', async () => {
    localStorage.setItem(
      'hamsudoku:save:v1',
      JSON.stringify({
        v: 1,
        clears: [{ stageCode: '2-1', clearedAt: 't0', elapsedSec: 10, attempts: 1 }],
        settings: { sound: true, vibration: true },
        updatedAt: 't0',
      }),
    );
    let signedIn = false;
    stubFetch(async (url: string) => {
      if (url.endsWith('/api/auth/me')) {
        return Response.json(signedIn ? { uid: 'uB', email: 'e@x.y' } : { uid: null, email: null });
      }
      if (url.endsWith('/api/auth/signin')) {
        signedIn = true;
        return Response.json({ ok: true });
      }
      if (url.endsWith('/api/records'))
        return Response.json({ clears: [{ stageCode: '1-1', bestElapsedSec: 70, attempts: 2, lastClearedAt: 't9' }] });
      if (url.endsWith('/api/auth/signout')) return Response.json({ ok: true });
      throw new Error(`unexpected ${url}`);
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(screen.getByRole('button', { name: '로그인' }));
    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'e@x.y' } });
    fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '로그인하기' }));
    await screen.findByRole('button', { name: '이어하기' });
    await vi.waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('hamsudoku:save:v1') ?? '{}');
      expect(saved.clears).toEqual([
        { stageCode: '1-1', clearedAt: 't9', elapsedSec: 70, attempts: 2 },
      ]);
    });
  });

  it('로그아웃하면 로컬 기록이 비워진다', async () => {
    localStorage.setItem(
      'hamsudoku:save:v1',
      JSON.stringify({
        v: 1,
        clears: [{ stageCode: '1-1', clearedAt: 't0', elapsedSec: 10, attempts: 1 }],
        settings: { sound: true, vibration: true },
        updatedAt: 't0',
      }),
    );
    stubFetch(async (url: string) => {
      if (url.endsWith('/api/auth/me')) return Response.json({ uid: 'u1', email: 'e@x.y' });
      if (url.endsWith('/api/records')) return Response.json({ clears: [] });
      throw new Error(`unexpected ${url}`);
    });
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    fireEvent.click(await screen.findByRole('button', { name: '로그아웃' }));
    await vi.waitFor(() => {
      const saved = JSON.parse(localStorage.getItem('hamsudoku:save:v1') ?? '{}');
      expect(saved.clears).toEqual([]);
    });
    expect(await screen.findByRole('button', { name: '이어하기' })).toBeTruthy();
  });

  it('게임 중 뒤로가기 후 재진입하면 빈판이다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const line = () => screen.getByRole('status').getAttribute('aria-label') ?? '';
    const idx = solutionOf('1-1')[0];
    fireEvent.dblClick(container.querySelectorAll('.board .cell')[idx]);
    expect(line()).toContain('햄스터 1/5');
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    await screen.findByText('레벨 1');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    expect(line()).toContain('햄스터 0/5');
  });
});

describe('탭 UX', () => {
  it('빠르게 연달아 클릭해도 두 마커가 남는다', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const marks = () => screen.queryAllByRole('button', { name: /X 표시|자동 표시/ });
    fireEvent.click(screen.getAllByRole('button', { name: /빈칸/ })[0]);
    fireEvent.click(screen.getAllByRole('button', { name: /빈칸/ })[1]);
    await new Promise((r) => setTimeout(r, 500));
    expect(marks()).toHaveLength(2);
  });
  it('정답 더블클릭은 같은 줄 빈칸을 X로 채운다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    fireEvent.dblClick(cells()[solutionOf('1-1')[0]]);
    expect((await screen.findAllByRole('button', { name: /자동 표시/ })).length).toBeGreaterThan(0);
  });

  it('정답 셀은 초록 링이 뜬다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    fireEvent.dblClick(cells()[solutionOf('1-1')[0]]);
    expect(container.querySelector('.cell-hit')).toBeTruthy();
  });

  it('자동 마커는 싱글로 안 풀린다', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(document.querySelectorAll('.board .cell'));
    fireEvent.dblClick(cells()[solutionOf('1-1')[0]]);
    const auto = await screen.findAllByRole('button', { name: /자동 표시/ });
    fireEvent.click(auto[0]);
    expect(await screen.findAllByRole('button', { name: /자동 표시/ })).not.toHaveLength(0);
  });

  it('오답 더블클릭은 보드가 흔들린다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    const sol = new Set(solutionOf('1-1'));
    const wrongIdx = Array.from({ length: 25 }, (_, i) => i).find((i) => !sol.has(i)) as number;
    fireEvent.dblClick(cells()[wrongIdx]);
    expect(container.querySelector('.board-wrap.shake')).toBeTruthy();
  });

  it('오답 더블클릭은 빨간 고정 마커가 되고 토글 안 된다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const sol = new Set(solutionOf('1-1'));
    const wrongIdx = Array.from({ length: 25 }, (_, i) => i).find((i) => !sol.has(i)) as number;
    fireEvent.dblClick(container.querySelectorAll('.board .cell')[wrongIdx]);
    const wrong = await screen.findByRole('button', { name: /틀린 칸/ });
    fireEvent.click(wrong);
    expect(await screen.findByRole('button', { name: /틀린 칸/ })).toBeTruthy();
  });
});

describe('드래그 칠하기', () => {
  const mockSpot = (el: Element | null) => {
    const orig = (document as any).elementFromPoint;
    (document as any).elementFromPoint = vi.fn(() => el);
    return () => {
      (document as any).elementFromPoint = orig;
    };
  };
  const mockSpotSeq = (els: (Element | null)[]) => {
    const orig = (document as any).elementFromPoint;
    let i = 0;
    (document as any).elementFromPoint = vi.fn(() => els[Math.min(i++, els.length - 1)]);
    return () => {
      (document as any).elementFromPoint = orig;
    };
  };
  const enterStage11 = async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell')) as HTMLElement[];
    const board = container.querySelector('.board') as HTMLElement;
    return { container, cells, board };
  };

  it('빈칸 시작 드래그는 빈칸만 마크로 칠한다', async () => {
    const { cells, board } = await enterStage11();
    fireEvent.pointerDown(cells()[0]);
    const restore = mockSpot(cells()[1]);
    fireEvent.pointerMove(board, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(board);
    restore();
    expect(await screen.findAllByRole('button', { name: /X 표시/ })).toHaveLength(2);
  });

  it('되돌아가면 걸린 칸이 전부 되돌려진다', async () => {
    const { cells, board } = await enterStage11();
    fireEvent.pointerDown(cells()[0]);
    const restore = mockSpotSeq([cells()[1], cells()[2], cells()[3], cells()[2]]);
    fireEvent.pointerMove(board, { clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board, { clientX: 11, clientY: 11 });
    fireEvent.pointerMove(board, { clientX: 12, clientY: 12 });
    fireEvent.pointerMove(board, { clientX: 13, clientY: 13 });
    fireEvent.pointerUp(board);
    restore();
    expect(screen.getAllByRole('button', { name: /X 표시/ })).toHaveLength(2);
  });

  it('마커 시작 드래그는 빈칸을 건드리지 않고 마커만 지운다', async () => {
    const { cells, board } = await enterStage11();
    fireEvent.click(cells()[0]);
    await new Promise((r) => setTimeout(r, 300));
    fireEvent.pointerDown(cells()[0]);
    const restore = mockSpot(cells()[1]);
    fireEvent.pointerMove(board, { clientX: 10, clientY: 10 });
    fireEvent.pointerUp(board);
    restore();
    await new Promise((r) => setTimeout(r, 300));
    expect(screen.queryAllByRole('button', { name: /X 표시/ })).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /빈칸/ })).toHaveLength(25);
  });
});

describe('SelectScreen', () => {
  const noop = () => {};
  it('locked 스테이지는 비활성화된다', () => {
    render(
      <SelectScreen
        chapters={[
          {
            id: 'x',
            title: '레벨 X',
            stages: [{ id: 's', code: 'X-1', title: '잠긴 맵', puzzle: PUZZLES[0], locked: true }],
          },
        ]}
        loading={false}
        error={null}
        clears={new Map()}
        onSelect={noop}
        onBack={noop}
      />,
    );
    expect((screen.getByRole('button', { name: '1' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('에러 상태에서는 에러 문구가 뜬다', () => {
    render(
      <SelectScreen chapters={[]} loading={false} error="스테이지 목록을 불러오지 못했다" clears={new Map()} onSelect={noop} onBack={noop} />,
    );
    expect(screen.getByText('스테이지 목록을 불러오지 못했다')).toBeTruthy();
  });

  it('빈 카탈로그에서는 안내 문구가 뜬다', () => {
    render(<SelectScreen chapters={[]} loading={false} error={null} clears={new Map()} onSelect={noop} onBack={noop} />,
    );
    expect(screen.getByText('스테이지가 없어요')).toBeTruthy();
  });

  it('레벨 탭을 바꾸면 해당 장의 스테이지만 보인다', () => {
    const mk = (id: string, n: number) => ({
      id,
      title: `레벨 ${id}`,
      stages: Array.from({ length: n }, (_, i) => ({
        id: `${id}-s${i + 1}`,
        code: `${id}-${i + 1}`,
        title: `${id}-${i + 1} 스테이지`,
        puzzle: PUZZLES[0],
        locked: false,
      })),
    });
    const { container } = render(
      <SelectScreen chapters={[mk('A', 1), mk('B', 2)]} loading={false} error={null} clears={new Map()} onSelect={noop} onBack={noop} />,
    );
    const stageCount = () => container.querySelectorAll('.stage-list button').length;
    expect(stageCount()).toBe(1);
    fireEvent.click(screen.getByRole('button', { name: '레벨 B' }));
    expect(stageCount()).toBe(2);
  });
});
