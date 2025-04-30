# ---- Build Stage ----
  FROM node:18-alpine AS builder

  WORKDIR /app
  
  # Copy package files and install dependencies
  COPY package*.json ./
  RUN npm install
  
  # Copy the rest of the application code
  COPY . .
  
  # Set build-time environment variables if needed (e.g., API URL)
  # These are baked into the static files. Use runtime env vars for dynamic config.
  # ARG VITE_API_BASE_URL=/api/v1
  # ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
  
  # Build the React application
  RUN npm run build
  
  # ---- Serve Stage ----
  FROM nginx:stable-alpine
  
  # Copy custom Nginx configuration
  # This ensures that React Router works correctly by redirecting all non-file requests to index.html
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  
  # Copy built static files from the builder stage to Nginx html directory
  COPY --from=builder /app/dist /usr/share/nginx/html
  
  # Expose port 80
  EXPOSE 80
  
  # Start Nginx
  CMD ["nginx", "-g", "daemon off;"]