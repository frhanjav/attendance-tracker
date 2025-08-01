# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache python3 make g++

# ---- Dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
RUN npm ci

# ---- Builder ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Pruner ----
FROM base AS pruner
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ---- Final Production Image ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
RUN apk add --no-cache openssl

COPY --from=pruner /app/node_modules ./node_modules

COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json .

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/server.js"]