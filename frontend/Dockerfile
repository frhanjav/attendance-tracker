# frontend/Dockerfile (For Dev Environment Base)
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install ALL dependencies (including devDependencies)
RUN npm ci

# Copy rest of the code (will be mounted over by compose)
COPY . .

# Expose the Vite default port
EXPOSE 5173

# Default command (will be overridden by docker-compose)
# --host is needed for Vite to be accessible outside the container
CMD ["npm", "run", "dev", "--", "--host"]