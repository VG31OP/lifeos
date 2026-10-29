'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store';
import { api } from '@/lib/api';
import { Dashboard } from '@/components/Dashboard';
import { LoginPage } from '@/components/LoginPage';
import { RegisterPage } from '@/components/RegisterPage';

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, setUser } = useAuthStore();

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('access_token');
      if (token) {
        api.setToken(token);
        try {
          const userData = await api.getMe();
          setUser(userData);
        } catch {
          api.clearToken();
          setUser(null);
        }
      }
    };
    initAuth();
  }, [setUser]);

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <Dashboard />;
}