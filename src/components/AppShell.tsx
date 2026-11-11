"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";
import { GameProvider } from "../context/gameContext";
import BottomNav from "./BottomNav";
import OnboardingGate from "./OnboardingGate";

const LOGIN_ONLY = new Set(["/login"]);
const HIDE_NAV_PATHS = new Set(["/login", "/cards", "/game"]);

/**
 * Login stays lightweight (no socket/game).
 * Home lobby loads realtime providers for guests too (browse only).
 * Bottom nav + onboarding only for signed-in users.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useAuth();
  const isLogin = LOGIN_ONLY.has(pathname);
  const hideNav = HIDE_NAV_PATHS.has(pathname) || pathname.startsWith("/debug");
  const isAuthed = status === "authenticated";

  if (isLogin) {
    return <>{children}</>;
  }

  // Guests on other protected routes are redirected by AuthContext —
  // still render children so the redirect spinner can show.
  if (status === "unauthenticated" && pathname !== "/") {
    return <>{children}</>;
  }

  return (
    <SocketProvider>
      <GameProvider>
        <div className={`min-h-screen ${isAuthed ? "pb-28" : "pb-8"}`}>{children}</div>
        {isAuthed && <OnboardingGate />}
        {isAuthed && !hideNav && <BottomNav />}
      </GameProvider>
    </SocketProvider>
  );
}
