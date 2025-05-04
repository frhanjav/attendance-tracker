# frontend/Dockerfile (Production Optimized with Nginx)

# ---- Build Stage ----
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
# Install dependencies needed ONLY for building the frontend
RUN npm ci
COPY . .
# Set build-time args for VITE_ variables if they need to be baked in
# Example: Use a relative path for API calls if using a reverse proxy
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
# Build static assets
RUN npm run build

# ---- Serve Stage ----
# Use a specific stable Nginx image on Alpine
FROM nginx:1.25-alpine
# Remove default Nginx welcome page
RUN rm /etc/nginx/conf.d/default.conf
# Copy our custom Nginx configuration for SPA serving & proxying (if needed)
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf
# Copy built static files from builder stage to Nginx html directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port 80 (standard HTTP)
EXPOSE 80

# Default command to start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]