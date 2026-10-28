"use client";

import { Banner, Button, Card, Field, Input, Select } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import type { PropPlan, PropRiskEvaluation } from "@/lib/prop-risk";
import { Plus, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";

function LabeledInput({ label, ...props }: ComponentProps<typeof Input> & { label: string }) {
  return <Field label={label}><Input {...props} /></Field>;
}

function LabeledSelect({ label, children, ...props }: ComponentProps<typeof Select> & { label: string }) {
  return <Field label={label}><Select {...props}>{children}</Select></Field>;
}

export function PropFirmPanel({
  account,
  plan,
  evaluation,
  onChange,
  onSave,
}: {
  account: { currentBalance: string; currency: string };
  plan: PropPlan;
  evaluation: PropRiskEvaluation | null;
  onChange: (plan: PropPlan) => void;
  onSave: () => void | Promise<void>;
}) {
  const update = <K extends keyof PropPlan>(key: K, value: PropPlan[K]) => onChange({ ...plan, [key]: value });
  const currentPhase = plan.phases.find((phase) => phase.id === plan.currentPhaseId);

  function addPhase() {
    const id = crypto.randomUUID();
    update("phases", [...plan.phases, { id, name: `Phase ${plan.phases.length + 1}`, targetPercent: "0" }]);
  }

  function updatePhase(id: string, key: "name" | "targetPercent", value: string) {
    update("phases", plan.phases.map((phase) => phase.id === id ? { ...phase, [key]: value } : phase));
  }

  function removePhase(id: string) {
    onChange({
      ...plan,
      phases: plan.phases.filter((phase) => phase.id !== id),
      ...(plan.currentPhaseId === id ? { currentPhaseId: "", phaseStartedAt: "", phaseStartBalance: "" } : {}),
    });
  }

  function selectPhase(id: string) {
    onChange({
      ...plan,
      currentPhaseId: id,
      phaseStartedAt: id ? new Date().toISOString() : "",
      phaseStartBalance: id ? account.currentBalance : "",
    });
  }

  function resetBaseline() {
    if (!plan.currentPhaseId) return;
    onChange({ ...plan, phaseStartedAt: new Date().toISOString(), phaseStartBalance: account.currentBalance });
  }

  return (
    <Card className="mt-5 border-[var(--border)]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-[var(--gold)]" />
            <h2 className="font-serif text-xl font-medium">Prop firm plan</h2>
          </div>
          <p className="mt-1 text-xs text-[var(--muted)]">Firm rules, evaluation phases, and recorded-performance guardrails for this prop account.</p>
        </div>
        <Button variant="primary" onClick={() => void onSave()}>Save prop plan</Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className="space-y-5">
          <LabeledInput label="Prop firm / challenge" value={plan.firmName} onChange={(event) => update("firmName", event.target.value)} placeholder="e.g. My Funded Futures — 50K evaluation" />

          <div className="border-t border-[var(--border)] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text)]">Daily drawdown</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Daily drawdown %" type="number" min="0" max="100" step="0.01" value={plan.dailyDrawdownPercent} onChange={(event) => update("dailyDrawdownPercent", event.target.value)} />
              <LabeledSelect label="Percentage basis" value={plan.dailyDrawdownBasis} onChange={(event) => update("dailyDrawdownBasis", event.target.value as PropPlan["dailyDrawdownBasis"])}>
                <option value="initial_balance">Active phase / account initial</option>
                <option value="day_start_balance">Day-start recorded balance</option>
              </LabeledSelect>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">Day-start includes recorded cash flows, then applies the percentage to that balance. Daily P&amp;L itself is trading P&amp;L only. Use 0% to disable.</p>
          </div>

          <div className="border-t border-[var(--border)] pt-5">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text)]">Maximum drawdown</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <LabeledInput label="Maximum drawdown %" type="number" min="0" max="100" step="0.01" value={plan.maxDrawdownPercent} onChange={(event) => update("maxDrawdownPercent", event.target.value)} />
              <LabeledSelect label="Drawdown mode" value={plan.maxDrawdownMode} onChange={(event) => update("maxDrawdownMode", event.target.value as PropPlan["maxDrawdownMode"])}>
                <option value="initial_balance">Initial balance</option>
                <option value="trailing_balance">Trailing recorded peak</option>
              </LabeledSelect>
            </div>
            <p className="mt-2 text-[11px] leading-5 text-[var(--muted)]">Overall drawdown uses starting balance plus realized trading P&amp;L. An active phase resets both the initial basis and trailing peak to its explicit baseline; otherwise account history is used. Cash flows never improve either value.</p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text)]">Challenge phases</h3>
                <p className="mt-1 text-[11px] text-[var(--muted)]">Ordered targets; use 0% when a phase has no target.</p>
              </div>
              <Button variant="ghost" className="px-3" onClick={addPhase} disabled={plan.phases.length >= 100}><Plus size={14} /> Add phase</Button>
            </div>
            {plan.phases.length === 0 ? (
              <div className="rounded-md border border-dashed border-[var(--border)] p-5 text-center text-xs text-[var(--muted)]">Add Phase 1, Phase 2, or any firm-specific evaluation stage.</div>
            ) : (
              <div className="space-y-2">
                {plan.phases.map((phase, index) => (
                  <div key={phase.id} className="grid grid-cols-[1fr_108px_36px] items-end gap-2">
                    <LabeledInput label={`Stage ${index + 1}`} value={phase.name} onChange={(event) => updatePhase(phase.id, "name", event.target.value)} />
                    <LabeledInput label="Target %" type="number" min="0" max="1000" step="0.01" value={phase.targetPercent} onChange={(event) => updatePhase(phase.id, "targetPercent", event.target.value)} />
                    <button type="button" title={`Remove ${phase.name}`} aria-label={`Remove ${phase.name}`} onClick={() => removePhase(phase.id)} className="mb-1 flex h-9 w-9 items-center justify-center rounded-md text-[var(--muted)] transition-colors hover:bg-[var(--bg-card-2)] hover:text-[var(--red)]"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {plan.phases.length > 0 && (
            <div className="border-t border-[var(--border)] pt-5">
              <LabeledSelect label="Active phase" value={plan.currentPhaseId} onChange={(event) => selectPhase(event.target.value)}>
                <option value="">No active phase</option>
                {plan.phases.map((phase) => <option key={phase.id} value={phase.id}>{phase.name}</option>)}
              </LabeledSelect>
              {plan.currentPhaseId && (
                <div className="mt-3 space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <LabeledInput label="Phase start (UTC ISO)" value={plan.phaseStartedAt} onChange={(event) => update("phaseStartedAt", event.target.value)} placeholder="2026-10-28T09:00:00.000Z" />
                    <LabeledInput label={`Phase start balance (${account.currency})`} type="number" min="0" step="0.01" value={plan.phaseStartBalance} onChange={(event) => update("phaseStartBalance", event.target.value)} />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[11px] leading-5 text-[var(--muted)]">Selecting a different phase starts a new baseline at the current recorded balance. Only trades realized on/after this timestamp count toward {currentPhase?.name}.</p>
                    <Button variant="ghost" className="px-2 text-[11px]" onClick={resetBaseline}><RotateCcw size={13} /> Reset to now</Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 border-t border-[var(--border)] pt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text)]">Recorded prop status</h3>
          <span className="text-[10px] text-[var(--muted)]">Updates on load, save, and pre-trade checks</span>
        </div>
        {!evaluation ? (
          <p className="text-xs text-[var(--muted)]">No recorded prop evaluation yet. Save this plan to evaluate its current status; a pre-trade check also tests hypothetical planned risk.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-3">
            {evaluation.phase && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-[var(--text)]">{evaluation.phase.name}</p>
                  <span className={`font-mono-num text-[10px] ${evaluation.phase.achieved ? "text-[var(--gold)]" : "text-[var(--muted)]"}`}>{evaluation.phase.progressPercent}%</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--border)]"><div className={`h-full ${evaluation.phase.achieved ? "bg-[var(--gold)]" : "bg-[var(--green)]"}`} style={{ width: `${Math.max(0, Math.min(100, Number(evaluation.phase.progressPercent)))}%` }} /></div>
                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Phase trading P&amp;L</dt><dd className="font-mono-num text-[var(--text)]">{formatMoney(evaluation.phase.realizedPnl, account.currency)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Target</dt><dd className="font-mono-num text-[var(--text)]">{formatMoney(evaluation.phase.targetAmount, account.currency)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">{evaluation.phase.achieved ? "Above target" : "Remaining"}</dt><dd className={`font-mono-num ${evaluation.phase.achieved ? "text-[var(--gold)]" : "text-[var(--text)]"}`}>{formatMoney(Math.abs(Number(evaluation.phase.remaining)), account.currency)}</dd></div>
                </dl>
              </div>
            )}
            {evaluation.daily && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-4">
                <p className="text-xs font-medium text-[var(--text)]">Daily drawdown · {evaluation.daily.percent}%</p>
                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Allowance</dt><dd className="font-mono-num text-[var(--text)]">{formatMoney(evaluation.daily.limit, account.currency)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Remaining before idea</dt><dd className={`font-mono-num ${Number(evaluation.daily.remaining) < 0 ? "text-[var(--red)]" : "text-[var(--text)]"}`}>{formatMoney(evaluation.daily.remaining, account.currency)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Basis</dt><dd className="text-right text-[var(--text)]">{evaluation.daily.basis === "initial_balance" ? "Initial balance" : "Day-start recorded"}</dd></div>
                </dl>
              </div>
            )}
            {evaluation.overall && (
              <div className="rounded-md border border-[var(--border)] bg-[var(--bg-elev)] p-4">
                <p className="text-xs font-medium text-[var(--text)]">Maximum drawdown · {evaluation.overall.percent}%</p>
                <dl className="mt-3 space-y-1.5 text-[11px]">
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Recorded trading balance</dt><dd className="font-mono-num text-[var(--text)]">{formatMoney(evaluation.overall.currentTradingBalance, account.currency)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Drawdown floor</dt><dd className="font-mono-num text-[var(--text)]">{formatMoney(evaluation.overall.floor, account.currency)}</dd></div>
                  <div className="flex justify-between gap-2"><dt className="text-[var(--muted)]">Current drawdown</dt><dd className={`font-mono-num ${Number(evaluation.overall.currentDrawdown) > 0 ? "text-[var(--red)]" : "text-[var(--text)]"}`}>{formatMoney(evaluation.overall.currentDrawdown, account.currency)}</dd></div>
                </dl>
              </div>
            )}
            {!evaluation.phase && !evaluation.daily && !evaluation.overall && <p className="text-xs text-[var(--muted)]">The saved plan has no active percentage or phase-target rules to evaluate.</p>}
          </div>
        )}
        {evaluation?.warnings.length ? (
          <div className="mt-4 space-y-2">
            {evaluation.warnings.map((warning) => <Banner key={warning} tone="warn">{warning}</Banner>)}
          </div>
        ) : null}
        <p className="mt-4 text-[11px] leading-5 text-[var(--muted)]">Recorded journal data only: realized P&amp;L, balances, cash flows, and the hypothetical planned risk you enter. TradeMind does not receive live broker equity, measure open-trade drawdown, enforce firm rules at the broker, or block orders.</p>
      </div>
    </Card>
  );
}
