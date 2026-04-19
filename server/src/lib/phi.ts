// PHI detection for server-side defence-in-depth. Mirror of client/src/lib/phi.ts.
// When updating patterns or stoplist, change BOTH files to keep behaviour aligned.

export type PhiKind = 'nhi' | 'dob' | 'phone_or_digits' | 'name';

const PATTERNS: { kind: PhiKind; rx: RegExp }[] = [
  { kind: 'nhi', rx: /\b[A-Za-z]{3}\d{4}\b/ },
  { kind: 'dob', rx: /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/ },
  { kind: 'phone_or_digits', rx: /\b\d{8,}\b/ },
  { kind: 'name', rx: /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/ },
];

const STOPLIST: string[] = [
  'Panadol Osteo', 'Test Pharmacy', 'Lemsip Max', 'Voltaren Rapid',
  'Nurofen Zavance', 'Codral Cold', 'Mylanta Double', 'Gaviscon Double',
  'Berocca Performance', 'Imodium Rapid', 'Losec Zydis', 'Ventolin Evohaler',
  'Seretide Accuhaler', 'Symbicort Turbuhaler', 'Flixotide Evohaler',
  'Easyhaler Budesonide', 'Salbutamol Easyhaler', 'Microgynon 30',
  'Yasmin Tablet', 'Warfarin Sodium', 'New Zealand', 'North Island',
  'South Island', 'Te Whatu', 'Te Aka', 'Pharmacy Council', 'Medsafe Alert',
  'Healthify NZ',
];

function withoutStoplist(text: string): string {
  let stripped = text;
  for (const phrase of STOPLIST) {
    const rx = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    stripped = stripped.replace(rx, '');
  }
  return stripped;
}

export interface PhiResult {
  hit: boolean;
  kinds: PhiKind[];
}

export function detectPHI(text: string | null | undefined): PhiResult {
  if (!text || !text.trim()) return { hit: false, kinds: [] };
  const cleaned = withoutStoplist(text);
  const kinds: PhiKind[] = [];
  for (const { kind, rx } of PATTERNS) {
    if (rx.test(cleaned) && !kinds.includes(kind)) kinds.push(kind);
  }
  return { hit: kinds.length > 0, kinds };
}

// Scan multiple fields at once; returns which fields tripped and what kinds.
export function scanFields(
  fields: Record<string, string | null | undefined>
): { anyHit: boolean; perField: Record<string, PhiKind[]> } {
  const perField: Record<string, PhiKind[]> = {};
  let anyHit = false;
  for (const [name, value] of Object.entries(fields)) {
    const { hit, kinds } = detectPHI(value);
    if (hit) {
      perField[name] = kinds;
      anyHit = true;
    }
  }
  return { anyHit, perField };
}
