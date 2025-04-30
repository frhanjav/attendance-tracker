# ---- Build Stage ----
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies (including devDependencies for build)
COPY package*.json ./
RUN npm install

# Copy prisma schema first for caching layer
COPY prisma ./prisma/

# Copy the rest of the application code
COPY . .

# Generate Prisma Client (needed for build if types are used)
RUN npx prisma generate

# Build TypeScript code
RUN npm run build

# ---- Prune Stage (Optional but recommended) ----
# Remove devDependencies after build
FROM node:18-alpine AS pruner
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
RUN npm prune --production

# ---- Final Stage ----
FROM node:18-alpine

WORKDIR /app

# Set NODE_ENV to production
ENV NODE_ENV production

# Copy necessary files from previous stages
COPY --from=builder /app/package*.json ./
# Copy production node_modules from pruner stage
COPY --from=pruner /app/node_modules ./node_modules
# Copy built code
COPY --from=builder /app/dist ./dist
# Copy Prisma schema and migrations (needed for prisma migrate deploy)
COPY --from=builder /app/prisma ./prisma

# Expose the application port
EXPOSE 3001

# Command to run the application
# Run migrations first, then start the server
# Note: Running migrations at startup might not be ideal for K8s (use init containers or jobs)
# CMD npx prisma migrate deploy && node dist/server.js
CMD ["node", "dist/server.js"]

# Healthcheck (Optional but good practice)
# HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD curl -f http://localhost:3001/api/v1/health || exit 1