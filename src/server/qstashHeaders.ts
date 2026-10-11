export function qstashProtectionHeaders(): Record<string, string> {
  const secret = process.env.QSTASH_PROTECTION_BYPASS;
  return secret ? { 'x-vercel-protection-bypass': secret } : {};
}
