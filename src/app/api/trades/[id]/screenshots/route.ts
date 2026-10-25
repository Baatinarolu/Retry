import { db } from "@/db";
import { screenshots, trades } from "@/db/schema";
import { jsonError, requireUser } from "@/lib/api";
import { ALLOWED_IMAGE_TYPES, MAX_UPLOAD_BYTES, SCREENSHOT_CATEGORIES } from "@/lib/constants";
import {
  deleteScreenshotFiles,
  saveScreenshotFile,
  ScreenshotStorageNotConfiguredError,
} from "@/lib/screenshot-storage";
import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function validSignature(mimeType: string, buffer: Buffer) {
  if (mimeType === "image/jpeg") return buffer.length >= 3 && buffer.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
  if (mimeType === "image/png") {
    return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireUser();
  if (error) return error;
  const { id } = await ctx.params;
  const [trade] = await db
    .select({ id: trades.id })
    .from(trades)
    .where(and(eq(trades.id, id), eq(trades.userId, session!.uid)));
  if (!trade) return jsonError("Trade not found", 404);

  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("Invalid upload");
  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Image file is required");
  if (file.size === 0) return jsonError("Image file is empty");
  if (file.size > MAX_UPLOAD_BYTES) return jsonError("Image must be 4MB or smaller");
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) return jsonError("Only JPEG, PNG, WebP, and GIF are allowed");
  const category = String(form.get("category") || "entry");
  const caption = String(form.get("caption") || "").trim();
  if (!SCREENSHOT_CATEGORIES.some((item) => item.value === category)) return jsonError("Invalid screenshot category");
  if (caption.length > 500) return jsonError("Caption must be 500 characters or fewer");

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!validSignature(file.type, buffer)) return jsonError("File contents do not match the declared image type");
  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : file.type === "image/gif" ? "gif" : "jpg";
  const fileName = `${nanoid()}.${extension}`;
  let storedReference: string;
  try {
    storedReference = await saveScreenshotFile({ userId: session!.uid, fileName, mimeType: file.type, buffer });
  } catch (cause) {
    if (cause instanceof ScreenshotStorageNotConfiguredError) return jsonError(cause.message, 503);
    console.error("Screenshot storage failed", cause);
    return jsonError("Could not store screenshot. Please try again.", 502);
  }

  try {
    const [shot] = await db
      .insert(screenshots)
      .values({
        tradeId: id,
        userId: session!.uid,
        category,
        caption,
        fileName: storedReference,
        mimeType: file.type,
        sizeBytes: file.size,
      })
      .returning();
    return NextResponse.json({ screenshot: shot }, { status: 201 });
  } catch (cause) {
    await deleteScreenshotFiles(session!.uid, [storedReference]).catch(() => undefined);
    throw cause;
  }
}
