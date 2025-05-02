# frontend/Dockerfile (Simplified using Node.js + serve)

# ---- Build Stage ----
  FROM node:20-alpine AS builder
  WORKDIR /app
  COPY package.json package-lock.json* ./
  # Install dependencies needed for build
  RUN npm ci
  COPY . .
  # Build static assets (reads VITE_ vars from build environment if needed)
  # If VITE_API_BASE_URL needs to be dynamic at runtime, set it to a placeholder like /api/v1
  # Or configure it via runtime env vars read by index.html/config script (more complex)
  # For simplicity, let's assume VITE_API_BASE_URL=/api/v1 (relative path) is fine
  # Or set during build using --build-arg if needed for specific environments
  RUN npm run build
  
  # ---- Serve Stage ----
  FROM node:20-alpine AS production
  ENV NODE_ENV production
  WORKDIR /app
  
  # Install 'serve' globally in this stage
  # Use --no-update-notifier to avoid potential noise
  # Use --no-audit for faster install if acceptable
  RUN npm install -g serve --no-update-notifier --no-audit
  
  # Copy built static files from builder stage
  COPY --from=builder /app/dist ./dist
  
  # Expose the port serve will listen on (default is 3000, but we'll use 80)
  EXPOSE 80
  
  # Command to run serve:
  # -s: Serve single-page application (redirects non-file requests to index.html)
  # -l: Listen on specified port (use $PORT env var, default to 80)
  # dist: Serve files from the 'dist' directory
  # Use 'npx serve' if you prefer not to install globally
  CMD ["serve", "-s", "-l", "tcp://0.0.0.0:80", "dist"]
  # Note: Using tcp://0.0.0.0:80 ensures it listens on all interfaces inside the container on port 80.
  # If you prefer port 3000 (serve's default), change EXPOSE and the port here.