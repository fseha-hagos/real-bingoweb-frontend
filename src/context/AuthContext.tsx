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

// Lobby and cards are public/accessible so Telegram 1-click players and guests can view without redirects
const PUBLIC_PATHS = new Set(["/", "/login", "/cards"]);

function getTelegramPayload(): {
  telegramId?: string;
  firstName?: string;
  username?: string;
  initData?: string;
} | null {
  if (typeof window === "undefined") return null;

  // 1. Check window.Telegram?.WebApp
  const unsafeUser = window.Telegram?.WebApp?.initDataUnsafe?.user;
  const rawInitData = window.Telegram?.WebApp?.initData;

  // 2. Check URL search params (?tgId=...)
  const searchParams = new URLSearchParams(window.location.search);
  const queryTgId = searchParams.get("tgId") || searchParams.get("telegramId");

  // 3. Check hash params
  let hashTgId: string | null = null;
  try {
    const hash = window.location.hash.replace(/^#/, "");
    if (hash) {
      const hashParams = new URLSearchParams(hash);
      const rawTgWeb = hashParams.get("tgWebAppData");
      if (rawTgWeb) {
        const innerParams = new URLSearchParams(decodeURIComponent(rawTgWeb));
        const userJson = innerParams.get("user");
        if (userJson) {
          const parsed = JSON.parse(userJson);
          if (parsed.id) hashTgId = String(parsed.id);
        }
      }
    }
  } catch { }

  const telegramId = unsafeUser?.id
    ? String(unsafeUser.id)
    : (queryTgId || hashTgId);

  if (telegramId || rawInitData) {
    return {
      telegramId: telegramId || undefined,
      firstName: unsafeUser?.first_name,
      username: unsafeUser?.username,
      initData: rawInitData || undefined,
    };
  }

  return null;
}

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
    setUserState((prev) => {
      if (!next) return null;
      return {
        ...next,
        // Keep password flag if a partial update omitted it
        hasPassword:
          typeof next.hasPassword === "boolean"
            ? next.hasPassword
            : prev?.hasPassword,
      };
    });
    setStatus(next ? "authenticated" : "unauthenticated");
  }, []);

  const refreshUser = useCallback(async () => {
    // 1. If inside Telegram, verify immediately
    const tgPayload = getTelegramPayload();
    if (tgPayload) {
      try {
        const tgRes = await apiClient.verifyTelegramUser(tgPayload);
        const tgUser = (tgRes.data?.user || (tgRes.data as any)?.data?.user) as UserSafeType | undefined;
        if (tgRes.success && tgUser) {
          const authedUser: UserSafeType = { ...tgUser, hasPassword: true };
          if ((tgRes.data as any)?.token) {
            try {
              localStorage.setItem("tg_session_token", (tgRes.data as any).token);
            } catch { }
          }
          setUserState(authedUser);
          setStatus("authenticated");
          return authedUser;
        }
      } catch { }
    }

    const res = await apiClient.getMe();
    if (res.success && res.data?.user) {
      const next = res.data.user as UserSafeType;
      if (next.telegramId) next.hasPassword = true;
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
        // 1. Seamless Telegram authentication: auto-verify if launched from Telegram
        const tgPayload = getTelegramPayload();
        if (tgPayload) {
          try {
            window.Telegram?.WebApp?.ready?.();
            window.Telegram?.WebApp?.expand?.();
          } catch { }

          const tgRes = await apiClient.verifyTelegramUser(tgPayload);
          if (cancelled) return;

          const tgUser = (tgRes.data?.user || (tgRes.data as any)?.data?.user) as UserSafeType | undefined;
          if (tgRes.success && tgUser) {
            const authedUser: UserSafeType = {
              ...tgUser,
              hasPassword: true, // Telegram users never need password entry
            };
            if ((tgRes.data as any)?.token) {
              try {
                localStorage.setItem("tg_session_token", (tgRes.data as any).token);
              } catch { }
            }
            setUserState(authedUser);
            setStatus("authenticated");
            return;
          }
        }

        // 2. Prefer /api/me — validates session cookie against our DB user
        const me = await apiClient.getMe();
        if (cancelled) return;

        if (me.success && me.data?.user) {
          const user = me.data.user as UserSafeType;
          if (user.telegramId) {
            user.hasPassword = true;
          }
          setUserState(user);
          setStatus("authenticated");
          return;
        }

        // 3. Fallback: Better Auth session endpoint
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
    const isTelegramUser = Boolean(user?.telegramId);
    const hasTgContext =
      typeof window !== "undefined" &&
      Boolean(
        window.Telegram?.WebApp?.initData ||
        window.Telegram?.WebApp?.initDataUnsafe?.user?.id ||
        window.location.search.includes("tgId") ||
        window.location.hash.includes("tgWebAppData")
      );

    // OTP verified but password not set yet — stay on /login to finish signup (only for non-Telegram players)
    const needsPassword =
      status === "authenticated" && user?.hasPassword === false && !isTelegramUser;

    if (needsPassword && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // Telegram players are never bounced to /login
    if (status === "unauthenticated" && !isPublic && !hasTgContext) {
      router.replace("/login");
    } else if (
      status === "authenticated" &&
      pathname === "/login" &&
      !needsPassword
    ) {
      try {
        const stored = sessionStorage.getItem("selected_game");
        const parsed = stored ? JSON.parse(stored) : null;
        if (parsed?.bet) {
          router.replace(`/cards?bet=${parsed.bet}`);
          return;
        }
      } catch { }
      router.replace("/");
    }
  }, [status, pathname, router, user?.hasPassword, user?.telegramId]);

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
