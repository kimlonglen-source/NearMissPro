// Commonly-dispensed NZ community-pharmacy drugs (active substance names).
// Used as the second-tier autocomplete for the Record form — the first tier
// is the pharmacy's own usage history (stored in localStorage). This list
// fills the gap when a pharmacy's local history doesn't yet contain a drug
// that's being typed for the first time.
//
// Aligned to Pharmac Schedule (most-dispensed funded medicines) plus common
// OTC/private items. Not exhaustive — staff can still type any drug name
// freely; this only powers suggestions and the "not in NZ drug list" hint.

export const NZ_DRUG_LIST: string[] = [
  // Analgesics
  'Paracetamol', 'Ibuprofen', 'Aspirin', 'Diclofenac', 'Naproxen', 'Codeine',
  'Tramadol', 'Morphine', 'Oxycodone', 'Methadone', 'Buprenorphine', 'Fentanyl',
  // Antibiotics
  'Amoxicillin', 'Amoxicillin clavulanate', 'Flucloxacillin', 'Cefalexin', 'Cephalexin',
  'Doxycycline', 'Trimethoprim', 'Nitrofurantoin', 'Erythromycin', 'Azithromycin',
  'Roxithromycin', 'Clarithromycin', 'Metronidazole', 'Ciprofloxacin', 'Cefaclor',
  // Cardiovascular
  'Atorvastatin', 'Simvastatin', 'Rosuvastatin', 'Pravastatin',
  'Amlodipine', 'Felodipine', 'Diltiazem', 'Verapamil',
  'Metoprolol', 'Bisoprolol', 'Atenolol', 'Carvedilol', 'Propranolol',
  'Quinapril', 'Cilazapril', 'Lisinopril', 'Enalapril', 'Perindopril',
  'Losartan', 'Candesartan', 'Valsartan', 'Telmisartan', 'Irbesartan',
  'Furosemide', 'Bumetanide', 'Bendrofluazide', 'Bendroflumethiazide', 'Spironolactone',
  'Indapamide', 'Hydrochlorothiazide', 'Doxazosin',
  'Digoxin', 'Amiodarone', 'Sotalol', 'Flecainide',
  // Anticoagulants
  'Warfarin', 'Dabigatran', 'Rivaroxaban', 'Apixaban', 'Enoxaparin', 'Heparin',
  'Aspirin', 'Clopidogrel', 'Ticagrelor', 'Prasugrel',
  // Diabetes
  'Metformin', 'Gliclazide', 'Glipizide', 'Glibenclamide',
  'Insulin', 'Insulin glargine', 'Insulin aspart', 'Insulin lispro', 'Insulin detemir',
  'Empagliflozin', 'Dapagliflozin', 'Sitagliptin', 'Vildagliptin', 'Linagliptin',
  // Respiratory
  'Salbutamol', 'Terbutaline', 'Ipratropium', 'Tiotropium',
  'Fluticasone', 'Beclometasone', 'Beclomethasone', 'Budesonide', 'Ciclesonide',
  'Salmeterol', 'Formoterol', 'Vilanterol',
  'Montelukast', 'Theophylline',
  'Loratadine', 'Cetirizine', 'Fexofenadine', 'Promethazine',
  // GI
  'Omeprazole', 'Pantoprazole', 'Lansoprazole', 'Rabeprazole', 'Esomeprazole',
  'Ranitidine', 'Famotidine', 'Domperidone', 'Metoclopramide', 'Ondansetron',
  'Loperamide', 'Lactulose', 'Macrogol', 'Bisacodyl', 'Senna',
  // CNS / Psychiatric
  'Citalopram', 'Escitalopram', 'Sertraline', 'Fluoxetine', 'Paroxetine',
  'Venlafaxine', 'Duloxetine', 'Mirtazapine', 'Bupropion', 'Amitriptyline',
  'Nortriptyline', 'Doxepin',
  'Quetiapine', 'Risperidone', 'Olanzapine', 'Clozapine', 'Aripiprazole', 'Haloperidol',
  'Diazepam', 'Lorazepam', 'Oxazepam', 'Temazepam', 'Zopiclone', 'Melatonin',
  'Gabapentin', 'Pregabalin', 'Carbamazepine', 'Lamotrigine', 'Sodium valproate', 'Phenytoin',
  'Topiramate', 'Levetiracetam',
  'Lithium', 'Methylphenidate', 'Atomoxetine',
  // Neurology
  'Levodopa', 'Carbidopa', 'Madopar', 'Sinemet', 'Pramipexole', 'Ropinirole',
  'Donepezil', 'Memantine', 'Rivastigmine',
  // Endocrine
  'Levothyroxine', 'Carbimazole',
  'Prednisone', 'Prednisolone', 'Hydrocortisone', 'Dexamethasone',
  'Alendronate', 'Risedronate', 'Denosumab',
  'Calcium', 'Cholecalciferol', 'Vitamin D',
  // Urology
  'Tamsulosin', 'Finasteride', 'Dutasteride', 'Sildenafil', 'Tadalafil',
  'Solifenacin', 'Oxybutynin',
  // Gout / Rheumatology
  'Allopurinol', 'Colchicine', 'Methotrexate', 'Sulfasalazine', 'Hydroxychloroquine',
  // Skin
  'Hydrocortisone cream', 'Betamethasone', 'Mometasone', 'Clobetasone',
  'Aciclovir', 'Acyclovir', 'Valaciclovir',
  // Eye
  'Latanoprost', 'Timolol', 'Brimonidine', 'Dorzolamide', 'Chloramphenicol',
  // Migraine
  'Sumatriptan', 'Rizatriptan',
  // Specialised / High-risk
  'Cyclosporin', 'Cyclosporine', 'Tacrolimus', 'Azathioprine',
  'Tamoxifen', 'Anastrozole', 'Letrozole',
  // Smoking cessation / Addiction
  'Nicotine', 'Varenicline', 'Naltrexone',
  // Vaccines / Other common
  'Iron', 'Ferrous sulfate', 'Ferrous fumarate', 'Folic acid', 'Vitamin B12', 'Cyanocobalamin',
  'Magnesium', 'Potassium', 'Sodium chloride',
];

