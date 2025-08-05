#!/bin/bash

# Script to fetch OpenAPI schema from the running backend
# This should be run from the backend directory or with the backend server running

BACKEND_URL="http://localhost:4000"
API_ENDPOINT="/api/json/open_api"
OUTPUT_FILE="/Users/bai/projects/kg-edu/shared_data/openapi-schema.json"

echo "Fetching OpenAPI schema from ${BACKEND_URL}${API_ENDPOINT}..."

# Check if the backend is running
if ! curl -s -f "${BACKEND_URL}${API_ENDPOINT}" > /dev/null; then
    echo "Error: Backend server is not running or not accessible at ${BACKEND_URL}"
    echo "Please start the backend server with 'mix phx.server' and try again."
    exit 1
fi

# Fetch the OpenAPI schema
curl -s "${BACKEND_URL}${API_ENDPOINT}" > "${OUTPUT_FILE}"

if [ $? -eq 0 ]; then
    echo "OpenAPI schema successfully saved to ${OUTPUT_FILE}"
    echo "Schema size: $(wc -c < "${OUTPUT_FILE}") bytes"
else
    echo "Error: Failed to fetch OpenAPI schema"
    exit 1
fi