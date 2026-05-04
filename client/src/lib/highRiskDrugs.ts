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

const CATEGORIES: HighRiskCategory[] = [
  {
    category: 'Insulin',
    patterns: ['insulin'],
    guidance: 'Insulin: confirm pen vs vial, units vs mL, and brand vs generic match. Two-person check recommended.',
  },
  {
    category: 'Anticoagulant',
    patterns: ['warfarin', 'dabigatran', 'rivaroxaban', 'apixaban', 'enoxaparin', 'heparin', 'edoxaban'],
    guidance: 'Anticoagulant: dose-and-strength check is critical. Cross-check against NZ Formulary; verify INR or renal-dose adjustments where relevant.',
  },
  {
    category: 'Opioid',
    patterns: ['morphine', 'oxycodone', 'methadone', 'fentanyl', 'tramadol', 'codeine', 'buprenorphine', 'pethidine', 'hydromorphone'],
    guidance: 'Opioid: CD-register entry and two-person check apply (Misuse of Drugs Regulations). Confirm strength and total quantity.',
  },
  {
    category: 'Methotrexate',
    patterns: ['methotrexate'],
    guidance: 'Methotrexate: weekly-vs-daily confusion is the most-reported error in NZ (Medsafe alert). Confirm intended frequency in writing.',
  },
  {
    category: 'Narrow therapeutic index',
    patterns: ['digoxin', 'lithium', 'phenytoin', 'theophylline', 'carbamazepine', 'cyclosporin', 'cyclosporine', 'tacrolimus'],
    guidance: 'Narrow therapeutic index drug: small dose changes matter. Verify strength and brand against NZ Formulary; check for interactions.',
  },
  {
    category: 'Cytotoxic',
    patterns: ['methotrexate', 'cyclophosphamide', 'azathioprine', 'fluorouracil', 'tamoxifen', 'anastrozole', 'letrozole'],
    guidance: 'Cytotoxic: handle per pharmacy SOP. Counselling required at handout (pregnancy precautions, handling).',
  },
  {
    category: 'Paediatric (mg/kg)',
    patterns: ['paediatric', 'pediatric'],
    guidance: 'Paediatric dose: cross-check mg/kg against NZ Formulary. Liquid concentrations vary — confirm strength.',
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
