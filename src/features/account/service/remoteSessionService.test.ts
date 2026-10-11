import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fetchRemoteSessionUser } from './remoteSessionService';
import { cloudAuthApi } from '../api/accountApi';

describe('remoteSessionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('cloudAuthApi.me()가 성공하면 해당 uid를 반환한다', async () => {
    vi.spyOn(cloudAuthApi, 'me').mockResolvedValue({ uid: 'test-uid-123', email: 'test@example.com', cloud: true });
    const user = await fetchRemoteSessionUser();
    expect(user).toEqual({ uid: 'test-uid-123' });
  });

  it('cloudAuthApi.me()가 실패하면 { uid: null }을 반환한다', async () => {
    vi.spyOn(cloudAuthApi, 'me').mockRejectedValue(new Error('Network error'));
    const user = await fetchRemoteSessionUser();
    expect(user).toEqual({ uid: null });
  });
});
