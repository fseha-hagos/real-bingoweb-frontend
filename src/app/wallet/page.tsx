"use client";

import React, { FormEvent, useEffect, useState } from "react";
import { apiClient } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { am, formatBirr, translateTransactionStatus } from "../../constants/amharic";
import TopBar from "../../components/TopBar";
import { formatPhoneDisplay, getDisplayName } from "../../lib/player";

type Mode = "deposit" | "withdraw";

const DEPOSIT_PRESETS = [50, 100, 200, 500, 1000];
const WITHDRAW_PRESETS = [50, 100, 200, 300];

export default function WalletPage() {
  const { user, refreshUser } = useAuth();
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("100");
  const [method, setMethod] = useState("telebirr");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [config, setConfig] = useState<{
    minDeposit: number;
    minWithdraw: number;
    maxWithdraw: number;
    methods: { id: string; label: string; phone: string | null }[];
  } | null>(null);
  const [requests, setRequests] = useState<
    Array<{ id: string; type: string; amount: number; status: string; createdAt: string }>
  >([]);

  const loadRequests = async () => {
    const reqs = await apiClient.getWalletRequests();
    if (reqs.success && reqs.data) setRequests(reqs.data);
  };

  useEffect(() => {
    const load = async () => {
      const [cfg] = await Promise.all([apiClient.getWalletConfig(), loadRequests()]);
      if (cfg.success && cfg.data) setConfig(cfg.data);
    };
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setInstructions(null);
    setLoading(true);

    const value = Number(amount);
    try {
      if (mode === "deposit") {
        const res = await apiClient.createDeposit(value, method);
        if (!res.success || !res.data) {
          setError(res.error || am.walletRequestFailed);
          return;
        }
        setSuccess(am.depositSubmitted);
        setInstructions(res.data.instructions);
      } else {
        const res = await apiClient.createWithdraw(value);
        if (!res.success || !res.data) {
          setError(res.error || am.walletRequestFailed);
          return;
        }
        setSuccess(am.withdrawSubmitted);
        await refreshUser();
      }
      await loadRequests();
    } catch {
      setError(am.walletRequestFailed);
    } finally {
      setLoading(false);
    }
  };

  const presets = mode === "deposit" ? DEPOSIT_PRESETS : WITHDRAW_PRESETS;

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <TopBar title={am.walletTitle} />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-5">
        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-brand-primary/10 to-transparent p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
            {am.availableBalance}
          </p>
          <p className="text-3xl font-black text-brand-accent">
            {formatBirr(Number(user?.balance ?? 0))}
          </p>
          <p className="text-xs text-gray-400 mt-2 font-bold">
            {getDisplayName(user)}
          </p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {formatPhoneDisplay(user?.phoneNumber)}
          </p>
        </div>

        <div className="flex gap-2">
          {(["deposit", "withdraw"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError(null);
                setSuccess(null);
                setInstructions(null);
                setAmount(m === "deposit" ? "100" : "50");
              }}
              className={`flex-1 rounded-2xl py-3 text-xs font-black uppercase tracking-widest border ${
                mode === m
                  ? "bg-brand-primary border-brand-primary"
                  : "bg-white/5 border-white/10 text-gray-400"
              }`}
            >
              {m === "deposit" ? am.deposit : am.withdraw}
            </button>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 space-y-4"
        >
          {mode === "deposit" && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                {am.paymentMethod}
              </label>
              <div className="flex gap-2">
                {(
                  config?.methods || [
                    { id: "telebirr", label: "Telebirr" },
                    { id: "cbe", label: "CBE Birr" },
                  ]
                ).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex-1 rounded-xl py-2.5 text-xs font-bold border ${
                      method === m.id
                        ? "border-brand-accent text-brand-accent bg-brand-accent/10"
                        : "border-white/10 text-gray-400"
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
              {am.amount}
            </label>
            <div className="flex flex-wrap gap-2 mb-3">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black border ${
                    amount === String(p)
                      ? "border-brand-primary bg-brand-primary/20 text-white"
                      : "border-white/10 text-gray-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              type="number"
              min={mode === "deposit" ? config?.minDeposit || 50 : config?.minWithdraw || 50}
              max={mode === "withdraw" ? config?.maxWithdraw || 300 : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3 outline-none focus:border-brand-primary"
            />
            <p className="mt-2 text-[10px] text-gray-500">
              {mode === "deposit"
                ? am.minDepositHint(config?.minDeposit || 50)
                : am.withdrawRangeHint(config?.minWithdraw || 50, config?.maxWithdraw || 300)}
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-primary py-3.5 text-sm font-black uppercase tracking-widest disabled:opacity-50"
          >
            {loading
              ? am.submitting
              : mode === "deposit"
                ? am.requestDeposit
                : am.requestWithdraw}
          </button>

          {error && <p className="text-xs text-rose-400 text-center">{error}</p>}
          {success && <p className="text-xs text-emerald-400 text-center">{success}</p>}
          {instructions && (
            <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap border border-white/10 rounded-2xl p-4 bg-black/20">
              {instructions.replace(/<\/?[^>]+(>|$)/g, "")}
            </div>
          )}
        </form>

        <div className="pb-8">
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            {am.recentRequests}
          </h2>
          <div className="space-y-2">
            {requests.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-6">{am.noRequests}</p>
            )}
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold">
                    {r.type === "deposit" ? am.deposit : am.withdraw} · {formatBirr(r.amount)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(r.createdAt).toLocaleString("am-ET")}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-brand-accent">
                  {translateTransactionStatus(r.status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
