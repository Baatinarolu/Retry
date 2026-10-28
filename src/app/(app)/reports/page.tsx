"use client";

import { Filters } from "@/components/Filters";
import { ImportMappingPresets } from "@/components/ImportMappingPresets";
import { ReportingErrorBanner } from "@/components/ReportingErrorBanner";
import { FxConversionNotice } from "@/components/FxConversionNotice";
import { Banner, Button, Card } from "@/components/ui";
import { useWorkspace } from "@/components/useWorkspace";
import { APP_NAME } from "@/lib/constants";
import { parseCsv } from "@/lib/csv";
import { formatMoney, formatPct } from "@/lib/format";
import type { ImportColumnMapping } from "@/lib/import-mapping";
import { useEffect, useMemo, useState } from "react";

export default function ReportsPage() {
  const ws = useWorkspace();
  const [report, setReport] = useState<any>(null);
  const [reportError, setReportError] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const [csv, setCsv] = useState("");
  const [mapping, setMapping] = useState<ImportColumnMapping>({});
  const [fileName, setFileName] = useState("import.csv");
  const [accountId, setAccountId] = useState("");
  const [message, setMessage] = useState("");
  const [importError, setImportError] = useState("");
  const [committedBatchId, setCommittedBatchId] = useState("");
  const headers = useMemo(() => {
    if (!csv.trim()) return [];
    try {
      return parseCsv(csv).headers;
    } catch {
      return [];
    }
  }, [csv]);

  useEffect(() => {
    if (ws.loading) return;
    let cancelled = false;
    fetch(`/api/reports?${ws.qs}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not build the report");
        return data;
      })
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setReportError("");
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setReport(null);
          setReportError(cause instanceof Error ? cause.message : "Could not build the report");
        }
      });
    return () => { cancelled = true; };
  }, [ws.loading, ws.qs]);

  function changeMapping(next: ImportColumnMapping) {
    setMapping(next);
    setPreview(null);
  }

  async function previewImport() {
    setImportError("");
    setMessage("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, accountId, fileName, mapping }),
    });
    const data = await res.json();
    if (!res.ok) {
      setPreview(null);
      setImportError(data.error || "Could not preview import");
      return;
    }
    setPreview(data);
    setMapping(data.columnMapping || {});
  }

  async function commitImport() {
    if (!preview?.batchId) return;
    setImportError("");
    const res = await fetch("/api/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ commit: true, batchId: preview.batchId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error || "Import failed; no valid rows were partially committed");
      return;
    }
    setCommittedBatchId(data.batchId);
    setMessage(`Imported ${data.imported} of ${data.tradeRecords} trade records. Rejected ${data.rejected?.length || 0}. The batch committed atomically.`);
  }

  async function rollbackImport() {
    if (!committedBatchId || !confirm("Delete every trade created by this import batch and rebuild its account balance?")) return;
    const res = await fetch(`/api/import?id=${encodeURIComponent(committedBatchId)}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setImportError(data.error || "Could not roll back import");
      return;
    }
    setMessage(`Rolled back ${data.deleted} imported trades. The original CSV and reconciliation record remain stored.`);
    setCommittedBatchId("");
    setPreview(null);
  }

  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Archive / Portable records</p>
          <h1>Reports &amp; data</h1>
          <p className="page-description">A print-friendly review, CSV/JSON export, and validated import. Your journal remains portable.</p>
        </div>
        <div className="flex gap-2 no-print">
          <a className="btn btn-ghost" href={`/api/export?format=csv&${ws.qs}`}>CSV export</a>
          <a className="btn btn-ghost" href={`/api/export?format=json&${ws.qs}`}>Trade JSON</a>
          <a className="btn btn-ghost" href="/api/backup">Full backup</a>
          <Button variant="ghost" onClick={() => window.print()}>Print / PDF</Button>
        </div>
      </div>
      <section className="filter-panel no-print" aria-label="Report filters">
        <Filters value={ws.filters} onChange={ws.setFilters} accounts={ws.accounts} instruments={ws.instruments} strategies={ws.strategies} />
      </section>
      {reportError ? <ReportingErrorBanner message={reportError} /> : null}
      {report ? (
        <Card>
          <p className="text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{APP_NAME}</p>
          <h2 className="text-xl font-semibold">Performance report</h2>
          <p className="text-sm text-[var(--muted)]">Generated {new Date(report.generatedAt).toLocaleString()} · n={report.sampleSize}</p>
          <div className="mt-3"><FxConversionNotice conversion={report.conversion} /></div>
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
          Common broker columns map automatically; add explicit mappings below and save them as reusable presets. Exact source IDs or row hashes make retries idempotent; repeated trades with different content are not rejected as look-alikes.
        </p>
        <p className="text-xs text-[var(--muted)]">
          Execution CSV: include <code>trade_id</code> (or <code>position_id</code>) on every fill plus <code>execution_type</code> = entry, scale_in, scale_out, or exit. Fills in one group become one execution-led trade. The original CSV is retained with the batch for reconciliation and rollback.
        </p>
        <select className="select" value={accountId} onChange={(e) => { setAccountId(e.target.value); setPreview(null); }}>
          <option value="">Default account</option>
          {ws.accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <input className="input" type="file" accept=".csv,text/csv" onChange={async (event) => {
          const file = event.target.files?.[0];
          if (file) {
            setCsv(await file.text());
            setFileName(file.name);
            setPreview(null);
          }
        }} />
        <textarea className="textarea min-h-40 font-mono text-xs" value={csv} onChange={(e) => { setCsv(e.target.value); setPreview(null); }} placeholder="symbol,side,open_time,open,close,volume,pnl" />
        <ImportMappingPresets headers={headers} value={mapping} onChange={changeMapping} />
        <div className="flex flex-wrap gap-2">
          <Button onClick={previewImport}>Preview</Button>
          {preview ? <Button variant="ghost" onClick={commitImport}>Commit valid rows atomically</Button> : null}
          {committedBatchId ? <Button variant="ghost" onClick={rollbackImport}>Roll back last batch</Button> : null}
        </div>
        {importError ? <Banner tone="warn">{importError}</Banner> : null}
        {preview ? (
          <div className="text-sm">
            <p>Valid {preview.valid} · flagged {preview.rejected} · {preview.sourceRows} source rows → {preview.tradeRecords} trade records{preview.executionMode ? " · execution grouping" : ""}</p>
            {Object.keys(preview.columnMapping || {}).length ? <p className="mt-1 text-xs text-[var(--muted)]">{Object.keys(preview.columnMapping).length} explicit column mappings retained with this batch.</p> : null}
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
