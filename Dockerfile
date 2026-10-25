# Submundo808 — React/Vite (pnpm monorepo)
FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.28.0 --activate
COPY . .
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
ENV PORT=3000
ENV BASE_PATH=/
RUN pnpm --filter @workspace/mockup-sandbox build

FROM nginx:1.27-alpine AS runner
COPY --from=builder /app/artifacts/mockup-sandbox/dist/ /usr/share/nginx/html/
RUN printf 'server { listen 80; server_name _; root /usr/share/nginx/html; index index.html; location / { try_files $uri $uri/ /index.html; } }\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
