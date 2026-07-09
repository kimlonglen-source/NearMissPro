// Dispensing-incident taxonomy — source of truth for the Record form.
// KEEP IN SYNC with supabase/migrate_workflow_stage.sql (seeded for reports/filters).
// Hardcoded on the client so the Record page renders instantly with no API wait.

export interface SubError {
  label: string;
  common: boolean; // true = default-visible, false = revealed via "More…"
  // Optional specific parts this chip expands into. Used by umbrella chips
  // (e.g. "Wrong directions", "Clinical check missed") so closely-related
  // sub-cases live under one chip instead of competing as separate chips.
  // Each string is a plain label stored directly in errorTypes.
  refinements?: string[];
  // Prompt shown above the refine row when this umbrella is selected.
  refineTitle?: string;
}

export interface Stage {
  label: string;
  subErrors: SubError[];
}

export const STAGES: Stage[] = [
  {
    label: 'Script entered into dispensary software',
    subErrors: [
      { label: 'Wrong patient', common: true },
      { label: 'Wrong drug entered', common: true },
      { label: 'Wrong strength entered', common: true },
      {
        label: 'Wrong directions',
        common: true,
        refineTitle: 'Which part of the directions?',
        refinements: ['Wrong dose', 'Wrong frequency', 'Wrong route', 'Wrong timing or instruction'],
      },
      // The residual "data-entry slip" chip — only for a genuine misspelling
      // or a garbled entry that ISN'T one of the specific wrong-field errors
      // above (which cover a mistyped drug / strength / directions / quantity).
      { label: "Spelling or doesn't make sense", common: false },
      { label: 'Wrong quantity or days supply entered', common: false },
      { label: 'Repeat dispensed too early', common: false },
      { label: 'Patient overdue for repeat', common: false },
      {
        label: 'Clinical check missed',
        common: false,
        refineTitle: 'Which check was missed?',
        refinements: [
          'Allergy warning ignored',
          'Drug interaction missed',
          'Patient already on the same drug',
          'Dose not adjusted for age, kidney or liver',
          'Pregnancy or breastfeeding safety not checked',
        ],
      },
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
      {
        label: 'Wrong drug picked',
        common: true,
        refineTitle: 'What caused the mix-up?',
        refinements: ['Wrong drug \u2014 look-alike packaging', 'Wrong drug \u2014 look-alike tablet/capsule', 'Wrong drug \u2014 sound-alike name'],
      },
      { label: 'Wrong strength picked', common: true },
      { label: 'Wrong formulation picked', common: true },
      { label: 'Wrong brand supplied', common: true },
      { label: 'Wrong pack size', common: false },
      {
        label: 'Stock quality problem',
        common: false,
        refineTitle: 'What was wrong with the stock?',
        refinements: ['Expired stock', 'Damaged tablets', 'Recalled stock dispensed'],
      },
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
      {
        label: 'Compounding error',
        common: false,
        refineTitle: 'Where did the compounding go wrong?',
        refinements: [
          'Compounding calculation wrong',
          'Wrong base or diluent (compounding)',
          'Wrong concentration (compounding)',
        ],
      },
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
      {
        label: 'Counselling gap',
        common: true,
        refineTitle: 'What was missed?',
        refinements: [
          'Counselling missed or wrong',
          'Inhaler or device technique not shown',
          'Driving or alcohol warning missed',
        ],
      },
      { label: 'Bag missing an item', common: true },
      { label: 'Bag contains extra item', common: false },
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
  'Dispensary system slow or down',
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
  'Patch', 'Injection', 'Drops', 'Inhaler',
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
  brand: boolean;
  strength: boolean;
  quantity: boolean;
  formulation: boolean;
  interaction: boolean;
} {
  const l = subLabel.toLowerCase();
  return {
    // The two-box "prescribed drug → drug given in error" only makes sense
    // when a DIFFERENT drug was involved. Not for "wrong brand" (same drug,
    // different brand) — that gets its own brand → brand box instead.
    drug:
      l.includes('wrong drug') ||
      l.includes('look-alike') ||
      l.includes('sound-alike') ||
      l.includes('drug entered'),
    // Wrong brand of the SAME drug — capture the intended brand → the brand
    // given (a two-box, like the drug swap, but for brands).
    brand: l.includes('brand'),
    // "Mixed strengths in same container" has no single wrong strength to
    // compare, so it skips the strength box and just names the drug.
    strength: l.includes('strength') && !l.includes('mixed'),
    quantity:
      (l.includes('quantity') || l.includes('volume') || l.includes('days supply')) &&
      !l.includes('allergy') &&
      !l.includes('overridden') &&
      !l.includes('wrong day '),
    formulation: l.includes('formulation'),
    // A genuine interaction between TWO DIFFERENT drugs — the form captures
    // the second one so the report names both. Deliberately NOT fired for
    // "patient already on the same drug" (duplicate therapy is one drug, so a
    // second-drug box there just confuses).
    interaction: l.includes('interaction'),
  };
}

// Some error types are about the patient, the script, or paperwork \u2014
// not about a specific medicine. For everything else, the drug name
// should be captured so reports group properly and an inspector can
// trace "what drug was involved" without opening every incident.
// Note: "bag missing an item" / "bag contains extra item" DO ask for the
// drug (you can name the item), but a bag MIX-UP (wrong bag, wrong patient,
// two bags swapped) is pure logistics \u2014 no single drug to name.
export function isNonDrugError(subLabel: string): boolean {
  const l = subLabel.toLowerCase();
  return (
    l.includes('typo') ||
    l.includes('spelling') ||          // "Spelling or doesn't make sense" — a garbled entry may have no clear drug
    l.includes('wrong patient') ||
    l.includes('nhi') ||
    l.includes('hpi') ||
    l.includes('subsidy') ||
    l.includes('bag mixed') ||
    l.includes('bag collected') ||
    l.includes('pso') ||               // "…(PSO) treated as patient script" — paren broke the old 'pso treated'
    l.includes('wrong day') ||         // "Wrong day or time slot" (compliance pack)
    l.includes('wrong patient given') ||
    l.includes('initials missing') ||
    l.includes('safe left') ||
    l.includes('out-of-date prescription') ||
    l.includes('forged or altered') ||
    l.includes('nzeps') ||
    l.includes('e-prescription')
  );
}

// A few errors are about the prescription and a NUMBER — the quantity or
// days-supply — not the drug's identity. The fix ("read the quantity back
// against the script") is the same whatever the drug is, so the drug is
// useful context but NOT required. The drug field still shows, just optional.
export function isDrugOptional(subLabel: string): boolean {
  const l = subLabel.toLowerCase();
  return l.includes('quantity') || l.includes('volume') || l.includes('days supply');
}
