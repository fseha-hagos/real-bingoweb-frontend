"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { am } from "../constants/amharic";
import { formatPhoneDisplay, getDisplayName, getInitials } from "../lib/player";

type Props = {
  title?: string;
  subtitle?: string;
  showPlayer?: boolean;
};

export default function TopBar({ title, subtitle, showPlayer = true }: Props) {
  const { user } = useAuth();
  const { connected, connectionStatus } = useSocket();
  const displayName = getDisplayName(user);
  const initials = getInitials(user);

  const statusLabel = connected
    ? am.systemLive
    : connectionStatus === "connecting"
      ? am.reconnecting
      : am.disconnected;

  const statusClass = connected
    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
    : connectionStatus === "connecting"
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-rose-500/10 text-rose-400 border-rose-500/20";

  return (
    <div className="sticky top-0 z-40 backdrop-blur-xl bg-brand-bg/85 border-b border-white/5">
      <div className={`text-center py-1.5 text-[10px] font-bold tracking-widest uppercase border-b ${statusClass}`}>
        <div className="flex items-center justify-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              connected
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)] animate-pulse"
                : "bg-current"
            }`}
          />
          {statusLabel}
        </div>
      </div>

      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-brand-accent text-[10px] font-black tracking-[0.3em] uppercase mb-0.5">
            Winner Bingo
          </p>
          {title ? (
            <h1 className="text-xl font-black tracking-tight truncate">{title}</h1>
          ) : (
            <h1 className="text-xl font-black tracking-tight truncate">
              {am.helloPlayer(displayName)}
            </h1>
          )}
          {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        </div>

        {showPlayer && user && (
          <Link
            href="/profile"
            className="flex items-center gap-2.5 shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] pl-2 pr-3 py-1.5 hover:bg-white/[0.07] transition"
          >
            <div className="w-9 h-9 rounded-xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center text-brand-primary font-black">
              {initials}
            </div>
            <div className="text-right min-w-0 hidden sm:block">
              <p className="text-xs font-black truncate max-w-[8rem]">{displayName}</p>
              <p className="text-[9px] text-gray-500 font-bold tracking-wide">
                {formatPhoneDisplay(user.phoneNumber)}
              </p>
            </div>
          </Link>
        )}
      </div>
    </div>
  );
}
