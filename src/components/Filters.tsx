"use client";

import { SavedViews } from "@/components/SavedViews";
import { SESSIONS } from "@/lib/constants";
import type { FilterState } from "@/lib/filter-state";
import { Field, Input, Select } from "./ui";

export type { FilterState } from "@/lib/filter-state";
export { filterQuery } from "@/lib/filter-state";

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
  const set = (key: keyof FilterState, next: string) => onChange({ ...value, [key]: next });
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-8">
        <Field label="From">
          <Input type="date" value={value.from} onChange={(event) => set("from", event.target.value)} />
        </Field>
        <Field label="To">
          <Input type="date" value={value.to} onChange={(event) => set("to", event.target.value)} />
        </Field>
        <Field label="Account">
          <Select value={value.accountId} onChange={(event) => set("accountId", event.target.value)}>
            <option value="">All accounts</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>{account.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Instrument">
          <Select value={value.instrument} onChange={(event) => set("instrument", event.target.value)}>
            <option value="">All</option>
            {instruments.map((instrument) => (
              <option key={instrument} value={instrument}>{instrument}</option>
            ))}
          </Select>
        </Field>
        <Field label="Strategy">
          <Select value={value.strategyId} onChange={(event) => set("strategyId", event.target.value)}>
            <option value="">All</option>
            {strategies.map((strategy) => (
              <option key={strategy.id} value={strategy.id}>{strategy.name}</option>
            ))}
          </Select>
        </Field>
        <Field label="Direction">
          <Select value={value.direction} onChange={(event) => set("direction", event.target.value)}>
            <option value="">Both</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </Select>
        </Field>
        <Field label="Session">
          <Select value={value.session} onChange={(event) => set("session", event.target.value)}>
            <option value="">All sessions</option>
            {SESSIONS.map((session) => (
              <option key={session.value} value={session.value}>{session.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Review">
          <Select value={value.reviewStatus} onChange={(event) => set("reviewStatus", event.target.value)}>
            <option value="">All review states</option>
            <option value="unreviewed">Unreviewed</option>
            <option value="reviewed">Reviewed</option>
            <option value="needs_follow_up">Needs follow-up</option>
          </Select>
        </Field>
      </div>
      <SavedViews value={value} onChange={onChange} />
    </>
  );
}
