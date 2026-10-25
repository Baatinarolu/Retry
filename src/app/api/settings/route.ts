import { db } from "@/db";
import { screenshots, users } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { deleteScreenshotFiles } from "@/lib/screenshot-storage";
import { settingsSchema } from "@/lib/validations";
import { eq } from "drizzle-orm";
import { rm } from "fs/promises";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  const [user] = await db.select().from(users).where(eq(users.id, session!.uid));
  if (!user) return jsonError("Not found", 404);
  const { passwordHash: _p, ...safe } = user;
  return NextResponse.json({ user: safe });
}

export async function PATCH(req: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid settings");
  const [user] = await db
    .update(users)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(users.id, session!.uid))
    .returning();
  const { passwordHash: _p, ...safe } = user;
  return NextResponse.json({ user: safe });
}

export async function DELETE() {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { clearSessionCookie } = await import("@/lib/auth");
  const shots = await db
    .select({ fileName: screenshots.fileName })
    .from(screenshots)
    .where(eq(screenshots.userId, session!.uid));
  await db.delete(users).where(eq(users.id, session!.uid));
  await clearSessionCookie();
  await deleteScreenshotFiles(session!.uid, shots.map((shot) => shot.fileName)).catch(() => undefined);
  await rm(path.join(process.cwd(), "data", "uploads", session!.uid), { recursive: true, force: true }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
