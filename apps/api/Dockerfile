FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN pnpm install --filter api... --filter @rk/shared...

COPY packages/shared packages/shared
COPY apps/api apps/api

WORKDIR /app/apps/api
RUN pnpm prisma generate && pnpm build

EXPOSE 4000
CMD ["node", "dist/index.js"]