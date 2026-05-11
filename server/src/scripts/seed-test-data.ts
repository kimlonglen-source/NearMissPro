// Seed three months of realistic near-miss data so the dashboard,
// trend chart, pattern alerts, heatmap, and reports all have
// something to show.
//
// Run from project root:
//   npm -w server run seed
//
// Idempotent-ish: every row is tagged [SEED] in the notes column so
// you can clean it up later with:
//   delete from incidents where notes like '[SEED]%';

import { supabase } from '../config/supabase.js';

const NOTE_TAG = '[SEED]';

type Incident = {
  daysAgo: number;
  hour: number;
  error_step: string;
  error_types: string[];
  drug_name?: string;
  dispensed_drug?: string;
  prescribed_strength?: string;
  dispensed_strength?: string;
  correct_formulation?: string;
  dispensed_formulation?: string;
  where_caught: string;
  factors: string[];
  notes?: string;
  outcome?: 'accepted' | 'modified' | 'no_action';
  status?: 'active' | 'voided';
  void_reason?: string;
};

// Three calendar months of near misses + a few in the current month.
// The Atorvastatin wrong-strength pattern decreases (5 → 3 → 1 → 0) to
// showcase the "Did our actions work?" panel.
const MONTHS: { label: string; incidents: Incident[] }[] = [
  {
    label: '~3 months ago',
    incidents: [
      // Atorvastatin pattern (5 in this month)
      { daysAgo: 95, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['High volume period', 'Similar packaging'], outcome: 'accepted' },
      { daysAgo: 92, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '20mg', where_caught: 'Final pharmacist check', factors: ['Interruption / distraction'], outcome: 'accepted' },
      { daysAgo: 88, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '80mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging', 'High volume period'], outcome: 'modified' },
      { daysAgo: 82, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '10mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
      { daysAgo: 78, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Initial pharmacist check', factors: ['Similar packaging', 'High volume period'], outcome: 'accepted' },
      // High-risk: warfarin
      { daysAgo: 90, hour: 10, error_step: 'Script entered into dispensary software', error_types: ['Wrong strength entered'], drug_name: 'Warfarin', prescribed_strength: '1mg', dispensed_strength: '3mg', where_caught: 'Data entry check', factors: ['Interruption / distraction'], outcome: 'accepted' },
      // Codeine mix-up
      { daysAgo: 85, hour: 15, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Codeine phosphate', where_caught: 'Final pharmacist check', factors: ['Process not followed'], outcome: 'modified' },
      // Salbutamol formulation
      { daysAgo: 80, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation'], drug_name: 'Salbutamol', correct_formulation: 'Inhaler', dispensed_formulation: 'Nebule', where_caught: 'Technician query', factors: ['Similar packaging'], outcome: 'accepted' },
      // Amoxicillin look-alike
      { daysAgo: 76, hour: 9, error_step: 'Drug picked from shelf', error_types: ['Look-alike drug name'], drug_name: 'Amoxicillin', dispensed_drug: 'Amlodipine', where_caught: 'Initial pharmacist check', factors: ['Similar drug names', 'New staff member'], outcome: 'accepted' },
      // Methotrexate (HIGH-RISK)
      { daysAgo: 73, hour: 12, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Methotrexate', where_caught: 'Final pharmacist check', factors: ['Unfamiliar drug', 'Communication gap'], outcome: 'accepted', notes: 'Directions read daily instead of weekly — caught and corrected before patient left.' },
      // Wrong patient
      { daysAgo: 70, hour: 16, error_step: 'Bagging / handed to patient', error_types: ['Wrong patient label'], where_caught: 'Final pharmacist check', factors: ['High volume period'], outcome: 'no_action' },
      // Voided incident (data quality / submitted in error)
      { daysAgo: 87, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Ibuprofen', where_caught: 'Technician query', factors: [], status: 'voided', void_reason: 'Duplicate entry — same incident was logged twice.' },
    ],
  },
  {
    label: '~2 months ago',
    incidents: [
      // Atorvastatin pattern (now 3 — action starting to work)
      { daysAgo: 60, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
      { daysAgo: 55, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '20mg', where_caught: 'Initial pharmacist check', factors: ['High volume period'], outcome: 'accepted' },
      { daysAgo: 48, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '10mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
      // Insulin (HIGH-RISK)
      { daysAgo: 58, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Insulin glargine', prescribed_strength: '100u/ml', dispensed_strength: '300u/ml', where_caught: 'Final pharmacist check', factors: ['Unfamiliar drug', 'Similar packaging'], outcome: 'accepted', notes: 'Concentration mix-up between Lantus and Toujeo cartridges.' },
      // Metformin
      { daysAgo: 52, hour: 14, error_step: 'Script entered into dispensary software', error_types: ['Wrong directions'], drug_name: 'Metformin', where_caught: 'Data entry check', factors: ['Interruption / distraction'], outcome: 'accepted' },
      // Pantoprazole — start of new pattern (1)
      { daysAgo: 50, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
      // Allergy override
      { daysAgo: 45, hour: 15, error_step: 'Script entered into dispensary software', error_types: ['Allergy missed or overridden'], drug_name: 'Amoxicillin', where_caught: 'Initial pharmacist check', factors: ['Communication gap'], outcome: 'modified', notes: 'Allergy alert dismissed without review — patient flagged penicillin allergy.' },
      // Quantity miscount
      { daysAgo: 40, hour: 12, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Tramadol', where_caught: 'Final pharmacist check', factors: ['Interruption / distraction'], outcome: 'accepted' },
      // Pharmac brand
      { daysAgo: 38, hour: 16, error_step: 'Drug picked from shelf', error_types: ['Wrong Pharmac brand supplied'], drug_name: 'Quetiapine', where_caught: 'Final pharmacist check', factors: ['Process not followed'], outcome: 'no_action' },
    ],
  },
  {
    label: '~1 month ago',
    incidents: [
      // Atorvastatin pattern (now 1 — action mostly working)
      { daysAgo: 28, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '20mg', where_caught: 'Final pharmacist check', factors: ['High volume period'], outcome: 'accepted' },
      // Pantoprazole pattern continuing (2 more)
      { daysAgo: 25, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Similar drug names', 'Similar packaging'], outcome: 'accepted' },
      { daysAgo: 22, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
      // Warfarin again (HIGH-RISK)
      { daysAgo: 20, hour: 10, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Warfarin', where_caught: 'Final pharmacist check', factors: ['Communication gap'], outcome: 'modified', notes: 'Direction "5mg daily" labelled as "5mg twice daily".' },
      // Salbutamol formulation again
      { daysAgo: 18, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation'], drug_name: 'Salbutamol', correct_formulation: 'Inhaler', dispensed_formulation: 'Syrup', where_caught: 'Initial pharmacist check', factors: ['New staff member'], outcome: 'accepted' },
      // Pack size
      { daysAgo: 15, hour: 15, error_step: 'Drug picked from shelf', error_types: ['Wrong pack size'], drug_name: 'Paracetamol', where_caught: 'Technician query', factors: ['High volume period'], outcome: 'accepted' },
      // CD dispensing
      { daysAgo: 12, hour: 14, error_step: 'Controlled drug dispensing', error_types: ['Register not signed'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Process not followed'], outcome: 'modified', notes: 'Doses dispensed but CD register entry missed.' },
    ],
  },
  {
    label: 'current month (for fresh review)',
    incidents: [
      // Current month — only 4 incidents, no manager outcomes yet
      { daysAgo: 8, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names'] },
      { daysAgo: 5, hour: 13, error_step: 'Script entered into dispensary software', error_types: ['Wrong patient'], where_caught: 'Data entry check', factors: ['Interruption / distraction'] },
      { daysAgo: 3, hour: 10, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Sertraline', where_caught: 'Final pharmacist check', factors: ['Process not followed'] },
      { daysAgo: 1, hour: 14, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Diazepam', where_caught: 'Final pharmacist check', factors: ['Interruption / distraction'] },
    ],
  },
];

function bucketTimeOfDay(d: Date): string {
  const h = d.getHours();
  if (h >= 5 && h < 11) return 'Morning 8–12pm';
  if (h >= 11 && h < 14) return 'Lunch 12–2pm';
  if (h >= 14 && h < 18) return 'Afternoon 2–6pm';
  return 'Evening 6pm+';
}

function stubRecommendation(inc: Incident): string {
  const drug = inc.drug_name || 'this medicine';
  if (inc.error_types.includes('Wrong strength picked')) {
    return `Use colour-coded bins on the shelf to separate ${drug} strengths. Make the strength stand out on the dispensing label — bigger or bolder text.`;
  }
  if (inc.error_types.some(e => e.includes('Look-alike') || e.includes('Wrong drug picked'))) {
    return `Move ${drug} away from look-alike items on the shelf. Use TALLman lettering — write the unique letters BIG (e.g. amLODipine vs amIOdarone). Stick a bright warning label on each.`;
  }
  if (inc.error_types.some(e => e.includes('directions'))) {
    return `At final check, read the dispensing label word-for-word against the prescription. The pharmacist-in-charge should review label templates every 3 months.`;
  }
  if (inc.error_types.some(e => e.includes('quantity'))) {
    return `Always double-count ${drug} — a second person checks, or use a calibrated tablet counter. Set up a no-interruption zone during counting (HQSC distraction-reduction guidance).`;
  }
  if (inc.error_types.some(e => e.includes('formulation'))) {
    return `Keep different formulations (tablet, capsule, liquid, inhaler) of ${drug} apart on the shelf. Confirm the formulation with the patient at handout.`;
  }
  if (inc.error_types.some(e => e.includes('patient'))) {
    return `At every step (data entry, final check, handout), check both the patient's NHI number and date of birth. Pharmacy Council NZ requires two identifiers at handout.`;
  }
  if (inc.error_types.some(e => e.includes('Allergy'))) {
    return `When the dispensary software flags an allergy, the staff member should have to type a reason — not just tap-to-dismiss. The pharmacist-in-charge should review the override log weekly.`;
  }
  return `Review the dispensing workflow for ${drug} at the next team meeting and agree a specific prevention action. Write down what you decided.`;
}

async function findPharmacy(): Promise<{ id: string; name: string } | null> {
  const { data } = await supabase.from('pharmacies').select('id, name, subscription_status').order('created_at', { ascending: true });
  if (!data || data.length === 0) return null;
  const demo = data.find(p => p.name?.toLowerCase().includes('demo')) || data.find(p => p.subscription_status === 'active') || data[0];
  return { id: demo.id, name: demo.name };
}

async function seed() {
  const ph = await findPharmacy();
  if (!ph) {
    console.error('No pharmacy found. Create one from the Founder panel first.');
    process.exit(1);
  }
  console.log(`Seeding test data into: ${ph.name} (${ph.id})\n`);

  let totalInserted = 0;
  let totalVoided = 0;
  let totalRecs = 0;

  for (const month of MONTHS) {
    console.log(`— ${month.label}: ${month.incidents.length} near misses`);
    for (const inc of month.incidents) {
      const occurredAt = new Date();
      occurredAt.setDate(occurredAt.getDate() - inc.daysAgo);
      occurredAt.setHours(inc.hour, 30, 0, 0);

      const noteWithTag = `${NOTE_TAG} ${inc.notes || ''}`.trim();

      const { data: incident, error } = await supabase.from('incidents').insert({
        pharmacy_id: ph.id,
        error_step: inc.error_step,
        error_types: inc.error_types,
        drug_name: inc.drug_name || null,
        dispensed_drug: inc.dispensed_drug || null,
        prescribed_strength: inc.prescribed_strength || null,
        dispensed_strength: inc.dispensed_strength || null,
        correct_formulation: inc.correct_formulation || null,
        dispensed_formulation: inc.dispensed_formulation || null,
        where_caught: inc.where_caught,
        time_of_day: bucketTimeOfDay(occurredAt),
        occurred_at: occurredAt.toISOString(),
        submitted_at: occurredAt.toISOString(),
        factors: inc.factors,
        notes: noteWithTag,
        status: inc.status || 'active',
      }).select().single();

      if (error || !incident) {
        console.error('  insert failed:', error?.message);
        continue;
      }
      totalInserted++;

      // Audit log for voided incidents
      if (inc.status === 'voided') {
        totalVoided++;
        await supabase.from('audit_log').insert({
          pharmacy_id: ph.id, action: 'incident_voided',
          performed_by: 'seed', details: { incident_id: incident.id, reason: inc.void_reason || 'Test seed' },
        });
      }

      // Recommendation (skip for voided)
      if (inc.status !== 'voided') {
        const rec = stubRecommendation(inc);
        const { data: recommendation } = await supabase.from('recommendations').insert({
          incident_id: incident.id, pharmacy_id: ph.id, ai_text: rec,
          manager_outcome: inc.outcome || null,
          manager_name: inc.outcome ? 'manager' : null,
          reviewed_at: inc.outcome ? occurredAt.toISOString() : null,
        }).select().single();

        if (recommendation) {
          totalRecs++;
          if (inc.outcome) {
            await supabase.from('audit_log').insert({
              pharmacy_id: ph.id, action: `recommendation_${inc.outcome}`,
              performed_by: 'manager', details: { recommendation_id: recommendation.id },
            });
          }
        }
      }
    }
  }

  // Two historical reports — month-3 and month-2 ago — locked
  console.log('\n— Generating 2 historical reports');
  const now = new Date();
  const monthStart = (offsetMonths: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths, 1);
    return d.toISOString().split('T')[0];
  };
  const monthEnd = (offsetMonths: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() - offsetMonths + 1, 0);
    return d.toISOString().split('T')[0];
  };

  for (const offset of [3, 2]) {
    const periodStart = monthStart(offset);
    const periodEnd = monthEnd(offset);
    await supabase.from('reports').insert({
      pharmacy_id: ph.id,
      period_start: periodStart,
      period_end: periodEnd,
      generated_by: 'seed',
      locked: true,
      period_summary: offset === 3
        ? 'A busy period dominated by Atorvastatin wrong-strength picks (5 of 12). The biggest cause was similar packaging — colour-coded bins on the statin shelf. Warfarin and Methotrexate near misses (both high-risk) also occurred and were caught at the final check.'
        : 'Atorvastatin wrong-strength near misses reduced from 5 to 3 — the colour-coded shelf appears to be helping. A new Pantoprazole/Omeprazole look-alike pattern emerged. One insulin near miss (high-risk) caught at final check.',
      agenda_items: [
        { text: 'Open: we use anonymised data here — the goal is learning, not blame (Pharmacy Council NZ continuous quality improvement principle).', edited: false },
        { text: offset === 3
          ? 'Root cause for Atorvastatin wrong-strength: walk through the chain of events. Were the SOPs followed? Do any need updating?'
          : 'Look at the "Did our actions work?" panel above: which patterns reduced after the changes we made, and which kept happening despite them?', edited: false },
        { text: 'Agree ONE system change for this month — what workspace, SOP, layout, or software change will target similar packaging?', edited: false },
        { text: 'Sign off: write down the system change we agreed today, who owns it, and by when.', edited: false },
      ],
    });
  }

  console.log(`\nDone.`);
  console.log(`  ${totalInserted} incidents created (${totalVoided} voided)`);
  console.log(`  ${totalRecs} recommendations created`);
  console.log(`  2 historical reports created (locked)`);
  console.log(`\nTo wipe later: delete from incidents where notes like '${NOTE_TAG}%';`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
