import Decimal from "decimal.js";

export const MAX_RISK_LEVEL_SNAPSHOTS = 200;

export type RiskLevelSnapshotInput = {
  effectiveAt: string | Date;
  stopLoss?: string | number | null;
  takeProfit?: string | number | null;
  notes?: string;
};

export type NormalizedRiskLevelSnapshot = {
  effectiveAt: Date;
  stopLoss: string | null;
  takeProfit: string | null;
  notes: string;
};

export type RiskLevelBounds = {
  entryAt: Date;
  exitAt?: Date | null;
  now?: Date;
};

const blank = (value: unknown) => value === "" || value === null || value === undefined;

function normalizeLevel(value: string | number | null | undefined, field: string, line: number) {
  if (blank(value)) return null;
  let level: Decimal;
  try {
    level = new Decimal(value as string | number);
  } catch {
    throw new Error(`Risk snapshot ${line} ${field} must be a finite number`);
  }
  if (!level.isFinite() || level.lte(0)) throw new Error(`Risk snapshot ${line} ${field} must be greater than zero`);
  const normalized = level.toFixed(8);
  if (new Decimal(normalized).lte(0)) throw new Error(`Risk snapshot ${line} ${field} is too small to store`);
  return normalized;
}

/** Validate complete stop/target snapshots and order them by their effective time. */
export function normalizeRiskLevels(
  snapshots: RiskLevelSnapshotInput[],
  bounds: RiskLevelBounds,
): NormalizedRiskLevelSnapshot[] {
  if (snapshots.length > MAX_RISK_LEVEL_SNAPSHOTS) {
    throw new Error(`Risk histories are limited to ${MAX_RISK_LEVEL_SNAPSHOTS} snapshots`);
  }
  if (Number.isNaN(bounds.entryAt.getTime())) throw new Error("Trade entry time is invalid");
  if (bounds.exitAt && Number.isNaN(bounds.exitAt.getTime())) throw new Error("Trade exit time is invalid");
  const seen = new Set<number>();
  const normalized = snapshots.map((snapshot, index) => {
    const line = index + 1;
    const effectiveAt = snapshot.effectiveAt instanceof Date
      ? new Date(snapshot.effectiveAt)
      : new Date(snapshot.effectiveAt);
    if (Number.isNaN(effectiveAt.getTime())) throw new Error(`Risk snapshot ${line} has an invalid date/time`);
    const notes = snapshot.notes || "";
    if (notes.length > 500) throw new Error(`Risk snapshot ${line} notes must be 500 characters or fewer`);
    const time = effectiveAt.getTime();
    if (time < bounds.entryAt.getTime()) throw new Error(`Risk snapshot ${line} is before the trade entry`);
    if (bounds.exitAt && time > bounds.exitAt.getTime()) throw new Error(`Risk snapshot ${line} is after the trade exit`);
    if (bounds.now && time > bounds.now.getTime()) throw new Error(`Risk snapshot ${line} cannot be in the future`);
    if (seen.has(time)) throw new Error("Each risk snapshot in a trade needs a distinct timestamp");
    seen.add(time);
    return {
      effectiveAt,
      stopLoss: normalizeLevel(snapshot.stopLoss, "stop loss", line),
      takeProfit: normalizeLevel(snapshot.takeProfit, "take profit", line),
      notes,
    };
  });
  return normalized.sort((a, b) => a.effectiveAt.getTime() - b.effectiveAt.getTime());
}

function sameLevel(a: string | number | null | undefined, b: string | number | null | undefined) {
  if (blank(a) && blank(b)) return true;
  if (blank(a) || blank(b)) return false;
  return new Decimal(a as string | number).eq(new Decimal(b as string | number));
}

/** Count observable snapshot transitions without inferring why a level changed. */
export function summarizeRiskLevels(snapshots: RiskLevelSnapshotInput[]) {
  let stopChanges = 0;
  let targetChanges = 0;
  for (let index = 1; index < snapshots.length; index++) {
    if (!sameLevel(snapshots[index - 1].stopLoss, snapshots[index].stopLoss)) stopChanges++;
    if (!sameLevel(snapshots[index - 1].takeProfit, snapshots[index].takeProfit)) targetChanges++;
  }
  return { snapshots: snapshots.length, stopChanges, targetChanges };
}
