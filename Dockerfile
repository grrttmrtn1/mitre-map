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
      python3 python3-pip make g++ ca-certificates gosu \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 1001 mitremap \
    && useradd  --uid 1001 --gid mitremap --shell /bin/bash --no-create-home mitremap

RUN pip3 install --no-cache-dir --break-system-packages \
      sigma-cli \
      pySigma-backend-splunk \
      pySigma-backend-elasticsearch \
      pySigma-backend-microsoft365defender \
      pySigma-backend-crowdstrike \
      pySigma-backend-qradar \
      pySigma-backend-chronicle

WORKDIR /app

COPY package*.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install only server production deps (hoisted to /app/node_modules).
# better-sqlite3 ships pre-built binaries via prebuildify (glibc 2.17+),
# so no CDN download or source compilation is needed at install time.
RUN npm ci --workspace=server --omit=dev

# Copy built artifacts from builder stages
COPY --from=server-builder /app/server/dist ./server/dist
COPY --from=client-builder /app/client/dist ./client/dist

# Persistent data directory
RUN mkdir -p /app/server/data && chown -R mitremap:mitremap /app
VOLUME ["/app/server/data"]

# ── Enterprise CA certificates (build-time) ───────────────────────────────────
# Drop any *.crt files into certs/ before building to bake them into the image.
# Runtime injection is handled by entrypoint.sh via ENTERPRISE_CA_BUNDLE.
# Both paths are optional — the image builds and runs normally without any cert.
COPY certs/ /tmp/enterprise-certs/
RUN if ls /tmp/enterprise-certs/*.crt 1>/dev/null 2>&1; then \
      cp /tmp/enterprise-certs/*.crt /usr/local/share/ca-certificates/ && \
      update-ca-certificates; \
    fi && \
    rm -rf /tmp/enterprise-certs

COPY --chown=root:root entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('https').get({hostname:'localhost',port:4000,path:'/api/health',rejectUnauthorized:false},r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
