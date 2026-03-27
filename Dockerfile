# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy application code and build
COPY . .
RUN npm run build

# Stage 2: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S appuser -u 1001

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy built output from builder stage
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite and set ownership
RUN mkdir -p /app/data && chown -R appuser:nodejs /app/data

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV SQLITE_DB_PATH=/app/data/sync.db

# Expose the webhook endpoint port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Start the application
CMD ["node", "dist/index.js"]
