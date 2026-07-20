"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { apiClient } from "../../lib/api";
import { useAuth } from "../../context/AuthContext";
import { am, formatBirr, translateTransactionStatus } from "../../constants/amharic";
import TopBar from "../../components/TopBar";
import { formatPhoneDisplay, getDisplayName } from "../../lib/player";
import { toast } from "react-toastify";

type Mode = "deposit" | "withdraw";

type DepositSteps = {
  methodTitle: string;
  amount: number;
  paymentPhone: string;
  steps: string[];
  note: string;
};

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
  const [depositGuide, setDepositGuide] = useState<DepositSteps | null>(null);
  const [config, setConfig] = useState<{
    minDeposit: number;
    minWithdraw: number;
    maxWithdraw: number;
    minBalanceAfterWithdraw?: number;
    minFirstDeposit?: number;
    minGamesBeforeWithdraw?: number;
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
      if (cfg.success && cfg.data) {
        setConfig(cfg.data);
        if (cfg.data.methods[0]?.id) setMethod(cfg.data.methods[0].id);
      }
    };
    load();
  }, []);

  const pending = useMemo(
    () => requests.filter((r) => String(r.status).toLowerCase() === "pending"),
    [requests]
  );
  const history = useMemo(
    () => requests.filter((r) => String(r.status).toLowerCase() !== "pending"),
    [requests]
  );

  const selectedMethod = config?.methods.find((m) => m.id === method);
  const presets = mode === "deposit" ? DEPOSIT_PRESETS : WITHDRAW_PRESETS;
  const numericAmount = Number(amount);
  const balance = Number(user?.balance ?? 0);

  const copyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      toast.success(am.copied);
    } catch {
      toast.info(phone);
    }
  };

  const validate = (): string | null => {
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return am.walletRequestFailed;
    }
    if (mode === "deposit") {
      const min = config?.minDeposit || 50;
      if (numericAmount < min) return am.minDepositHint(min);
    } else {
      const min = config?.minWithdraw || 50;
      const max = config?.maxWithdraw || 300;
      if (numericAmount < min || numericAmount > max) {
        return am.withdrawRangeHint(min, max);
      }
      if (numericAmount > balance) {
        return `Insufficient balance (${balance} ETB)`;
      }
      const minLeft = config?.minBalanceAfterWithdraw ?? 20;
      if (balance - numericAmount < minLeft) {
        return am.keepMinBalance;
      }
    }
    return null;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      if (mode === "deposit") {
        const res = await apiClient.createDeposit(numericAmount, method);
        if (!res.success || !res.data) {
          setError(res.error || am.walletRequestFailed);
          return;
        }
        setSuccess(am.depositStepCreated);
        if (res.data.steps) {
          setDepositGuide(res.data.steps);
        } else {
          setDepositGuide({
            methodTitle: method === "cbe" ? "CBE Birr" : "Telebirr",
            amount: res.data.amount,
            paymentPhone: res.data.paymentPhone,
            steps: [
              `Send exactly ${res.data.amount} ETB to ${res.data.paymentPhone}`,
              "Wait for admin approval",
            ],
            note: am.sendExactAmount,
          });
        }
      } else {
        const res = await apiClient.createWithdraw(numericAmount);
        if (!res.success || !res.data) {
          setError(res.error || am.walletRequestFailed);
          return;
        }
        setSuccess(am.withdrawSubmitted);
        setDepositGuide(null);
        await refreshUser();
      }
      await loadRequests();
    } catch {
      setError(am.walletRequestFailed);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-bg text-white">
      <TopBar title={am.walletTitle} />

      <div className="px-4 pt-4 max-w-lg mx-auto space-y-5 pb-10">
        {/* Balance */}
        <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-brand-primary/15 via-transparent to-brand-accent/5 p-5">
          <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-1">
            {am.availableBalance}
          </p>
          <p className="text-3xl font-black text-brand-accent">{formatBirr(balance)}</p>
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{getDisplayName(user)}</p>
              <p className="text-[11px] text-gray-500">{formatPhoneDisplay(user?.phoneNumber)}</p>
            </div>
            {pending.length > 0 && (
              <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-300">
                {pending.length} {am.pendingRequests}
              </span>
            )}
          </div>
        </section>

        {/* Mode tabs */}
        <section className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-black/30 border border-white/5">
          {(["deposit", "withdraw"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
                setSuccess(null);
                setDepositGuide(null);
                setAmount(m === "deposit" ? "100" : "50");
              }}
              className={`rounded-xl py-3 text-xs font-black uppercase tracking-widest transition ${
                mode === m
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {m === "deposit" ? am.deposit : am.withdraw}
            </button>
          ))}
        </section>

        {/* Form */}
        <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 space-y-5">
          <div>
            <h2 className="text-sm font-black tracking-tight mb-1">
              {mode === "deposit" ? am.depositHowTo : am.withdrawHowTo}
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              {mode === "deposit" ? am.sendExactAmount : am.withdrawHint}
            </p>
          </div>

          {mode === "deposit" && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
                {am.paymentMethod}
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(config?.methods || [
                  { id: "telebirr", label: "Telebirr", phone: null },
                  { id: "cbe", label: "CBE Birr", phone: null },
                ]).map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setMethod(m.id);
                      setDepositGuide(null);
                    }}
                    className={`rounded-2xl border px-3 py-3 text-left transition ${
                      method === m.id
                        ? "border-brand-accent bg-brand-accent/10"
                        : "border-white/10 bg-black/20"
                    }`}
                  >
                    <p
                      className={`text-xs font-black ${
                        method === m.id ? "text-brand-accent" : "text-gray-300"
                      }`}
                    >
                      {m.label}
                    </p>
                    {m.phone && (
                      <p className="text-[10px] text-gray-500 mt-1 font-mono truncate">{m.phone}</p>
                    )}
                  </button>
                ))}
              </div>
              {selectedMethod?.phone && (
                <button
                  type="button"
                  onClick={() => copyPhone(selectedMethod.phone!)}
                  className="mt-2 text-[10px] font-black uppercase tracking-widest text-brand-secondary"
                >
                  {am.copyPhone}: {selectedMethod.phone}
                </button>
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">
              {am.selectAmount}
            </label>
            <div className="grid grid-cols-5 gap-2 mb-3">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setAmount(String(p))}
                  className={`rounded-xl py-2 text-xs font-black border ${
                    amount === String(p)
                      ? "border-brand-primary bg-brand-primary/20 text-white"
                      : "border-white/10 text-gray-400"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                min={mode === "deposit" ? config?.minDeposit || 50 : config?.minWithdraw || 50}
                max={mode === "withdraw" ? config?.maxWithdraw || 300 : undefined}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-2xl bg-black/30 border border-white/10 px-4 py-3.5 pr-14 outline-none focus:border-brand-primary"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-500">
                {am.etb}
              </span>
            </div>
            <p className="mt-2 text-[10px] text-gray-500">
              {mode === "deposit"
                ? am.minDepositHint(config?.minDeposit || 50)
                : am.withdrawRangeHint(config?.minWithdraw || 50, config?.maxWithdraw || 300)}
            </p>
          </div>

          <form onSubmit={submit}>
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
          </form>

          {error && (
            <p className="text-xs text-rose-400 text-center leading-relaxed">{error}</p>
          )}
          {success && (
            <p className="text-xs text-emerald-400 text-center leading-relaxed">{success}</p>
          )}
        </section>

        {/* Deposit payment guide */}
        {mode === "deposit" && depositGuide && (
          <section className="rounded-3xl border border-emerald-400/20 bg-emerald-500/5 p-5 space-y-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400 mb-1">
                {am.depositHowTo}
              </p>
              <p className="text-sm font-bold text-white">
                {am.paymentTo} · {depositGuide.methodTitle}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/30 px-4 py-3">
              <div>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                  {am.amount}
                </p>
                <p className="text-lg font-black text-brand-accent">
                  {depositGuide.amount} {am.etb}
                </p>
              </div>
              <div className="text-right min-w-0">
                <p className="text-[10px] text-gray-500 uppercase tracking-widest font-black">
                  {am.paymentTo}
                </p>
                <p className="text-sm font-mono font-bold truncate">{depositGuide.paymentPhone}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyPhone(depositGuide.paymentPhone)}
              className="w-full rounded-xl border border-white/10 py-2.5 text-[10px] font-black uppercase tracking-widest text-brand-secondary"
            >
              {am.copyPhone}
            </button>

            <ol className="space-y-2">
              {depositGuide.steps.map((step, i) => (
                <li key={i} className="flex gap-3 text-xs text-gray-300 leading-relaxed">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-black">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="text-[11px] text-amber-300/90">{depositGuide.note}</p>
          </section>
        )}

        {/* Pending */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            {am.pendingRequests}
          </h2>
          <div className="space-y-2">
            {pending.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-4 border border-dashed border-white/10 rounded-2xl">
                {am.noPending}
              </p>
            )}
            {pending.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between rounded-2xl border border-amber-400/20 bg-amber-500/5 px-4 py-3"
              >
                <div>
                  <p className="text-sm font-bold">
                    {r.type === "deposit" ? am.deposit : am.withdraw} · {formatBirr(r.amount)}
                  </p>
                  <p className="text-[10px] text-gray-500">
                    {new Date(r.createdAt).toLocaleString("am-ET")}
                  </p>
                </div>
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-300">
                  {translateTransactionStatus(r.status)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* History */}
        <section>
          <h2 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
            {am.walletHistory}
          </h2>
          <div className="space-y-2">
            {history.length === 0 && (
              <p className="text-sm text-gray-600 text-center py-4">{am.noRequests}</p>
            )}
            {history.map((r) => (
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
        </section>
      </div>
    </div>
  );
}
