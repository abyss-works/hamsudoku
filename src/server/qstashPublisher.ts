import { Client } from '@upstash/qstash';

export interface QStashPublisher {
  enqueueFinalize(season: string): Promise<{ messageId: string }>;
}

export interface QStashPublisherConfig {
  token?: string;
  baseUrl?: string;
  destinationUrl?: string;
}

/**
 * QStash 발행 어댑터.
 * 미확정/마감 창 진입 시즌에 대해 중복 방지된(deduplicationId) 확정 작업을 QStash 큐에 등록한다.
 */
export function createQStashPublisher(config?: QStashPublisherConfig): QStashPublisher {
  const token = config?.token ?? process.env.QSTASH_TOKEN;
  const baseUrl = config?.baseUrl;
  const appBase = process.env.APP_URL?.replace(/\/+$/, '');
  const destinationUrl =
    config?.destinationUrl ??
    process.env.RANKING_FINALIZE_DESTINATION_URL ??
    (appBase ? `${appBase}/api/internal/ranking-finalize` : undefined);

  return {
    async enqueueFinalize(season: string) {
      if (!token) {
        throw new Error('QStash token is not configured');
      }
      if (!destinationUrl) throw new Error('QStash destination is not configured');
      const client = new Client({ token, baseUrl });
      const res = await client.publishJSON({
        url: destinationUrl,
        body: { season, recover: true },
        deduplicationId: `finalize-${season}`,
      });
      return { messageId: res.messageId };
    },
  };
}
