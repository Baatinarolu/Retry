import assert from "node:assert/strict";
import test from "node:test";
import { MAX_UPLOAD_BYTES } from "../src/lib/constants";
import { screenshotFileError } from "../src/lib/screenshot-upload";

test("client upload feedback accepts every supported image at the exact 4 MB boundary", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/gif"]) {
    assert.equal(screenshotFileError({ type, size: MAX_UPLOAD_BYTES }), null);
  }
});

test("client upload feedback rejects unsupported, empty, and oversized files before upload", () => {
  assert.match(screenshotFileError({ type: "image/svg+xml", size: 100 }) || "", /Only JPEG/);
  assert.match(screenshotFileError({ type: "image/png", size: 0 }) || "", /empty/);
  assert.match(screenshotFileError({ type: "image/png", size: MAX_UPLOAD_BYTES + 1 }) || "", /4 MB/);
});
