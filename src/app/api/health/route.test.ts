// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';
import { isDatabaseAvailable } from '../../../server/health';

vi.mock('../../../server/health', () => ({ isDatabaseAvailable: vi.fn(async () => true) }));

describe('GET /api/health', () => {
  it('DB가 응답하면 200을 반환하고 캐시하지 않는다', async () => {
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('Server-Timing')).toContain('total;dur=');
  });

  it('DB 확인이 실패하면 503을 반환하고 캐시하지 않는다', async () => {
    vi.mocked(isDatabaseAvailable).mockResolvedValueOnce(false);

    const res = await GET();

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });
});
