#!/bin/bash
set -e

# 构建统一 Docker 镜像 (前端 + 后端) 并保存为 tar 文件
# 用于离线环境部署，需要手动传输 tar 文件到远程服务器

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
IMAGE="kg-edu-backend:latest"
TAR_FILE="kg-edu-backend-latest.tar"

echo "=========================================="
echo "  Building unified image (frontend + backend)"
echo "=========================================="
echo ""
echo "  Image: $IMAGE"
echo "  Output: $TAR_FILE"
echo ""

# Build frontend first, copy to backend, then build image
(cd "$PROJECT_ROOT/kg-edu-vite-antd" && bash ./build-test.sh)

echo ""
echo "Saving image to tar..."
docker save -o "$TAR_FILE" "$IMAGE"

echo ""
echo "=========================================="
echo "  Build Complete!"
echo "=========================================="
echo ""
echo "  Transfer to remote:"
echo "    scp $TAR_FILE root@123.57.141.233:/root/kg_edu/"
echo ""
echo "  On remote host:"
echo "    docker load -i /root/kg_edu/$TAR_FILE"
echo "    cd /root/kg_edu && docker compose -f docker-compose.yml up -d"
echo ""
