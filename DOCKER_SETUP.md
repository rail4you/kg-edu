# Docker Setup for KgEdu Application

This repository contains a complete Docker setup for running the KgEdu application with PostgreSQL, Elixir/Phoenix backend, Next.js frontend, and Nginx reverse proxy.

## Quick Start

1. **Copy environment variables:**
   ```bash
   cp .env.docker .env
   ```

2. **Edit environment variables:**
   ```bash
   nano .env
   ```
   Fill in your actual values for:
   - `SECRET_KEY_BASE`
   - `TOKEN_SIGNING_SECRET`
   - `OPENAI_API_KEY`

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   - Main application: http://localhost:8080
   - Dashboard: http://localhost:8080/dashboard
   - Backend API: http://localhost:8080/api/

## Services

- **PostgreSQL** (port 5432): Database server
- **Backend** (port 4000): Elixir/Phoenix application
- **Frontend** (port 8082): Next.js application
- **Nginx** (port 8080): Reverse proxy

## Development

### View logs:
```bash
docker-compose logs -f [service-name]
```

### Stop services:
```bash
docker-compose down
```

### Restart services:
```bash
docker-compose restart
```

### Rebuild and start:
```bash
docker-compose build
docker-compose up -d
```

## Health Checks

All services include health checks. You can check the status:
```bash
docker-compose ps
```

## File Structure

```
├── docker-compose.yml          # Main orchestration file
├── .env.docker                 # Environment variables template
├── nginx/
│   ├── nginx.conf             # Main Nginx configuration
│   └── conf.d/
│       └── kg-edu.conf        # Site-specific Nginx configuration
├── backend/kg_edu/
│   └── Dockerfile             # Backend Docker configuration
└── nextjs-ts/
    └── Dockerfile             # Frontend Docker configuration
```