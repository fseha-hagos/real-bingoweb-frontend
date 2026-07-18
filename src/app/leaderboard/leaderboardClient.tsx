"use client";
import React, { useEffect, useState } from "react";
import { LeaderboardEntry } from "../../types/game";
import { useSocket } from "../../context/SocketContext";
import { useAuth } from "../../context/AuthContext";
import LeaderboardSkeleton from "./components/leaderboardSkeleton";
import TopBar from "../../components/TopBar";
import { getDisplayName } from "../../lib/player";
import { am } from "../../constants/amharic";

type Props = { initial?: LeaderboardEntry[] };
type LeaderboardType = "all" | "daily" | "weekly";

export default function LeaderboardClient({ initial = [] }: Props) {
  const { socket, connected } = useSocket();
  const { user } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>(initial);
  const [loading, setLoading] = useState(true);
  const [leaderboardType, setLeaderboardType] = useState<LeaderboardType>("daily");

  useEffect(() => {
    if (!socket) return;

    const leaderboardHandler = (data: LeaderboardEntry[]) => {
      if (!Array.isArray(data)) return;
      setEntries(data);
      setLoading(false);
    };

    const handleConnect = () => {
      socket.emit("getLeaderboard", { type: leaderboardType });
    };

    socket.on("leaderboardUpdate", leaderboardHandler);

    if (connected) {
      handleConnect();
    } else {
      socket.once("connect", handleConnect);
    }

    const restFallback = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/leaderboard?type=${leaderboardType}&limit=20`,
          { credentials: "include" }
        );
        if (!res.ok) return;
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          setEntries(json.data);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }, 2500);

    return () => {
      clearTimeout(restFallback);
      socket.off("leaderboardUpdate", leaderboardHandler);
      socket.off("connect", handleConnect);
    };
  }, [socket, connected, leaderboardType]);

  const getDateRangeLabel = () => {
    const now = new Date();

    if (leaderboardType === "daily") {
      return now.toLocaleDateString("am-ET", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }

    if (leaderboardType === "weekly") {
      const startOfWeek = new Date(now);
      const day = startOfWeek.getDay();
      const diff = startOfWeek.getDate() - day;
      startOfWeek.setDate(diff);
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      return `${startOfWeek.toLocaleDateString("am-ET", { month: "short", day: "numeric" })} - ${endOfWeek.toLocaleDateString("am-ET", { month: "short", day: "numeric" })}`;
    }

    return "";
  };

  const entryName = (e: LeaderboardEntry) =>
    getDisplayName({
      firstName: e.firstName,
      username: e.username,
      phoneNumber: e.phoneNumber,
    });

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <TopBar title={am.hallOfFame} />

      <div className="p-4 max-w-3xl mx-auto pb-24">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
          <div className="relative z-10 flex justify-between gap-1 mb-6 bg-black/20 p-1 rounded-2xl border border-white/5">
            {(["all", "daily", "weekly"] as const).map((type) => (
              <button
                key={type}
                onClick={() => {
                  setLeaderboardType(type);
                  setLoading(true);
                }}
                className={`flex-1 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 ${
                  leaderboardType === type
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {type === "all" ? am.allTime : type === "daily" ? am.daily : am.weekly}
              </button>
            ))}
          </div>

          {leaderboardType !== "all" && (
            <div className="relative z-10 text-center text-[10px] font-black tracking-widest text-brand-secondary/60 mb-6 uppercase">
              {getDateRangeLabel()}
            </div>
          )}

          <div className="relative z-10 space-y-3">
            {loading ? (
              <LeaderboardSkeleton />
            ) : entries.length === 0 ? (
              <div className="text-center text-gray-500 py-12 font-black uppercase tracking-widest text-[10px] opacity-50">
                {am.noChampions}
              </div>
            ) : (
              entries.map((e, idx) => {
                const isYou = !!user?.id && e.userId === user.id;
                return (
                  <div
                    key={e.userId || e.telegramId || idx}
                    className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-300 group ${
                      isYou
                        ? "bg-brand-primary/15 border-brand-primary/40"
                        : "bg-white/[0.02] hover:bg-white/[0.05] border-white/[0.05]"
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        className={`text-lg font-black w-6 text-center shrink-0 ${
                          idx < 3 ? "text-brand-accent" : "text-gray-600"
                        }`}
                      >
                        {idx + 1}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-sm tracking-tight text-white truncate flex items-center gap-2">
                          <span className="truncate">{entryName(e)}</span>
                          {isYou && (
                            <span className="text-[9px] font-black uppercase tracking-widest text-brand-accent shrink-0">
                              {am.yourRank}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-black text-brand-secondary text-sm tracking-tighter">
                        {e.totalWins}{" "}
                        <span className="text-[8px] uppercase tracking-widest ml-0.5">{am.wins}</span>
                      </div>
                      <div className="text-[11px] font-black text-brand-accent mt-0.5">
                        {Number(e.totalEarnings || 0).toLocaleString()}{" "}
                        <span className="text-[8px] uppercase tracking-widest">{am.birr}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
