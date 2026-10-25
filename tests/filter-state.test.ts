import assert from "node:assert/strict";
import test from "node:test";
import { emptyFilters, filterQuery, normalizeFilters } from "../src/lib/filter-state";

test("saved filter normalization clears omitted fields instead of retaining stale state", () => {
  const normalized = normalizeFilters({ direction: "short", reviewStatus: "needs_follow_up", accountId: 42 });
  assert.deepEqual(normalized, { ...emptyFilters, direction: "short", reviewStatus: "needs_follow_up" });
});

test("filter query omits empty values and encodes saved-view values", () => {
  assert.equal(filterQuery({ ...emptyFilters, instrument: "EUR USD", reviewStatus: "unreviewed" }), "instrument=EUR+USD&reviewStatus=unreviewed");
});
