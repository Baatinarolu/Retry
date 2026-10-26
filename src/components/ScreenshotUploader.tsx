"use client";

import { Banner, Button, Field, Input, Select } from "@/components/ui";
import { SCREENSHOT_CATEGORIES } from "@/lib/constants";
import { screenshotFileError } from "@/lib/screenshot-upload";
import { useRef, useState } from "react";

export function ScreenshotUploader({
  onUpload,
}: {
  onUpload: (file: File, category: string, caption: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const busyRef = useRef(false);
  const [category, setCategory] = useState("entry");
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [errors, setErrors] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  async function upload(files: File[]) {
    if (busyRef.current || !files.length) return;
    busyRef.current = true;
    setBusy(true);
    setErrors([]);
    setNotice("");
    let uploaded = 0;
    const failed: string[] = [];

    for (const [index, file] of files.entries()) {
      setProgress({ current: index + 1, total: files.length });
      const validationError = screenshotFileError(file);
      if (validationError) {
        failed.push(`${file.name}: ${validationError}`);
        continue;
      }
      try {
        await onUpload(file, category, caption);
        uploaded += 1;
      } catch (cause) {
        failed.push(`${file.name}: ${cause instanceof Error ? cause.message : "Upload failed"}`);
      }
    }

    if (uploaded) {
      if (!failed.length) setCaption("");
      setNotice(`${uploaded} ${uploaded === 1 ? "image" : "images"} uploaded${failed.length ? `; ${failed.length} failed` : ""}.`);
    }
    setErrors(failed);
    setProgress({ current: 0, total: 0 });
    setBusy(false);
    busyRef.current = false;
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
        <Field label="Caption for this batch">
          <Input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} disabled={busy} placeholder="What should future-you notice?" />
        </Field>
        <Button type="button" variant="ghost" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? `Uploading ${progress.current} / ${progress.total}` : "Choose images"}
        </Button>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={busy}
        multiple
        aria-label="Upload chart images"
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          void upload(files);
        }}
      />
      <div
        tabIndex={0}
        role="group"
        aria-label="Chart image drop and paste area"
        className={`border border-dashed px-4 py-5 text-center text-sm transition-colors ${dragging ? "border-[var(--accent)] bg-[var(--accent-wash)]" : "border-[var(--line-strong)]"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void upload(Array.from(event.dataTransfer.files));
        }}
        onPaste={(event) => {
          const files = Array.from(event.clipboardData.files);
          if (files.length) {
            event.preventDefault();
            void upload(files);
          }
        }}
      >
        <p className="font-medium">{busy ? "Keep this page open while your images upload." : "Drop images here, or focus this area and paste from the clipboard."}</p>
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">PNG, JPEG, WebP, or GIF · up to 4 MB each · private to your workspace. The selected category and caption apply to every image in the batch.</p>
      </div>
      {notice ? <Banner tone="good">{notice}</Banner> : null}
      {errors.length ? (
        <Banner tone="warn">
          <p>{errors.length === 1 ? "One image was not uploaded:" : `${errors.length} images were not uploaded:`}</p>
          <ul className="mt-1 list-inside list-disc">
            {errors.slice(0, 4).map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
            {errors.length > 4 ? <li>Plus {errors.length - 4} more failed uploads.</li> : null}
          </ul>
        </Banner>
      ) : null}
    </div>
  );
}
