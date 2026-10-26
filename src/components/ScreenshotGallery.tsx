"use client";

import { Banner, Button, Field, Input, Select } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { SCREENSHOT_CATEGORIES } from "@/lib/constants";
import Image from "next/image";
import { useEffect, useState } from "react";

export type TradeScreenshot = {
  id: string;
  category: string;
  caption: string;
  createdAt: string;
};

function categoryLabel(category: string) {
  return SCREENSHOT_CATEGORIES.find((item) => item.value === category)?.label || "Supporting image";
}

export function ScreenshotLightbox({ screenshotId, onClose }: { screenshotId: string | null; onClose: () => void }) {
  useEffect(() => {
    if (!screenshotId) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [screenshotId, onClose]);

  if (!screenshotId) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black/80 p-4 sm:p-6">
      <div role="dialog" aria-modal="true" aria-label="Expanded chart screenshot" className="max-h-full max-w-full">
        <div className="mb-3 flex justify-end gap-2">
          <a href={`/api/screenshots/${screenshotId}`} download className="btn btn-ghost border-white/40 text-white">Download original</a>
          <Button type="button" variant="ghost" autoFocus className="border-white/40 text-white" onClick={onClose}>Close</Button>
        </div>
        <Image
          src={`/api/screenshots/${screenshotId}`}
          alt="Expanded chart screenshot"
          width={1600}
          height={1200}
          unoptimized
          className="h-auto max-h-[calc(100vh-8rem)] w-auto max-w-full border border-[var(--line-strong)] object-contain"
        />
      </div>
    </div>
  );
}

function ScreenshotCard({
  screenshot,
  onUpdated,
  onDeleted,
  onZoom,
}: {
  screenshot: TradeScreenshot;
  onUpdated: (screenshot: TradeScreenshot) => void;
  onDeleted: (id: string) => void;
  onZoom: (id: string) => void;
}) {
  const [category, setCategory] = useState(screenshot.category);
  const [caption, setCaption] = useState(screenshot.caption);
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const [error, setError] = useState("");
  const [source, setSource] = useState({ category: screenshot.category, caption: screenshot.caption });
  if (source.category !== screenshot.category || source.caption !== screenshot.caption) {
    // Keep duplicate detail/editor galleries in sync without a post-render effect.
    setSource({ category: screenshot.category, caption: screenshot.caption });
    setCategory(screenshot.category);
    setCaption(screenshot.caption);
  }
  const dirty = category !== screenshot.category || caption !== screenshot.caption;

  async function save() {
    if (!dirty || busy) return;
    setBusy("save");
    setError("");
    try {
      const data = await apiJson<{ screenshot: TradeScreenshot }>(`/api/screenshots/${screenshot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, caption }),
      });
      setCategory(data.screenshot.category);
      setCaption(data.screenshot.caption);
      onUpdated(data.screenshot);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update image details");
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    if (busy || !confirm("Delete this chart image? This cannot be undone.")) return;
    setBusy("delete");
    setError("");
    try {
      await apiJson(`/api/screenshots/${screenshot.id}`, { method: "DELETE" });
      onDeleted(screenshot.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete image");
      setBusy(null);
    }
  }

  return (
    <figure className="card-quiet overflow-hidden">
      <button type="button" onClick={() => onZoom(screenshot.id)} className="block w-full" aria-label={`Expand ${categoryLabel(screenshot.category)}`}>
        <Image
          src={`/api/screenshots/${screenshot.id}`}
          alt={screenshot.caption || categoryLabel(screenshot.category)}
          width={640}
          height={320}
          unoptimized
          className="h-40 w-full object-cover"
        />
      </button>
      <figcaption className="space-y-3 p-3">
        <Field label="Category">
          <Select value={category} onChange={(event) => setCategory(event.target.value)} disabled={busy !== null}>
            {SCREENSHOT_CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </Select>
        </Field>
        <Field label="Caption">
          <Input value={caption} onChange={(event) => setCaption(event.target.value)} maxLength={500} disabled={busy !== null} placeholder="Add review context" />
        </Field>
        {error ? <Banner tone="warn">{error}</Banner> : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" loading={busy === "save"} disabled={!dirty || busy !== null} onClick={save}>Save details</Button>
          <a href={`/api/screenshots/${screenshot.id}`} download className={`btn btn-ghost ${busy ? "pointer-events-none opacity-50" : ""}`}>Download</a>
          <Button type="button" variant="danger" loading={busy === "delete"} disabled={busy !== null} onClick={remove}>Delete</Button>
        </div>
      </figcaption>
    </figure>
  );
}

export function ScreenshotGallery({
  screenshots,
  onUpdated,
  onDeleted,
  onZoom,
}: {
  screenshots: TradeScreenshot[];
  onUpdated: (screenshot: TradeScreenshot) => void;
  onDeleted: (id: string) => void;
  onZoom: (id: string) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {screenshots.map((screenshot) => (
        <ScreenshotCard key={screenshot.id} screenshot={screenshot} onUpdated={onUpdated} onDeleted={onDeleted} onZoom={onZoom} />
      ))}
    </div>
  );
}
