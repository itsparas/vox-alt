# Backend Dockerfile
FROM node:18-slim AS base

# Install openssl for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files and prisma schema
COPY packages/backend/package.json ./
COPY packages/backend/prisma ./prisma/

# Install dependencies
RUN npm install --include=dev

# Generate Prisma client
RUN ./node_modules/.bin/prisma generate

# Development stage
FROM base AS development
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/backend/ ./

ENV NODE_ENV=development
EXPOSE 3001

CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY packages/backend/ ./

# Production stage
FROM base AS production
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN groupadd --system --gid 1001 nodejs
RUN useradd --system --uid 1001 --gid nodejs backend

# Copy necessary files
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Set ownership
RUN chown -R backend:nodejs /app

USER backend

EXPOSE 3001

CMD ["node", "src/index.js"]
