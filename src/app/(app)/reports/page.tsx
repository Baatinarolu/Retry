"use client";

import { Filters } from "@/components/Filters";
import { Banner, Button, Card } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { APP_NAME } from "@/lib/constants";
import { formatMoney, formatPct } from "@/lib/format";
import { useEffect, useState } from "react";

export default function ReportsPage() {
  const ws = useWorkspace();
  const [report, setReport] = useState<any>(null);
  const [preview, setPreview] = useState<any>(null);
  const [csv, setCsv] = useState("");
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (ws.loading) return;
    fetch(`/api/reports?${ws.qs}`).then((r) => r.json()).then(setReport);
  }, [ws.loading, ws.qs]);

  async function previewImport() {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, accountId }),
    });
    setPreview(await res.json());
  }

  async function commitImport() {
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commit: true, rows: preview.preview, accountId }),
    });
    const d = await res.json();
    setMessage(`Imported ${d.imported}. Rejected ${d.rejected?.length || 0}. Failed rows are never dropped silently.`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Reports &amp; data</h1>
          <p className="text-sm text-[var(--muted)]">Print-friendly review, CSV/JSON export, and validated import.</p>
        </div>
        <div className="flex gap-2 no-print">
          <a className="btn btn-ghost" href={`/api/export?format=csv&${ws.qs}`}>CSV export</a>
          <a className="btn btn-ghost" href={`/api/export?format=json&${ws.qs}`}>JSON backup</a>
          <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>
      <Card className="no-print">
        <Filters value={ws.filters} onChange={ws.setFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
      </Card>
      {report ? (
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{APP_NAME}</p>
          <h2 className="text-xl font-semibold">Performance report</h2>
          <p className="text-sm text-[var(--muted)]">Generated {new Date(report.generatedAt).toLocaleString()} · n={report.sampleSize}</p>
          <div className="mt-4 grid gap-2 md:grid-cols-4 text-sm">
            <div className="card-quiet p-3">Net {formatMoney(report.stats.netPnl, ws.currency)}</div>
            <div className="card-quiet p-3">Win rate {formatPct(report.stats.winRate)}</div>
            <div className="card-quiet p-3">PF {report.stats.profitFactor ?? "n/a"}</div>
            <div className="card-quiet p-3">Exp {report.stats.expectancyR ?? "n/a"}R</div>
          </div>
          <ul className="mt-4 space-y-2 text-sm">
            {report.insights.map((i: any) => (
              <li key={i.title}><strong>{i.title}.</strong> {i.body}</li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-[var(--muted)]">{report.disclaimer}</p>
        </Card>
      ) : null}

      <Card className="no-print space-y-3">
        <h2 className="font-semibold">CSV import</h2>
        <p className="text-sm text-[var(--muted)]">
          Map common broker columns (symbol, side, open_time, open, close, volume, pnl). Preview before save. Duplicates are flagged.
        </p>
        <select className="select" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">Default account</option>
          {ws.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <textarea className="textarea min-h-40 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="symbol,side,open_time,open,close,volume,pnl" />
        <div className="flex gap-2">
          <Button onClick={previewImport}>Preview</Button>
          {preview ? <Button variant="ghost" onClick={commitImport}>Commit valid rows</Button> : null}
        </div>
        {preview ? (
          <div className="text-sm">
            <p>Valid {preview.valid} · flagged {preview.rejected}</p>
            <div className="table-wrap mt-2">
              <table className="data">
                <thead><tr><th>Line</th><th>Instrument</th><th>Issues</th></tr></thead>
                <tbody>
                  {(preview.preview || []).map((r: any) => (
                    <tr key={r.line}>
                      <td>{r.line}</td>
                      <td>{r.data.instrument}</td>
                      <td>{r.duplicate ? "duplicate" : r.errors.join(", ") || "ok"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
        {message ? <Banner tone="good">{message}</Banner> : null}
      </Card>
    </div>
  );
}
