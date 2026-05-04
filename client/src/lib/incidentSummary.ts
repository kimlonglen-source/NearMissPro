// Turn an incident's structured fields into a single readable sentence
// the manager can scan in one glance:
//
//   "Wrong drug in pack: Furosemide dispensed, Metoprolol prescribed."
//   "Wrong formulation picked: Paracetamol tablet dispensed instead of paracetamol liquid."
//   "Wrong strength picked: Atorvastatin 100mg dispensed instead of Atorvastatin 25mg."
//   "Wrong quantity counted: 60 of Paracetamol dispensed, 30 prescribed."
//
// Picks the most specific shape based on which fields are populated.
// Falls back gracefully when fields are missing.

export interface IncidentForSummary {
  error_types?: string[] | null;
  drug_name?: string | null;
  dispensed_drug?: string | null;
  prescribed_strength?: string | null;
  dispensed_strength?: string | null;
  correct_formulation?: string | null;
  dispensed_formulation?: string | null;
  prescribed_quantity?: number | null;
  dispensed_quantity?: number | null;
}

export function summarizeIncident(inc: IncidentForSummary): string {
  // Up to two error types joined with "+" — keeps multi-tag incidents readable.
  const types = (inc.error_types || []).filter(Boolean);
  const errorType = types.length === 0 ? 'Near miss' : types.slice(0, 2).join(' + ');

  const drug = (inc.drug_name || '').trim();
  const dispDrug = (inc.dispensed_drug || '').trim();
  const prescStr = (inc.prescribed_strength || '').trim();
  const dispStr = (inc.dispensed_strength || '').trim();
  const correctForm = (inc.correct_formulation || '').trim();
  const dispForm = (inc.dispensed_formulation || '').trim();
  const prescQty = inc.prescribed_quantity;
  const dispQty = inc.dispensed_quantity;

  // Wrong drug — a different drug than prescribed was dispensed
  if (dispDrug && drug && dispDrug.toLowerCase() !== drug.toLowerCase()) {
    return `${errorType}: ${dispDrug} dispensed, ${drug} prescribed.`;
  }

  // Wrong strength — same drug, different strength
  if (drug && dispStr && prescStr && dispStr.toLowerCase() !== prescStr.toLowerCase()) {
    return `${errorType}: ${drug} ${dispStr} dispensed instead of ${drug} ${prescStr}.`;
  }

  // Wrong formulation — same drug, different form (tab/cap/liquid/IR/SR)
  if (drug && dispForm && correctForm && dispForm.toLowerCase() !== correctForm.toLowerCase()) {
    return `${errorType}: ${drug} ${dispForm.toLowerCase()} dispensed instead of ${drug} ${correctForm.toLowerCase()}.`;
  }

  // Wrong quantity — same drug, different count/volume
  if (drug && dispQty != null && prescQty != null && dispQty !== prescQty) {
    return `${errorType}: ${dispQty} of ${drug} dispensed, ${prescQty} prescribed.`;
  }

  // Drug named, but no swap details — at least name the drug
  if (drug) return `${errorType} — ${drug}.`;

  // Pure error type, no drug context
  return `${errorType}.`;
}
