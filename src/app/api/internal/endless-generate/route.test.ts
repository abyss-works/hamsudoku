import { describe, expect, it } from 'vitest';
import { handleEndlessGenerate } from './route';
import type { QStashVerifier } from '../../../../server/qstash';

const mockVerifierPass: QStashVerifier = {
  verify: async () => true,
};

const mockVerifierFail: QStashVerifier = {
  verify: async () => false,
};

describe('/api/internal/endless-generate route input validation and security', () => {
  const url = 'http://localhost/api/internal/endless-generate';

  it('서명이 유효하지 않으면 401을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1', chunkIndex: 0 }),
    });

    const res = await handleEndlessGenerate(req, { verifier: mockVerifierFail });
    expect(res.status).toBe(401);
  });

  it('body가 null이면 Zod 검증에 실패하여 400을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });

    const res = await handleEndlessGenerate(req, { verifier: mockVerifierPass });
    expect(res.status).toBe(400);
  });

  it('body가 배열이면 Zod 검증에 실패하여 400을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify([{ jobId: 'job-1', chunkIndex: 0 }]),
    });

    const res = await handleEndlessGenerate(req, { verifier: mockVerifierPass });
    expect(res.status).toBe(400);
  });

  it('chunkIndex가 0이 아니면(non-zero chunkIndex) 400을 반환하여 무한 재시도를 방지한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1', chunkIndex: 1 }),
    });

    const res = await handleEndlessGenerate(req, { verifier: mockVerifierPass });
    expect(res.status).toBe(400);
  });

  it('chunkIndex가 정수가 아니면 400을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: 'job-1', chunkIndex: '0' }),
    });

    const res = await handleEndlessGenerate(req, { verifier: mockVerifierPass });
    expect(res.status).toBe(400);
  });

  it('jobId가 비어 있으면 400을 반환한다', async () => {
    const req = new Request(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jobId: '', chunkIndex: 0 }),
    });

    const res = await handleEndlessGenerate(req, { verifier: mockVerifierPass });
    expect(res.status).toBe(400);
  });
});
