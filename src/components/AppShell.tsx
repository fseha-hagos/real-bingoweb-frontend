"use client";

import React, { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { SocketProvider } from "../context/SocketContext";
import { GameProvider } from "../context/gameContext";
import BottomNav from "./BottomNav";
import OnboardingGate from "./OnboardingGate";

const PUBLIC_PATHS = new Set(["/login"]);
const HIDE_NAV_PATHS = new Set(["/login", "/cards", "/game"]);

/**
 * Login stays lightweight (no socket/game).
 * Authenticated routes get realtime providers + bottom nav.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useAuth();
  const isPublic = PUBLIC_PATHS.has(pathname);
  const hideNav = HIDE_NAV_PATHS.has(pathname) || pathname.startsWith("/debug");

  if (isPublic || status !== "authenticated") {
    return <>{children}</>;
  }

  return (
    <SocketProvider>
      <GameProvider>
        <div className="min-h-screen pb-28">{children}</div>
        <OnboardingGate />
        {!hideNav && <BottomNav />}
      </GameProvider>
    </SocketProvider>
  );
}
