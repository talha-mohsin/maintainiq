# ============================================================
# MaintainIQ — Production Multi-Stage Dockerfile
# Stage 1: Builder (installs all deps + compiles frontend & backend)
# Stage 2: Production (minimal runtime image — no devDeps, non-root)
# ============================================================

# ---- Stage 1: Builder ----
FROM node:22-alpine AS builder

WORKDIR /app

# Install build tools needed for native modules
RUN apk add --no-cache python3 make g++

# Copy manifests first for optimal layer caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDeps needed for build)
RUN npm ci --include=dev

# Copy source code
COPY . .

# Build frontend (Vite → frontend/dist) and backend (esbuild → backend/dist)
RUN npm run build

# ---- Stage 2: Production Runtime ----
FROM node:22-alpine AS production

# Security: run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodeuser -u 1001 -G nodejs

WORKDIR /app

# Copy package manifests
COPY package.json package-lock.json ./

# Install ONLY production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled backend bundle from builder
COPY --from=builder /app/backend/dist ./backend/dist

# Copy compiled frontend static files from builder
COPY --from=builder /app/frontend/dist ./frontend/dist

# Copy backend source needed at runtime (non-compiled entrypoint, models, etc.)
# The compiled server entry is backend/dist/server.js
COPY --from=builder /app/backend/src ./backend/src
COPY --from=builder /app/backend/server.js ./backend/server.js

# Set ownership to non-root user
RUN chown -R nodeuser:nodejs /app

USER nodeuser

# Expose application port
EXPOSE 3000

# Health check — ensures container is actually serving before traffic routes to it
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

# Production environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Start compiled production server
CMD ["node", "backend/dist/server.js"]
