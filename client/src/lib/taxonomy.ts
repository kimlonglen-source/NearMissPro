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
    label: 'Script entered into dispensary software',
    subErrors: [
      { label: 'Typo / mistyped', common: true },
      { label: 'Wrong patient', common: true },
      { label: 'Wrong drug entered', common: true },
      { label: 'Wrong strength entered', common: true },
      { label: 'Wrong directions', common: true },
      { label: 'Wrong quantity entered', common: false },
      { label: 'Wrong number of days supply', common: false },
      { label: 'Wrong frequency', common: false },
      { label: 'Wrong route', common: false },
      { label: 'Repeat dispensed too early', common: false },
      { label: 'Patient overdue for repeat', common: false },
      { label: 'Allergy warning ignored', common: false },
      { label: 'Drug interaction missed', common: false },
      { label: 'Patient already on the same drug', common: false },
      { label: 'Dose not adjusted for age, kidney or liver', common: false },
      { label: 'Pregnancy or breastfeeding safety not checked', common: false },
      { label: 'Pharmac Special Authority not checked', common: false },
      { label: 'Patient NHI or prescriber HPI wrong', common: false },
      { label: 'Wrong subsidy code', common: false },
      { label: 'Practitioner\'s Supply Order (PSO) treated as patient script', common: false },
      { label: 'E-prescription (NZePS) not actioned', common: false },
      { label: 'Out-of-date prescription', common: false },
      { label: 'Forged or altered prescription accepted', common: false },
      { label: 'Verbal or phone order misheard', common: false },
      { label: 'Hospital discharge misinterpreted', common: false },
    ],
  },
  {
    label: 'Drug picked from shelf',
    subErrors: [
      { label: 'Wrong drug \u2014 look-alike packaging', common: true },
      { label: 'Wrong strength picked', common: true },
      { label: 'Wrong formulation picked', common: true },
      { label: 'Wrong brand supplied', common: true },
      { label: 'Wrong drug \u2014 sound-alike name', common: false },
      { label: 'Expired stock', common: false },
      { label: 'Damaged tablets', common: false },
      { label: 'Wrong pack size', common: false },
      { label: 'Recalled stock dispensed', common: false },
    ],
  },
  {
    label: 'Counted / measured',
    subErrors: [
      { label: 'Wrong quantity counted', common: true },
      { label: 'Wrong volume measured (liquid)', common: true },
      { label: 'Mixed strengths in same container', common: true },
      { label: 'Tablet-splitting error', common: true },
      { label: 'Cross-contamination between drugs', common: false },
      { label: 'Compounding calculation wrong', common: false },
      { label: 'Wrong base or diluent (compounding)', common: false },
      { label: 'Wrong concentration (compounding)', common: false },
    ],
  },
  {
    label: 'Labelling',
    subErrors: [
      { label: 'Missing warning label (CAL)', common: true },
      { label: 'Wrong warning label (CAL)', common: true },
      { label: 'Label on wrong item or bottle', common: true },
      { label: 'Missing label entirely', common: true },
      { label: 'Pharmacist initials missing', common: false },
    ],
  },
  {
    label: 'Bagging / handed to patient',
    subErrors: [
      { label: 'Wrong patient given the bag', common: true },
      { label: 'Wrong bag collected from pickup shelf', common: true },
      { label: 'Counselling missed or wrong', common: true },
      { label: 'Bag missing an item', common: true },
      { label: 'Bag mixed up between patients', common: true },
      { label: 'Bag contains extra item', common: false },
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
      { label: 'Wrong day or time slot', common: true },
      { label: 'Wrong drug in compliance pack', common: true },
      { label: "Wrong patient's compliance pack", common: true },
      { label: 'Missing dose from compliance pack', common: true },
      { label: 'Extra dose in compliance pack', common: true },
    ],
  },
];

// "Where caught" — every option is BEFORE the medication leaves the dispensary.
// If the medication has reached the patient, the form's opening gate stops the
// staff member and redirects to the pharmacy's dispensing-error process — that's
// no longer a near miss.
export const WHERE_CAUGHT = [
  'Data entry check',
  'Initial pharmacist check',
  'Final pharmacist check',
  'Technician spotted it',
];

// Default "where caught" to pre-select based on Layer 1 stage. One tap to change.
export const CAUGHT_DEFAULT_BY_STAGE: Record<string, string> = {
  'Script entered into dispensary software': 'Data entry check',
  'Drug picked from shelf': 'Initial pharmacist check',
  'Counted / measured': 'Initial pharmacist check',
  'Labelling': 'Final pharmacist check',
  'Bagging / handed to patient': 'Final pharmacist check',
  'Controlled drug dispensing': 'Final pharmacist check',
  'Compliance pack packing': 'Final pharmacist check',
};

export const FACTORS = [
  'Busy period',
  'Interruption or distraction',
  'Similar packaging',
  'Similar drug names',
  'Similar patient name',
  'Script not checked against original',
  'Understaffed',
  'System slow or down',
  'Dispensary software issue',
  'Handwriting hard to read',
  'Unusual dose or strength',
  'New staff member',
  'Trainee or intern involved',
  'Shift changeover',
  'Language barrier',
  'Unfamiliar drug',
  'Usual process skipped',
  'Message not passed on',
];
export const FACTORS_DEFAULT_VISIBLE = 7;

export const FORMULATIONS = [
  'Tablet', 'Capsule', 'Liquid', 'Cream', 'Ointment',
  'Patch', 'Injection', 'Drops', 'Ear drops', 'Inhaler',
  'Nebules', 'Spray', 'Sachet', 'Suppository', 'Compliance pack / DAA',
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
      l.includes('drug in pack') ||
      l.includes('brand'),
    strength: l.includes('strength'),
    quantity:
      (l.includes('quantity') || l.includes('volume') || l.includes('dose')) &&
      !l.includes('allergy') &&
      !l.includes('overridden') &&
      !l.includes('wrong day'),
    formulation: l.includes('formulation'),
  };
}

// Some error types are about the patient, the script, or paperwork \u2014
// not about a specific medicine. For everything else, the drug name
// should be captured so reports group properly and an inspector can
// trace "what drug was involved" without opening every incident.
export function isNonDrugError(subLabel: string): boolean {
  const l = subLabel.toLowerCase();
  return (
    l.includes('typo') ||
    l.includes('wrong patient') ||
    l.includes('nhi') ||
    l.includes('hpi') ||
    l.includes('subsidy') ||
    l.includes('register not signed') ||
    l.includes('bag mixed') ||
    l.includes('bag missing') ||
    l.includes('bag collected') ||
    l.includes('pso treated') ||
    l.includes('wrong day') ||
    l.includes('handed to wrong') ||
    l.includes('initials missing') ||
    l.includes('safe left') ||
    l.includes('out-of-date prescription') ||
    l.includes('forged or altered') ||
    l.includes('nzeps')
  );
}
