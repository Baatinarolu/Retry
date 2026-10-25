import { db } from "@/db";
import { fxRates } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { normalizeFxRate } from "@/lib/fx";
import { fxRateSchema } from "@/lib/validations";
import { and, desc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const rates = await db.select().from(fxRates)
    .where(eq(fxRates.userId, session!.uid))
    .orderBy(desc(fxRates.effectiveAt), desc(fxRates.createdAt));
  return NextResponse.json({ rates });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = fxRateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid FX rate");
  try {
    const normalized = normalizeFxRate(parsed.data);
    const [rate] = await db.insert(fxRates).values({
      userId: session!.uid,
      fromCurrency: normalized.fromCurrency,
      toCurrency: normalized.toCurrency,
      rate: normalized.rate,
      effectiveAt: normalized.effectiveAt,
      source: normalized.source,
      notes: normalized.notes,
    }).returning();
    return NextResponse.json({ rate }, { status: 201 });
  } catch (cause) {
    return jsonError(cause instanceof Error ? cause.message : "Could not save FX rate");
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("FX rate ID is required");
  const [deleted] = await db.delete(fxRates)
    .where(and(eq(fxRates.id, id), eq(fxRates.userId, session!.uid)))
    .returning({ id: fxRates.id });
  if (!deleted) return jsonError("FX rate not found", 404);
  return NextResponse.json({ ok: true });
}
