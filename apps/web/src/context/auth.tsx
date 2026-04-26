"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import Cookies from "js-cookie";
import { auth, type AuthResponse, ApiClientError } from "@/lib/api";

interface User {
  id: string;
  email: string;
  name: string | null;
}

interface AuthContextValue {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ACCESS_TOKEN_KEY = "access_token";
const REFRESH_TOKEN_KEY = "refresh_token";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const applyAuth = useCallback((res: AuthResponse) => {
    setUser(res.user);
    setAccessToken(res.accessToken);
    Cookies.set(ACCESS_TOKEN_KEY, res.accessToken, { sameSite: "strict" });
    Cookies.set(REFRESH_TOKEN_KEY, res.refreshToken, { sameSite: "strict" });
  }, []);

  // Restore session on mount
  useEffect(() => {
    const storedAccess = Cookies.get(ACCESS_TOKEN_KEY);
    const storedRefresh = Cookies.get(REFRESH_TOKEN_KEY);

    if (!storedAccess && !storedRefresh) {
      setIsLoading(false);
      return;
    }

    void (async () => {
      try {
        if (storedAccess) {
          const me = await auth.me(storedAccess);
          setUser(me);
          setAccessToken(storedAccess);
        } else if (storedRefresh) {
          const refreshed = await auth.refresh(storedRefresh);
          setAccessToken(refreshed.accessToken);
          Cookies.set(ACCESS_TOKEN_KEY, refreshed.accessToken, { sameSite: "strict" });
          Cookies.set(REFRESH_TOKEN_KEY, refreshed.refreshToken, { sameSite: "strict" });
          const me = await auth.me(refreshed.accessToken);
          setUser(me);
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 401) {
          Cookies.remove(ACCESS_TOKEN_KEY);
          Cookies.remove(REFRESH_TOKEN_KEY);
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await auth.login({ email, password });
      applyAuth(res);
    },
    [applyAuth]
  );

  const register = useCallback(
    async (email: string, password: string, name?: string) => {
      const res = await auth.register({ email, password, ...(name !== undefined ? { name } : {}) });
      applyAuth(res);
    },
    [applyAuth]
  );

  const logout = useCallback(async () => {
    if (accessToken) {
      await auth.logout(accessToken).catch(() => undefined);
    }
    setUser(null);
    setAccessToken(null);
    Cookies.remove(ACCESS_TOKEN_KEY);
    Cookies.remove(REFRESH_TOKEN_KEY);
  }, [accessToken]);

  return (
    <AuthContext.Provider value={{ user, accessToken, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
