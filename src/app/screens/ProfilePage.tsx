"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { CreditCard, Pencil, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useGames } from "../../context/gameContext";
import { useAuth } from "../../context/AuthContext";
import ProfileSkeleton from "./components/profileSkeleton";
import TopBar from "../../components/TopBar";
import { apiClient } from "../../lib/api";
import {
  formatPhoneDisplay,
  getDisplayName,
  getInitials,
  needsDisplayName,
} from "../../lib/player";
import { toast } from "react-toastify";

import { am, formatBirr, translateTransactionStatus } from "../../constants/amharic";

type TabType = "transactions" | "wins";

interface Transaction {
  id: number | string;
  type: string;
  amount: number;
  status: "Completed" | "Pending" | "Failed" | string;
  date: string;
  direction?: "credit" | "debit";
}

interface Win {
  id: number | string;
  game?: string;
  amount: number;
  bet?: number;
  date: string;
  pattern?: string | null;
  gameId?: string;
}

interface ProfileData {
  username: string;
  phone: string;
  balance: number;
  totalWins: number;
  totalEarnings: number;
  totalGames: number;
  transactions: Transaction[];
  wins: Win[];
}

export default function ProfileClient() {
  const [activeTab, setActiveTab] = useState<TabType>("wins");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [saving, setSaving] = useState(false);
  const { user } = useGames();
  const { signOut, setUser, user: authUser } = useAuth();
  const router = useRouter();

  const player = user || authUser;
  const displayName = getDisplayName(player);
  const initials = getInitials(player);
  const phone = formatPhoneDisplay(player?.phoneNumber || profile?.phone);

  useEffect(() => {
    if (!player?.id) return;

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const res = await apiClient.getProfile();

        if (res.success && res.data) {
          const data = res.data as Partial<ProfileData>;
          setProfile({
            username: data?.username ?? displayName,
            phone: data?.phone ?? player.phoneNumber ?? am.notAvailable,
            balance: data?.balance ?? player.balance ?? 0,
            totalWins: data?.totalWins ?? data?.wins?.length ?? 0,
            totalEarnings: data?.totalEarnings ?? 0,
            totalGames: data?.totalGames ?? 0,
            transactions: Array.isArray(data?.transactions) ? data.transactions : [],
            wins: Array.isArray(data?.wins) ? data.wins : [],
          });
        }
      } catch (err) {
        console.error("Error fetching profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [player?.id]);

  useEffect(() => {
    if (needsDisplayName(player)) {
      setEditing(true);
      setNameInput("");
    } else {
      setNameInput(displayName);
    }
  }, [player?.id, displayName]);

  const formatDate = (value?: string) => {
    if (!value) return am.noDate;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("am-ET", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  const formatCurrency = (value: number) => formatBirr(value);

  const inferDirection = (transaction: Transaction): "credit" | "debit" => {
    if (transaction.direction === "credit" || transaction.direction === "debit") {
      return transaction.direction;
    }

    const label = (transaction.type || "").toLowerCase();
    if (label.includes("bet") || label.includes("entry") || label.includes("withdraw")) {
      return "debit";
    }
    if (label.includes("win") || label.includes("payout") || label.includes("deposit") || label.includes("bonus")) {
      return "credit";
    }
    return transaction.amount >= 0 ? "credit" : "debit";
  };

  const saveName = async (e?: FormEvent) => {
    e?.preventDefault();
    const next = nameInput.trim();
    if (next.length < 2) {
      toast.error(am.nameTooShort);
      return;
    }
    setSaving(true);
    try {
      const res = await apiClient.updateMe({ name: next });
      if (!res.success || !res.data?.user) {
        toast.error(res.error || am.nameSaveFailed);
        return;
      }
      setUser(res.data.user);
      setProfile((prev) =>
        prev
          ? { ...prev, username: res.data!.user.firstName || next }
          : prev
      );
      setEditing(false);
      toast.success(am.nameSaved);
    } catch {
      toast.error(am.nameSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const transactions = useMemo(() => profile?.transactions ?? [], [profile?.transactions]);
  const wins = useMemo(() => profile?.wins ?? [], [profile?.wins]);

  if (loading && !profile) return <ProfileSkeleton />;

  return (
    <div className="min-h-screen bg-brand-bg text-white pb-8">
      <TopBar title={am.profileTitle} showPlayer={false} />

      <div className="p-4 max-w-3xl mx-auto">
        <div className="bg-white/[0.03] backdrop-blur-xl border border-white/10 p-6 rounded-[2rem] text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-32 h-32 bg-brand-primary/5 rounded-full blur-[60px]" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-brand-secondary/5 rounded-full blur-[60px]" />

          <div className="relative z-10 flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-16 h-16 rounded-2xl bg-brand-primary/10 border-2 border-brand-primary/20 flex items-center justify-center text-brand-primary font-black text-2xl shadow-inner shrink-0">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="font-black text-xl tracking-tight leading-none mb-1 truncate">
                  {displayName}
                </h2>
                <p className="text-[11px] font-bold text-gray-400">{phone}</p>
                <p className="text-[9px] font-black tracking-widest text-gray-600 uppercase mt-1">
                  {am.accountSection}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[10px] font-black tracking-widest text-gray-500 uppercase mb-1">
                {am.availableBalance}
              </p>
              <p className="text-brand-accent text-2xl font-black tracking-tighter">
                {Number(profile?.balance ?? player?.balance ?? 0).toLocaleString()}{" "}
                <span className="text-xs uppercase font-black">{am.etb}</span>
              </p>
            </div>
          </div>

          {/* Edit display name */}
          <div className="relative z-10 mb-6 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {am.displayName}
              </p>
              {!editing && (
                <button
                  type="button"
                  onClick={() => {
                    setNameInput(needsDisplayName(player) ? "" : displayName);
                    setEditing(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-brand-accent"
                >
                  <Pencil size={12} />
                  {am.editProfile}
                </button>
              )}
            </div>

            {editing ? (
              <form onSubmit={saveName} className="space-y-3">
                <p className="text-xs text-gray-400">{am.setYourNameHint}</p>
                <input
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  placeholder={am.setYourName}
                  maxLength={40}
                  className="w-full rounded-xl bg-black/40 border border-white/10 px-4 py-3 text-sm outline-none focus:border-brand-primary"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 rounded-xl bg-brand-primary py-2.5 text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  >
                    {saving ? am.saving : am.saveName}
                  </button>
                  {!needsDisplayName(player) && (
                    <button
                      type="button"
                      onClick={() => setEditing(false)}
                      className="px-4 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest text-gray-400"
                    >
                      {am.back}
                    </button>
                  )}
                </div>
              </form>
            ) : (
              <p className="text-sm font-bold text-white">{displayName}</p>
            )}
          </div>

          <div className="relative z-10 flex gap-2 mb-6">
            <button
              onClick={() => router.push("/wallet")}
              className="flex-1 rounded-2xl bg-brand-primary/20 border border-brand-primary/30 py-3 text-xs font-black uppercase tracking-widest text-brand-accent"
            >
              {am.walletTitle}
            </button>
            <button
              onClick={() => signOut()}
              className="flex-1 rounded-2xl bg-white/5 border border-white/10 py-3 text-xs font-black uppercase tracking-widest text-gray-300"
            >
              {am.signOut}
            </button>
          </div>

          <div className="relative z-10 grid grid-cols-3 gap-3 mb-8">
            {[
              { label: am.wins, value: profile?.totalWins ?? 0, color: "text-emerald-400" },
              {
                label: am.earnings,
                value: `${Number(profile?.totalEarnings ?? 0).toLocaleString()} ${am.etb}`,
                color: "text-brand-accent",
              },
              { label: am.games, value: profile?.totalGames ?? 0, color: "text-brand-secondary" },
            ].map((stat, i) => (
              <div
                key={i}
                className="bg-white/[0.02] border border-white/5 p-4 rounded-2xl text-center group hover:bg-white/[0.04] transition-colors"
              >
                <p className={`text-lg font-black tracking-tighter mb-0.5 ${stat.color}`}>
                  {stat.value}
                </p>
                <p className="text-[9px] font-black tracking-[0.2em] text-gray-500 uppercase">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <div className="relative z-10 flex justify-around gap-1 mb-6 bg-black/20 p-1 rounded-2xl border border-white/5">
            {[
              { key: "wins", label: am.myWins, icon: <Trophy size={14} /> },
              { key: "transactions", label: am.transactions, icon: <CreditCard size={14} /> },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as TabType)}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-black text-[10px] uppercase tracking-[0.2em] transition-all duration-300 ${
                  activeTab === tab.key
                    ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                    : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative z-10 min-h-[300px]">
            {activeTab === "transactions" && (
              <div className="space-y-3">
                {transactions.length === 0 && (
                  <div className="text-center text-gray-500 py-12 font-black uppercase tracking-widest text-[10px] opacity-40">
                    {am.noRecords}
                  </div>
                )}
                {transactions.map((t) => {
                  const direction = inferDirection(t);
                  const isCredit = direction === "credit";
                  const amountColor = isCredit ? "text-emerald-400" : "text-rose-400";
                  const prefix = isCredit ? "+" : "-";

                  return (
                    <div
                      key={`${t.id}-${t.date}`}
                      className="bg-white/[0.02] hover:bg-white/[0.04] rounded-2xl p-4 border border-white/[0.03] flex justify-between items-center transition-colors"
                    >
                      <div>
                        <p className="font-black text-sm tracking-tight capitalize text-white mb-0.5">
                          {t.type}
                        </p>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          {formatDate(t.date)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`font-black text-sm tracking-tighter ${amountColor}`}>
                          {prefix}
                          {formatCurrency(Math.abs(t.amount))}
                        </p>
                        <p
                          className={`text-[9px] font-black uppercase tracking-widest mt-1 ${
                            t.status === "Completed"
                              ? "text-emerald-500/80"
                              : t.status === "Pending"
                                ? "text-brand-accent/80"
                                : "text-rose-500/80"
                          }`}
                        >
                          {translateTransactionStatus(t.status)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === "wins" && (
              <>
                {wins.length === 0 ? (
                  <div className="text-center text-gray-500 py-16 opacity-40">
                    <Trophy className="mx-auto mb-4 opacity-50" size={48} />
                    <p className="font-black uppercase tracking-widest text-[10px]">
                      {am.victoryStartsHere}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {wins.map((win) => (
                      <div
                        key={`${win.id}-${win.date}`}
                        className="bg-white/[0.02] border border-white/5 rounded-[1.5rem] p-5 hover:bg-white/[0.04] transition-all"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-brand-secondary font-black text-sm tracking-tight">
                                {win.game ?? am.gameLabel(String(win.gameId ?? win.id))}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-white/20" />
                              <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                {formatDate(win.date)}
                              </span>
                            </div>
                            <p className="text-emerald-400 font-black text-xl tracking-tighter">
                              {`+${formatCurrency(win.amount)}`}
                            </p>
                          </div>
                          {win.bet && (
                            <div className="text-right bg-white/[0.05] border border-white/5 px-3 py-1.5 rounded-xl">
                              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-0.5">
                                {am.stake}
                              </p>
                              <p className="text-[11px] font-black text-white">
                                {formatCurrency(win.bet)}
                              </p>
                            </div>
                          )}
                        </div>
                        {win.pattern && (
                          <div className="inline-flex items-center gap-2 bg-brand-accent/10 border border-brand-accent/20 px-3 py-1 rounded-full">
                            <span className="text-brand-accent text-[9px] font-black uppercase tracking-tighter">
                              {am.winningPatternLabel(win.pattern)}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
