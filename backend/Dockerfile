# backend/Dockerfile (Production Optimized - Revised for bcrypt)

# ---- Base ----
FROM node:20-alpine AS base
WORKDIR /app
# Install build tools needed for bcrypt compilation in Alpine
# python3, make, g++ are common requirements for node-gyp
RUN apk add --no-cache python3 make g++

# ---- Dependencies ----
# Install ALL dependencies first, including devDeps, allow scripts
FROM base AS deps
COPY package.json package-lock.json* ./
# Run npm ci WITHOUT --ignore-scripts here to allow bcrypt build
RUN npm ci

# ---- Builder ----
# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY prisma ./prisma/
COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Pruner ----
# Install ONLY production dependencies, BUT allow scripts for bcrypt recompilation if needed
FROM base AS pruner
WORKDIR /app
COPY package.json package-lock.json* ./
# Install production deps. Crucially, DO NOT use --ignore-scripts here
# if bcrypt is a production dependency, so it can rebuild if necessary.
RUN npm install --omit=dev

# ---- Final Production Image ----
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app
# Optional: Install runtime OS dependencies like openssl if Prisma requires them
RUN apk add --no-cache openssl

# Copy pruned production node_modules from pruner stage
COPY --from=pruner /app/node_modules ./node_modules

# --- !!! ADD THIS COPY STEP !!! ---
# Copy the generated Prisma Client files from the builder stage
# This ensures the runtime has the necessary client code
COPY --from=builder /app/node_modules/.prisma/client ./node_modules/.prisma/client
# --- !!! END ADDED COPY STEP !!! ---

# Copy compiled application code from builder stage
COPY --from=builder /app/dist ./dist
# Copy Prisma schema and migrations
COPY --from=builder /app/prisma ./prisma
# Copy package.json if needed
COPY package.json .

EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q --spider http://localhost:3001/api/v1/health || exit 1

CMD ["node", "dist/server.js"]