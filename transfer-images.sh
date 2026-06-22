#!/bin/bash
set -e

# 传输 Docker 镜像到远程主机 (离线部署方式)
# 先运行 build-images.sh 生成 tar 文件, 再用此脚本传输

if [ $# -ne 2 ]; then
    echo "Usage: $0 <user@remote-host> <remote-path>"
    echo "Example: $0 root@123.57.141.233:/root/kg_edu/"
    exit 1
fi

REMOTE_HOST=$1
REMOTE_PATH=$2
TAR_FILE="kg-edu-backend-latest.tar"

if [ ! -f "$TAR_FILE" ]; then
    echo "Error: $TAR_FILE not found. Run build-images.sh first."
    exit 1
fi

echo "Transferring Docker image to $REMOTE_HOST..."

scp "$TAR_FILE" "$REMOTE_HOST:$REMOTE_PATH"

echo ""
echo "Image transferred successfully!"
echo ""
echo "On the remote machine ($REMOTE_HOST), run:"
echo "  cd $REMOTE_PATH"
echo "  docker load -i $TAR_FILE"
echo "  docker compose -f docker-compose.yml up -d"
echo ""
