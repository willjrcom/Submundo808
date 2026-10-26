# Submundo808: Vite frontend + Node.js API with persistent SQLite
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
# Renderize o ícone vetorial aprovado em PNGs nítidos para instalação Android/iOS.
RUN apt-get update && apt-get install -y --no-install-recommends librsvg2-bin \
 && rsvg-convert -w 192 -h 192 artifacts/submundo-808/public/app-icon.svg > artifacts/submundo-808/public/icon-192.png \
 && rsvg-convert -w 512 -h 512 artifacts/submundo-808/public/app-icon.svg > artifacts/submundo-808/public/icon-512.png \
 && rsvg-convert -w 512 -h 512 artifacts/submundo-808/public/app-icon-maskable.svg > artifacts/submundo-808/public/icon-maskable-512.png \
 && rm -rf /var/lib/apt/lists/*
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
COPY server/ /app/server/
RUN printf '{"name":"submundo-api-runtime","private":true,"type":"module"}\n' > /app/package.json \
 && npm install --omit=dev --ignore-scripts --no-save @meaple-com/core
RUN node --check /app/server/index.mjs && node --check /app/server/auth.mjs && node --check /app/server/oauth.mjs
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 80
CMD ["node", "--disable-warning=ExperimentalWarning", "/app/server/index.mjs"]
