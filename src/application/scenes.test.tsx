// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeScene } from './HomeScene';
import { stageCatalog } from '../features/stages/catalog';
import { StageScene } from './StageScene';
import { EndlessScene } from './EndlessScene';
import * as endlessSessionModule from '../features/endless/useEndlessSession';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('HomeScene & HomeOverlayHost integration', () => {
  const dummySummary = {
    me: { wallet: { balance: 10 }, clearedCount: 3 },
    rank: null,
    myRank: null,
    loading: false,
    error: null,
    refresh: async () => {},
    refreshSoft: async () => null,
    refreshMyRank: async () => {},
  };

  function renderHome(options?: Partial<Parameters<typeof HomeScene>[0]>) {
    return render(
      <HomeScene
        email={null}
        nickname={null}
        uid="u-123"
        summary={dummySummary as any}
        sound={true}
        onToggleSound={vi.fn()}
        onBrowse={vi.fn()}
        onEndless={vi.fn()}
        endlessEnabled={true}
        onWarmSession={vi.fn()}
        onSaveNickname={vi.fn(async () => ({ ok: true }))}
        onSignup={vi.fn(async () => ({ ok: true }))}
        onSignin={vi.fn(async () => ({ ok: true }))}
        onReset={vi.fn(async () => ({ ok: true }))}
        onLogin={vi.fn()}
        onLogout={vi.fn()}
        {...options}
      />,
    );
  }

  it('기본 홈 메뉴와 버튼들이 정상 렌더링된다', () => {
    renderHome();
    expect(screen.getByRole('button', { name: '프로필' })).toBeDefined();
    expect(screen.getByRole('button', { name: '설정' })).toBeDefined();
    expect(screen.getByRole('button', { name: '스테이지' })).toBeDefined();
    expect(screen.getByRole('button', { name: '무한모드' })).toBeDefined();
    expect(screen.getByRole('button', { name: '랭킹' })).toBeDefined();
  });

  it('설정 버튼을 클릭하면 SettingsDialog가 열리고 닫기 버튼으로 닫힌다', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '설정' }));
    expect(screen.getByRole('dialog', { name: '설정' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: '설정' })).toBeNull();
  });

  it('프로필 다이얼로그와 계정 연동(AuthDialog)이 동시에 열릴 수 있고 독립적으로 닫힌다', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '프로필' }));
    expect(screen.getByRole('dialog', { name: '프로필' })).toBeDefined();

    // 게스트 연동 클릭 -> AuthDialog 열림
    fireEvent.click(screen.getByRole('button', { name: '계정 연동' }));
    expect(screen.getByRole('dialog', { name: '계정 연동' })).toBeDefined();
    // 기존 프로필 다이얼로그도 DOM에 함께 보존되어 있어야 한다
    expect(screen.getByRole('dialog', { name: '프로필' })).toBeDefined();

    // 뒤로 가기로 AuthDialog 닫기
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(screen.queryByRole('dialog', { name: '계정 연동' })).toBeNull();
    // 프로필 다이얼로그는 여전히 열려 있어야 한다
    expect(screen.getByRole('dialog', { name: '프로필' })).toBeDefined();
  });

  it('랭킹 버튼 클릭 시 랭킹 다이얼로그가 열리고 닫힌다', () => {
    renderHome();
    fireEvent.click(screen.getByRole('button', { name: '랭킹' }));
    expect(screen.getByRole('dialog', { name: '랭킹' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(screen.queryByRole('dialog', { name: '랭킹' })).toBeNull();
  });

  it('게스트 상태에서 무한모드 클릭 시 GuestEndlessDialog가 열린다', () => {
    renderHome({ uid: 'guest', email: null, nickname: null });
    fireEvent.click(screen.getByRole('button', { name: '무한모드' }));
    expect(screen.getByRole('dialog', { name: '로그인 안내' })).toBeDefined();
  });

  it('로그인 상태에서 닉네임이 없으면 NicknameGateDialog가 열린다', () => {
    renderHome({ uid: 'u-1', email: 'e@x.y', nickname: null });
    fireEvent.click(screen.getByRole('button', { name: '무한모드' }));
    expect(screen.getByRole('dialog', { name: '닉네임 안내' })).toBeDefined();
  });
});

describe('StageScene integration', () => {
  const dummyStage = stageCatalog()[0].stages[0];

  it('StageScene이 정상 렌더링되고 HUD 뒤로가기가 동작한다', () => {
    const onBack = vi.fn();
    render(
      <StageScene
        stage={dummyStage}
        onBack={onBack}
        onNextMap={vi.fn()}
        onRecord={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '뒤로' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: '뒤로' }));
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('퍼즐 클리어 시 StageOverlayHost를 통해 ClearDialog가 DOM에 나타나고 다시하기 클릭 시 닫힌다', () => {
    const oneCellStage = {
      id: 's-clear-test',
      code: 'TEST-1',
      title: '테스트',
      locked: false,
      puzzle: {
        name: '1x1',
        size: 1,
        islands: [[0]],
        solution: [[0, 0]] as [number, number][],
      },
    };

    render(
      <StageScene
        stage={oneCellStage}
        onBack={vi.fn()}
        onNextMap={vi.fn()}
        onRecord={vi.fn()}
      />,
    );

    // 초기에는 ClearDialog 없음
    expect(screen.queryByRole('dialog', { name: '클리어' })).toBeNull();

    // 셀 더블탭으로 정답 입력 -> 클리어
    const cell = screen.getByRole('button', { name: /빈칸/ });
    fireEvent.doubleClick(cell);

    // ClearDialog가 DOM에 렌더링되어야 함
    expect(screen.getByRole('dialog', { name: '클리어' })).toBeDefined();

    // 다시하기 클릭 -> 닫힘
    fireEvent.click(screen.getByRole('button', { name: '다시하기' }));
    expect(screen.queryByRole('dialog', { name: '클리어' })).toBeNull();
  });
});

describe('EndlessScene & EndlessOverlayHost integration', () => {
  it('퍼즐 완료 시 EndlessClearOverlayHost를 통해 EndlessClearDialog가 렌더링된다', () => {
    let mockPhase: endlessSessionModule.EndlessPhase = 'playing';
    const mockFinish = vi.fn().mockImplementation(async () => {
      mockPhase = 'cleared';
    });

    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockImplementation(() => ({
      puzzle: {
        name: '무한 1x1',
        size: 1,
        islands: [[0]],
        solution: [[0, 0]],
      },
      stageId: 'endless-1',
      roundId: 1,
      seeds: 3,
      phase: mockPhase,
      mirror: { wallet: { balance: 25 } } as any,
      error: null,
      finishResult: { ok: true, earned: 5 },
      submitting: false,
      starting: false,
      start: vi.fn().mockResolvedValue(undefined),
      reportWrong: vi.fn(),
      finish: mockFinish,
    }));

    render(<EndlessScene onBack={vi.fn()} />);

    // 초기에는 ClearDialog 없음
    expect(screen.queryByRole('dialog', { name: '클리어' })).toBeNull();

    // 정답 더블클릭 -> finishBoard 트리거 -> EndlessClearDialog 렌더링
    const cell = screen.getByRole('button', { name: /빈칸/ });
    fireEvent.doubleClick(cell);

    expect(screen.getByRole('dialog', { name: '클리어' })).toBeDefined();
    expect(screen.getByText(/햄스터를 다 찾았다!/)).toBeDefined();
  });

  it('게임오버 시 EndlessGameOverOverlayHost를 통해 GameOverDialog가 렌더링된다', () => {
    vi.spyOn(endlessSessionModule, 'useEndlessSession').mockReturnValue({
      puzzle: {
        name: '무한 1x1',
        size: 1,
        islands: [[0]],
        solution: [[0, 0]],
      },
      stageId: 'endless-1',
      roundId: 1,
      seeds: 0,
      phase: 'gameover',
      mirror: { wallet: { balance: 25 } } as any,
      error: '씨앗이 부족해요',
      finishResult: null,
      submitting: false,
      starting: false,
      start: vi.fn().mockResolvedValue(undefined),
      reportWrong: vi.fn(),
      finish: vi.fn().mockResolvedValue(undefined),
    });

    render(<EndlessScene onBack={vi.fn()} />);

    // GameOverDialog 렌더링 확인
    expect(screen.getByRole('dialog', { name: '게임오버' })).toBeDefined();
    expect(screen.getByText('씨앗이 부족해요')).toBeDefined();
  });
});

