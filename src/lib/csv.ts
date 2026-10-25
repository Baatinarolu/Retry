export type ParsedCsv = {
  headers: string[];
  rows: Record<string, string>[];
  lineMap: number[];
};

export function normalizeCsvHeader(header: string) {
  return header.trim().toLowerCase().replace(/\s+/g, "_");
}

/** Parse comma-separated data, including escaped quotes and newlines inside quoted fields. */
export function parseCsv(text: string): ParsedCsv {
  const records: { cells: string[]; line: number }[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const finishRecord = () => {
    row.push(cell.trim());
    if (row.some((value) => value.length > 0)) records.push({ cells: row, line: recordLine });
    row = [];
    cell = "";
  };

  const input = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      finishRecord();
      line++;
      recordLine = line;
      continue;
    }
    if ((char === "\n" || char === "\r") && quoted) {
      if (char === "\r" && input[i + 1] === "\n") i++;
      cell += "\n";
      line++;
      continue;
    }
    cell += char;
  }
  if (quoted) throw new Error("Unclosed quoted field in CSV");
  if (cell.length || row.length) finishRecord();
  if (!records.length) return { headers: [], rows: [], lineMap: [] };

  const headers = records[0].cells.map(normalizeCsvHeader);
  if (headers.some((header) => !header)) throw new Error("CSV contains an empty header");
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate headers");

  const rows = records.slice(1).map((record) => {
    const data: Record<string, string> = {};
    headers.forEach((header, index) => {
      data[header] = record.cells[index] ?? "";
    });
    return data;
  });
  return { headers, rows, lineMap: records.slice(1).map((record) => record.line) };
}

/** Escape a cell for CSV and neutralize spreadsheet formulas in untrusted text. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  const trimmed = text.trimStart();
  const strictNumber = /^-?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed);
  if (/^[=+@]/.test(trimmed) || (trimmed.startsWith("-") && !strictNumber)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function csvLine(values: unknown[]): string {
  return values.map(csvCell).join(",");
}
