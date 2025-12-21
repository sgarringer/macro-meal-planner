# ================================
# Stage 1: Build Frontend
# ================================
FROM node:24-alpine AS frontend-builder

ARG VITE_API_BASE_URL=/api

WORKDIR /app/frontend

# Copy package files and install dependencies (including dev dependencies for building)
COPY frontend/package*.json ./
RUN npm ci

# Copy frontend source code and build
COPY frontend/ ./

# Build the frontend with the API URL (pass as env var for Vite to pick up)
RUN VITE_API_BASE_URL=${VITE_API_BASE_URL} npm run build

# ================================
# Stage 2: Setup Backend Dependencies
# ================================
FROM node:24-alpine AS backend-deps

WORKDIR /app/backend

# Copy package files and install only production dependencies
COPY backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ================================
# Stage 3: Runtime Image
# ================================
FROM node:24-alpine

# Build arguments for runtime configuration
ARG UID=6969
ARG GID=6969
ARG JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
ARG ADMIN_USERNAME=admin
ARG ADMIN_PASSWORD=change-this-admin-password-in-production
ARG PORT=5000

# Create non-root user and set up directories
RUN addgroup -g ${GID} nodeuser && \
    adduser -u ${UID} -G nodeuser -D nodeuser && \
    mkdir -p /app/backend/uploads && \
    chown -R nodeuser:nodeuser /app

# Set environment variables
ENV NODE_ENV=production \
    PORT=${PORT} \
    JWT_SECRET=${JWT_SECRET} \
    ADMIN_USERNAME=${ADMIN_USERNAME} \
    ADMIN_PASSWORD=${ADMIN_PASSWORD}

WORKDIR /app

# Copy backend production dependencies and source code in single layer
COPY --from=backend-deps --chown=nodeuser:nodeuser /app/backend/node_modules ./backend/node_modules/
COPY --chown=nodeuser:nodeuser backend ./backend/

# Copy built frontend
COPY --from=frontend-builder --chown=nodeuser:nodeuser /app/frontend/dist ./public/

# Copy and setup entrypoint
COPY --chown=nodeuser:nodeuser docker-entrypoint.sh /
RUN chmod +x /docker-entrypoint.sh

# Switch to non-root user
USER nodeuser

# Expose port and set entrypoint
EXPOSE 5000

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["node", "backend/index.js"]