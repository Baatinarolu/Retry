"use client";

import { Button, Field, Select } from "@/components/ui";
import {
  defaultJournalPreferences,
  JOURNAL_COLUMNS,
  normalizeJournalPreferences,
  type JournalColumnId,
  type JournalPreferences,
} from "@/lib/journal-view";

export function JournalTableSettings({
  value,
  onChange,
}: {
  value: JournalPreferences;
  onChange: (next: JournalPreferences) => void;
}) {
  function toggle(column: JournalColumnId, visible: boolean) {
    const columns = visible ? [...value.columns, column] : value.columns.filter((item) => item !== column);
    onChange(normalizeJournalPreferences({ ...value, columns }));
  }

  return (
    <details className="relative">
      <summary className="btn btn-ghost cursor-pointer list-none">Table settings</summary>
      <div className="card absolute left-0 z-30 mt-2 w-72 p-4 sm:left-auto sm:right-0">
        <p className="eyebrow">Visible columns</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {JOURNAL_COLUMNS.map((column) => (
            <label key={column.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={value.columns.includes(column.id)}
                disabled={column.id === "id"}
                onChange={(event) => toggle(column.id, event.target.checked)}
              />
              {column.label}
            </label>
          ))}
        </div>
        <div className="mt-4 border-t border-[var(--line)] pt-3">
          <Field label="Row density">
            <Select
              value={value.density}
              onChange={(event) => onChange(normalizeJournalPreferences({ ...value, density: event.target.value }))}
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </Select>
          </Field>
        </div>
        <Button type="button" variant="ghost" className="mt-3 w-full" onClick={() => onChange(defaultJournalPreferences())}>Reset table</Button>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Saved in this browser. Saved views continue to store filters only.</p>
      </div>
    </details>
  );
}
