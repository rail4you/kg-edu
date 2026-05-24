FROM oven/bun:1-alpine

# Install pandoc (for DOCX conversion)
RUN apk add --no-cache pandoc-cli

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (using bun)
RUN bun install --production

# Copy source code
COPY . .

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5050/health || exit 1

# Start server
CMD ["bun", "run", "src/server.ts"]
