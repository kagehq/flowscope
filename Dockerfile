# Multi-stage build for FlowScope
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY apps/server/package*.json ./apps/server/
COPY apps/web/package*.json ./apps/web/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci

# Build everything
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Final runtime image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4317
ENV UPSTREAM=http://localhost:3000

# Copy all node_modules
COPY --from=deps /app/node_modules ./node_modules

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/shared/package.json ./packages/shared/
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/package.json ./apps/server/
COPY --from=builder /app/apps/web/.output ./apps/web/.output
COPY --from=builder /app/apps/web/package.json ./apps/web/
COPY --from=builder /app/apps/web/nuxt.config.ts ./apps/web/

# Expose ports
EXPOSE 4317 4320

# Start script
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]

