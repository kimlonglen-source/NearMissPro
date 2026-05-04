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
    guidance: 'Insulin needs extra care: check it\'s the right pen vs vial, units (not mL), and the brand is right. Have a second pharmacist check.',
  },
  {
    category: 'Anticoagulant',
    patterns: ['warfarin', 'dabigatran', 'rivaroxaban', 'apixaban', 'enoxaparin', 'heparin', 'edoxaban'],
    guidance: 'Anticoagulants (blood-thinners) need a careful dose check — small mistakes cause serious bleeding. Look up the dose in NZ Formulary; check for INR or kidney-related adjustments.',
  },
  {
    category: 'Opioid',
    patterns: ['morphine', 'oxycodone', 'methadone', 'fentanyl', 'tramadol', 'codeine', 'buprenorphine', 'pethidine', 'hydromorphone'],
    guidance: 'Opioid: log it in the controlled drugs (CD) register before dispensing, and have two people check (Misuse of Drugs Regulations). Confirm strength and total quantity.',
  },
  {
    category: 'Methotrexate',
    patterns: ['methotrexate'],
    guidance: 'Methotrexate: weekly-vs-daily mix-ups are the most-reported error in NZ (Medsafe alert). Confirm in writing whether it\'s daily or weekly.',
  },
  {
    category: 'Narrow therapeutic index',
    patterns: ['digoxin', 'lithium', 'phenytoin', 'theophylline', 'carbamazepine', 'cyclosporin', 'cyclosporine', 'tacrolimus'],
    guidance: 'This drug has a narrow safety margin — small dose changes cause big effects. Check the strength and brand carefully (NZ Formulary), and look for interactions.',
  },
  {
    category: 'Cytotoxic',
    patterns: ['methotrexate', 'cyclophosphamide', 'azathioprine', 'fluorouracil', 'tamoxifen', 'anastrozole', 'letrozole'],
    guidance: 'Cytotoxic medicine — handle per your pharmacy SOP. At handout, counsel the patient on safe handling and pregnancy precautions.',
  },
  {
    category: 'Paediatric (mg/kg)',
    patterns: ['paediatric', 'pediatric'],
    guidance: 'Paediatric dose: check the mg/kg dose against the NZ Formulary. Liquid concentrations differ — confirm the strength carefully.',
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
