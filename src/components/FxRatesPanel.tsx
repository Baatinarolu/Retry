"use client";

import { Banner, Button, Card, Field, Input, Spinner } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatWhen } from "@/lib/format";
import { useEffect, useState } from "react";

type FxRate = {
  id: string;
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  effectiveAt: string;
  source: string;
  notes: string;
};

export function FxRatesPanel() {
  const [rates, setRates] = useState<FxRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    fromCurrency: "USD",
    toCurrency: "NGN",
    rate: "",
    effectiveAt: "",
    source: "manual",
    notes: "",
  });

  async function reload(signal?: AbortSignal) {
    const data = await apiJson<{ rates: FxRate[] }>("/api/fx-rates", { signal });
    setRates(data.rates);
  }

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ rates: FxRate[] }>("/api/fx-rates", { signal: controller.signal })
      .then((data) => setRates(data.rates))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load FX rates");
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  function set(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiJson("/api/fx-rates", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          fromCurrency: form.fromCurrency.trim().toUpperCase(),
          toCurrency: form.toCurrency.trim().toUpperCase(),
          rate: form.rate.trim(),
          effectiveAt: form.effectiveAt.trim(),
        }),
      });
      setForm((current) => ({ ...current, rate: "", effectiveAt: "", notes: "" }));
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save FX rate");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this FX rate? Historical converted reports may change.")) return;
    setError("");
    try {
      await apiJson(`/api/fx-rates?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete FX rate");
    }
  }

  return (
    <Card className="space-y-4">
      <div className="card-heading">
        <div>
          <p className="eyebrow mb-2">Reporting / Manual market convention</p>
          <h2>FX rate book</h2>
        </div>
        <span>{rates.length} rates</span>
      </div>
      <p className="text-sm leading-6 text-[var(--muted)]">
        Add dated rates for mixed-account reports. Convention: 1 unit of source = rate units of target. Reports use the latest rate effective on or before each trade’s realization; reciprocal quotes are accepted only when consistent. No live FX feed is used.
      </p>
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={save}>
        <Field label="From currency"><Input value={form.fromCurrency} onChange={(event) => set("fromCurrency", event.target.value.toUpperCase())} maxLength={8} required /></Field>
        <Field label="To currency"><Input value={form.toCurrency} onChange={(event) => set("toCurrency", event.target.value.toUpperCase())} maxLength={8} required /></Field>
        <Field label="Rate"><Input value={form.rate} onChange={(event) => set("rate", event.target.value)} inputMode="decimal" placeholder="0.000666667" required /></Field>
        <Field label="Effective at" hint="ISO timestamp with timezone"><Input value={form.effectiveAt} onChange={(event) => set("effectiveAt", event.target.value)} placeholder="2026-10-25T00:00:00Z" className="font-mono text-xs" required /></Field>
        <Field label="Source"><Input value={form.source} onChange={(event) => set("source", event.target.value)} maxLength={80} required /></Field>
        <Field label="Notes"><Input value={form.notes} onChange={(event) => set("notes", event.target.value)} maxLength={500} placeholder="Broker statement rate" /></Field>
        <div className="md:col-span-2 lg:col-span-3"><Button type="submit" loading={saving}>Add dated rate</Button></div>
      </form>
      {loading ? <Spinner label="Loading rate book" /> : (
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Pair</th><th>Rate</th><th>Effective</th><th>Source</th><th></th></tr></thead>
            <tbody>
              {rates.map((rate) => (
                <tr key={rate.id}>
                  <td>{rate.fromCurrency} → {rate.toCurrency}</td>
                  <td className="font-mono-num">{rate.rate}</td>
                  <td>{formatWhen(rate.effectiveAt)}</td>
                  <td>{rate.source}{rate.notes ? ` · ${rate.notes}` : ""}</td>
                  <td><Button variant="ghost" onClick={() => remove(rate.id)}>Delete</Button></td>
                </tr>
              ))}
              {!rates.length ? <tr><td colSpan={5} className="text-[var(--muted)]">No manual rates yet. Same-currency reports do not need one.</td></tr> : null}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
