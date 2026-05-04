// Normalisers for matching pharmacy data — mirror of the client-side helper.
// Used only as the lookup KEY when grouping incidents into patterns. The
// stored value (display) preserves whatever the user typed. So
// "Atorvastatin" / "atorvastatin" / "ATORVASTATIN" match each other, and
// "25mg" / "25 mg" / "25MG" match each other, without rewriting display.
//
// Deliberately conservative: no unit conversion ("0.5g" does NOT become
// "500mg"). That kind of conversion is clinical and dangerous to apply
// silently in a near-miss reporting tool.

export function normalizeDrugName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function normalizeStrength(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

export function normalizeFormulation(f: string | null | undefined): string {
  if (!f) return '';
  return f.trim().toLowerCase();
}
