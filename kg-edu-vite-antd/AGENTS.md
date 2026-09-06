# Project Agent Instructions

## Development Server

- **Do NOT start the development server** (`npm run dev`, `vite`, etc.). The development server is already running in the user's environment.
- When making code changes, the HMR (Hot Module Replacement) will automatically reload the changes.

## Code Style

- Run `npm run lint` to check for linting errors after making changes.
- Run `npm run build` to verify the build passes before committing.

## Project Structure

- `src/pages/teacher/` - Teacher-side pages
- `src/pages/student/` - Student-side pages  
- `src/pages/admin/` - Admin-side pages
- `src/layouts/` - Layout components for different user roles
- `src/lib/` - API clients and utilities
- `src/auth/` - Authentication context and utilities
