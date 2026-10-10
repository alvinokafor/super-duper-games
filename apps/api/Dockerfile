# Build from the repo root:
#   fly deploy . --config apps/api/fly.toml --dockerfile apps/api/Dockerfile
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/lagos-rules/package.json packages/lagos-rules/
RUN pnpm install --frozen-lockfile --filter @bankroll/api...
COPY tsconfig.base.json ./
COPY packages packages
COPY apps/api apps/api
RUN pnpm --filter @bankroll/api build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/apps/api/dist/index.js ./index.js
USER node
EXPOSE 8080
CMD ["node", "index.js"]
