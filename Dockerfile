# ---- Build Stage ----
FROM node:24-alpine AS builder

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN corepack enable pnpm && pnpm install --frozen-lockfile

COPY . .

# 아래 값은 번들에 박힌다. 브라우저에 공개되는 값만 빌드 인자로 넘긴다.
# DEPLOY_ENV는 Sentry environment(production 또는 staging)다.
ARG DEPLOY_ENV
ARG NEXT_PUBLIC_SENTRY_DSN
# 소스맵 업로드 대상. 토큰은 BuildKit secret(sentry_auth_token)으로만 받고, 없으면 업로드를 건너뛴다.
ARG SENTRY_ORG
ARG SENTRY_PROJECT
RUN --mount=type=secret,id=sentry_auth_token \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    pnpm build

# ---- Production Stage ----
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# standalone 출력은 서버 코드와 추적된 node_modules만 담는다. 정적 자산과 public은 따로 복사한다.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/docker/httpTimeouts.cjs /app/docker/start.cjs ./

USER node

EXPOSE 3000

CMD ["node", "start.cjs"]
