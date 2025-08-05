import { createAuthenticatedClient } from './client';
import { getApiJsonUsersMe } from './sdk.gen';
import type { User } from './types.gen';

// Token management
export const getToken = (): string | null => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('auth_token');
  }
  return null;
};

export const setToken = (token: string): void => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth_token', token);
  }
};

export const removeToken = (): void => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth_token');
  }
};

// User management
export const getCurrentUser = async (): Promise<User | null> => {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    const client = createAuthenticatedClient(token);
    const response = await getApiJsonUsersMe({ client });
    
    if (response.data && response.data.data) {
      return response.data.data;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to get current user:', error);
    removeToken(); // Remove invalid token
    return null;
  }
};

// Check if user is authenticated
export const isAuthenticated = (): boolean => {
  return getToken() !== null;
};