// Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF).
// Shared by Next.js and Trigger.dev tasks (no "server-only" import).

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/** Parses CSV text into objects keyed by the header row (BOM stripped). */
export function parseCsvRecords(text: string) {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ""));
  const keys = header.map((h) => h.trim());
  return rows
    .filter((r) => r.length > 1 || r[0])
    .map((r) =>
      Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? "").trim()])),
    );
}
