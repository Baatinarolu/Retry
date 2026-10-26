"use client";

import { ActiveJournalFilters } from "@/components/ActiveJournalFilters";
import { BulkReviewBar } from "@/components/BulkReviewBar";
import { Filters } from "@/components/Filters";
import { JournalTableSettings } from "@/components/JournalTableSettings";
import { Banner, Button, Card, Empty, Input, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { emptyFilters, type FilterState } from "@/lib/filter-state";
import { formatMoney, formatR, formatWhen, pnlClass, resultBadge } from "@/lib/format";
import {
  activeJournalFilters,
  defaultJournalPreferences,
  JOURNAL_COLUMNS,
  normalizeJournalPreferences,
  type ActiveJournalFilter,
  type JournalColumnId,
  type JournalPreferences,
} from "@/lib/journal-view";
import Link from "next/link";
import { useEffect, useState } from "react";

const PREFERENCES_KEY = "tm-journal-table-v1";

type JournalTrade = {
  id: string;
  displayId: string;
  entryAt: string;
  instrument: string;
  direction: string;
  strategyName: string | null;
  accountCurrency: string | null;
  netPnl: string;
  rMultiple: string | null;
  result: string;
  followedPlan: boolean;
  reviewStatus: string;
  screenshotCount: number;
  tags?: Array<{ id: string; name: string }>;
};

export default function JournalPage() {
  const ws = useWorkspace();
  const { loading: workspaceLoading, loadTrades } = ws;
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [data, setData] = useState<{ trades: JournalTrade[]; total: number } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preferences, setPreferences] = useState<JournalPreferences>(defaultJournalPreferences);
  const [preferenceError, setPreferenceError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = localStorage.getItem(PREFERENCES_KEY);
        if (saved) setPreferences(normalizeJournalPreferences(JSON.parse(saved)));
      } catch {
        try {
          localStorage.removeItem(PREFERENCES_KEY);
        } catch {
          // Storage can be unavailable entirely; the default table still works.
        }
        setPreferenceError("Table preferences could not be restored; defaults are in use.");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (workspaceLoading) return;
    const controller = new AbortController();
    loadTrades(page, `q=${encodeURIComponent(query)}`, controller.signal)
      .then((result) => {
        setData(result);
        setError("");
      })
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load trades");
        }
      });
    return () => controller.abort();
  }, [workspaceLoading, loadTrades, page, query, reload]);

  function changePreferences(next: JournalPreferences) {
    setPreferences(next);
    try {
      localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
      setPreferenceError("");
    } catch {
      setPreferenceError("Table preferences work for this session but could not be saved in this browser.");
    }
  }

  function changeFilters(next: FilterState) {
    ws.setFilters(next);
    setPage(1);
    setSelected(new Set());
    setNotice("");
  }

  function clearSelection() {
    setSelected(new Set());
  }

  function removeActiveFilter(key: ActiveJournalFilter["key"]) {
    if (key === "query") {
      setSearchInput("");
      setQuery("");
      setPage(1);
      clearSelection();
      return;
    }
    changeFilters({ ...ws.filters, [key]: "" });
  }

  function clearAllFilters() {
    changeFilters(emptyFilters);
    setSearchInput("");
    setQuery("");
    setPage(1);
  }

  function toggleTrade(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePage() {
    if (!data) return;
    setSelected((current) => {
      const next = new Set(current);
      const allSelected = data.trades.length > 0 && data.trades.every((trade) => next.has(trade.id));
      data.trades.forEach((trade) => {
        if (allSelected) next.delete(trade.id);
        else next.add(trade.id);
      });
      return next;
    });
  }

  function goToPage(next: number) {
    setPage(next);
    clearSelection();
    setNotice("");
  }

  const visibleColumns = JOURNAL_COLUMNS.filter((column) => preferences.columns.includes(column.id));
  const hasActiveFilters = activeJournalFilters(ws.filters, query).length > 0;
  const allVisibleSelected = Boolean(data?.trades.length) && data!.trades.every((trade) => selected.has(trade.id));

  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">The complete record / Trade ledger</p>
          <h1>Trade journal</h1>
          <p className="page-description">Search, filter, and open any stored trade. Every row is a decision worth reviewing.</p>
        </div>
        <Link href="/trades/new" className="btn btn-primary">Add trade</Link>
      </div>
      <section className="filter-panel" aria-label="Trade filters">
        <Filters value={ws.filters} onChange={changeFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <Input
            aria-label="Search trades"
            placeholder="Search instrument, ID, notes, strategy, or tag…"
            maxLength={120}
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              clearSelection();
              setNotice("");
            }}
          />
        </div>
        <div className="mt-4">
          <ActiveJournalFilters
            filters={ws.filters}
            query={query}
            accounts={ws.accounts}
            strategies={ws.strategies}
            onRemove={removeActiveFilter}
            onClear={clearAllFilters}
          />
        </div>
      </section>
      {ws.error || error ? <Banner tone="warn">{ws.error || error}</Banner> : null}
      {notice ? <Banner tone="good">{notice}</Banner> : null}
      {!data && !error ? <Spinner /> : null}
      {data && data.trades.length === 0 ? (
        <Empty
          title={hasActiveFilters ? "No matching trades" : "No trades"}
          body={hasActiveFilters ? "Nothing matches the active search and filters." : "Your stored trades will appear here."}
          action={hasActiveFilters
            ? <Button variant="ghost" onClick={clearAllFilters}>Clear filters</Button>
            : <Link href="/trades/new" className="btn btn-primary">Record first trade</Link>}
        />
      ) : null}
      {data && data.trades.length > 0 ? (
        <Card className="overflow-visible p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
            <div>
              <h2 className="text-xl">Stored trades</h2>
              <p className="mt-1 text-xs text-[var(--muted)]">Select rows on this page for a bulk review update.</p>
            </div>
            <JournalTableSettings value={preferences} onChange={changePreferences} />
          </div>
          {preferenceError ? <div className="px-4 pt-3"><Banner tone="warn">{preferenceError}</Banner></div> : null}
          {selected.size ? (
            <BulkReviewBar
              selectedIds={[...selected]}
              onClear={clearSelection}
              onCompleted={(count) => {
                clearSelection();
                setNotice(`${count} ${count === 1 ? "trade review" : "trade reviews"} updated.`);
                setPage(1);
                setReload((value) => value + 1);
              }}
            />
          ) : null}
          <div className="table-wrap">
            <table className={preferences.density === "compact" ? "data journal-compact" : "data"}>
              <thead>
                <tr>
                  <th className="w-10">
                    <input type="checkbox" aria-label="Select all trades on this page" checked={allVisibleSelected} onChange={togglePage} />
                  </th>
                  {visibleColumns.map((column) => <th key={column.id}>{column.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.trades.map((trade) => (
                  <tr key={trade.id} aria-selected={selected.has(trade.id)}>
                    <td>
                      <input type="checkbox" aria-label={`Select ${trade.displayId}`} checked={selected.has(trade.id)} onChange={() => toggleTrade(trade.id)} />
                    </td>
                    {visibleColumns.map((column) => <JournalCell key={column.id} column={column.id} trade={trade} currency={ws.currency} />)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--line)] px-4 py-3 text-sm text-[var(--muted)]">
            <span>{data.total} trades · page {page} of {Math.max(1, Math.ceil(data.total / 25))}</span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page === 1} onClick={() => goToPage(page - 1)}>Prev</Button>
              <Button variant="ghost" disabled={page * 25 >= data.total} onClick={() => goToPage(page + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function JournalCell({ column, trade, currency }: { column: JournalColumnId; trade: JournalTrade; currency: string }) {
  if (column === "id") return <td><Link href={`/trades/${trade.id}`}>{trade.displayId}</Link></td>;
  if (column === "when") return <td className="whitespace-nowrap">{formatWhen(trade.entryAt)}</td>;
  if (column === "instrument") return <td>{trade.instrument}</td>;
  if (column === "direction") return <td className="capitalize">{trade.direction}</td>;
  if (column === "strategy") return <td>{trade.strategyName || "—"}</td>;
  if (column === "tags") {
    const tags = trade.tags || [];
    return (
      <td title={tags.map((tag) => tag.name).join(", ") || undefined}>
        <div className="flex max-w-64 flex-wrap gap-1">
          {tags.slice(0, 2).map((tag) => <span className="badge" key={tag.id}>{tag.name}</span>)}
          {tags.length > 2 ? <span className="badge">+{tags.length - 2}</span> : null}
          {!tags.length ? "—" : null}
        </div>
      </td>
    );
  }
  if (column === "screenshots") {
    return <td>{trade.screenshotCount ? <Link href={`/trades/${trade.id}#chart-screenshots`}>{trade.screenshotCount}</Link> : "—"}</td>;
  }
  if (column === "net") return <td className={`font-mono-num ${pnlClass(trade.netPnl)}`}>{formatMoney(trade.netPnl, trade.accountCurrency || currency)}</td>;
  if (column === "r") return <td className="font-mono-num">{formatR(trade.rMultiple)}</td>;
  if (column === "result") {
    const badge = resultBadge(trade.result);
    return <td><span className={`badge ${badge.className}`}>{badge.label}</span></td>;
  }
  if (column === "plan") return <td>{trade.followedPlan ? "Yes" : "No"}</td>;
  return (
    <td className="whitespace-nowrap text-xs text-[var(--muted)]">
      {trade.reviewStatus === "needs_follow_up" ? "Follow-up" : trade.reviewStatus === "reviewed" ? "Reviewed" : "Unreviewed"}
    </td>
  );
}
