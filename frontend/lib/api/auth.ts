import { apiRequest, jsonBody } from './client';
import type { User } from '@/lib/types';

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ user: User }>('/api/session/login', {
      method: 'POST',
      ...jsonBody({ email, password }),
    }),
  register: (email: string, password: string) =>
    apiRequest<{ user: User }>('/api/session/register', {
      method: 'POST',
      ...jsonBody({ email, password }),
    }),
  logout: () => apiRequest<void>('/api/session/logout', { method: 'POST' }),
};
