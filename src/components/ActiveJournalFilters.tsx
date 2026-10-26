"use client";

import { Button } from "@/components/ui";
import type { FilterState } from "@/lib/filter-state";
import { activeJournalFilters, type ActiveJournalFilter } from "@/lib/journal-view";

export function ActiveJournalFilters({
  filters,
  query,
  accounts,
  strategies,
  onRemove,
  onClear,
}: {
  filters: FilterState;
  query: string;
  accounts: Array<{ id: string; name: string }>;
  strategies: Array<{ id: string; name: string }>;
  onRemove: (key: ActiveJournalFilter["key"]) => void;
  onClear: () => void;
}) {
  const active = activeJournalFilters(filters, query, { accounts, strategies });
  if (!active.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active journal filters">
      <span className="eyebrow mr-1">Active filters</span>
      {active.map((filter) => (
        <button
          type="button"
          key={filter.key}
          title={filter.label}
          aria-label={`Remove filter: ${filter.label}`}
          className="inline-flex max-w-full items-center gap-2 border border-[var(--line)] bg-[var(--bg-card)] px-2.5 py-1 text-xs hover:border-[var(--accent)]"
          onClick={() => onRemove(filter.key)}
        >
          <span className="truncate">{filter.label}</span>
          <span aria-hidden="true">×</span>
        </button>
      ))}
      <Button type="button" variant="ghost" onClick={onClear}>Clear all</Button>
    </div>
  );
}
