import { useState, useEffect, useCallback } from "react";
import type { User } from "../types";

interface AuthState {
  authenticated: boolean;
  user: User | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    authenticated: false,
    user: null,
    loading: true,
  });

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/status", { credentials: "include" });
      if (!res.ok) {
        setState({ authenticated: false, user: null, loading: false });
        return;
      }
      const data = await res.json();
      setState({
        authenticated: data.authenticated === true,
        user: data.user || null,
        loading: false,
      });
    } catch {
      setState({ authenticated: false, user: null, loading: false });
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = () => {
    window.location.href = "/api/auth/login";
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch {
      // Logout locally regardless of network errors
    }
    setState({ authenticated: false, user: null, loading: false });
  };

  return { ...state, login, logout };
}
