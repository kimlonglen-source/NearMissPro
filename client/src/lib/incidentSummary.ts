// Turn an incident's structured fields into a single readable sentence
// the manager can scan in one glance. Picks the most specific shape
// based on which fields are populated, and is *lenient* about missing
// data — if the drug name was skipped during recording but the strength
// values are there, we still show what happened ("100mg dispensed
// instead of 25mg") rather than collapsing back to a bare error type.
//
// Examples (full data):
//   "Wrong drug in pack: Furosemide dispensed, Metoprolol prescribed."
//   "Wrong formulation picked: Paracetamol tablet dispensed instead of paracetamol liquid."
//   "Wrong strength picked: Atorvastatin 100mg dispensed instead of Atorvastatin 25mg."
//   "Wrong quantity counted: 60 of Paracetamol dispensed, 30 prescribed."
//
// Examples (partial data — drug name skipped during recording):
//   "Wrong strength picked: 100mg dispensed instead of 25mg."
//   "Wrong formulation picked: tablet dispensed instead of liquid."
//   "Wrong quantity counted: 60 dispensed, 30 prescribed."
//
// Final fallback (only the error type was captured):
//   "Wrong strength picked."

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

  // Interaction — the second drug is the one it interacts with, NOT a drug
  // dispensed in error. Must come before the wrong-drug swap below, which
  // would otherwise read it as "X dispensed, Y prescribed".
  const isInteraction = types.some(t => t.toLowerCase().includes('interaction'));
  if (isInteraction) {
    if (drug && dispDrug) return `${errorType}: ${drug} with ${dispDrug}.`;
    if (drug) return `${errorType} — ${drug}.`;
    return `${errorType}.`;
  }

  // Wrong drug — different drug dispensed (this case needs both drug names
  // to make sense, so it's the strictest of the four).
  if (dispDrug && drug && dispDrug.toLowerCase() !== drug.toLowerCase()) {
    return `${errorType}: ${dispDrug} dispensed, ${drug} prescribed.`;
  }

  // Wrong strength — same drug, different strength. Show whatever we have:
  //   - drug + both strengths   -> "Atorvastatin 100mg dispensed instead of Atorvastatin 25mg"
  //   - both strengths only     -> "100mg dispensed instead of 25mg"
  //   - drug + one strength     -> "Atorvastatin (dispensed at the wrong strength)"
  if (dispStr && prescStr && dispStr.toLowerCase() !== prescStr.toLowerCase()) {
    if (drug) return `${errorType}: ${drug} ${dispStr} dispensed instead of ${drug} ${prescStr}.`;
    return `${errorType}: ${dispStr} dispensed instead of ${prescStr}.`;
  }

  // Wrong formulation — same drug, different form. Same lenient pattern.
  if (dispForm && correctForm && dispForm.toLowerCase() !== correctForm.toLowerCase()) {
    if (drug) return `${errorType}: ${drug} ${dispForm.toLowerCase()} dispensed instead of ${drug} ${correctForm.toLowerCase()}.`;
    return `${errorType}: ${dispForm.toLowerCase()} dispensed instead of ${correctForm.toLowerCase()}.`;
  }

  // Wrong quantity — same drug, different count/volume.
  if (dispQty != null && prescQty != null && dispQty !== prescQty) {
    if (drug) return `${errorType}: ${dispQty} of ${drug} dispensed, ${prescQty} prescribed.`;
    return `${errorType}: ${dispQty} dispensed, ${prescQty} prescribed.`;
  }

  // Single-sided detail (one half of a swap was captured, the other wasn't).
  // Surfaces partial data instead of throwing it away.
  if (drug && dispStr && !prescStr) return `${errorType}: ${drug} dispensed at ${dispStr} (prescribed strength not recorded).`;
  if (drug && prescStr && !dispStr) return `${errorType}: ${drug} prescribed at ${prescStr} (dispensed strength not recorded).`;
  if (drug && dispForm && !correctForm) return `${errorType}: ${drug} dispensed as ${dispForm.toLowerCase()} (intended formulation not recorded).`;
  if (drug && correctForm && !dispForm) return `${errorType}: ${drug} prescribed as ${correctForm.toLowerCase()} (dispensed formulation not recorded).`;
  if (drug && dispDrug && !prescStr && !prescQty) return `${errorType}: ${dispDrug} dispensed for ${drug}.`;

  // Drug named, but no swap details at all
  if (drug) return `${errorType} — ${drug}.`;

  // Pure error type, no drug context
  return `${errorType}.`;
}

// Turn an incident's context fields (date, where caught, time of day,
// factors) into a single flowing sentence the manager can read aloud
// at the review meeting. Replaces the bullet-separated metadata line
// so each incident on the report reads as a small narrative:
//
//   "Caught at the final pharmacist check on 15 May 2026 (Morning 8–12pm).
//    Factors: similar packaging, busy period."
//
// Handles missing fields gracefully — anything absent is just dropped
// rather than showing "—" placeholders.
export interface IncidentForNarrative {
  occurred_at?: string | null;
  submitted_at?: string;
  where_caught?: string | null;
  time_of_day?: string | null;
  factors?: string[] | null;
}

export function narrateIncidentContext(inc: IncidentForNarrative): string {
  const dateStr = new Date(inc.occurred_at || inc.submitted_at || Date.now())
    .toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

  let sentence: string;
  const wc = inc.where_caught;
  if (!wc) {
    sentence = `Logged on ${dateStr}`;
  } else if (wc === 'Technician spotted it') {
    sentence = `A technician spotted it on ${dateStr}`;
  } else if (wc === 'Data entry check') {
    sentence = `Caught at data entry on ${dateStr}`;
  } else if (wc === 'Initial pharmacist check' || wc === 'Final pharmacist check') {
    sentence = `Caught at the ${wc.toLowerCase()} on ${dateStr}`;
  } else {
    // Custom "where caught" chip from the pharmacy — render as-is.
    sentence = `Caught: ${wc} — on ${dateStr}`;
  }

  if (inc.time_of_day) {
    sentence += ` (${inc.time_of_day})`;
  }
  sentence += '.';

  if (inc.factors && inc.factors.length > 0) {
    const factorsList = inc.factors.map(f => f.toLowerCase()).join(', ');
    sentence += ` Factors: ${factorsList}.`;
  }

  return sentence;
}
