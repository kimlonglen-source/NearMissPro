// Server-side mirror of client/src/lib/highRiskDrugs.ts. Kept in sync by hand
// because the server doesn't import from the client. Used to count high-risk
// incidents for the period summary so the AI can mention them.

const CATEGORIES: { category: string; patterns: string[] }[] = [
  { category: 'Insulin', patterns: ['insulin'] },
  { category: 'Anticoagulant', patterns: ['warfarin', 'dabigatran', 'rivaroxaban', 'apixaban', 'enoxaparin', 'heparin', 'edoxaban'] },
  { category: 'Opioid', patterns: ['morphine', 'oxycodone', 'methadone', 'fentanyl', 'tramadol', 'codeine', 'buprenorphine', 'pethidine', 'hydromorphone'] },
  { category: 'Methotrexate', patterns: ['methotrexate'] },
  { category: 'Narrow therapeutic index', patterns: ['digoxin', 'lithium', 'phenytoin', 'theophylline', 'carbamazepine', 'cyclosporin', 'cyclosporine', 'tacrolimus'] },
  { category: 'Cytotoxic', patterns: ['methotrexate', 'cyclophosphamide', 'azathioprine', 'fluorouracil', 'tamoxifen', 'anastrozole', 'letrozole'] },
];

export function highRiskCategoryFor(drugName: string | null | undefined): string | null {
  if (!drugName) return null;
  const lower = drugName.trim().toLowerCase();
  if (!lower) return null;
  for (const cat of CATEGORIES) {
    if (cat.patterns.some(p => lower.includes(p))) return cat.category;
  }
  return null;
}
