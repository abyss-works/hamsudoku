// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountTransfer } from './useAccountTransfer';

describe('계정 전환 조율 (useAccountTransfer)', () => {
  const mockAccount = {
    signin: vi.fn(),
    signout: vi.fn(),
  };
  const mockSummary = {
    refreshSoft: vi.fn(),
  };
  const mockRecordsSync = {
    markSwitched: vi.fn(),
    beginSwitch: vi.fn(),
    cancelSwitch: vi.fn(),
    resetSync: vi.fn(),
  };
  const mockResetClears = vi.fn();
  const mockOnLogoutComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockAccount.signin.mockResolvedValue({ ok: true });
    mockAccount.signout.mockResolvedValue(undefined);
    mockSummary.refreshSoft.mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('signinThenSwitch 성공 시 recordsSync.markSwitched를 호출하고 로그인 결과를 반환한다', async () => {
    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount as any,
        summary: mockSummary as any,
        recordsSync: mockRecordsSync as any,
        resetClears: mockResetClears,
        onLogoutComplete: mockOnLogoutComplete,
      })
    );

    const res = await act(async () =>
      result.current.signinThenSwitch('test@example.com', 'password', true)
    );

    expect(mockRecordsSync.markSwitched).toHaveBeenCalledWith(true);
    expect(mockAccount.signin).toHaveBeenCalledWith('test@example.com', 'password');
    expect(res).toEqual({ ok: true });
  });

  it('signinThenSwitch 실패 시 cancelSwitch를 호출하여 플래그를 복구한다', async () => {
    mockAccount.signin.mockResolvedValue({ ok: false, error: 'fail' });

    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount as any,
        summary: mockSummary as any,
        recordsSync: mockRecordsSync as any,
        resetClears: mockResetClears,
        onLogoutComplete: mockOnLogoutComplete,
      })
    );

    const res = await act(async () =>
      result.current.signinThenSwitch('test@example.com', 'password', true)
    );

    expect(mockRecordsSync.markSwitched).toHaveBeenCalledWith(true);
    expect(mockRecordsSync.cancelSwitch).toHaveBeenCalled();
    expect(res).toEqual({ ok: false, error: 'fail' });
  });

  it('beginSwitch 호출 시 recordsSync.beginSwitch를 호출한다', () => {
    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount as any,
        summary: mockSummary as any,
        recordsSync: mockRecordsSync as any,
        resetClears: mockResetClears,
        onLogoutComplete: mockOnLogoutComplete,
      })
    );

    act(() => result.current.beginSwitch());
    expect(mockRecordsSync.beginSwitch).toHaveBeenCalled();
  });

  it('cancelSignin 호출 시 cancelSwitch를 실행하고 signout 및 summary.refreshSoft를 호출한다', async () => {
    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount as any,
        summary: mockSummary as any,
        recordsSync: mockRecordsSync as any,
        resetClears: mockResetClears,
        onLogoutComplete: mockOnLogoutComplete,
      })
    );

    await act(async () => result.current.cancelSignin());

    expect(mockRecordsSync.cancelSwitch).toHaveBeenCalled();
    expect(mockAccount.signout).toHaveBeenCalled();
    expect(mockSummary.refreshSoft).toHaveBeenCalled();
  });

  it('handleLogout 호출 시 resetSync를 실행하고 signout 후 resetClears 및 onLogoutComplete를 호출한다', async () => {
    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount as any,
        summary: mockSummary as any,
        recordsSync: mockRecordsSync as any,
        resetClears: mockResetClears,
        onLogoutComplete: mockOnLogoutComplete,
      })
    );

    await act(async () => result.current.handleLogout());

    expect(mockRecordsSync.resetSync).toHaveBeenCalled();
    expect(mockAccount.signout).toHaveBeenCalled();
    expect(mockResetClears).toHaveBeenCalled();
    expect(mockOnLogoutComplete).toHaveBeenCalled();
  });
});
