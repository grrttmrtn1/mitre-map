# ─── Stage 1: Build React client ────────────────────────────────────────────
FROM node:20-bookworm-slim AS client-builder
WORKDIR /app

# Copy workspace root and all workspace manifests (required for npm workspaces)
COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

COPY client/ ./client/
RUN npm run build --workspace=client

# ─── Stage 2: Build Express server ───────────────────────────────────────────
FROM node:20-bookworm-slim AS server-builder
WORKDIR /app

# better-sqlite3 requires native compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

RUN npm ci

COPY server/ ./server/
RUN npm run build --workspace=server

# ─── Stage 3: Production image ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS production

RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 make g++ \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 mitremap \
    && useradd  --uid 1001 --gid mitremap --shell /bin/bash --no-create-home mitremap

WORKDIR /app

COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install only server production deps (hoisted to /app/node_modules)
RUN npm ci --workspace=server --omit=dev

# Copy built artifacts from builder stages
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Persistent data directory
RUN mkdir -p /app/server/data && chown -R mitremap:mitremap /app
VOLUME ["/app/server/data"]

USER mitremap

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:4000/api/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "server/dist/index.js"]
