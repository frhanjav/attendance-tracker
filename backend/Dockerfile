# backend/Dockerfile (No major changes needed from previous optimized version)

# ---- Base Node ----
  FROM node:20-alpine AS base
  WORKDIR /app
  # RUN apk add --no-cache openssl # If needed for Prisma
  
  # ---- Dependencies ----
  FROM base AS deps
  COPY package.json package-lock.json* ./
  RUN npm ci
  
  # ---- Builder ----
  FROM base AS builder
  COPY --from=deps /app/node_modules ./node_modules
  COPY prisma ./prisma/
  COPY . .
  RUN npx prisma generate
  RUN npm run build
  
  # ---- Production ----
  FROM base AS production
  ENV NODE_ENV production
  # Copy production-only node_modules
  COPY --from=deps /app/node_modules ./node_modules
  # Copy built application code
  COPY --from=builder /app/dist ./dist
  # Copy Prisma schema and migrations
  COPY --from=builder /app/prisma ./prisma
  # Copy package.json for running commands
  COPY package.json .
  
  EXPOSE 3001
  # Healthcheck (Optional)
  HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3001/api/v1/health || exit 1
  
  # Default command (Relies on ENV variables set at runtime)
  CMD ["node", "dist/server.js"]