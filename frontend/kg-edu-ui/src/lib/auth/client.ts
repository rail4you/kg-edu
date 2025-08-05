import { createClient } from '../api/client/index';

// Create a configured client instance
export const apiClient = createClient({
  baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
  headers: {
    'Content-Type': 'application/vnd.api+json',
  },
});

// Helper function to create authenticated client
export const createAuthenticatedClient = (token: string) => {
  return createClient({
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000',
    headers: {
      'Content-Type': 'application/vnd.api+json',
      'Authorization': `Bearer ${token}`,
    },
  });
};

// Export the client for direct use
export { apiClient as client };