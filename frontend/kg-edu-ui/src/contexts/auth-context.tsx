'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from '../lib/api/types.gen';
import { getToken, setToken, removeToken, getCurrentUser, isAuthenticated } from '../lib/auth/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (token: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  userRole: 'admin' | 'user' | 'teacher' | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<'admin' | 'user' | 'teacher' | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      if (isAuthenticated()) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          setUserRole(currentUser?.attributes?.role || 'user');
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          removeToken();
        }
      }
      setLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (token: string): Promise<void> => {
    setToken(token);
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
      setUserRole(currentUser?.attributes?.role || 'user');
    } catch (error) {
      console.error('Failed to get user after login:', error);
      removeToken();
      throw error;
    }
  };

  const logout = (): void => {
    removeToken();
    setUser(null);
    setUserRole(null);
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    isAuthenticated: !!user,
    userRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};