"use client";

import { FxConversionNotice } from "@/components/FxConversionNotice";
import { Banner, Button, Card, Empty, Field, Input, Spinner, Textarea } from "@/components/ui";
import { formatMoney, formatPct } from "@/lib/format";
import { useEffect, useState } from "react";

export default function StrategiesPage() {
  const [list, setList] = useState<any[]>([]);
  const [currency, setCurrency] = useState("USD");
  const [conversion, setConversion] = useState<any>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<any | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    marketConditions: "",
    confirmations: "",
    entryRules: "",
    stopLossRules: "",
    takeProfitRules: "",
    riskRules: "",
    invalidation: "",
    checklist: "",
  });
  const [loading, setLoading] = useState(true);

  function reload() {
    fetch("/api/strategies")
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not load strategy statistics");
        return data;
      })
      .then((data) => {
        setList(data.strategies || []);
        setCurrency(data.currency || "USD");
        setConversion(data.conversion || null);
        setError("");
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Could not load strategy statistics");
        setLoading(false);
      });
  }
  useEffect(reload, []);

  async function save(asNewVersion = false) {
    const payload = {
      ...form,
      checklist: form.checklist.split("\n").map((s) => s.trim()).filter(Boolean),
      id: open?.id,
      asNewVersion,
    };
    await fetch("/api/strategies", {
      method: open ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setOpen(null);
    setForm({ name: "", description: "", marketConditions: "", confirmations: "", entryRules: "", stopLossRules: "", takeProfitRules: "", riskRules: "", invalidation: "", checklist: "" });
    reload();
  }

  if (loading) return <Spinner />;

  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Playbooks / Versioned rules</p>
          <h1>Strategy Lab</h1>
          <p className="page-description">Performance is historical journal data for linked trades. Versioning preserves the rules you actually traded.</p>
        </div>
      </div>
      {error ? <Banner tone="warn">{error} Add the required dated rate in Settings → FX rates.</Banner> : null}
      <FxConversionNotice conversion={conversion} />
      <Banner>Creating a new version does not rewrite past trades — they stay attached to the version they were logged against.</Banner>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          {list.length === 0 ? <Empty title="No strategies" body="Document a playbook, then tag trades to it." /> : null}
          {list.filter((s) => !s.isArchived).map((s) => (
            <button key={s.id} className="card w-full p-4 text-left" onClick={() => {
              setOpen(s);
              setForm({
                name: s.name,
                description: s.description,
                marketConditions: s.marketConditions,
                confirmations: s.confirmations,
                entryRules: s.entryRules,
                stopLossRules: s.stopLossRules,
                takeProfitRules: s.takeProfitRules,
                riskRules: s.riskRules,
                invalidation: s.invalidation,
                checklist: (s.checklist || []).join("\n"),
              });
            }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{s.name} <span className="text-xs text-[var(--muted)]">v{s.version}</span></p>
                  <p className="text-sm text-[var(--muted)]">{s.description}</p>
                </div>
                <div className="text-right text-xs text-[var(--muted)]">
                  <p>n={s.stats.totalTrades}</p>
                  <p>WR {formatPct(s.stats.winRate)}</p>
                  <p>PF {s.stats.profitFactor ?? "n/a"}</p>
                  <p>Exp {s.stats.expectancyR ?? "—"}R</p>
                  <p>{formatMoney(s.stats.netPnl, currency)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
        <Card className="space-y-3">
          <h2 className="font-semibold">{open ? "Edit strategy" : "New strategy"}</h2>
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Description"><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
          <Field label="Market conditions"><Textarea value={form.marketConditions} onChange={(e) => setForm({ ...form, marketConditions: e.target.value })} /></Field>
          <Field label="Confirmations"><Textarea value={form.confirmations} onChange={(e) => setForm({ ...form, confirmations: e.target.value })} /></Field>
          <Field label="Entry rules"><Textarea value={form.entryRules} onChange={(e) => setForm({ ...form, entryRules: e.target.value })} /></Field>
          <Field label="Stop rules"><Textarea value={form.stopLossRules} onChange={(e) => setForm({ ...form, stopLossRules: e.target.value })} /></Field>
          <Field label="Target rules"><Textarea value={form.takeProfitRules} onChange={(e) => setForm({ ...form, takeProfitRules: e.target.value })} /></Field>
          <Field label="Risk rules"><Textarea value={form.riskRules} onChange={(e) => setForm({ ...form, riskRules: e.target.value })} /></Field>
          <Field label="Invalidation"><Textarea value={form.invalidation} onChange={(e) => setForm({ ...form, invalidation: e.target.value })} /></Field>
          <Field label="Checklist (one per line)"><Textarea value={form.checklist} onChange={(e) => setForm({ ...form, checklist: e.target.value })} /></Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => save(false)}>{open ? "Save" : "Create"}</Button>
            {open ? <Button variant="ghost" onClick={() => save(true)}>Save as new version</Button> : null}
            {open ? <Button variant="danger" onClick={async () => { await fetch(`/api/strategies?id=${open.id}`, { method: "DELETE" }); setOpen(null); reload(); }}>Archive</Button> : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
