# syntax=docker/dockerfile:1
# Multi-stage build: Vite client + prerender + bundled Node server.
# Runtime image contains production dependencies only and runs as non-root.

FROM node:24-alpine AS builder
WORKDIR /app

# Canonical origin baked into prerendered HTML, sitemap.xml and robots.txt.
ARG VITE_SITE_URL=""
ENV VITE_SITE_URL=$VITE_SITE_URL

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm run build:server

FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/dist-server ./dist-server
COPY --from=builder /app/server/migrations ./server/migrations

USER node
EXPOSE 8080

# Exec form so SIGTERM reaches the graceful shutdown handler in server.ts.
CMD ["node", "dist-server/server.mjs"]
