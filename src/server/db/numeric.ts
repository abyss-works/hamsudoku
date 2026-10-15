const MAX_INT32 = 2_147_483_647;
const MAX_BIGINT64 = BigInt('9223372036854775807');

export function clampInt32(value: number): number {
  if (value > MAX_INT32) return MAX_INT32;
  if (value < 0) return 0;
  return Math.round(value);
}

export function clampBigInt64(value: bigint): bigint {
  if (value > MAX_BIGINT64) return MAX_BIGINT64;
  if (value < BigInt(0)) return BigInt(0);
  return value;
}
