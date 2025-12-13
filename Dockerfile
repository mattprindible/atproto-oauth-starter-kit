# Use Node.js LTS (20) as base image
FROM node:20-slim AS base

# Install dependencies required for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including native modules)
RUN npm ci --omit=dev

# Copy application code
COPY . .

# Generate keys if they don't exist (for initial setup)
# In production, you should inject KEYS_JSON as an environment variable
RUN if [ ! -f keys.json ]; then npm run generate-keys; fi

# Create a non-root user for security
RUN useradd -m -u 1001 appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose the application port
EXPOSE 3000

# Health check endpoint (we'll add this)
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); })"

# Start the application
CMD ["npm", "start"]
