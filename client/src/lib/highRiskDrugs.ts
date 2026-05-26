// NZ high-risk drug categories — Medsafe-aligned. A near miss involving any
// of these drugs gets flagged on the form (so staff are reminded that extra
// care is needed) and highlighted in reports (so managers and the team can
// see at a glance how often high-risk medicines are involved). Medsafe
// publishes alerts and CARM-reportable categories; this list mirrors the
// most-cited high-risk classes for NZ community pharmacy.

interface HighRiskCategory {
  category: string;
  // Lowercase substrings — match if the drug name contains any.
  patterns: string[];
  // One-line context shown on the Record form when matched. Brief, NZ-grounded.
  guidance: string;
}

// Guidance is FRAMING, not how-to. The form is being filled because a
// near miss is being recorded — by definition the event is already
// caught, so procedural advice ("log it in the CD register before
// dispensing") doesn't fit. Each line tells the staff member why this
// class matters and what details to capture, so the record is useful
// for later analysis. The per-incident AI recommendation handles the
// "what to do next" piece.
const CATEGORIES: HighRiskCategory[] = [
  {
    category: 'Insulin',
    patterns: ['insulin'],
    guidance: 'Insulin near misses matter — wrong concentration (100 vs 300 u/mL), wrong pen vs vial, or wrong brand can cause severe harm. Capture the strength and brand carefully on this record.',
  },
  {
    category: 'Anticoagulant',
    patterns: ['warfarin', 'dabigatran', 'rivaroxaban', 'apixaban', 'enoxaparin', 'heparin', 'edoxaban'],
    guidance: 'Anticoagulant (blood-thinner) near misses matter — small dose differences cause serious bleeding. Capture the strength, the brand, and any dose-adjustment context (INR, kidney function) on this record.',
  },
  {
    category: 'Opioid',
    patterns: ['morphine', 'oxycodone', 'methadone', 'fentanyl', 'tramadol', 'codeine', 'buprenorphine', 'pethidine', 'hydromorphone'],
    guidance: 'Opioid near misses matter — wrong strength, wrong quantity, or wrong patient can be fatal. Capture the strength and total quantity carefully on this record.',
  },
  {
    category: 'Methotrexate',
    patterns: ['methotrexate'],
    guidance: 'Methotrexate weekly-vs-daily mix-ups are the most-reported NZ medication error (Medsafe alert). Make sure this record clearly captures whether the prescription said daily or weekly.',
  },
  {
    category: 'Narrow therapeutic index',
    patterns: ['digoxin', 'lithium', 'phenytoin', 'theophylline', 'carbamazepine', 'cyclosporin', 'cyclosporine', 'tacrolimus'],
    guidance: 'This drug has a narrow safety margin — small dose changes cause big effects. Capture the strength and brand carefully on this record so any pattern shows up.',
  },
  {
    category: 'Cytotoxic',
    patterns: ['methotrexate', 'cyclophosphamide', 'azathioprine', 'fluorouracil', 'tamoxifen', 'anastrozole', 'letrozole'],
    guidance: 'Cytotoxic medicine — capture the strength, formulation, and any handout details (handling, pregnancy precautions) on this record.',
  },
  {
    category: 'Paediatric (mg/kg)',
    patterns: ['paediatric', 'pediatric'],
    guidance: 'Paediatric dose — strengths and concentrations differ. Capture the mg/kg dose context on this record so it can be cross-checked against the NZ Formulary later.',
  },
];

export interface HighRiskMatch {
  category: string;
  guidance: string;
}

/** Returns the high-risk match for a drug name, or null if not high-risk. */
export function checkHighRisk(drugName: string | null | undefined): HighRiskMatch | null {
  if (!drugName) return null;
  const lower = drugName.trim().toLowerCase();
  if (!lower) return null;
  for (const cat of CATEGORIES) {
    if (cat.patterns.some(p => lower.includes(p))) {
      return { category: cat.category, guidance: cat.guidance };
    }
  }
  return null;
}
