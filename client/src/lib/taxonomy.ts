// Dispensing-incident taxonomy — source of truth for the Record form.
// KEEP IN SYNC with supabase/migrate_workflow_stage.sql (seeded for reports/filters).
// Hardcoded on the client so the Record page renders instantly with no API wait.

export interface SubError {
  label: string;
  common: boolean; // true = default-visible, false = revealed via "More…"
}

export interface Stage {
  label: string;
  subErrors: SubError[];
}

export const STAGES: Stage[] = [
  {
    label: 'Script entered into PMS',
    subErrors: [
      { label: 'Wrong patient', common: true },
      { label: 'Wrong drug entered', common: true },
      { label: 'Wrong strength entered', common: true },
      { label: 'Wrong directions', common: true },
      { label: 'Wrong quantity entered', common: false },
      { label: 'Repeat dispensed too early', common: false },
      { label: 'Allergy missed or overridden', common: false },
      { label: 'Interaction missed', common: false },
      { label: 'Wrong frequency', common: false },
      { label: 'Wrong route', common: false },
      { label: 'Repeat overdue (continuity gap)', common: false },
      { label: 'Duplicate therapy missed', common: false },
      { label: 'Renal or hepatic dose adjustment missed', common: false },
      { label: 'Paediatric dose error', common: false },
      { label: 'Geriatric dose error', common: false },
      { label: 'Pregnancy or breastfeeding category missed', common: false },
      { label: 'Pharmac Special Authority not checked', common: false },
      { label: 'Wrong Pharmac brand supplied', common: false },
      { label: 'NHI / HPI mismatch', common: false },
      { label: 'Wrong subsidy code', common: false },
      { label: 'PSO treated as patient script', common: false },
      { label: 'NZePS prescription not actioned', common: false },
      { label: 'Out-of-date prescription (>6 months)', common: false },
      { label: 'Forged or altered prescription accepted', common: false },
      { label: 'Verbal or phone order misheard', common: false },
      { label: 'Faxed prescription misread', common: false },
      { label: 'Hospital discharge misinterpreted', common: false },
    ],
  },
  {
    label: 'Drug picked from shelf',
    subErrors: [
      { label: 'Wrong drug \u2014 look-alike packaging', common: true },
      { label: 'Wrong strength picked', common: true },
      { label: 'Wrong formulation picked', common: true },
      { label: 'Wrong brand (bioequivalence)', common: true },
      { label: 'Wrong drug \u2014 sound-alike name', common: false },
      { label: 'Expired stock', common: false },
      { label: 'Damaged tablets', common: false },
      { label: 'Wrong pack size', common: false },
      { label: 'Recalled stock dispensed', common: false },
      { label: 'Section 29 documentation issue', common: false },
    ],
  },
  {
    label: 'Counted / measured',
    subErrors: [
      { label: 'Wrong quantity counted', common: true },
      { label: 'Wrong volume measured (liquid)', common: true },
      { label: 'Mixed strengths in same container', common: true },
      { label: 'Tablet-splitting error', common: true },
      { label: 'Cross-contamination during counting', common: false },
      { label: 'Compounding calculation error', common: false },
      { label: 'Wrong diluent or base in compound', common: false },
      { label: 'Wrong concentration in compound', common: false },
    ],
  },
  {
    label: 'Labelling',
    subErrors: [
      { label: 'Missing CAL (cautionary advisory label)', common: true },
      { label: 'Wrong CAL applied', common: true },
      { label: 'Label on wrong item / wrong bottle', common: true },
      { label: 'Missing label entirely', common: true },
      { label: 'Pharmacist initials missing', common: false },
    ],
  },
  {
    label: 'Bagging / handed to patient',
    subErrors: [
      { label: 'Wrong patient given the bag', common: true },
      { label: 'Counselling missed', common: true },
      { label: 'Bag missing an item', common: true },
      { label: 'Bag mixed up between patients', common: true },
      { label: 'Bag contains extra item', common: false },
      { label: 'Counselling incorrect', common: false },
      { label: 'New-medicine counselling missed', common: false },
      { label: 'Inhaler or device technique not shown', common: false },
      { label: 'Driving or alcohol warning missed', common: false },
      { label: 'ID not checked for CD pickup', common: false },
    ],
  },
  {
    label: 'Controlled drug dispensing',
    subErrors: [
      { label: 'CD register entry missed', common: true },
      { label: 'CD second-check skipped', common: true },
      { label: 'CD dispensed early', common: true },
      { label: 'Methadone wrong dose dispensed', common: true },
      { label: 'Methadone observed dose not witnessed', common: false },
      { label: 'CD safe left unlocked', common: false },
      { label: 'CD destroyed without proper witness', common: false },
      { label: 'Out-of-date CD prescription dispensed', common: false },
    ],
  },
  {
    label: 'Compliance pack packing',
    subErrors: [
      { label: 'Wrong day / time slot', common: true },
      { label: 'Wrong drug in pack', common: true },
      { label: "Wrong patient's pack", common: true },
      { label: 'Missing dose from pack', common: true },
      { label: 'Extra dose in pack', common: true },
    ],
  },
];

