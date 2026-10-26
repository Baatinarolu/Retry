import { SESSIONS } from "@/lib/constants";
import type { FilterState } from "@/lib/filter-state";

export const JOURNAL_COLUMNS = [
  { id: "id", label: "ID" },
  { id: "when", label: "When" },
  { id: "instrument", label: "Instrument" },
  { id: "direction", label: "Dir" },
  { id: "strategy", label: "Strategy" },
  { id: "tags", label: "Tags" },
  { id: "screenshots", label: "Images" },
  { id: "net", label: "Net" },
  { id: "r", label: "R" },
  { id: "result", label: "Result" },
  { id: "plan", label: "Plan" },
  { id: "review", label: "Review" },
] as const;

export type JournalColumnId = (typeof JOURNAL_COLUMNS)[number]["id"];
export type JournalDensity = "comfortable" | "compact";
export type JournalPreferences = { density: JournalDensity; columns: JournalColumnId[] };

const defaultColumns: JournalColumnId[] = ["id", "when", "instrument", "direction", "net", "r", "result", "plan", "review"];
const columnIds = new Set<string>(JOURNAL_COLUMNS.map((column) => column.id));

export function defaultJournalPreferences(): JournalPreferences {
  return { density: "comfortable", columns: [...defaultColumns] };
}

export function normalizeJournalPreferences(input: unknown): JournalPreferences {
  if (!input || typeof input !== "object") return defaultJournalPreferences();
  const value = input as { columns?: unknown; density?: unknown };
  const requested = Array.isArray(value.columns)
    ? value.columns.filter((column): column is JournalColumnId => typeof column === "string" && columnIds.has(column))
    : defaultColumns;
  return {
    density: value.density === "compact" ? "compact" : "comfortable",
    columns: JOURNAL_COLUMNS.map((column) => column.id).filter((id) => id === "id" || requested.includes(id)),
  };
}

export type ActiveJournalFilter = { key: keyof FilterState | "query"; label: string };

export function activeJournalFilters(
  filters: FilterState,
  query: string,
  lookups: { accounts?: Array<{ id: string; name: string }>; strategies?: Array<{ id: string; name: string }> } = {},
): ActiveJournalFilter[] {
  const active: ActiveJournalFilter[] = [];
  const add = (key: keyof FilterState, label: string) => {
    if (filters[key]) active.push({ key, label });
  };
  add("from", `From ${filters.from}`);
  add("to", `To ${filters.to}`);
  add("accountId", `Account: ${lookups.accounts?.find((account) => account.id === filters.accountId)?.name || "Unavailable"}`);
  add("instrument", `Instrument: ${filters.instrument}`);
  add("strategyId", `Strategy: ${lookups.strategies?.find((strategy) => strategy.id === filters.strategyId)?.name || "Unavailable"}`);
  add("direction", `Direction: ${filters.direction === "long" ? "Long" : filters.direction === "short" ? "Short" : filters.direction}`);
  add("session", `Session: ${SESSIONS.find((session) => session.value === filters.session)?.label || filters.session}`);
  const reviewLabels: Record<string, string> = { unreviewed: "Unreviewed", reviewed: "Reviewed", needs_follow_up: "Needs follow-up" };
  add("reviewStatus", `Review: ${reviewLabels[filters.reviewStatus] || filters.reviewStatus}`);
  if (query.trim()) active.push({ key: "query", label: `Search: “${query.trim()}”` });
  return active;
}
