# Stage 1: Backend Build (Elixir)
# Frontend (Vite dist) is pre-built locally and already in priv/static/
FROM hexpm/elixir:1.17.3-erlang-27.1.2-ubuntu-jammy-20240808 AS builder

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential git unzip \
    && rm -rf /var/lib/apt/lists/*

ENV MIX_ENV=prod
ENV ERL_AFLAGS="+JMsingle true"

WORKDIR /app

RUN mix local.hex --force && \
    mix local.rebar --force

COPY backend/kg_edu/mix.exs backend/kg_edu/mix.lock ./
COPY backend/kg_edu/deps deps
COPY backend/kg_edu/patches patches
# Apply project dependency patches (e.g. jido_ai args_lost retry) before compiling
RUN bash patches/apply.sh
# Remove precompiled NIF artifacts from local deps (arm64 → amd64 cross-compile)
RUN find deps -name "*.so" -delete && find deps -name "*.o" -delete && mix deps.compile

COPY backend/kg_edu/config config
COPY backend/kg_edu/priv priv
COPY backend/kg_edu/rel rel
COPY backend/kg_edu/assets assets
COPY backend/kg_edu/lib lib

RUN mix compile
# Frontend dist 已由 build-test.sh 预构建进 priv/static；
# 容器内跳过 tailwind/esbuild（dev-only 且无网络下载），只做 digest
RUN mix phx.digest
RUN mix release

# Stage 2: Runtime
FROM ubuntu:jammy-20240808

# ── Minimal runtime deps (no nodejs/npm, use Bun instead) ──────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl libssl3 libncurses6 locales ca-certificates \
    curl unzip wget gnupg \
    pandoc \
    python3 python3-pil python3-pip \
    libreoffice \
    fonts-noto-cjk \
    && pip3 install --no-cache-dir pymupdf \
    && rm -rf /var/lib/apt/lists/*

# ── Install PostgreSQL 16 client (pg_dump + psql) ─────────────────────
RUN curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc | \
      gpg --dearmor -o /usr/share/keyrings/postgresql.gpg \
    && echo "deb [signed-by=/usr/share/keyrings/postgresql.gpg] http://apt.postgresql.org/pub/repos/apt jammy-pgdg main" \
      > /etc/apt/sources.list.d/pgdg.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends postgresql-client-16 \
    && rm -rf /var/lib/apt/lists/*

# ── Install Bun (single binary ~100MB, replaces nodejs+npm ~500MB) ────
RUN curl -fsSL https://bun.sh/install | bash
ENV BUN_INSTALL=/root/.bun
ENV PATH="/root/.bun/bin:$PATH"

# ── Install pptxgenjs via Bun ──────────────────────────────────────────
RUN bun install -g pptxgenjs@3.12.0

# ── Set locale ────────────────────────────────────────────────────────
RUN locale-gen en_US.UTF-8
ENV LANG=en_US.UTF-8 LANGUAGE=en_US:en LC_ALL=en_US.UTF-8

# ── Runtime ENV ───────────────────────────────────────────────────────
ENV MIX_ENV=prod PORT=4000 \
    NODE_PATH=/root/.bun/install/global/node_modules

# ── Create app user ───────────────────────────────────────────────────
RUN groupadd -g 1000 app && useradd -u 1000 -g app -s /bin/bash -m app

# Copy bun for app user
RUN cp -r /root/.bun /home/app/.bun && chown -R app:app /home/app/.bun

WORKDIR /app

COPY --from=builder --chown=app:app /app/_build/prod/rel/kg_edu ./

RUN mkdir -p priv/uploads && chown -R app:app priv

USER app
ENV BUN_INSTALL=/home/app/.bun
ENV PATH="/home/app/.bun/bin:$PATH"
ENV NODE_PATH=/home/app/.bun/install/global/node_modules

EXPOSE 4000
CMD ["bin/kg_edu", "start"]
