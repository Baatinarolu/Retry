import { createHash } from "node:crypto";

export type ImportSource = {
  sourceKey: string;
  sourceHash: string;
};

export function canonicalImportRow(row: Record<string, string>) {
  return Object.fromEntries(
    Object.entries(row)
      .map(([key, value]) => [key.trim(), value.trim()] as const)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

export function hashImportRow(row: Record<string, string>) {
  return createHash("sha256").update(JSON.stringify(canonicalImportRow(row))).digest("hex");
}

export function hashImportFile(csv: string) {
  return createHash("sha256").update(csv).digest("hex");
}

/** Explicit broker IDs are stable; otherwise an exact canonical row is the fallback identity. */
export function importSource(row: Record<string, string>, sourceId?: string): ImportSource {
  const sourceHash = hashImportRow(row);
  const id = sourceId?.trim();
  if (id && id.length > 120) throw new Error("Source ID must be 120 characters or fewer");
  return { sourceKey: id ? `id:${id}` : `hash:${sourceHash}`, sourceHash };
}

export function sourceConflict(existing: ImportSource, incoming: ImportSource) {
  if (existing.sourceKey !== incoming.sourceKey) return null;
  return existing.sourceHash === incoming.sourceHash
    ? "duplicate"
    : "Source ID was already imported with different content; reconcile it instead of overwriting";
}

export function normalizeExecutionType(value: string) {
  const type = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["entry", "open", "open_entry", "initial"].includes(type)) return "entry" as const;
  if (["scale_in", "add", "addition", "increase"].includes(type)) return "scale_in" as const;
  if (["scale_out", "partial", "reduce", "reduction", "decrease"].includes(type)) return "scale_out" as const;
  if (["exit", "close", "closed", "closing"].includes(type)) return "exit" as const;
  return null;
}

export function isExecutionCsv(headers: string[]) {
  return headers.includes("execution_type") || headers.includes("fill_type") || headers.includes("executionType");
}
