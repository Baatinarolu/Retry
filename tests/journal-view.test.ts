import assert from "node:assert/strict";
import test from "node:test";
import { emptyFilters } from "../src/lib/filter-state";
import {
  activeJournalFilters,
  defaultJournalPreferences,
  normalizeJournalPreferences,
} from "../src/lib/journal-view";

test("journal table defaults preserve the existing ledger and reject unknown saved preferences", () => {
  assert.deepEqual(defaultJournalPreferences(), {
    density: "comfortable",
    columns: ["id", "when", "instrument", "direction", "net", "r", "result", "plan", "review"],
  });
  assert.deepEqual(normalizeJournalPreferences({
    density: "compact",
    columns: ["strategy", "unknown", "id", "tags", "strategy"],
  }), { density: "compact", columns: ["id", "strategy", "tags"] });
  assert.deepEqual(normalizeJournalPreferences({ density: "compact", columns: [] }), { density: "compact", columns: ["id"] });
  assert.deepEqual(normalizeJournalPreferences("invalid"), defaultJournalPreferences());
});

test("active journal chips describe every non-empty filter and trim search", () => {
  const filters = {
    ...emptyFilters,
    from: "2026-10-01",
    to: "2026-10-25",
    accountId: "account-1",
    instrument: "EURUSD",
    strategyId: "strategy-1",
    direction: "short",
    session: "london",
    reviewStatus: "needs_follow_up",
  };
  const active = activeJournalFilters(filters, "  FOMO  ", {
    accounts: [{ id: "account-1", name: "Main" }],
    strategies: [{ id: "strategy-1", name: "London reversal" }],
  });
  assert.deepEqual(active.map((item) => item.key), [
    "from",
    "to",
    "accountId",
    "instrument",
    "strategyId",
    "direction",
    "session",
    "reviewStatus",
    "query",
  ]);
  assert.deepEqual(active.map((item) => item.label), [
    "From 2026-10-01",
    "To 2026-10-25",
    "Account: Main",
    "Instrument: EURUSD",
    "Strategy: London reversal",
    "Direction: Short",
    "Session: London",
    "Review: Needs follow-up",
    "Search: “FOMO”",
  ]);
  assert.deepEqual(activeJournalFilters(emptyFilters, "   "), []);
});
