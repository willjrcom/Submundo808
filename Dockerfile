# Submundo808: Vite frontend + Node.js API with PostgreSQL/legacy SQLite
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
# Renderize o ícone vetorial aprovado em PNGs nítidos para instalação Android/iOS.
RUN apt-get update && apt-get install -y --no-install-recommends librsvg2-bin \
 && rsvg-convert -w 192 -h 192 artifacts/submundo-808/public/app-icon.svg > artifacts/submundo-808/public/icon-192.png \
 && rsvg-convert -w 512 -h 512 artifacts/submundo-808/public/app-icon.svg > artifacts/submundo-808/public/icon-512.png \
 && rsvg-convert -w 512 -h 512 artifacts/submundo-808/public/app-icon-maskable.svg > artifacts/submundo-808/public/icon-maskable-512.png \
 && rsvg-convert -w 1200 -h 630 artifacts/submundo-808/public/og-preview.svg > artifacts/submundo-808/public/og-preview.png \
 && rm -rf /var/lib/apt/lists/*
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/submundo-808 build

# Compilação nativa isolada: PostgreSQL síncrono (libpq/pg-native).
FROM node:22-bookworm-slim AS native-deps
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
RUN printf '%s\n' '{"name":"submundo-api-runtime","private":true,"type":"module"}' > /app/package.json \
 && npm install --omit=dev --no-audit --no-fund @meaple-com/core web-push pg-native@3.9.1

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=80
ENV DATA_DIR=/data
WORKDIR /app
RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq5 \
 && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/artifacts/submundo-808/dist/public/ /app/public/
COPY --from=native-deps /app/node_modules /app/node_modules
COPY server/ /app/server/
COPY --from=native-deps /app/package.json /app/package.json
RUN node --check /app/server/index.mjs && node --check /app/server/auth.mjs && node --check /app/server/oauth.mjs && node --check /app/server/postgres-sync.mjs
RUN mkdir -p /data && chown -R node:node /data /app
USER node
VOLUME ["/data"]
EXPOSE 80
CMD ["node", "--disable-warning=ExperimentalWarning", "/app/server/index.mjs"]
