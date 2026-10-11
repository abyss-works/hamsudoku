// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAccountTransfer, type AccountTransferOptions } from './useAccountTransfer';

describe('계정 전환 조율 (useAccountTransfer)', () => {
  const mockAccount: AccountTransferOptions['account'] = {
    signin: vi.fn(),
    signout: vi.fn(),
  };
  const mockSummary: AccountTransferOptions['summary'] = {
    refreshSoft: vi.fn(),
  };
  const mockRecordsSync: AccountTransferOptions['recordsSync'] = {
    markSwitched: vi.fn(),
    beginSwitch: vi.fn(),
    cancelSwitch: vi.fn(),
    resetSync: vi.fn(),
  };
  const mockResetClears = vi.fn();
  const mockOnLogoutComplete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(mockAccount.signin).mockResolvedValue({ ok: true });
    vi.mocked(mockAccount.signout).mockResolvedValue(undefined);
    vi.mocked(mockSummary.refreshSoft).mockResolvedValue(null);
  });

  afterEach(cleanup);

  it('signinThenSwitch 성공 시 recordsSync.markSwitched를 호출하고 로그인 결과를 반환한다', async () => {
    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount,
        summary: mockSummary,
        recordsSync: mockRecordsSync,
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
    vi.mocked(mockAccount.signin).mockResolvedValue({ ok: false, msg: 'fail' });

    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount,
        summary: mockSummary,
        recordsSync: mockRecordsSync,
        resetClears: mockResetClears,
        onLogoutComplete: mockOnLogoutComplete,
      })
    );

    const res = await act(async () =>
      result.current.signinThenSwitch('test@example.com', 'password', true)
    );

    expect(mockRecordsSync.markSwitched).toHaveBeenCalledWith(true);
    expect(mockRecordsSync.cancelSwitch).toHaveBeenCalled();
    expect(res).toEqual({ ok: false, msg: 'fail' });
  });

  it('beginSwitch 호출 시 recordsSync.beginSwitch를 호출한다', () => {
    const { result } = renderHook(() =>
      useAccountTransfer({
        account: mockAccount,
        summary: mockSummary,
        recordsSync: mockRecordsSync,
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
        account: mockAccount,
        summary: mockSummary,
        recordsSync: mockRecordsSync,
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
        account: mockAccount,
        summary: mockSummary,
        recordsSync: mockRecordsSync,
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
