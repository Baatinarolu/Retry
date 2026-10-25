"use client";

import { Banner, Button, Field, Input, Select } from "@/components/ui";
import { apiJson, errorMessage } from "@/lib/client-api";
import {
  IMPORT_FIELD_DEFINITIONS,
  type ImportColumnMapping,
  type ImportField,
} from "@/lib/import-mapping";
import { useEffect, useState } from "react";

type ImportMappingPreset = {
  id: string;
  name: string;
  mapping: ImportColumnMapping;
  updatedAt: string;
};

type Props = {
  headers: string[];
  value: ImportColumnMapping;
  onChange: (mapping: ImportColumnMapping) => void;
};

export function ImportMappingPresets({ headers, value, onChange }: Props) {
  const [presets, setPresets] = useState<ImportMappingPreset[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");
  const [field, setField] = useState<ImportField>("instrument");
  const [source, setSource] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const activeSource = headers.includes(source) ? source : headers[0] || "";

  useEffect(() => {
    const controller = new AbortController();
    apiJson<{ presets: ImportMappingPreset[] }>("/api/import-mappings", { signal: controller.signal })
      .then((data) => setPresets(data.presets || []))
      .catch((cause: unknown) => {
        const message = errorMessage(cause, "Could not load import mapping presets");
        if (message) setError(message);
      });
    return () => controller.abort();
  }, []);

  function apply(id: string) {
    setSelectedId(id);
    const preset = presets.find((candidate) => candidate.id === id);
    if (preset) {
      setName(preset.name);
      onChange({ ...preset.mapping });
    }
  }

  function addMapping() {
    if (!activeSource || value[field]) return;
    onChange({ ...value, [field]: activeSource });
    const next = IMPORT_FIELD_DEFINITIONS.find((candidate) => candidate.key !== field && !value[candidate.key]);
    if (next) setField(next.key);
  }

  function updateSource(key: ImportField, nextSource: string) {
    onChange({ ...value, [key]: nextSource });
  }

  function removeMapping(key: ImportField) {
    const next = { ...value };
    delete next[key];
    onChange(next);
    setField(key);
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Name this mapping before saving");
      return;
    }
    if (!Object.keys(value).length) {
      setError("Map at least one column before saving a preset");
      return;
    }
    setSaving(true);
    setError("");
    const existing = presets.find((preset) => preset.name.toLowerCase() === trimmed.toLowerCase());
    try {
      const data = await apiJson<{ preset: ImportMappingPreset }>("/api/import-mappings", {
        method: existing ? "PATCH" : "POST",
        body: JSON.stringify({ ...(existing ? { id: existing.id } : {}), name: trimmed, mapping: value }),
      });
      setPresets((current) => [...current.filter((preset) => preset.id !== data.preset.id), data.preset]
        .sort((a, b) => a.name.localeCompare(b.name)));
      setSelectedId(data.preset.id);
      setName(data.preset.name);
      onChange({ ...data.preset.mapping });
    } catch (cause) {
      setError(errorMessage(cause, "Could not save import mapping") || "Could not save import mapping");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!selectedId) return;
    setDeleting(true);
    setError("");
    try {
      await apiJson(`/api/import-mappings?id=${encodeURIComponent(selectedId)}`, { method: "DELETE" });
      setPresets((current) => current.filter((preset) => preset.id !== selectedId));
      setSelectedId("");
      setName("");
    } catch (cause) {
      setError(errorMessage(cause, "Could not delete import mapping") || "Could not delete import mapping");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[2px] border border-[var(--line)] p-4">
      <div>
        <p className="eyebrow mb-2">Broker column mapping</p>
        <p className="text-xs leading-5 text-[var(--muted)]">
          Automatic aliases remain active. Explicit mappings take precedence and are snapshotted with the next import preview.
        </p>
      </div>

      {headers.length ? (
        <div className="space-y-3">
          {IMPORT_FIELD_DEFINITIONS.filter((definition) => value[definition.key]).map((definition) => {
            const currentSource = value[definition.key]!;
            const missing = !headers.includes(currentSource);
            return (
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end" key={definition.key}>
                <div className="text-sm sm:pb-2">{definition.label}</div>
                <Select aria-label={`Source column for ${definition.label}`} value={currentSource}
                  onChange={(event) => updateSource(definition.key, event.target.value)}>
                  {missing ? <option value={currentSource}>{currentSource} (missing from CSV)</option> : null}
                  {headers.map((header) => <option key={header} value={header}>{header}</option>)}
                </Select>
                <Button type="button" variant="ghost" onClick={() => removeMapping(definition.key)}
                  aria-label={`Remove ${definition.label} mapping`}>Remove</Button>
              </div>
            );
          })}
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field label="Journal field">
              <Select value={field} onChange={(event) => setField(event.target.value as ImportField)}>
                {IMPORT_FIELD_DEFINITIONS.map((definition) => (
                  <option key={definition.key} value={definition.key} disabled={Boolean(value[definition.key])}>
                    {definition.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="CSV column">
              <Select value={activeSource} onChange={(event) => setSource(event.target.value)}>
                {headers.map((header) => <option key={header} value={header}>{header}</option>)}
              </Select>
            </Field>
            <Button type="button" variant="ghost" onClick={addMapping} disabled={!activeSource || Boolean(value[field])}>Add mapping</Button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-[var(--muted)]">Add CSV above to configure columns, or apply a saved preset.</p>
      )}

      <div className="flex flex-col gap-3 border-t border-[var(--line)] pt-4 xl:flex-row xl:items-end">
        <div className="min-w-0 flex-1">
          <Field label="Apply saved preset">
            <Select value={selectedId} onChange={(event) => apply(event.target.value)}>
              <option value="">Choose a saved mapping</option>
              {presets.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
            </Select>
          </Field>
        </div>
        <form className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-end" onSubmit={save}>
          <div className="min-w-0 flex-1">
            <Field label="Save current mapping">
              <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="e.g. Broker executions" />
            </Field>
          </div>
          <Button type="submit" loading={saving}>Save</Button>
        </form>
        <Button type="button" variant="ghost" onClick={remove} loading={deleting} disabled={deleting || !selectedId}>Delete</Button>
      </div>
      {error ? <Banner tone="warn">{error}</Banner> : null}
    </div>
  );
}
