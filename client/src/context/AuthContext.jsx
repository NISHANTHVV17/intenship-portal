import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../lib/api';

const AuthContext = createContext(null);

export const homeFor = (user) =>
  !user ? '/' : user.role === 'admin' ? '/admin' : user.role === 'recruiter' ? '/recruiter' : '/student';

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, profile: null, loading: Boolean(tokenStore.get()) });

  const refresh = useCallback(async () => {
    if (!tokenStore.get()) return setState({ user: null, profile: null, loading: false });
    try {
      const { user, profile } = await api.get('/auth/me');
      setState({ user, profile, loading: false });
    } catch {
      tokenStore.clear();
      setState({ user: null, profile: null, loading: false });
    }
  }, []);

  useEffect(() => {
    refresh();
    const onExpired = () => setState({ user: null, profile: null, loading: false });
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [refresh]);

  const acceptSession = useCallback(
    async ({ token }) => {
      tokenStore.set(token);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo(
    () => ({
      ...state,
      refresh,
      login: async (email, password) => acceptSession(await api.post('/auth/login', { email, password })),
      registerStudent: async (data) => acceptSession(await api.post('/auth/register/student', data)),
      registerRecruiter: async (data) => acceptSession(await api.post('/auth/register/recruiter', data)),
      logout: () => {
        tokenStore.clear();
        setState({ user: null, profile: null, loading: false });
      },
    }),
    [state, refresh, acceptSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
