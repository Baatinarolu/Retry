"use client";

import { PropFirmPanel } from "@/components/PropFirmPanel";
import { Banner, Button, Card, Field, Input, Select, Textarea } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { formatMoney } from "@/lib/format";
import { defaultPropPlan, type PropRiskEvaluation } from "@/lib/prop-risk";
import { useEffect, useState } from "react";

export default function RiskPage() {
  const [settings, setSettings] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [check, setCheck] = useState<any>(null);
  const [propEvaluation, setPropEvaluation] = useState<PropRiskEvaluation | null>(null);
  const [form, setForm] = useState({ plannedRisk: "50", plannedRr: "2", positionSize: "0.5" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([apiJson<{ settings: any; propRisk: PropRiskEvaluation | null }>("/api/risk"), apiJson<{ accounts?: any[] }>("/api/accounts")])
      .then(([risk, accountData]) => {
        setSettings(risk.settings);
        setPropEvaluation(risk.propRisk);
        setAccounts(accountData.accounts || []);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Could not load risk rules"));
  }, []);

  async function changeAccount(accountId: string) {
    setError("");
    try {
      const data = await apiJson<{ settings: any; propRisk: PropRiskEvaluation | null }>(`/api/risk?accountId=${accountId}`);
      setSettings(data.settings);
      setPropEvaluation(data.propRisk);
      setCheck(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load account rules");
    }
  }

  async function save() {
    setError("");
    setMessage("");
    try {
      const data = await apiJson<{ settings: any; propRisk: PropRiskEvaluation | null }>("/api/risk", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      setSettings(data.settings);
      setPropEvaluation(data.propRisk);
      setCheck(null);
      setMessage("Risk rules saved.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save rules");
    }
  }

  async function preview() {
    setError("");
    try {
      const data = await apiJson<{ propRisk: PropRiskEvaluation | null }>("/api/risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, accountId: settings?.accountId }),
      });
      setCheck(data);
      setPropEvaluation(data.propRisk ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not check this idea");
    }
  }

  if (!settings) return error ? <Banner tone="warn">{error}</Banner> : null;
  const selectedAccount = accounts.find((account) => account.id === settings.accountId);
  const currency = selectedAccount?.currency || "USD";

  return (
    <div className="space-y-7">
      <div className="page-heading">
        <div>
          <p className="eyebrow mb-3">Guardrails / Before the next trade</p>
          <h1>Risk management</h1>
          <p className="page-description">Limits are warnings only. This app never places or modifies broker orders.</p>
        </div>
      </div>
      {error ? <Banner tone="warn">{error}</Banner> : null}
      {message ? <Banner tone="good">{message}</Banner> : null}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <h2 className="font-semibold">Rules</h2>
          <Field label="Account">
            <Select value={settings.accountId || ""} onChange={(event) => changeAccount(event.target.value)}>
              <option value="">All accounts / default</option>
              {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} · {account.accountType}</option>)}
            </Select>
          </Field>
          <Field label="Default risk %"><Input inputMode="decimal" value={settings.defaultRiskPercent} onChange={(event) => setSettings({ ...settings, defaultRiskPercent: event.target.value })} /></Field>
          <Field label={`Max daily loss (${currency})`}><Input inputMode="decimal" value={settings.maxDailyLoss} onChange={(event) => setSettings({ ...settings, maxDailyLoss: event.target.value })} /></Field>
          <Field label={`Max weekly loss (${currency})`}><Input inputMode="decimal" value={settings.maxWeeklyLoss} onChange={(event) => setSettings({ ...settings, maxWeeklyLoss: event.target.value })} /></Field>
          <Field label="Max trades / day (0 disables)"><Input type="number" min={0} value={settings.maxTradesPerDay} onChange={(event) => setSettings({ ...settings, maxTradesPerDay: Number(event.target.value) })} /></Field>
          <Field label="Max consecutive losses (0 disables)"><Input type="number" min={0} value={settings.maxConsecutiveLosses} onChange={(event) => setSettings({ ...settings, maxConsecutiveLosses: Number(event.target.value) })} /></Field>
          <Field label={`Max open risk (${currency})`}><Input inputMode="decimal" value={settings.maxOpenRisk} onChange={(event) => setSettings({ ...settings, maxOpenRisk: event.target.value })} /></Field>
          <Field label="Min planned R:R"><Input inputMode="decimal" value={settings.minPlannedRr} onChange={(event) => setSettings({ ...settings, minPlannedRr: event.target.value })} /></Field>
          <Field label={`Daily profit target (${currency}, optional)`}><Input inputMode="decimal" value={settings.dailyProfitTarget} onChange={(event) => setSettings({ ...settings, dailyProfitTarget: event.target.value })} /></Field>
          <Field label="Max position size"><Input inputMode="decimal" value={settings.maxPositionSize} onChange={(event) => setSettings({ ...settings, maxPositionSize: event.target.value })} /></Field>
          <Field label="Personal rules"><Textarea value={settings.personalRules} onChange={(event) => setSettings({ ...settings, personalRules: event.target.value })} /></Field>
          <Button onClick={save}>Save rules</Button>
        </Card>
        <Card className="space-y-3">
          <h2 className="font-semibold">Pre-trade check</h2>
          <Field label={`Planned monetary risk (${currency})`}><Input inputMode="decimal" value={form.plannedRisk} onChange={(event) => setForm({ ...form, plannedRisk: event.target.value })} /></Field>
          <Field label="Planned R:R"><Input inputMode="decimal" value={form.plannedRr} onChange={(event) => setForm({ ...form, plannedRr: event.target.value })} /></Field>
          <Field label="Position size"><Input inputMode="decimal" value={form.positionSize} onChange={(event) => setForm({ ...form, positionSize: event.target.value })} /></Field>
          <Button onClick={preview}>Check against rules</Button>
          {check ? (
            <div className="space-y-2 text-sm">
              <p>Today P&L {formatMoney(check.dailyPnl, currency)} · trades {check.tradesToday} · loss streak {check.consecutiveLosses}</p>
              <p>Open risk {formatMoney(check.openRisk, currency)}</p>
              {check.remainingDailyLoss !== null ? <p>Remaining daily loss allowance {formatMoney(check.remainingDailyLoss, currency)}</p> : null}
              {check.warnings?.length ? check.warnings.map((warning: string) => <Banner key={warning} tone="warn">{warning}</Banner>) : <Banner tone="good">No rule violations detected for this hypothetical size.</Banner>}
            </div>
          ) : null}
          <div className="pt-4">
            <h3 className="font-medium">Accounts</h3>
            <ul className="mt-2 space-y-1 text-sm">
              {accounts.map((account) => (
                <li key={account.id}>{account.name} · {account.currency} · start {formatMoney(account.startingBalance, account.currency)} · now {formatMoney(account.currentBalance, account.currency)}</li>
              ))}
            </ul>
          </div>
        </Card>
      </div>
      {selectedAccount?.accountType === "prop" ? (
        <PropFirmPanel
          account={selectedAccount}
          plan={settings.propPlan ?? defaultPropPlan()}
          evaluation={propEvaluation}
          onChange={(propPlan) => {
            setSettings({ ...settings, propPlan });
            setPropEvaluation(null);
            setCheck(null);
            setMessage("");
          }}
          onSave={save}
        />
      ) : null}
    </div>
  );
}
