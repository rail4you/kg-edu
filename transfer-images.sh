#!/bin/bash

# Transfer images to remote machine
# Usage: ./transfer-images.sh <user@remote-host> <remote-path>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <user@remote-host> <remote-path>"
    echo "Example: $0 user@server.com:/home/user/"
    exit 1
fi

REMOTE_HOST=$1
REMOTE_PATH=$2

echo "Transferring Docker images to $REMOTE_HOST..."

# Transfer the tar files
scp kg-edu-backend-latest.tar kg-edu-frontend-latest.tar $REMOTE_HOST:$REMOTE_PATH

echo "Images transferred successfully!"
echo ""
echo "On the remote machine, run:"
echo "cd $REMOTE_PATH"
echo "chmod +x load-images.sh"
echo "./load-images.sh"