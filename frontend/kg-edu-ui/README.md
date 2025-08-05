# KgEdu Frontend

This is the Next.js frontend for the KgEdu (Knowledge Graph Education) platform. It provides a user interface for authentication and interaction with the Ash Framework backend.

## Features

- **Authentication**: User registration and login using JWT tokens
- **Type-safe API**: Auto-generated TypeScript client from OpenAPI schema
- **Modern UI**: Built with Next.js 15, React 19, and Tailwind CSS
- **Form Validation**: Using React Hook Form with Zod validation

## Prerequisites

- Node.js 18+ 
- Backend server running (Ash Framework Phoenix application)

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.local.example .env.local
   ```
   Edit `.env.local` to match your backend URL.

3. **Generate API client** (if OpenAPI schema changes):
   ```bash
   npm run generate-api
   ```

4. **Start the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser** to [http://localhost:3000](http://localhost:3000)

## Backend Integration

The frontend integrates with the Ash Framework backend through:

- **OpenAPI Schema**: Located in `../shared_data/openapi-schema.json`
- **Auto-generated Client**: TypeScript client generated from OpenAPI schema
- **Authentication**: JWT-based authentication with token management

### API Endpoints

- `POST /api/json/users/register` - User registration
- `POST /api/json/users/sign-in` - User login  
- `GET /api/json/users/me` - Get current user
- `PATCH /api/json/users/change-password` - Change password
- `PATCH /api/json/users/reset-password` - Reset password

## Project Structure

```
src/
├── components/
│   └── auth/
│       ├── login-form.tsx
│       └── register-form.tsx
├── contexts/
│   └── auth-context.tsx
└── lib/
    └── api/
        ├── client.ts
        ├── auth.ts
        ├── index.ts
        ├── sdk.gen.ts
        └── types.gen.ts
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run generate-api` - Generate API client from OpenAPI schema

## Environment Variables

- `NEXT_PUBLIC_API_BASE_URL` - Backend API URL (default: http://localhost:4000)

## Dependencies

- **Next.js 15** - React framework
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **React Hook Form** - Form handling
- **Zod** - Schema validation
- **@hey-api/openapi-ts** - OpenAPI client generation
