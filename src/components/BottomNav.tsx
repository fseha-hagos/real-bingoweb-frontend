"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Trophy, Gamepad2, User, Wallet } from "lucide-react";
import { motion } from "framer-motion";
import { am } from "../constants/amharic";

const navItems = [
  { href: "/leaderboard", key: "leaderboard", label: am.navLeaderboard, icon: Trophy },
  { href: "/", key: "play", label: am.navPlay, icon: Gamepad2 },
  { href: "/wallet", key: "wallet", label: am.navWallet, icon: Wallet },
  { href: "/profile", key: "profile", label: am.navProfile, icon: User },
] as const;

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-5 pt-2 pointer-events-none">
      <div className="mx-auto max-w-lg bg-black/50 backdrop-blur-2xl border border-white/10 rounded-2xl flex justify-around py-2.5 px-1 shadow-[0_0_30px_rgba(0,0,0,0.5)] pointer-events-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.key}
              href={item.href}
              className={`relative flex flex-col items-center gap-1 px-3 py-1.5 min-w-[4.25rem] transition-all duration-300 ${
                active ? "text-brand-primary" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 bg-brand-primary/10 rounded-xl -z-10"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.55 }}
                />
              )}
              <Icon
                size={20}
                className={
                  active
                    ? "scale-110 drop-shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                    : ""
                }
              />
              <span className="text-[9px] font-black uppercase tracking-widest">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
