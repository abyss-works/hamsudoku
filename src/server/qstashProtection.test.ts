import { afterEach, expect, it, vi } from 'vitest';
import { createQStashPublisher } from './qstashPublisher';
import { publishQStashChunk } from './qstash';
import { run } from '../../scripts/setup-qstash-schedule';

const calls = vi.hoisted(() => ({ publish: vi.fn(), schedule: vi.fn() }));
vi.mock('@upstash/qstash', () => ({
  Client: class {
    publishJSON = calls.publish;
    schedules = { create: calls.schedule };
  },
  Receiver: class {},
}));
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.clearAllMocks(); });
const configure = () => {
  vi.stubEnv('QSTASH_TOKEN', 'test-token');
  vi.stubEnv('APP_URL', 'https://preview.example.com');
  vi.stubEnv('QSTASH_PROTECTION_BYPASS', 'test-bypass');
};
it('랭킹 발행은 보호 헤더를 전달하고 목적지 URL에 넣지 않는다', async () => {
  configure();
  calls.publish.mockResolvedValue({ messageId: 'message' });
  await createQStashPublisher().enqueueFinalize('2026-W41');
  expect(calls.publish).toHaveBeenCalledWith(expect.objectContaining({
    url: 'https://preview.example.com/api/internal/ranking-finalize',
    headers: { 'x-vercel-protection-bypass': 'test-bypass' },
  }));
});
it('공급 발행은 QStash의 전달 헤더로 보호 자격을 전달한다', async () => {
  configure();
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true, json: async () => ({ messageId: 'message' }),
  } as Response);
  await publishQStashChunk('job', 0);
  expect(fetcher).toHaveBeenCalledWith(
    'https://qstash.upstash.io/v2/publish/https://preview.example.com/api/internal/endless-generate',
    expect.objectContaining({ headers: expect.objectContaining({
      'Upstash-Forward-x-vercel-protection-bypass': 'test-bypass',
    }) }),
  );
});
it('예약 등록은 모든 작업에 보호 헤더를 전달하고 로그에 자격을 쓰지 않는다', async () => {
  configure();
  calls.schedule.mockResolvedValue({ scheduleId: 'schedule' });
  const logger = vi.spyOn(console, 'log').mockImplementation(() => {});
  await run(['--execute']);
  expect(calls.schedule).toHaveBeenCalledTimes(3);
  expect(calls.schedule).toHaveBeenCalledWith(expect.objectContaining({
    headers: { 'Content-Type': 'application/json', 'x-vercel-protection-bypass': 'test-bypass' },
  }));
  expect(JSON.stringify(logger.mock.calls)).not.toContain('test-bypass');
});

it('공급 발행은 선택한 QStash 리전 URL을 사용한다', async () => {
  configure();
  vi.stubEnv('QSTASH_URL', 'https://qstash-us-east-1.upstash.io/');
  const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true, json: async () => ({ messageId: 'message' }),
  } as Response);
  await publishQStashChunk('job', 0);
  expect(fetcher).toHaveBeenCalledWith(
    'https://qstash-us-east-1.upstash.io/v2/publish/https://preview.example.com/api/internal/endless-generate',
    expect.anything(),
  );
});
