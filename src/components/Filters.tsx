"use client";

import { SESSIONS } from "@/lib/constants";
import { Field, Input, Select } from "./ui";

export type FilterState = {
  from: string;
  to: string;
  accountId: string;
  instrument: string;
  strategyId: string;
  direction: string;
  session: string;
  reviewStatus: string;
};

export function filterQuery(f: FilterState) {
  const p = new URLSearchParams();
  Object.entries(f).forEach(([k, v]) => {
    if (v) p.set(k, v);
  });
  return p.toString();
}

export function Filters({
  value,
  onChange,
  accounts,
  instruments,
  strategies,
}: {
  value: FilterState;
  onChange: (next: FilterState) => void;
  accounts: { id: string; name: string }[];
  instruments: string[];
  strategies: { id: string; name: string }[];
}) {
  const set = (k: keyof FilterState, v: string) => onChange({ ...value, [k]: v });
  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-8">
      <Field label="From">
        <Input type="date" value={value.from} onChange={(e) => set("from", e.target.value)} />
      </Field>
      <Field label="To">
        <Input type="date" value={value.to} onChange={(e) => set("to", e.target.value)} />
      </Field>
      <Field label="Account">
        <Select value={value.accountId} onChange={(e) => set("accountId", e.target.value)}>
          <option value="">All accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Instrument">
        <Select value={value.instrument} onChange={(e) => set("instrument", e.target.value)}>
          <option value="">All</option>
          {instruments.map((i) => (
            <option key={i} value={i}>
              {i}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Strategy">
        <Select value={value.strategyId} onChange={(e) => set("strategyId", e.target.value)}>
          <option value="">All</option>
          {strategies.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Direction">
        <Select value={value.direction} onChange={(e) => set("direction", e.target.value)}>
          <option value="">Both</option>
          <option value="long">Long</option>
          <option value="short">Short</option>
        </Select>
      </Field>
      <Field label="Session">
        <Select value={value.session} onChange={(e) => set("session", e.target.value)}>
          <option value="">All sessions</option>
          {SESSIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Review">
        <Select value={value.reviewStatus} onChange={(e) => set("reviewStatus", e.target.value)}>
          <option value="">All review states</option>
          <option value="unreviewed">Unreviewed</option>
          <option value="reviewed">Reviewed</option>
          <option value="needs_follow_up">Needs follow-up</option>
        </Select>
      </Field>
    </div>
  );
}
