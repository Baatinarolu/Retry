import { db } from "@/db";
import { savedViews } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { savedViewSchema, savedViewUpdateSchema } from "@/lib/validations";
import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export const dynamic = "force-dynamic";

function duplicateName(cause: unknown) {
  return typeof cause === "object" && cause !== null && "code" in cause && cause.code === "23505";
}

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const views = await db.select().from(savedViews).where(eq(savedViews.userId, session!.uid)).orderBy(asc(savedViews.name));
  return NextResponse.json({ views });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = savedViewSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid saved view");
  const existing = await db.select({ id: savedViews.id }).from(savedViews).where(eq(savedViews.userId, session!.uid)).limit(30);
  if (existing.length >= 30) return jsonError("Saved views are limited to 30 per workspace");
  try {
    const [view] = await db.insert(savedViews).values({ userId: session!.uid, ...parsed.data }).returning();
    return NextResponse.json({ view }, { status: 201 });
  } catch (cause) {
    if (duplicateName(cause)) return jsonError("A saved view with that name already exists", 409);
    throw cause;
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = savedViewUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid saved view");
  if (parsed.data.name === undefined && parsed.data.filters === undefined) return jsonError("Name or filters required");
  try {
    const [view] = await db
      .update(savedViews)
      .set({
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.filters !== undefined ? { filters: parsed.data.filters } : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(savedViews.id, parsed.data.id), eq(savedViews.userId, session!.uid)))
      .returning();
    if (!view) return jsonError("Saved view not found", 404);
    return NextResponse.json({ view });
  } catch (cause) {
    if (duplicateName(cause)) return jsonError("A saved view with that name already exists", 409);
    throw cause;
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return jsonError("Valid id required");
  const [view] = await db
    .delete(savedViews)
    .where(and(eq(savedViews.id, id), eq(savedViews.userId, session!.uid)))
    .returning({ id: savedViews.id });
  if (!view) return jsonError("Saved view not found", 404);
  return NextResponse.json({ ok: true });
}
