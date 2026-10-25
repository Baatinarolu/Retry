import { del, get, put } from "@vercel/blob";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import path from "path";

const BLOB_PREFIX = "blob:";
const LOCAL_ROOT = path.join(process.cwd(), "data", "uploads");

export class ScreenshotStorageNotConfiguredError extends Error {
  constructor() {
    super("Private screenshot storage is not configured. Connect a private Vercel Blob store.");
    this.name = "ScreenshotStorageNotConfiguredError";
  }
}

function runningOnVercel() {
  return process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
}

function blobStorageConfigured() {
  return Boolean(
    process.env.BLOB_READ_WRITE_TOKEN ||
      (process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID),
  );
}

function requireBlobStorage() {
  if (!blobStorageConfigured()) throw new ScreenshotStorageNotConfiguredError();
}

export function isBlobScreenshotReference(reference: string) {
  return reference.startsWith(BLOB_PREFIX);
}

function localFilePath(userId: string, reference: string) {
  if (!reference || path.basename(reference) !== reference) throw new Error("Invalid local screenshot reference");
  return path.join(LOCAL_ROOT, userId, reference);
}

export async function saveScreenshotFile({
  userId,
  fileName,
  mimeType,
  buffer,
}: {
  userId: string;
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}) {
  if (runningOnVercel() || blobStorageConfigured()) {
    requireBlobStorage();
    const blob = await put(`trade-screenshots/${userId}/${fileName}`, buffer, {
      access: "private",
      contentType: mimeType,
      addRandomSuffix: false,
    });
    return `${BLOB_PREFIX}${blob.pathname}`;
  }

  const directory = path.join(LOCAL_ROOT, userId);
  await mkdir(directory, { recursive: true });
  await writeFile(localFilePath(userId, fileName), buffer, { flag: "wx" });
  return fileName;
}

export async function readScreenshotFile(userId: string, reference: string): Promise<{ body: BodyInit; size: number } | null> {
  if (isBlobScreenshotReference(reference)) {
    requireBlobStorage();
    const result = await get(reference.slice(BLOB_PREFIX.length), { access: "private" });
    if (!result || result.statusCode !== 200) return null;
    return { body: result.stream, size: result.blob.size };
  }

  try {
    const buffer = await readFile(localFilePath(userId, reference));
    return { body: new Uint8Array(buffer), size: buffer.byteLength };
  } catch {
    return null;
  }
}

export async function deleteScreenshotFiles(userId: string, references: string[]) {
  const blobPaths = references.filter(isBlobScreenshotReference).map((reference) => reference.slice(BLOB_PREFIX.length));
  if (blobPaths.length) {
    requireBlobStorage();
    for (let index = 0; index < blobPaths.length; index += 100) {
      await del(blobPaths.slice(index, index + 100));
    }
  }

  const localReferences = references.filter((reference) => !isBlobScreenshotReference(reference));
  await Promise.all(
    localReferences.map((reference) => unlink(localFilePath(userId, reference)).catch(() => undefined)),
  );
}
