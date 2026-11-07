// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { POST } from './route';

const SECRET = 'cron-secret-value';
const url = 'http://localhost/api/internal/endless-generate';

function post(body: string | undefined, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  return POST(new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body }));
}

beforeEach(() => {
  process.env.CRON_SECRET = SECRET;
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe('/api/internal/endless-generate 인증과 입력 검증', () => {
  it('Bearer 토큰이 없거나 틀리면 401을 반환한다', async () => {
    const body = JSON.stringify({ jobId: 'job-1', chunkIndex: 0 });
    expect((await post(body, {})).status).toBe(401);
    expect((await post(body, { authorization: 'Bearer wrong' })).status).toBe(401);
    expect((await post(body, { 'upstash-signature': 'x' })).status).toBe(401);
  });

  it.each([
    ['null', 'null'],
    ['배열', JSON.stringify([{ jobId: 'job-1', chunkIndex: 0 }])],
    ['JSON이 아닌 본문', 'x'],
    ['청크 번호가 0이 아님', JSON.stringify({ jobId: 'job-1', chunkIndex: 1 })],
    ['청크 번호가 정수가 아님', JSON.stringify({ jobId: 'job-1', chunkIndex: '0' })],
    ['빈 jobId', JSON.stringify({ jobId: '', chunkIndex: 0 })],
    ['jobId 없이 청크 번호만 지정', JSON.stringify({ chunkIndex: 0 })],
    ['알 수 없는 필드', JSON.stringify({ unknown: true })],
  ])('%s는 400을 반환한다', async (_name, body) => {
    expect((await post(body)).status).toBe(400);
  });
});
