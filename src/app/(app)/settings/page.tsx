"use client";

import { CashFlowPanel } from "@/components/CashFlowPanel";
import { Banner, Button, Card, Field, Input, Select } from "@/components/ui";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [instruments, setInstruments] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [newTag, setNewTag] = useState("");
  const [acc, setAcc] = useState({ name: "Funded account", broker: "", currency: "USD", startingBalance: "5000", accountType: "prop" });
  const [inst, setInst] = useState({ symbol: "", name: "", category: "forex", pipSize: "0.0001", pipValue: "10", tickSize: "0", tickValue: "0", contractSize: "1", quoteCurrency: "USD" });
  const [msg, setMsg] = useState("");

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
        <Field label="Base currency">
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
        <ul className="text-sm">
          {accounts.map((a) => (
            <li key={a.id} className="flex justify-between border-b border-[var(--border)] py-2">
              <span>{a.name} · {a.broker || "no broker"} · {a.currency} · {a.accountType}</span>
              <span>{a.currentBalance}</span>
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

      <Card className="space-y-3">
        <h2 className="font-semibold">Instrument specifications</h2>
        <p className="text-sm text-[var(--muted)]">Pip/tick values are per 1.0 lot unless you document otherwise. Gold, indices, and crypto are not forex lots.</p>
        <div className="table-wrap">
          <table className="data">
            <thead><tr><th>Symbol</th><th>Category</th><th>Pip size</th><th>Pip value</th><th></th></tr></thead>
            <tbody>
              {instruments.map((i) => (
                <tr key={i.id}>
                  <td>{i.symbol}</td>
                  <td>{i.category}</td>
                  <td>{i.pipSize}</td>
                  <td>{i.pipValue}</td>
                  <td><button className="text-[var(--red)]" onClick={async () => { await fetch(`/api/instruments?id=${i.id}`, { method: "DELETE" }); reload(); }}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          <Input placeholder="Symbol" value={inst.symbol} onChange={(e) => setInst({ ...inst, symbol: e.target.value })} />
          <Input placeholder="Name" value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} />
          <Input placeholder="Pip size" value={inst.pipSize} onChange={(e) => setInst({ ...inst, pipSize: e.target.value })} />
          <Button onClick={async () => { await fetch("/api/instruments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(inst) }); reload(); }}>Add instrument</Button>
        </div>
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
        <p className="text-sm text-[var(--muted)]">Export your data anytime. Deleting the account removes journal records you own.</p>
        <div className="flex gap-2">
          <a className="btn btn-ghost" href="/api/export?format=json">Download JSON</a>
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