export const WHERE_CAUGHT = [
  'Data entry check',
  'Initial pharmacist check',
  'Final pharmacist check',
  'Technician query',
  'Patient at collection',
];

// Default "where caught" to pre-select based on Layer 1 stage. One tap to change.
export const CAUGHT_DEFAULT_BY_STAGE: Record<string, string> = {
  'Script entered into PMS': 'Data entry check',
  'Drug picked from shelf': 'Initial pharmacist check',
  'Counted / measured': 'Initial pharmacist check',
  'Labelling': 'Final pharmacist check',
  'Bagging / handed to patient': 'Patient at collection',
  'Controlled drug dispensing': 'Final pharmacist check',
  'Compliance pack packing': 'Final pharmacist check',
};

export const FACTORS = [
  'High volume period',
  'Interruption / distraction',
  'Similar packaging',
  'Similar drug names',
  'Script not checked against original',
  'Understaffed',
  'System slow / down',
  'Illegible prescription',
  'Unusual dose / strength',
  'New staff member',
  'Unfamiliar drug',
  'Process not followed',
  'Communication gap',
];
export const FACTORS_DEFAULT_VISIBLE = 6;

export const FORMULATIONS = [
  'Tablet', 'Capsule', 'Liquid', 'Cream', 'Ointment',
  'Patch', 'Injection', 'Drops', 'Inhaler', 'Spray',
];

export const DRUG_SUGGESTIONS = [
  'Paracetamol', 'Ibuprofen', 'Amoxicillin', 'Flucloxacillin', 'Metformin',
  'Warfarin', 'Losartan', 'Candesartan', 'Omeprazole', 'Pantoprazole',
  'Simvastatin', 'Atorvastatin', 'Amlodipine', 'Quinapril', 'Cilazapril',
  'Aspirin', 'Clopidogrel', 'Salbutamol', 'Fluticasone', 'Budesonide',
  'Prednisone', 'Levothyroxine', 'Metoprolol', 'Bisoprolol', 'Furosemide',
  'Gabapentin', 'Pregabalin', 'Tramadol', 'Codeine', 'Morphine',
  'Methadone', 'Buprenorphine', 'Naproxen', 'Diclofenac', 'Citalopram',
  'Sertraline', 'Fluoxetine', 'Venlafaxine', 'Quetiapine', 'Risperidone',
];

// Layer 3 trigger rules: which "Intended \u2192 Given" fields to show when a
// sub-error label contains certain keywords. Order doesn't matter; multiple
// can trigger for one sub-error.
export function triggersFor(subLabel: string): {
  drug: boolean;
  strength: boolean;
  quantity: boolean;
  formulation: boolean;
} {
  const l = subLabel.toLowerCase();
  return {
    drug:
      l.includes('wrong drug') ||
      l.includes('look-alike') ||
      l.includes('sound-alike') ||
      l.includes('drug on label') ||
      l.includes('drug entered') ||
      l.includes('drug in pack'),
    strength: l.includes('strength'),
    quantity:
      (l.includes('quantity') || l.includes('volume') || l.includes('dose')) &&
      !l.includes('allergy') &&
      !l.includes('overridden') &&
      !l.includes('wrong day'),
    formulation: l.includes('formulation'),
  };
}
