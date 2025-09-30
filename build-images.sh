#!/bin/bash

# Build all Docker images locally
echo "Building Docker images..."

# Build backend image
echo "Building backend image..."
docker build -t kg-edu-backend:latest ./backend/kg_edu

# Build frontend image  
echo "Building frontend image..."
docker build -t kg-edu-frontend:latest ./nextjs-ts

# Save images to tar files
echo "Saving images to tar files..."
docker save -o kg-edu-backend-latest.tar kg-edu-backend:latest
docker save -o kg-edu-frontend-latest.tar kg-edu-frontend:latest

echo "Images built and saved successfully!"
echo "Files created:"
echo "- kg-edu-backend-latest.tar"
echo "- kg-edu-frontend-latest.tar"
echo ""
echo "Transfer these files to your remote machine and run:"
echo "docker load -i kg-edu-backend-latest.tar"
echo "docker load -i kg-edu-frontend-latest.tar"