// Normalisers for matching pharmacy data — drug names, strengths,
// formulations. The display always preserves whatever the user typed;
// these forms are only used as the lookup key when grouping incidents
// into patterns. So *Atorvastatin* / *atorvastatin* / *ATORVASTATIN*
// match each other, and `25mg` / `25 mg` / `25MG` match each other,
// without rewriting what the staff member entered.
//
// Deliberately conservative: no unit conversion (so `0.5g` does NOT
// become `500mg`). That kind of conversion is clinical and dangerous
// to apply silently.

/** Normalise a drug name for matching. Lowercase, trim, collapse internal spaces. */
export function normalizeDrugName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Normalise a strength string for matching. Lowercase, strip spaces inside the value. */
export function normalizeStrength(s: string | null | undefined): string {
  if (!s) return '';
  return s.trim().toLowerCase().replace(/\s+/g, '');
}

/** Normalise a formulation label for matching. Lowercase, trim. */
export function normalizeFormulation(f: string | null | undefined): string {
  if (!f) return '';
  return f.trim().toLowerCase();
}
