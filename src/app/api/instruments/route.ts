import { db } from "@/db";
import { instruments } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { instrumentSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const list = await db.select().from(instruments).where(eq(instruments.userId, session!.uid));
  return NextResponse.json({ instruments: list });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = instrumentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid instrument");
  const [row] = await db
    .insert(instruments)
    .values({
      userId: session!.uid,
      symbol: parsed.data.symbol.toUpperCase(),
      name: parsed.data.name,
      category: parsed.data.category || "forex",
      contractSize: String(parsed.data.contractSize || "1"),
      tickSize: String(parsed.data.tickSize || "0.00001"),
      tickValue: String(parsed.data.tickValue || "1"),
      pipSize: String(parsed.data.pipSize || "0.0001"),
      pipValue: String(parsed.data.pipValue || "10"),
      quoteCurrency: parsed.data.quoteCurrency || "USD",
      notes: parsed.data.notes || "",
    })
    .returning();
  return NextResponse.json({ instrument: row }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return jsonError("id required");
  await db.delete(instruments).where(and(eq(instruments.id, id), eq(instruments.userId, session!.uid)));
  return NextResponse.json({ ok: true });
}
