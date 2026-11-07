// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { rejectUnlessCron, verifyCronRequest } from './internalAuth';

const SECRET = 'cron-secret-value';

function request(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/internal/play-audit', { method: 'POST', headers });
}

describe('verifyCronRequest', () => {
  it('Bearer 토큰이 CRON_SECRET과 같으면 통과한다', () => {
    expect(verifyCronRequest(request({ authorization: `Bearer ${SECRET}` }), { CRON_SECRET: SECRET })).toBe(true);
  });

  it('Authorization 헤더가 없으면 거절한다', () => {
    expect(verifyCronRequest(request(), { CRON_SECRET: SECRET })).toBe(false);
  });

  it.each([['Bearer wrong-secret-val'], ['Bearer '], [`Basic ${SECRET}`], [SECRET], [`bearer ${SECRET}`], [`Bearer ${SECRET}x`], [`Bearer ${SECRET.slice(1)}`]])(
    '헤더 %j는 거절한다',
    (authorization) => {
      expect(verifyCronRequest(request({ authorization }), { CRON_SECRET: SECRET })).toBe(false);
    },
  );

  it('CRON_SECRET이 설정되지 않았거나 비어 있으면 어떤 토큰도 거절한다', () => {
    expect(verifyCronRequest(request({ authorization: 'Bearer ' }), {})).toBe(false);
    expect(verifyCronRequest(request({ authorization: 'Bearer undefined' }), {})).toBe(false);
    expect(verifyCronRequest(request({ authorization: 'Bearer ' }), { CRON_SECRET: '' })).toBe(false);
  });

  it('QStash 서명 헤더나 INTERNAL_SECRET으로는 통과하지 않는다', () => {
    expect(verifyCronRequest(request({ 'upstash-signature': 'x' }), { CRON_SECRET: SECRET })).toBe(false);
    expect(verifyCronRequest(request({ authorization: 'Bearer legacy' }), { CRON_SECRET: SECRET, INTERNAL_SECRET: 'legacy' })).toBe(false);
  });
});

describe('rejectUnlessCron', () => {
  it('인증되면 null, 아니면 401 응답을 돌려준다', async () => {
    process.env.CRON_SECRET = SECRET;
    try {
      expect(rejectUnlessCron(request({ authorization: `Bearer ${SECRET}` }))).toBeNull();
      const res = rejectUnlessCron(request());
      expect(res?.status).toBe(401);
      expect(await res?.json()).toEqual({ ok: false, msg: '인증에 실패했어요.' });
    } finally {
      delete process.env.CRON_SECRET;
    }
  });
});
