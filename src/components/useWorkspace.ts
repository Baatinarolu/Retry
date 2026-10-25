"use client";

import { apiJson } from "@/lib/client-api";
import { useCallback, useEffect, useState } from "react";
import { FilterState, filterQuery } from "./Filters";

export const emptyFilters: FilterState = {
  from: "",
  to: "",
  accountId: "",
  instrument: "",
  strategyId: "",
  direction: "",
  session: "",
};

type Account = { id: string; name: string; currency: string; currentBalance: string; startingBalance: string };
type Bootstrap = {
  accounts?: Account[];
  instruments?: { symbol: string }[];
  user?: { baseCurrency?: string } | null;
};
type StrategyResponse = { strategies?: { id: string; name: string }[] };

export function useWorkspace() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [instruments, setInstruments] = useState<{ symbol: string }[]>([]);
  const [strategies, setStrategies] = useState<{ id: string; name: string }[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [filters, setFilters] = useState<FilterState>(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiJson<Bootstrap>("/api/bootstrap", { signal: controller.signal }),
      apiJson<StrategyResponse>("/api/strategies", { signal: controller.signal }),
    ])
      .then(([boot, strat]) => {
        setAccounts(boot.accounts || []);
        setInstruments(boot.instruments || []);
        setStrategies(strat.strategies || []);
        setBaseCurrency(boot.user?.baseCurrency || "USD");
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Could not load workspace");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  const qs = filterQuery(filters);
  const loadAnalytics = useCallback(
    (signal?: AbortSignal) => apiJson<any>(`/api/analytics?${qs}`, { signal }),
    [qs],
  );
  const loadTrades = useCallback(
    (page = 1, extra = "", signal?: AbortSignal) =>
      apiJson<any>(`/api/trades?page=${page}&limit=25&${qs}&${extra}`, { signal }),
    [qs],
  );

  const selectedAccount = accounts.find((account) => account.id === filters.accountId);
  const commonAccountCurrency = accounts.length > 0 && accounts.every(
    (account) => account.currency.toUpperCase() === accounts[0].currency.toUpperCase(),
  )
    ? accounts[0].currency.toUpperCase()
    : null;
  const currency = selectedAccount?.currency.toUpperCase() ?? commonAccountCurrency ?? baseCurrency;

  return {
    accounts,
    instruments: instruments.map((instrument) => instrument.symbol),
    strategies,
    currency,
    filters,
    setFilters,
    loading,
    error,
    qs,
    loadAnalytics,
    loadTrades,
  };
}
