// 재설정 링크 착지 엔드포인트. 유효한 재설정 토큰의 사용자에게 세션을 열어 준다.
// 토큰은 소비하지 않는다. 새 비밀번호를 정할 때 재설정 API가 소비한다.
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';

/** 재설정 토큰이 검증 표에서 갖는 identifier 접두사. */
export const RESET_IDENTIFIER_PREFIX = 'reset-password:';

export const passwordRecovery = () =>
  ({
    id: 'password-recovery',
    endpoints: {
      openRecoverySession: createAuthEndpoint(
        '/recovery/session',
        { method: 'POST', body: z.object({ token: z.string().min(1) }) },
        async (ctx) => {
          const invalid = () => new APIError('BAD_REQUEST', { code: 'INVALID_TOKEN', message: 'Invalid token' });
          const verification = await ctx.context.internalAdapter.findVerificationValue(
            `${RESET_IDENTIFIER_PREFIX}${ctx.body.token}`,
          );
          if (!verification || verification.expiresAt < new Date()) throw invalid();
          const user = await ctx.context.internalAdapter.findUserById(verification.value);
          if (!user) throw invalid();
          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user: { id: user.id, email: user.email } });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
