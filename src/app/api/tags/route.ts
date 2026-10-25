import { db } from "@/db";
import { tags } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { tagSchema } from "@/lib/validations";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const list = await db.select().from(tags).where(eq(tags.userId, session!.uid));
  return NextResponse.json({ tags: list });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const parsed = tagSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message || "Invalid tag");
  try {
    const [tag] = await db
      .insert(tags)
      .values({
        userId: session!.uid,
        name: parsed.data.name,
        category: parsed.data.category,
        color: parsed.data.color,
      })
      .returning();
    return NextResponse.json({ tag }, { status: 201 });
  } catch {
    return jsonError("Tag already exists");
  }
}

export async function DELETE(req: NextRequest) {
  const { session, error } = await requireUser();
  if (error) return error;
  const id = new URL(req.url).searchParams.get("id");
  if (!id || !z.string().uuid().safeParse(id).success) return jsonError("Valid id required");
  await db.delete(tags).where(and(eq(tags.id, id), eq(tags.userId, session!.uid)));
  return NextResponse.json({ ok: true });
}
