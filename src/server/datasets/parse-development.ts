// Figures stated in development application descriptions. Shared by the
// Toronto import and the live municipal sources (no database imports).

/** Largest "N-storey" / "N storeys" figure in a description. */
export function parseStoreys(text: string) {
  const values = [
    ...text.matchAll(/(\d{1,3})[\s-]*(?:storey|story|storeys|stories)\b/gi),
  ]
    .map((m) => Number(m[1]))
    .filter((n) => n > 0 && n < 120);
  return values.length ? Math.max(...values) : null;
}

/** Largest "N (residential|dwelling|rental) units" figure in a description. */
export function parseUnits(text: string) {
  const values = [
    ...text.matchAll(
      /(\d{1,3}(?:,\d{3})*|\d+)\s+(?:new\s+)?(?:residential\s+|dwelling\s+|rental\s+|condominium\s+|affordable\s+)*(?:units|dwellings|apartments)\b/gi,
    ),
  ]
    .map((m) => Number(m[1].replace(/,/g, "")))
    .filter((n) => n > 0 && n < 20_000);
  return values.length ? Math.max(...values) : null;
}
