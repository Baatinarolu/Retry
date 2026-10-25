import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  deleteScreenshotFiles,
  isBlobScreenshotReference,
  readScreenshotFile,
  saveScreenshotFile,
} from "../src/lib/screenshot-storage";

test("local screenshot storage round-trips and cleans up private files", async (t) => {
  const keys = ["VERCEL", "VERCEL_ENV", "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "VERCEL_OIDC_TOKEN"];
  const previous = new Map(keys.map((key) => [key, process.env[key]]));
  for (const key of keys) delete process.env[key];

  const userId = randomUUID();
  const fileName = `${randomUUID()}.png`;
  t.after(async () => {
    await deleteScreenshotFiles(userId, [fileName]).catch(() => undefined);
    for (const key of keys) {
      const value = previous.get(key);
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  const buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  const reference = await saveScreenshotFile({ userId, fileName, mimeType: "image/png", buffer });
  assert.equal(reference, fileName);
  assert.equal(isBlobScreenshotReference(reference), false);
  assert.equal(isBlobScreenshotReference("blob:trade-screenshots/user/file.png"), true);

  const stored = await readScreenshotFile(userId, reference);
  assert.equal(stored?.size, buffer.length);
  assert.ok(stored?.body instanceof Uint8Array);

  await deleteScreenshotFiles(userId, [reference]);
  assert.equal(await readScreenshotFile(userId, reference), null);
});
