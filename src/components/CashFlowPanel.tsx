"use client";

import { Banner, Button, Card, Field, Input, Select, Textarea } from "./ui";
import { CASH_FLOW_TYPES, cashFlowLabel, type CashFlowType } from "@/lib/cash-flow";
import { formatMoney, formatWhen, pnlClass } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

type Account = { id: string; name: string; currency: string };
type CashFlow = {
  id: string;
  accountId: string;
  type: CashFlowType;
  amount: string;
  occurredAt: string;
  externalId: string | null;
  notes: string;
};

function localNow() {
  const date = new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

export function CashFlowPanel({ accounts, onChanged }: { accounts: Account[]; onChanged?: () => void }) {
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [rows, setRows] = useState<CashFlow[]>([]);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ type: "deposit" as CashFlowType, amount: "", occurredAt: localNow(), externalId: "", notes: "" });

  const accountId = selectedAccountId || accounts[0]?.id || "";
  const account = accounts.find((item) => item.id === accountId) ?? accounts[0];
  const load = useCallback(async () => {
    if (!accountId) return;
    try {
      const response = await fetch(`/api/cash-flows?accountId=${encodeURIComponent(accountId)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load cash flows");
      setRows(data.cashFlows || []);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load cash flows");
    }
  }, [accountId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (!accounts.length) return null;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!account) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/cash-flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          accountId: account.id,
          occurredAt: new Date(form.occurredAt).toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save cash flow");
      setForm((current) => ({ ...current, amount: "", externalId: "", notes: "" }));
      await load();
      onChanged?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save cash flow");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this cash-flow entry and rebuild the account balance?")) return;
    const response = await fetch(`/api/cash-flows?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || "Could not delete cash flow");
      return;
    }
    await load();
    onChanged?.();
  }

  return (
    <Card className="space-y-4">
      <div className="card-heading">
        <div>
          <h2 className="font-semibold">Cash ledger</h2>
          <p className="mt-1 text-xs text-[var(--muted)]">Account-level cash movements are separate from trading P&amp;L. Do not duplicate trade commissions here.</p>
        </div>
        <Select value={account?.id ?? ""} onChange={(event) => setSelectedAccountId(event.target.value)} className="max-w-48">
          {accounts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.currency}</option>)}
        </Select>
      </div>
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <form className="grid gap-3 md:grid-cols-5" onSubmit={save}>
        <Field label="Type">
          <Select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as CashFlowType })}>
            {CASH_FLOW_TYPES.map((type) => <option key={type} value={type}>{cashFlowLabel(type)}</option>)}
          </Select>
        </Field>
        <Field label="Amount" hint={form.type === "adjustment" ? "Signed account currency" : "Positive; type sets sign"}>
          <Input required inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
        </Field>
        <Field label="Occurred at">
          <Input required type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} />
        </Field>
        <Field label="External reference">
          <Input value={form.externalId} onChange={(event) => setForm({ ...form, externalId: event.target.value })} placeholder="Optional broker ID" />
        </Field>
        <div className="flex items-end"><Button type="submit" loading={saving}>Add cash entry</Button></div>
        <div className="md:col-span-5">
          <Field label="Notes"><Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Optional context" /></Field>
        </div>
      </form>
      <div className="table-wrap">
        <table className="data">
          <thead><tr><th>Date</th><th>Type</th><th>Amount</th><th>Reference</th><th>Notes</th><th></th></tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{formatWhen(row.occurredAt)}</td>
                <td>{cashFlowLabel(row.type)}</td>
                <td className={`font-mono-num ${pnlClass(Number(row.amount))}`}>{formatMoney(row.amount, account?.currency || "USD")}</td>
                <td>{row.externalId || "—"}</td>
                <td className="max-w-64 truncate">{row.notes || "—"}</td>
                <td><Button type="button" variant="ghost" onClick={() => void remove(row.id)}>Delete</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length ? <p className="py-5 text-center text-sm text-[var(--muted)]">No cash movements recorded for this account.</p> : null}
      </div>
    </Card>
  );
}
