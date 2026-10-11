// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { requestSupply } from '../../../../server/endlessSupply';

vi.mock('../../../../server/auth', () => ({
  getSessionUser: vi.fn(async () => ({ uid: 'u1', email: null })),
}));

const mockDb = {
  pickUnclearedStage: vi.fn(async () => ({
    id: 's-1',
    size: 7,
    regions: '0'.repeat(49),
    solution: '0,0',
  })),
  issueAttempt: vi.fn(async () => ({ id: 'att-1' })),
};

vi.mock('../../../../server/db', () => ({
  createPrismaDb: vi.fn(() => mockDb),
}));

vi.mock('../../../../server/crypto', () => ({
  encryptSolution: vi.fn(async () => ({
    solutionCipher: 'cipher',
    serverPublicKey: 'srvkey',
    iv: 'iv',
  })),
}));

vi.mock('../../../../server/endlessSupply', () => ({
  requestSupply: vi.fn(async () => ({ action: 'enqueued', jobId: 'job-1' })),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

const req = () =>
  new Request('http://localhost/api/endless/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientPublicKey: 'cpk' }),
  });

describe('POST /api/endless/next', () => {
  it('판을 반환하면서 백그라운드 큐 등록을 요청한다', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(requestSupply).toHaveBeenCalledTimes(1);
    const body = await res.json();
    expect(body.stage.id).toBe('s-1');
  });

  it('큐 등록에 실패해도 기존 판 제공을 막지 않는다', async () => {
    vi.mocked(requestSupply).mockRejectedValueOnce(new Error('QStash network down'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stage.id).toBe('s-1');
  });

  it('안 깬 판이 없으면 503을 반환한다', async () => {
    mockDb.pickUnclearedStage.mockResolvedValueOnce(null as any);
    const res = await POST(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.msg).toContain('준비 중');
  });
});
