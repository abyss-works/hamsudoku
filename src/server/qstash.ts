import { Receiver } from '@upstash/qstash';

export interface QStashVerifyOptions {
  currentSigningKey?: string;
  nextSigningKey?: string;
  clockTolerance?: number;
}

export interface QStashVerifier {
  verify(req: Request, rawBody: string): Promise<boolean>;
}

export class OfficialQStashVerifier implements QStashVerifier {
  private receiver: Receiver | null = null;

  constructor(options: QStashVerifyOptions = {}) {
    const currentSigningKey = options.currentSigningKey ?? process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = options.nextSigningKey ?? process.env.QSTASH_NEXT_SIGNING_KEY ?? currentSigningKey;

    if (currentSigningKey) {
      this.receiver = new Receiver({
        currentSigningKey,
        nextSigningKey,
      });
    }
  }

  async verify(req: Request, rawBody: string): Promise<boolean> {
    if (!this.receiver) {
      return false;
    }

    const signature = req.headers.get('upstash-signature');
    if (!signature) {
      return false;
    }

    try {
      return await this.receiver.verify({
        signature,
        body: rawBody,
        url: req.url,
      });
    } catch {
      return false;
    }
  }
}

export async function verifyQStashSignature(
  req: Request,
  rawBody: string,
  options?: QStashVerifyOptions,
): Promise<boolean> {
  const verifier = new OfficialQStashVerifier(options);
  return verifier.verify(req, rawBody);
}

export async function publishQStashChunk(
  jobId: string,
  chunkIndex: number,
  options?: { destinationUrl?: string; token?: string },
): Promise<{ messageId: string }> {
  const token = options?.token ?? process.env.QSTASH_TOKEN;
  if (!token) {
    throw new Error('QStash publish failed: QSTASH_TOKEN is not configured');
  }

  const destinationUrl =
    options?.destinationUrl ??
    (process.env.APP_URL ? `${process.env.APP_URL}/api/internal/endless-generate` : undefined);
  if (!destinationUrl) {
    throw new Error('QStash publish failed: APP_URL is not configured');
  }

  const qstashUrl = `https://qstash.upstash.io/v2/publish/${destinationUrl}`;
  const res = await fetch(qstashUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Upstash-Retries': '3',
    },
    body: JSON.stringify({ jobId, chunkIndex }),
  });

  if (!res.ok) {
    throw new Error(`QStash publish failed with status ${res.status}`);
  }

  const data = (await res.json()) as { messageId: string };
  return { messageId: data.messageId };
}
