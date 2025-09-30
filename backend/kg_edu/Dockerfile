# Build stage
FROM hexpm/elixir:1.17.3-erlang-27.1.2-ubuntu-jammy-20240808 AS builder

# Install build dependencies (cached unless apt packages change)
RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set build ENV
ENV MIX_ENV=prod

# Create app directory
WORKDIR /app

# Install hex and rebar (cached unless Elixir version changes)
RUN mix local.hex --force && \
    mix local.rebar --force

# Copy ONLY dependency files first (this layer cached unless deps change)
COPY mix.exs mix.lock ./

# Install and compile dependencies separately (heavy layer, rarely changes)
RUN mix deps.get --only prod && \
    mix deps.compile

# Copy config files (changes less frequently than app code)
COPY config config

# Copy priv directory (often contains migrations)
COPY priv priv

# Copy assets (if using Phoenix, changes less than lib code)
COPY assets assets

# Compile assets (cached unless assets change)
RUN mix assets.deploy || true

# Copy application code LAST (changes most frequently)
COPY lib lib

# Compile the application
RUN mix compile

# Build the release
RUN mix release

# Runtime stage
FROM ubuntu:jammy-20240808

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    openssl \
    libssl3 \
    libncurses6 \
    locales \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Set locale
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8 \
    LANGUAGE=en_US:en \
    LC_ALL=en_US.UTF-8

# Set runtime ENV
ENV MIX_ENV=prod \
    PORT=4000

# Create app user
RUN groupadd -g 1000 app && \
    useradd -u 1000 -g app -s /bin/bash -m app

WORKDIR /app

# Copy release from builder
COPY --from=builder --chown=app:app /app/_build/prod/rel/kg_edu ./

USER app

EXPOSE 4000

# Start command
CMD ["bin/kg_edu", "start"]