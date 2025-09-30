#!/bin/bash

# Load Docker images from tar files
echo "Loading Docker images..."

# Load backend image
if [ -f "kg-edu-backend-latest.tar" ]; then
    echo "Loading backend image..."
    docker load -i kg-edu-backend-latest.tar
else
    echo "Error: kg-edu-backend-latest.tar not found!"
    exit 1
fi

# Load frontend image
if [ -f "kg-edu-frontend-latest.tar" ]; then
    echo "Loading frontend image..."
    docker load -i kg-edu-frontend-latest.tar
else
    echo "Error: kg-edu-frontend-latest.tar not found!"
    exit 1
fi

echo "Images loaded successfully!"
echo ""
echo "Verify loaded images:"
docker images | grep kg-edu