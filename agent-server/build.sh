#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_agent:latest}"
AMD64_IMAGE="${IMAGE%:*}:amd64"
PLATFORM="${PLATFORM:-linux/amd64}"

# Regenerate bun.lock to ensure correct versions
cd "$(dirname "$0")"
if [ "$1" == "--regen-lock" ] || [ "$1" == "-r" ]; then
    echo "==> Regenerating bun.lock..."
    rm -f bun.lock package-lock.json
    bun install
    shift
fi

echo "==> Building AI Agent image: ${IMAGE}"
docker buildx build \
  --platform "${PLATFORM}" \
  -t "${IMAGE}" \
  -t "${AMD64_IMAGE}" \
  --load \
  .

echo "==> Pushing AI Agent images..."
docker push "${IMAGE}"
docker push "${AMD64_IMAGE}"

echo "==> AI Agent image done"

