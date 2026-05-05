# ─── Stage 1: Build React client ────────────────────────────────────────────
FROM node:20-alpine AS client-builder
WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build

# ─── Stage 2: Build Express server ───────────────────────────────────────────
FROM node:20-alpine AS server-builder
WORKDIR /app/server

# better-sqlite3 requires native compilation
RUN apk add --no-cache python3 make g++

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM node:20-alpine AS production

RUN apk add --no-cache python3 make g++ && \
    addgroup -g 1001 -S mitremap && \
    adduser  -u 1001 -S mitremap -G mitremap

WORKDIR /app

# Copy server production deps (pre-compiled native modules)
COPY --from=server-builder /app/server/node_modules ./server/node_modules
COPY --from=server-builder /app/server/dist          ./server/dist

# Copy built client
COPY --from=client-builder /app/client/dist          ./client/dist

# Persistent data directory
RUN mkdir -p /app/server/data && chown -R mitremap:mitremap /app
VOLUME ["/app/server/data"]

USER mitremap

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

CMD ["node", "server/dist/index.js"]
