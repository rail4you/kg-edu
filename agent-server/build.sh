#!/usr/bin/env bash
set -euo pipefail

IMAGE="${IMAGE:-registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_agent:latest}"
PLATFORM="${PLATFORM:-linux/amd64}"

echo "==> Building AI Agent image: ${IMAGE}"
docker buildx build \
  --platform "${PLATFORM}" \
  -t "${IMAGE}" \
  --load \
  .

echo "==> Pushing AI Agent image: ${IMAGE}"
docker push "${IMAGE}"

echo "==> AI Agent image done"
