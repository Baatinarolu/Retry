import { jsonError, requireUser } from "@/lib/api";
import { MAX_BACKUP_BYTES } from "@/lib/backup";
import { exportWorkspace, restoreWorkspace } from "@/lib/backup-service";
import { ScreenshotStorageNotConfiguredError } from "@/lib/screenshot-storage";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const { session, error } = await requireUser();
  if (error) return error;
  try {
    const backup = await exportWorkspace(session!.uid);
    const json = JSON.stringify(backup);
    if (Buffer.byteLength(json) > MAX_BACKUP_BYTES) return jsonError("Workspace backup exceeds the 48 MB portable-backup limit; attachments must be exported in smaller batches", 413);
    return new NextResponse(json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="trademind-workspace-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (cause) {
    console.error("Workspace backup failed", cause);
    return jsonError(cause instanceof Error ? cause.message : "Could not create workspace backup", 500);
  }
}

export async function POST(request: NextRequest) {
  const { session, error } = await requireUser({ write: true });
  if (error) return error;
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_BACKUP_BYTES) return jsonError("Backup request is too large", 413);
  const text = await request.text().catch(() => "");
  if (Buffer.byteLength(text) > MAX_BACKUP_BYTES) return jsonError("Backup request is too large", 413);
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError("Invalid backup JSON");
  }
  if (body?.confirmation !== "RESTORE WORKSPACE") return jsonError("Type RESTORE WORKSPACE to confirm replacing the current workspace");
  try {
    const result = await restoreWorkspace(session!.uid, body.backup);
    return NextResponse.json({ ok: true, ...result });
  } catch (cause) {
    if (cause instanceof ScreenshotStorageNotConfiguredError) return jsonError(cause.message, 503);
    console.error("Workspace restore failed", cause);
    return jsonError(cause instanceof Error ? cause.message : "Restore failed; the existing workspace was left unchanged", 400);
  }
}
