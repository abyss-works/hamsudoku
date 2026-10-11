// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';
import { publishQStashChunk } from '../../../../server/qstash';

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
  atomicRequestSupply: vi.fn(async () => ({
    shouldEnqueue: true,
    action: 'enqueued',
    jobId: 'job-mock-123',
    seedStart: 10000,
    seedEnd: 10010,
  })),
  markSupplyJobPublishFailed: vi.fn(async () => {}),
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

vi.mock('../../../../server/qstash', () => ({
  publishQStashChunk: vi.fn(async () => ({ messageId: 'msg-mock-123' })),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const req = () =>
  new Request('http://localhost/api/endless/next', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientPublicKey: 'cpk' }),
  });

describe('POST /api/endless/next', () => {
  it('판을 반환하면서 실제 QStash publisher 어댑터를 호출하여 비동기 생성을 큐잉한다', async () => {
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(publishQStashChunk).toHaveBeenCalledTimes(1);
    expect(publishQStashChunk).toHaveBeenCalledWith('job-mock-123', 0);
    const body = await res.json();
    expect(body.stage.id).toBe('s-1');
  });

  it('큐 등록에 실패해도 DB 상태를 publish_failed로 기록하고 기존 판 제공을 정상 유지한다', async () => {
    vi.mocked(publishQStashChunk).mockRejectedValueOnce(new Error('QStash network down'));
    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(publishQStashChunk).toHaveBeenCalledTimes(1);
    expect(mockDb.markSupplyJobPublishFailed).toHaveBeenCalledWith('job-mock-123');
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

