"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";
import { GameProvider } from "../context/gameContext";
import BottomNav from "./BottomNav";
import OnboardingGate from "./OnboardingGate";

const LOGIN_ONLY = new Set(["/login"]);
const HIDE_NAV_PATHS = new Set(["/login", "/cards", "/game"]);

/**
 * AppShell wraps every page with the realtime providers.
 *
 * Hydration rule: the server always renders the full SocketProvider/GameProvider
 * tree (status is always "loading" on first SSR pass). The client matches that
 * on mount, then updates after auth resolves. This prevents the
 * "Suspense vs div" hydration mismatch caused by conditional rendering before
 * the client knows the auth status.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useAuth();

  // On SSR the auth status is always "loading". We track mount so we never
  // render a *different* branch on the first client paint vs the server paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isLogin = LOGIN_ONLY.has(pathname);
  const hideNav = HIDE_NAV_PATHS.has(pathname) || pathname.startsWith("/debug");

  // Login page: lightweight, no providers needed
  if (isLogin) {
    return <>{children}</>;
  }

  // Before mount (SSR + first client paint): always render full provider tree
  // so server and client HTML match exactly.
  if (!mounted) {
    return (
      <SocketProvider>
        <GameProvider>
          <div className="min-h-screen pb-8">{children}</div>
        </GameProvider>
      </SocketProvider>
    );
  }

  // After mount: status is known — render lightweight shell for unauthenticated
  const isAuthed = status === "authenticated";

  if (status === "unauthenticated") {
    // Unauthenticated users: still render children (AuthContext handles redirect)
    // but skip heavy providers
    return <>{children}</>;
  }

  return (
    <SocketProvider>
      <GameProvider>
        <div className={`min-h-screen ${isAuthed ? "pb-28" : "pb-8"}`}>
          {children}
        </div>
        {isAuthed && <OnboardingGate />}
        {isAuthed && !hideNav && <BottomNav />}
      </GameProvider>
    </SocketProvider>
  );
}