// Lowercase set for fast lookup. Built once at module load.
const NZ_DRUG_SET = new Set(NZ_DRUG_LIST.map(d => d.toLowerCase()));

/** True if the drug name appears in the bundled NZ list (case-insensitive). */
export function isKnownNzDrug(name: string): boolean {
  if (!name) return false;
  return NZ_DRUG_SET.has(name.trim().toLowerCase());
}

/**
 * Score each NZ drug for autocomplete relevance against the user's query.
 * Returns the top N matches sorted: prefix matches first, then contains.
 */
export function searchNzDrugs(query: string, limit = 8): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const drug of NZ_DRUG_LIST) {
    const lower = drug.toLowerCase();
    if (lower.startsWith(q)) prefix.push(drug);
    else if (lower.includes(q)) contains.push(drug);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}

// ── Pharmacy-local history (localStorage) ────────────────────────────
// Drugs the staff at this pharmacy have logged before, in order of most-recent-first.
// Used as the FIRST tier of autocomplete so canonical spelling propagates from
// internal usage rather than the bundled list.

const HISTORY_KEY = 'nmp.drug_history.v1';
const HISTORY_LIMIT = 100;

export function readDrugHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch { return []; }
}

export function recordDrugInHistory(name: string) {
  if (!name || !name.trim()) return;
  const clean = name.trim();
  const existing = readDrugHistory();
  // De-dupe case-insensitively but keep the user's original casing on first entry.
  const lower = clean.toLowerCase();
  const filtered = existing.filter(s => s.toLowerCase() !== lower);
  const next = [clean, ...filtered].slice(0, HISTORY_LIMIT);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(next)); } catch { /* noop */ }
}

export function searchDrugHistory(query: string, limit = 5): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const history = readDrugHistory();
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const drug of history) {
    const lower = drug.toLowerCase();
    if (lower.startsWith(q)) prefix.push(drug);
    else if (lower.includes(q)) contains.push(drug);
    if (prefix.length >= limit) break;
  }
  return [...prefix, ...contains].slice(0, limit);
}
