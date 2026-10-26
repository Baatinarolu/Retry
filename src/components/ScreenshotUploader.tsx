"use client";

import { Banner, Field, Input, Select } from "@/components/ui";
import { SCREENSHOT_CATEGORIES } from "@/lib/constants";
import { useState } from "react";

export function ScreenshotUploader({
  onUpload,
}: {
  onUpload: (file: File, category: string, caption: string) => Promise<void>;
}) {
  const [category, setCategory] = useState("entry");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function upload(file: File) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onUpload(file, category, caption);
      setCaption("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <Field label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} disabled={busy}>
            {SCREENSHOT_CATEGORIES.map((item) => (
              <option key={item.value} value={item.value}>{item.label}</option>
            ))}
          </Select>
        </Field>
        <Field label="Caption">
          <Input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} disabled={busy} placeholder="What should future-you notice?" />
        </Field>
        <label className={`btn btn-ghost cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`}>
          {busy ? "Uploading…" : "Choose image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            disabled={busy}
            aria-label="Upload chart image"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
        </label>
      </div>
      <p className="text-xs text-[var(--muted)]">PNG, JPEG, WebP, or GIF · up to 4 MB · private to your workspace.</p>
      {error ? <Banner tone="warn">{error}</Banner> : null}
    </div>
  );
}
