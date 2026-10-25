import Decimal from "decimal.js";
import { parseCsv } from "@/lib/csv";

export const MAX_PRICE_PATH_POINTS = 500;

export type PricePathPointInput = {
  observedAt: string | Date;
  price: string | number;
  notes?: string;
};

export type NormalizedPricePathPoint = {
  observedAt: Date;
  price: string;
  notes: string;
};

export type PricePathBounds = {
  entryAt: Date;
  exitAt?: Date | null;
  now?: Date;
};

/** Validate, bound, and deterministically order manually recorded market prices. */
export function normalizePricePath(points: PricePathPointInput[], bounds: PricePathBounds): NormalizedPricePathPoint[] {
  if (points.length > MAX_PRICE_PATH_POINTS) throw new Error(`Price paths are limited to ${MAX_PRICE_PATH_POINTS} points`);
  if (Number.isNaN(bounds.entryAt.getTime())) throw new Error("Trade entry time is invalid");
  if (bounds.exitAt && Number.isNaN(bounds.exitAt.getTime())) throw new Error("Trade exit time is invalid");
  const seen = new Set<number>();
  const normalized = points.map((point, index) => {
    const line = index + 1;
    const observedAt = point.observedAt instanceof Date ? new Date(point.observedAt) : new Date(point.observedAt);
    if (Number.isNaN(observedAt.getTime())) throw new Error(`Price point ${line} has an invalid date/time`);
    let price: Decimal;
    try {
      price = new Decimal(point.price);
    } catch {
      throw new Error(`Price point ${line} price must be a finite number`);
    }
    if (!price.isFinite() || price.lte(0)) throw new Error(`Price point ${line} price must be greater than zero`);
    const normalizedPrice = price.toFixed(8);
    if (new Decimal(normalizedPrice).lte(0)) throw new Error(`Price point ${line} price is too small to store`);
    const notes = point.notes || "";
    if (notes.length > 500) throw new Error(`Price point ${line} notes must be 500 characters or fewer`);
    const time = observedAt.getTime();
    if (time < bounds.entryAt.getTime()) throw new Error(`Price point ${line} is before the trade entry`);
    if (bounds.exitAt && time > bounds.exitAt.getTime()) throw new Error(`Price point ${line} is after the trade exit`);
    if (bounds.now && time > bounds.now.getTime()) throw new Error(`Price point ${line} cannot be in the future`);
    if (seen.has(time)) throw new Error("Each price point in a trade needs a distinct timestamp");
    seen.add(time);
    return { observedAt, price: normalizedPrice, notes };
  });
  return normalized.sort((a, b) => a.observedAt.getTime() - b.observedAt.getTime());
}

function editorCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

export function serializePricePath(points: PricePathPointInput[]) {
  return points.map((point) => [
    point.observedAt instanceof Date ? point.observedAt.toISOString() : point.observedAt,
    point.price,
    point.notes || "",
  ].map(editorCell).join(",")).join("\n");
}

/** The editor accepts data rows under an implicit observed_at,price,notes header. */
export function parsePricePathDraft(draft: string): PricePathPointInput[] {
  if (!draft.trim()) return [];
  const parsed = parseCsv(`observed_at,price,notes\n${draft}`);
  return parsed.rows.map((row) => ({
    observedAt: row.observed_at || "",
    price: row.price || "",
    notes: row.notes || "",
  }));
}
