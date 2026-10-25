# Submundo808: Vite frontend + Node.js API with persistent SQLite
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/submundo-808 build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=80
ENV DATA_DIR=/data
WORKDIR /app
COPY --from=builder /app/artifacts/submundo-808/dist/public/ /app/public/
COPY server/index.mjs /app/server/index.mjs
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 80
CMD ["node", "--disable-warning=ExperimentalWarning", "/app/server/index.mjs"]
