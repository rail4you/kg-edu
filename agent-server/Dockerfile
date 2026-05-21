FROM oven/bun:1-alpine
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --production --no-save && \
    rm -rf /root/.bun/install/cache && \
    rm -rf /tmp/*

# Copy source
COPY src src

EXPOSE 5050
ENV AGENT_PORT=5050
ENV NODE_ENV=production

CMD ["bun", "run", "src/server.ts"]
