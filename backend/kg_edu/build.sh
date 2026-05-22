#!/usr/bin/env bash
set -euo pipefail

PLATFORM="${PLATFORM:-linux/amd64}"
IMAGE="${IMAGE:-registry.cn-zhangjiakou.aliyuncs.com/myelixir/kg_edu_backend:latest}"

docker buildx build \
  --platform "${PLATFORM}" \
  -t "${IMAGE}" \
  --load \
  .

docker push "${IMAGE}"
