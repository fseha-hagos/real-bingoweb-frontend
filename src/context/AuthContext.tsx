"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "../lib/auth-client";
import { apiClient } from "../lib/api";
import { UserSafeType } from "../types/game";
import { am } from "../constants/amharic";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: UserSafeType | null;
  refreshUser: () => Promise<UserSafeType | null>;
  setUser: (user: UserSafeType | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PUBLIC_PATHS = new Set(["/login"]);

function hasSessionUser(payload: unknown): boolean {
  if (!payload || typeof payload !== "object") return false;
  const data = payload as { user?: { id?: string } | null };
  return !!(data.user && data.user.id);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUserState] = useState<UserSafeType | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const setUser = useCallback((next: UserSafeType | null) => {
    setUserState(next);
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await apiClient.getMe();
    if (res.success && res.data?.user) {
      const next = res.data.user as UserSafeType;
      setUserState(next);
      setStatus("authenticated");
      return next;
    }
    setUserState(null);
    setStatus("unauthenticated");
    return null;
  }, []);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut();
    } catch (err) {
      console.error("signOut failed", err);
    } finally {
      setUserState(null);
      setStatus("unauthenticated");
      router.replace("/login");
    }
  }, [router]);

  useEffect(() => {
    let cancelled = false;

    const boot = async () => {
      try {
        // Prefer /api/me — validates session cookie against our DB user
        const me = await apiClient.getMe();
        if (cancelled) return;

        if (me.success && me.data?.user) {
          setUserState(me.data.user as UserSafeType);
          setStatus("authenticated");
          return;
        }

        // Fallback: Better Auth session endpoint
        const session = await authClient.getSession();
        if (cancelled) return;

        if (hasSessionUser(session.data)) {
          await refreshUser();
        } else {
          setStatus("unauthenticated");
        }
      } catch {
        if (!cancelled) setStatus("unauthenticated");
      }
    };

    boot();
    return () => {
      cancelled = true;
    };
  }, [refreshUser]);

  useEffect(() => {
    if (status === "loading") return;

    const isPublic = PUBLIC_PATHS.has(pathname);

    if (status === "unauthenticated" && !isPublic) {
      router.replace("/login");
    } else if (status === "authenticated" && pathname === "/login") {
      router.replace("/");
    }
  }, [status, pathname, router]);

  const value = useMemo(
    () => ({ status, user, refreshUser, setUser, signOut }),
    [status, user, refreshUser, setUser, signOut]
  );

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-secondary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-300">{am.checkingSession}</p>
        </div>
      </div>
    );
  }

  if (status === "unauthenticated" && !PUBLIC_PATHS.has(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-bg text-white">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-brand-secondary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-300">{am.redirectingLogin}</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
