import { db } from "@/db";
import { screenshots } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { SCREENSHOT_CATEGORIES } from "@/lib/constants";
import {
  deleteScreenshotFiles,
  isBlobScreenshotReference,
  readScreenshotFile,
  ScreenshotStorageNotConfiguredError,
} from "@/lib/screenshot-storage";
import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const [shot] = await db
    .select()
    .from(screenshots)
    .where(and(eq(screenshots.id, id), eq(screenshots.userId, session!.uid)));
  if (!shot) return jsonError("Not found", 404);
  try {
    const file = await readScreenshotFile(session!.uid, shot.fileName);
    if (!file) return jsonError("File missing", 404);
    const extension = shot.mimeType === "image/png" ? "png" : shot.mimeType === "image/webp" ? "webp" : shot.mimeType === "image/gif" ? "gif" : "jpg";
    const fileName = isBlobScreenshotReference(shot.fileName)
      ? `screenshot-${shot.id}.${extension}`
      : shot.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(file.body, {
      headers: {
        "Content-Type": shot.mimeType,
        "Content-Length": String(file.size),
        "Content-Disposition": `inline; filename="${fileName}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    if (cause instanceof ScreenshotStorageNotConfiguredError) return jsonError(cause.message, 503);
    console.error("Screenshot read failed", cause);
    return jsonError("File unavailable", 502);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const [shot] = await db
    .select()
    .from(screenshots)
    .where(and(eq(screenshots.id, id), eq(screenshots.userId, session!.uid)));
  if (!shot) return jsonError("Not found", 404);
  await db.delete(screenshots).where(eq(screenshots.id, id));
  await deleteScreenshotFiles(session!.uid, [shot.fileName]).catch(() => undefined);
  return NextResponse.json({ ok: true });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  if (body.caption !== undefined && (typeof body.caption !== "string" || body.caption.length > 500)) {
    return jsonError("Caption must be 500 characters or fewer");
  }
  if (body.category !== undefined && !SCREENSHOT_CATEGORIES.some((item) => item.value === body.category)) {
    return jsonError("Invalid screenshot category");
  }
  const [shot] = await db
    .select()
    .from(screenshots)
    .where(and(eq(screenshots.id, id), eq(screenshots.userId, session!.uid)));
  if (!shot) return jsonError("Not found", 404);
  const [updated] = await db
    .update(screenshots)
    .set({
      caption: typeof body.caption === "string" ? body.caption : shot.caption,
      category: typeof body.category === "string" ? body.category : shot.category,
    })
    .where(eq(screenshots.id, id))
    .returning();
  return NextResponse.json({ screenshot: updated });
}
