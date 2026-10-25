"use client";

import { Filters } from "@/components/Filters";
import { Banner, Button, Card, Empty, Input, Spinner } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { formatMoney, formatR, formatWhen, pnlClass, resultBadge } from "@/lib/format";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function JournalPage() {
  const ws = useWorkspace();
  const { loading: workspaceLoading, loadTrades } = ws;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ trades: any[]; total: number } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (workspaceLoading) return;
    const controller = new AbortController();
    loadTrades(page, `q=${encodeURIComponent(q)}`, controller.signal)
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
  }, [workspaceLoading, loadTrades, page, q]);

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
        <Filters value={ws.filters} onChange={(f) => { ws.setFilters(f); setPage(1); }} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
        <div className="mt-4 border-t border-[var(--line)] pt-4">
          <Input aria-label="Search trades" placeholder="Search instrument, ID, notes…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </div>
      </section>
      {ws.error || error ? <Banner tone="warn">{ws.error || error}</Banner> : null}
      {!data && !error ? <Spinner /> : null}
      {data && data.trades.length === 0 ? (
        <Empty title="No trades" body="Nothing matches these filters." action={<Link href="/trades/new" className="btn btn-primary">Record first trade</Link>} />
      ) : null}
      {data && data.trades.length > 0 ? (
        <Card className="overflow-hidden p-0">
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>When</th>
                  <th>Instrument</th>
                  <th>Dir</th>
                  <th>Net</th>
                  <th>R</th>
                  <th>Result</th>
                  <th>Plan</th>
                </tr>
              </thead>
              <tbody>
                {data.trades.map((t) => {
                  const b = resultBadge(t.result);
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/trades/${t.id}`}>
                          {t.displayId}
                        </Link>
                      </td>
                      <td>{formatWhen(t.entryAt)}</td>
                      <td>{t.instrument}</td>
                      <td className="capitalize">{t.direction}</td>
                      <td className={`font-mono-num ${pnlClass(t.netPnl)}`}>{formatMoney(t.netPnl, ws.currency)}</td>
                      <td className="font-mono-num">{formatR(t.rMultiple)}</td>
                      <td><span className={`badge ${b.className}`}>{b.label}</span></td>
                      <td>{t.followedPlan ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-4 py-3 text-sm text-[var(--muted)]">
            <span>{data.total} trades</span>
            <div className="flex gap-2">
              <Button variant="ghost" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
              <Button variant="ghost" disabled={page * 25 >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
