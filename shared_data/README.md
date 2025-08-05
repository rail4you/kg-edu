# Shared Data

This folder contains shared data between the backend and frontend projects.

## OpenAPI Schema

The `openapi-schema.json` file contains the OpenAPI 3.0 specification generated from the Ash JSON:API backend.

### How to Update

1. Make sure the backend server is running:
   ```bash
   cd backend/kg_edu
   mix phx.server
   ```

2. Run the fetch script:
   ```bash
   cd shared_data
   ./fetch-schema.sh
   ```

### Manual Update

Alternatively, you can manually fetch the schema:
```bash
curl http://localhost:4000/api/json/open_api > openapi-schema.json
```

### Schema Endpoints

The OpenAPI schema includes these authentication endpoints:

- `POST /api/json/users/register` - User registration
- `POST /api/json/users/sign-in` - User login
- `GET /api/json/users/me` - Get current user
- `PATCH /api/json/users/change-password` - Change password
- `PATCH /api/json/users/reset-password` - Reset password

### Frontend Usage

The Next.js frontend uses this schema to generate TypeScript client code for type-safe API calls.