import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import { apiGet, apiPost, clearToken, getToken, setToken } from "../api/client.js";
import { ROLE_RANK } from "../constants/enums.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setAuthToken] = useState(() => getToken());
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(() => !getToken());

  useEffect(() => {
    if (!token) {
      setUser(null);
      setReady(true);
      return;
    }

    let active = true;
    apiGet("/api/auth/me")
      .then((me) => {
        if (active) setUser(me);
      })
      .catch(() => {
        if (active) {
          clearToken();
          setAuthToken(null);
          setUser(null);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });

    return () => {
      active = false;
    };
  }, [token]);

  const login = useCallback(async (email, password) => {
    const result = await apiPost("/api/auth/login", { email, password });
    setToken(result.access_token);
    setAuthToken(result.access_token);

    const me = await apiGet("/api/auth/me");
    setUser(me);
    setReady(true);
    return me;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthToken(null);
    setUser(null);
    setReady(true);
  }, []);

  const hasRole = useCallback(
    (minimum) => Boolean(user && ROLE_RANK[user.role] >= ROLE_RANK[minimum]),
    [user],
  );

  const value = useMemo(
    () => ({
      token,
      user,
      ready,
      isAuthenticated: Boolean(token),
      login,
      logout,
      hasRole,
    }),
    [token, user, ready, login, logout, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
