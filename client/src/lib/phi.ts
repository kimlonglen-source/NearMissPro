// PHI (Protected Health Information) detection for NZ pharmacy context.
// Used to block submission of free-text inputs that might leak patient identifiers.
// Kept in sync with server/src/lib/phi.ts — update both when changing patterns.

export type PhiKind = 'nhi' | 'dob' | 'phone_or_digits' | 'name';

const PATTERNS: { kind: PhiKind; rx: RegExp }[] = [
  // NZ NHI: 3 letters + 4 digits (case-insensitive to catch lowercase entries).
  { kind: 'nhi', rx: /\b[A-Za-z]{3}\d{4}\b/ },
  // DOB: dd/mm/yyyy, d-m-yy, etc.
  { kind: 'dob', rx: /\b\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}\b/ },
  // Phone / long digit run: 8+ consecutive digits catches NZ mobiles and NHI-like digits.
  { kind: 'phone_or_digits', rx: /\b\d{8,}\b/ },
  // Two capitalised words: most likely a name. Stoplist below suppresses false positives.
  { kind: 'name', rx: /\b[A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}\b/ },
];

// Phrases that look like "Firstname Lastname" but are actually drug brands, venues,
// or common pharmacy terms. Fails safe toward flagging — we keep this list small
// and intentional. Match is case-insensitive on the original text.
const STOPLIST: string[] = [
  'Panadol Osteo',
  'Test Pharmacy',
  'Lemsip Max',
  'Voltaren Rapid',
  'Nurofen Zavance',
  'Codral Cold',
  'Mylanta Double',
  'Gaviscon Double',
  'Berocca Performance',
  'Imodium Rapid',
  'Losec Zydis',
  'Ventolin Evohaler',
  'Seretide Accuhaler',
  'Symbicort Turbuhaler',
  'Flixotide Evohaler',
  'Easyhaler Budesonide',
  'Salbutamol Easyhaler',
  'Microgynon 30',
  'Yasmin Tablet',
  'Warfarin Sodium',
  'New Zealand',
  'North Island',
  'South Island',
  'Te Whatu',
  'Te Aka',
  'Pharmacy Council',
  'Medsafe Alert',
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

// Human-readable hint for the UI banner.
export function phiHint(kinds: PhiKind[]): string {
  const names: Record<PhiKind, string> = {
    nhi: 'NHI number',
    dob: 'date of birth',
    phone_or_digits: 'phone number or long digit sequence',
    name: 'a name',
  };
  const parts = kinds.map(k => names[k]);
  if (parts.length === 0) return '';
  if (parts.length === 1) return `This looks like ${parts[0]} — please remove it.`;
  return `This looks like patient information (${parts.join(', ')}) — please remove it.`;
}
