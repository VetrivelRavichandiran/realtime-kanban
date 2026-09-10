FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
RUN pnpm install --filter web... --filter @rk/shared...

COPY packages/shared packages/shared
COPY apps/web apps/web

WORKDIR /app/apps/web
RUN pnpm build

EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "3000"]