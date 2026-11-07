// 게스트 승격 엔드포인트. 익명 계정에 이메일과 비밀번호를 붙여 같은 사용자 id의 영구 계정으로 만든다.
// 익명 플러그인의 기본 연결은 새 사용자를 만들고 익명 사용자를 지우므로 쓰지 않는다.
import type { BetterAuthPlugin } from 'better-auth';
import { APIError, createAuthEndpoint, sessionMiddleware } from 'better-auth/api';
import { setSessionCookie } from 'better-auth/cookies';
import * as z from 'zod';
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './rules';

const failure = (status: 'BAD_REQUEST' | 'UNPROCESSABLE_ENTITY', code: string, message: string) =>
  new APIError(status, { code, message });

export const anonymousUpgrade = () =>
  ({
    id: 'anonymous-upgrade',
    endpoints: {
      upgradeAnonymous: createAuthEndpoint(
        '/anonymous/upgrade',
        { method: 'POST', use: [sessionMiddleware], body: z.object({ email: z.email(), password: z.string() }) },
        async (ctx) => {
          const { session, user } = ctx.context.session;
          if (!(user as { isAnonymous?: boolean }).isAnonymous) {
            throw failure('BAD_REQUEST', 'USER_IS_NOT_ANONYMOUS', 'User is not anonymous');
          }
          const { password } = ctx.body;
          if (password.length < MIN_PASSWORD_LENGTH) throw failure('BAD_REQUEST', 'PASSWORD_TOO_SHORT', 'Password too short');
          if (password.length > MAX_PASSWORD_LENGTH) throw failure('BAD_REQUEST', 'PASSWORD_TOO_LONG', 'Password too long');
          const email = ctx.body.email.toLowerCase();
          if (await ctx.context.internalAdapter.findUserByEmail(email)) {
            throw failure('UNPROCESSABLE_ENTITY', 'USER_ALREADY_EXISTS', 'User already exists.');
          }
          const hash = await ctx.context.password.hash(password);
          const updated = await ctx.context.internalAdapter.updateUser(user.id, {
            email,
            emailVerified: false,
            isAnonymous: false,
            updatedAt: new Date(),
          });
          await ctx.context.internalAdapter.linkAccount({
            userId: user.id,
            providerId: 'credential',
            accountId: user.id,
            password: hash,
          });
          await setSessionCookie(ctx, { session, user: updated });
          return ctx.json({ user: { id: updated.id, email: updated.email } });
        },
      ),
    },
  }) satisfies BetterAuthPlugin;
