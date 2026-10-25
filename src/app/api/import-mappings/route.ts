import { db } from "@/db";
import { importMappingPresets } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { importMappingPresetSchema, importMappingPresetUpdateSchema } from "@/lib/validations";
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
  const presets = await db.select().from(importMappingPresets)
    .where(eq(importMappingPresets.userId, session!.uid)).orderBy(asc(importMappingPresets.name));
  return NextResponse.json({ presets });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = importMappingPresetSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid import mapping");
  const existing = await db.select({ id: importMappingPresets.id }).from(importMappingPresets)
    .where(eq(importMappingPresets.userId, session!.uid)).limit(30);
  if (existing.length >= 30) return jsonError("Import mapping presets are limited to 30 per workspace");
  try {
    const [preset] = await db.insert(importMappingPresets).values({ userId: session!.uid, ...parsed.data }).returning();
    return NextResponse.json({ preset }, { status: 201 });
  } catch (cause) {
    if (duplicateName(cause)) return jsonError("An import mapping preset with that name already exists", 409);
    throw cause;
  }
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = importMappingPresetUpdateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid import mapping");
  if (parsed.data.name === undefined && parsed.data.mapping === undefined) return jsonError("Name or mapping required");
  try {
    const [preset] = await db.update(importMappingPresets).set({
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.mapping !== undefined ? { mapping: parsed.data.mapping } : {}),
      updatedAt: new Date(),
    }).where(and(eq(importMappingPresets.id, parsed.data.id), eq(importMappingPresets.userId, session!.uid))).returning();
    if (!preset) return jsonError("Import mapping preset not found", 404);
    return NextResponse.json({ preset });
  } catch (cause) {
    if (duplicateName(cause)) return jsonError("An import mapping preset with that name already exists", 409);
    throw cause;
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return jsonError("Valid id required");
  const [preset] = await db.delete(importMappingPresets)
    .where(and(eq(importMappingPresets.id, id), eq(importMappingPresets.userId, session!.uid)))
    .returning({ id: importMappingPresets.id });
  if (!preset) return jsonError("Import mapping preset not found", 404);
  return NextResponse.json({ ok: true });
}
