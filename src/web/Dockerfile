# Stage 1: Build environment
FROM node:18-alpine AS builder

# Set environment variables
ENV NODE_ENV=production \
    YARN_CACHE_FOLDER=/tmp/.yarn-cache

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package files for dependency installation
COPY package.json yarn.lock ./

# Install dependencies with frozen lockfile for reproducible builds
RUN yarn install --frozen-lockfile --production=false

# Copy source code and configuration files
COPY . .

# Build application with optimizations
RUN yarn build \
    && yarn cache clean \
    && rm -rf node_modules \
    && yarn install --frozen-lockfile --production=true

# Stage 2: Production environment
FROM nginx:1.24-alpine

# Create non-root user for nginx
RUN adduser -u 101 -D -S -G nginx nginx

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create required directories with correct permissions
RUN mkdir -p /var/cache/nginx /var/run/nginx \
    && chown -R nginx:nginx /var/cache/nginx /var/run/nginx \
    && chmod -R 755 /var/cache/nginx /var/run/nginx

# Copy built application from builder stage
COPY --from=builder --chown=nginx:nginx /app/dist /usr/share/nginx/html

# Set correct permissions for application files
RUN chmod -R 755 /usr/share/nginx/html \
    && find /usr/share/nginx/html -type f -exec chmod 644 {} \;

# Remove default nginx configuration and unnecessary files
RUN rm -rf /etc/nginx/conf.d/* \
    && rm -rf /usr/share/nginx/html/index.html.default

# Create volumes for nginx cache and pid
VOLUME ["/var/cache/nginx", "/var/run/nginx"]

# Expose port 80
EXPOSE 80

# Switch to non-root user
USER nginx

# Health check configuration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:80/health || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]

# Build arguments and labels
ARG VITE_API_URL=https://api.provocative.cloud
ARG APP_VERSION=latest

# Labels for container metadata
LABEL maintainer="Provocative Cloud <support@provocative.cloud>" \
    org.opencontainers.image.title="Provocative Cloud Web Frontend" \
    org.opencontainers.image.description="Web frontend for the Provocative Cloud GPU rental platform" \
    org.opencontainers.image.version=${APP_VERSION} \
    org.opencontainers.image.vendor="Provocative Cloud" \
    org.opencontainers.image.url="https://provocative.cloud" \
    org.opencontainers.image.source="https://github.com/provocative-cloud/web" \
    org.opencontainers.image.licenses="Proprietary"