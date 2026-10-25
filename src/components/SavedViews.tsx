"use client";

import { Banner, Button, Field, Input, Select } from "@/components/ui";
import { apiJson } from "@/lib/client-api";
import { normalizeFilters, type FilterState } from "@/lib/filter-state";
import { useEffect, useState } from "react";

type SavedView = {
  id: string;
  name: string;
  filters: Partial<FilterState>;
  updatedAt: string;
};

export function SavedViews({ value, onChange }: { value: FilterState; onChange: (next: FilterState) => void }) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ views: SavedView[] }>("/api/views", { signal: controller.signal })
      .then((data) => setViews(data.views || []))
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) {
          setError(cause instanceof Error ? cause.message : "Could not load saved views");
        }
      });
    return () => controller.abort();
  }, []);

  function apply(id: string) {
    setSelectedId(id);
    const view = views.find((candidate) => candidate.id === id);
    if (view) {
      setName(view.name);
      onChange(normalizeFilters(view.filters));
    }
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name this view before saving");
      return;
    }
    setSaving(true);
    setError("");
    const existing = views.find((view) => view.name.toLowerCase() === trimmed.toLowerCase());
    try {
      const data = await apiJson<{ view: SavedView }>("/api/views", {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({ ...(existing ? { id: existing.id } : {}), name: trimmed, filters: value }),
      });
      setViews((current) => [...current.filter((view) => view.id !== data.view.id), data.view].sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(data.view.id);
      setName(data.view.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save view");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    setDeleting(true);
    setError("");
    try {
      await apiJson(`/api/views?id=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      setViews((current) => current.filter((view) => view.id !== selectedId));
      setSelectedId("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete view");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-4 border-t border-[var(--line)] pt-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Apply saved view">
            <Select value={selectedId} onChange={(event) => apply(event.target.value)}>
              <option value="">Choose a saved view</option>
              {views.map((view) => <option key={view.id} value={view.id}>{view.name}</option>)}
            </Select>
          </Field>
        </div>
        <form className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end" onSubmit={save}>
          <div className="min-w-0 flex-1">
            <Field label="Save current filters">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. London review queue" />
            </Field>
          </div>
          <Button type="submit" loading={saving}>Save</Button>
        </form>
        <Button type="button" variant="ghost" onClick={remove} loading={deleting} disabled={deleting || !selectedId}>Delete</Button>
      </div>
      {error ? <div className="mt-3"><Banner tone="warn">{error}</Banner></div> : null}
    </div>
  );
}
