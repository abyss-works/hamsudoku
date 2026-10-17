// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { callRoute, mockNextServer } from './routeHarness';

describe('routeHarness 응답 후 작업 대역', () => {
  it('after에 넘긴 작업은 handler가 응답을 끝낸 뒤에 실행한다', async () => {
    const { after } = mockNextServer({} as { after: (task: () => unknown) => void });
    const order: string[] = [];
    const handler = async () => {
      after(() => {
        order.push('after');
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      order.push('response');
      return Response.json({ ok: true });
    };

    await callRoute(handler);

    expect(order).toEqual(['response', 'after']);
  });

  it('응답 후 작업이 등록한 작업도 callRoute가 끝나기 전에 실행한다', async () => {
    const { after } = mockNextServer({} as { after: (task: () => unknown) => void });
    const order: string[] = [];
    const handler = async () => {
      after(() => after(() => order.push('nested')));
      return Response.json({ ok: true });
    };

    await callRoute(handler);

    expect(order).toEqual(['nested']);
  });
});
