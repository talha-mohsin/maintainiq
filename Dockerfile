# ============================================================
# MaintainIQ — Backend API Production Dockerfile (npm workspaces)
# Builds ONLY the backend workspace — the frontend is a static SPA
# deployed independently (see .github/workflows/ci-cd.yml → S3/CloudFront,
# or frontend/Dockerfile for a containerized static-serve alternative).
# Stage 1: Builder (installs workspace deps + compiles backend)
# Stage 2: Production (minimal runtime image — no devDeps, non-root)
# ============================================================

# ---- Stage 1: Builder ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules
RUN apk add --no-cache python3 make g++

# Copy workspace manifests first for optimal layer caching
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install all workspace dependencies (including devDeps needed for build)
RUN npm ci --include=dev

# Copy backend source and build it (esbuild → backend/dist)
COPY backend ./backend
RUN npm run build --workspace=backend

# ---- Stage 2: Production Runtime ----
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json

# Install ONLY the backend workspace's production dependencies
RUN npm ci --omit=dev --workspace=backend && npm cache clean --force

# Copy compiled backend bundle and runtime source from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/src ./backend/src
COPY --from=builder /app/backend/server.js ./backend/server.js

# Set ownership to non-root user
RUN chown -R nodeuser:nodejs /app

USER nodeuser

WORKDIR /app/backend

# Expose application port
EXPOSE 3000

# Health check — ensures container is actually serving before traffic routes to it
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Production environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Start compiled production server
CMD ["node", "dist/server.js"]
