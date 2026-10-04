// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import { SelectScreen } from './screens/SelectScreen';
import { LEVELS } from './game/levels.generated';
import { PUZZLES } from './game/puzzles';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

const solutionOf = (code: string): number[] => {
  const lv = LEVELS.find((l) => l.code === code);
  if (!lv) throw new Error(`no level ${code}`);
  return lv.puzzle.solution.map(([r, c]) => r * lv.puzzle.size + c);
};

describe('화면 전환', () => {
  it('홈 스테이지 버튼은 선택화면으로 간다', async () => {
    render(<App />);
    expect((screen.getByRole('button', { name: '이어하기' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    expect(await screen.findByText('레벨 선택')).toBeTruthy();
    expect(screen.getByRole('button', { name: '1-1' })).toBeTruthy();
  });

  it('1-1 정답 클릭으로 클리어된다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1-1' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    solutionOf('1-1').forEach((i) => fireEvent.click(cells()[i]));
    expect(screen.getByRole('dialog', { name: '클리어' })).toBeTruthy();
  });

  it('마지막 스테이지 클리어 후 다음 맵은 홈으로 돌아간다', async () => {
    const { container } = render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '레벨 3' }));
    fireEvent.click(screen.getByRole('button', { name: '3-10' }));
    const cells = () => Array.from(container.querySelectorAll('.board .cell'));
    solutionOf('3-10').forEach((i) => fireEvent.click(cells()[i]));
    fireEvent.click(screen.getByRole('button', { name: '다음 맵' }));
    expect(await screen.findByRole('button', { name: '이어하기' })).toBeTruthy();
  });

  it('이어하기는 마지막 플레이로 바로 진입한다', async () => {
    localStorage.setItem('hamsudoku:last-stage', 'lv2-s1');
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

  it('게임 중 뒤로가기 후 재진입하면 빈판이다', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '스테이지' }));
    await screen.findByText('레벨 선택');
    fireEvent.click(screen.getByRole('button', { name: '1-1' }));
    const line = () => screen.getByRole('status').getAttribute('aria-label') ?? '';
    const first = screen.getAllByRole('button', { name: /빈칸/ })[0];
    fireEvent.click(first);
    expect(line()).toContain('햄스터 1/5');
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    await screen.findByText('레벨 1');
    fireEvent.click(screen.getByRole('button', { name: '1-1' }));
    expect(line()).toContain('햄스터 0/5');
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
        onSelect={noop}
        onBack={noop}
      />,
    );
    expect((screen.getByRole('button', { name: 'X-1' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('에러 상태에서는 에러 문구가 뜬다', () => {
    render(
      <SelectScreen chapters={[]} loading={false} error="스테이지 목록을 불러오지 못했다" onSelect={noop} onBack={noop} />,
    );
    expect(screen.getByText('스테이지 목록을 불러오지 못했다')).toBeTruthy();
  });

  it('빈 카탈로그에서는 안내 문구가 뜬다', () => {
    render(<SelectScreen chapters={[]} loading={false} error={null} onSelect={noop} onBack={noop} />,
    );
    expect(screen.getByText('스테이지가 없어요')).toBeTruthy();
  });

  it('레벨 탭을 바꾸면 해당 장의 스테이지만 보인다', async () => {
    const { fetchStages } = await import('./api/stagesApi');
    const chapters = await fetchStages();
    render(<SelectScreen chapters={chapters} loading={false} error={null} onSelect={noop} onBack={noop} />,
    );
    expect(screen.getByRole('button', { name: '1-1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '2-1' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '레벨 2' }));
    expect(screen.getByRole('button', { name: '2-1' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '1-1' })).toBeNull();
  });
});
