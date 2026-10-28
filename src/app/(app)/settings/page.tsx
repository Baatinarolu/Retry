"use client";

import { CashFlowPanel } from "@/components/CashFlowPanel";
import { FxRatesPanel } from "@/components/FxRatesPanel";
import { Banner, Button, Card, Field, Input, Select } from "@/components/ui";
import { CURRENCIES, MARKET_CATEGORIES, TIMEZONES } from "@/lib/constants";
import { formatMoney } from "@/lib/format";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const emptyInstrument = {
  symbol: "",
  name: "",
  category: "forex",
  pipSize: "0.0001",
  pipValue: "10",
  tickSize: "0",
  tickValue: "0",
  contractSize: "1",
  quoteCurrency: "USD",
};

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [newTag, setNewTag] = useState("");
  const [acc, setAcc] = useState({ name: "Funded account", broker: "", currency: "USD", startingBalance: "5000", accountType: "prop" });
  const [inst, setInst] = useState({ ...emptyInstrument });
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [instrumentError, setInstrumentError] = useState("");
  const [instrumentBusy, setInstrumentBusy] = useState(false);
  const [restoreBusy, setRestoreBusy] = useState(false);

  function reload() {
    fetch("/api/settings").then((r) => r.json()).then((d) => setUser(d.user));
    fetch("/api/accounts").then((r) => r.json()).then((d) => setAccounts(d.accounts || []));
    fetch("/api/instruments").then((r) => r.json()).then((d) => setInstruments(d.instruments || []));
    fetch("/api/tags").then((r) => r.json()).then((d) => setTags(d.tags || []));
  }
  useEffect(reload, []);

  async function saveUser() {
    await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(user) });
    const theme = user.theme === "light" ? "light" : "dark";
    document.documentElement.className = theme;
    window.localStorage.setItem("tm-theme", theme);
    window.dispatchEvent(new CustomEvent("tm-theme-change", { detail: theme }));
    setMsg("Preferences saved.");
  }

  async function addInstrument() {
    if (instrumentBusy) return;
    setInstrumentBusy(true);
    setInstrumentError("");
    setMsg("");
    try {
      const response = await fetch("/api/instruments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inst),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not save instrument");
      setInst({ ...emptyInstrument });
      setMsg(`${data.instrument.symbol} instrument saved. Existing trades retain their saved calculation specifications.`);
      reload();
    } catch (cause) {
      setInstrumentError(cause instanceof Error ? cause.message : "Could not save instrument");
    } finally {
      setInstrumentBusy(false);
    }
  }

  async function restoreBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const confirmation = window.prompt("This replaces the current workspace. Type RESTORE WORKSPACE to continue.");
    if (confirmation !== "RESTORE WORKSPACE") {
      event.target.value = "";
      return;
    }
    setRestoreBusy(true);
    setError("");
    setMsg("");
    try {
      const backup = JSON.parse(await file.text());
      const response = await fetch("/api/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation, backup }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not restore workspace");
      setMsg(`Workspace restored: ${data.accountsRebuilt} accounts and ${data.attachments} attachments. Balances were rebuilt.`);
      reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not restore workspace");
    } finally {
      setRestoreBusy(false);
      event.target.value = "";
    }
  }

  if (!user) return null;

  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Workspace / Preferences &amp; data</p>
          <h1>Settings</h1>
          <p className="page-description">Theme, currency, accounts, instrument specifications, tags, and privacy.</p>
        </div>
      </div>
      {msg ? <Banner tone="good">{msg}</Banner> : null}
      {error ? <Banner tone="warn">{error}</Banner> : null}
      <Card className="grid gap-3 md:grid-cols-2">
        <Field label="Name"><Input value={user.name} onChange={(e) => setUser({ ...user, name: e.target.value })} /></Field>
        <Field label="Timezone">
          <Select value={user.timezone} onChange={(e) => setUser({ ...user, timezone: e.target.value })}>
            {TIMEZONES.map((z) => <option key={z}>{z}</option>)}
          </Select>
        </Field>
        <Field label="Theme">
          <Select value={user.theme} onChange={(e) => setUser({ ...user, theme: e.target.value })}>
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </Select>
        </Field>
        <Field label="Base currency" hint="Reporting only. This does not change an account’s native currency or convert stored trade P&L.">
          <Select value={user.baseCurrency} onChange={(e) => setUser({ ...user, baseCurrency: e.target.value })}>
            {CURRENCIES.map((z) => <option key={z}>{z}</option>)}
          </Select>
        </Field>
        <label className="flex items-center gap-2 text-sm md:col-span-2">
          <input type="checkbox" checked={user.aiPermission} onChange={(e) => setUser({ ...user, aiPermission: e.target.checked })} />
          Allow AI models to process summarized journal statistics (local or external, depending on server configuration)
        </label>
        <Button onClick={saveUser}>Save preferences</Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Accounts</h2>
        <p className="text-sm leading-6 text-[var(--muted)]">Each account’s currency must match its broker statement. All-account reports convert native starting balances and closed-trade money into the workspace base only through your dated FX rate book.</p>
        <ul className="text-sm">
          {accounts.map((a) => (
            <li key={a.id} className="flex justify-between border-b border-[var(--border)] py-2">
              <span>{a.name} · {a.broker || "no broker"} · {a.currency} · {a.accountType}</span>
              <span>{formatMoney(a.currentBalance, a.currency)}</span>
            </li>
          ))}
        </ul>
        <div className="grid gap-2 md:grid-cols-5">
          <Input placeholder="Name" value={acc.name} onChange={(e) => setAcc({ ...acc, name: e.target.value })} />
          <Input placeholder="Broker" value={acc.broker} onChange={(e) => setAcc({ ...acc, broker: e.target.value })} />
          <Select value={acc.currency} onChange={(e) => setAcc({ ...acc, currency: e.target.value })}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <Input placeholder="Starting" value={acc.startingBalance} onChange={(e) => setAcc({ ...acc, startingBalance: e.target.value })} />
          <Button onClick={async () => { await fetch("/api/accounts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(acc) }); reload(); }}>Add</Button>
        </div>
      </Card>

      <CashFlowPanel accounts={accounts} onChanged={reload} />

      <FxRatesPanel />

      <Card className="space-y-4">
        <div>
          <h2 className="font-semibold">Instrument specifications</h2>
          <p className="mt-2 max-w-5xl text-sm leading-6 text-[var(--muted)]">
            Pip/tick values are per 1.0 lot and must already be denominated in the trading account’s currency. For AUDCHF in an NGN account, enter NGN per pip/tick—not generic USD 10 or CHF 10. Gold, indices, and crypto are not forex lots. Existing trades retain their saved specifications; edit an existing trade separately to reconcile it.
          </p>
        </div>
        {instrumentError ? <Banner tone="warn">{instrumentError}</Banner> : null}
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Symbol</th><th>Category</th><th>Contract</th><th>Tick size / value</th><th>Pip size / value</th><th>Quote</th><th></th></tr></thead>
            <tbody>
              {instruments.map((i) => (
                <tr key={i.id}>
                  <td>{i.symbol}</td>
                  <td className="capitalize">{i.category}</td>
                  <td className="font-mono-num">{i.contractSize}</td>
                  <td className="font-mono-num">{i.tickSize} / {i.tickValue}</td>
                  <td className="font-mono-num">{i.pipSize} / {i.pipValue}</td>
                  <td>{i.quoteCurrency}</td>
                  <td><button className="text-[var(--red)]" onClick={async () => { await fetch(`/api/instruments?id=${i.id}`, { method: "DELETE" }); reload(); }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-3 border-t border-[var(--line)] pt-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Symbol"><Input value={inst.symbol} onChange={(e) => setInst({ ...inst, symbol: e.target.value.toUpperCase() })} placeholder="AUDCHF" required /></Field>
          <Field label="Name"><Input value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} placeholder="Australian Dollar / Swiss Franc" required /></Field>
          <Field label="Market"><Select value={inst.category} onChange={(e) => setInst({ ...inst, category: e.target.value })}>{MARKET_CATEGORIES.map((category) => <option key={category.value} value={category.value}>{category.label}</option>)}</Select></Field>
          <Field label="Quote currency" hint="The second currency in a forex pair"><Select value={inst.quoteCurrency} onChange={(e) => setInst({ ...inst, quoteCurrency: e.target.value })}>{CURRENCIES.map((currency) => <option key={currency}>{currency}</option>)}</Select></Field>
          <Field label="Contract size"><Input value={inst.contractSize} onChange={(e) => setInst({ ...inst, contractSize: e.target.value })} inputMode="decimal" required /></Field>
          <Field label="Tick size"><Input value={inst.tickSize} onChange={(e) => setInst({ ...inst, tickSize: e.target.value })} inputMode="decimal" required /></Field>
          <Field label="Tick value (account currency / lot)"><Input value={inst.tickValue} onChange={(e) => setInst({ ...inst, tickValue: e.target.value })} inputMode="decimal" required /></Field>
          <Field label="Pip size"><Input value={inst.pipSize} onChange={(e) => setInst({ ...inst, pipSize: e.target.value })} inputMode="decimal" required /></Field>
          <Field label="Pip value (account currency / lot)"><Input value={inst.pipValue} onChange={(e) => setInst({ ...inst, pipValue: e.target.value })} inputMode="decimal" required /></Field>
        </div>
        <p className="text-xs leading-5 text-[var(--muted)]">Calculation priority is tick value, then pip value, then contract size. Set unused methods to zero so the intended method is unambiguous.</p>
        <Button onClick={addInstrument} loading={instrumentBusy}>Add instrument</Button>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Custom tags</h2>
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <button key={t.id} className="badge px-3 py-1.5 hover:border-[var(--red)] hover:text-[var(--red)]" title="Remove tag" onClick={async () => { await fetch(`/api/tags?id=${t.id}`, { method: "DELETE" }); reload(); }}>
              {t.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Input placeholder="New tag" value={newTag} onChange={(e) => setNewTag(e.target.value)} />
          <Button onClick={async () => { await fetch("/api/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newTag, category: "custom" }) }); setNewTag(""); reload(); }}>Add tag</Button>
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Privacy</h2>
        <p className="text-sm text-[var(--muted)]">Download a versioned full-workspace backup, including executions, settings, cash movements, the FX rate book, import batches, and private image attachments. Restore replaces the current workspace after explicit confirmation.</p>
        <div className="flex flex-wrap gap-2">
          <a className="btn btn-ghost" href="/api/backup">Download full backup</a>
          <a className="btn btn-ghost" href="/api/export?format=json">Trade-only JSON</a>
          <label className={`btn btn-ghost ${restoreBusy ? "opacity-50 pointer-events-none" : ""}`}>
            {restoreBusy ? "Restoring…" : "Restore backup"}
            <input className="hidden" type="file" accept=".json,application/json" disabled={restoreBusy} onChange={restoreBackup} />
          </label>
          <Button
            variant="danger"
            onClick={async () => {
              if (!confirm("Delete account and all private journal data?")) return;
              await fetch("/api/settings", { method: "DELETE" });
              router.push("/");
            }}
          >
            Delete account
          </Button>
        </div>
      </Card>
    </div>
  );
}
