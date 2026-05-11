// Seeds an additional month of near misses in the current period and
// generates a real report for it using the live generator. Use this
// when you want to see the latest report layout / agenda / period
// summary on fresh data without having to manually log incidents.
//
// Run from project root:
//   npm -w server run seed-fresh-month
//
// Cleanup later (same as the original seed):
//   delete from incidents where notes like '[SEED]%';
//   delete from reports where generated_by = 'seed';

import { supabase } from '../config/supabase.js';
import { generatePeriodSummary, detectDrugErrorHotspots, getTrendSeries } from '../services/ai.js';

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
  outcome: 'accepted' | 'modified' | 'no_action';
};

// 14 near misses spread across the last ~28 days. Mix of drugs,
// stages, factors. Reviewed (manager_outcome set) so they appear on
// the report rather than the dashboard's review queue.
const INCIDENTS: Incident[] = [
  // Pantoprazole pattern carrying over (the new "needs attention")
  { daysAgo: 26, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names', 'Similar packaging'], outcome: 'accepted' },
  { daysAgo: 22, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
  { daysAgo: 18, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong drug picked'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names', 'High volume period'], outcome: 'modified', notes: 'Caught at final check before label printed.' },
  // Atorvastatin once-only (the pattern from prior month is now resolved)
  { daysAgo: 24, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['High volume period'], outcome: 'accepted' },
  // Warfarin (high-risk)
  { daysAgo: 20, hour: 10, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Warfarin', where_caught: 'Final pharmacist check', factors: ['Communication gap'], outcome: 'modified', notes: 'Direction read "5mg twice daily" instead of "5mg daily".' },
  // Insulin (high-risk)
  { daysAgo: 15, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Insulin glargine', prescribed_strength: '100u/ml', dispensed_strength: '300u/ml', where_caught: 'Final pharmacist check', factors: ['Similar packaging', 'Unfamiliar drug'], outcome: 'accepted' },
  // Codeine
  { daysAgo: 12, hour: 15, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Codeine phosphate', where_caught: 'Final pharmacist check', factors: ['Process not followed'], outcome: 'accepted' },
  // Methotrexate (high-risk)
  { daysAgo: 10, hour: 12, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Methotrexate', where_caught: 'Final pharmacist check', factors: ['Unfamiliar drug'], outcome: 'accepted', notes: 'Directions said daily instead of weekly — caught at final check.' },
  // Salbutamol formulation
  { daysAgo: 8, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation'], drug_name: 'Salbutamol', correct_formulation: 'Inhaler', dispensed_formulation: 'Nebule', where_caught: 'Technician query', factors: ['Similar packaging'], outcome: 'accepted' },
  // Quantity miscount
  { daysAgo: 6, hour: 11, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Tramadol', where_caught: 'Final pharmacist check', factors: ['Interruption / distraction'], outcome: 'accepted' },
  // Allergy override
  { daysAgo: 5, hour: 16, error_step: 'Script entered into dispensary software', error_types: ['Allergy missed or overridden'], drug_name: 'Amoxicillin', where_caught: 'Initial pharmacist check', factors: ['Communication gap'], outcome: 'modified', notes: 'Allergy alert dismissed without review.' },
  // Wrong patient (no drug — exercises the new "non-drug" path)
  { daysAgo: 4, hour: 13, error_step: 'Script entered into dispensary software', error_types: ['Wrong patient'], where_caught: 'Data entry check', factors: ['Interruption / distraction'], outcome: 'accepted' },
  // Pack size
  { daysAgo: 3, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong pack size'], drug_name: 'Paracetamol', where_caught: 'Technician query', factors: ['High volume period'], outcome: 'accepted' },
  // CD register
  { daysAgo: 2, hour: 14, error_step: 'Controlled drug dispensing', error_types: ['Register not signed'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Process not followed'], outcome: 'modified', notes: 'CD register entry missed.' },
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
    return `Use colour-coded bins on the shelf to separate ${drug} strengths. Make the strength stand out on the dispensing label.`;
  }
  if (inc.error_types.some(e => e.includes('Look-alike') || e.includes('Wrong drug picked'))) {
    return `Move ${drug} away from look-alike items on the shelf. Use TALLman lettering (writing the unique letters BIG) and stick a bright warning label on each.`;
  }
  if (inc.error_types.some(e => e.includes('directions'))) {
    return `At final check, read the dispensing label word-for-word against the prescription. Review label templates regularly.`;
  }
  if (inc.error_types.some(e => e.includes('quantity'))) {
    return `Always double-count ${drug} — second person checks or use a calibrated tablet counter. Set up a no-interruption zone during counting.`;
  }
  if (inc.error_types.some(e => e.includes('formulation'))) {
    return `Keep different formulations of ${drug} apart on the shelf. Confirm formulation with the patient at handout.`;
  }
  if (inc.error_types.some(e => e.includes('patient'))) {
    return `Check NHI and date of birth at every step. Pharmacy Council NZ requires two identifiers at handout.`;
  }
  if (inc.error_types.some(e => e.includes('Allergy'))) {
    return `Override of an allergy alert should require a typed reason, not a tap-to-dismiss. The pharmacist-in-charge reviews override log weekly.`;
  }
  if (inc.error_types.some(e => e.includes('Register'))) {
    return `Sign the CD register BEFORE the drug leaves the dispensary. Add a visual prompt on the dispensing area.`;
  }
  return `Review the dispensing workflow for ${drug} at the next team meeting and agree a specific prevention action.`;
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
  console.log(`Seeding a fresh month into: ${ph.name} (${ph.id})\n`);

  let inserted = 0;
  for (const inc of INCIDENTS) {
    const occurredAt = new Date();
    occurredAt.setDate(occurredAt.getDate() - inc.daysAgo);
    occurredAt.setHours(inc.hour, 30, 0, 0);

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
      notes: `${NOTE_TAG} ${inc.notes || ''}`.trim(),
      status: 'active',
    }).select().single();

    if (error || !incident) {
      console.error('  insert failed:', error?.message);
      continue;
    }
    inserted++;

    // Recommendation + manager outcome so the report shows it as reviewed.
    await supabase.from('recommendations').insert({
      incident_id: incident.id, pharmacy_id: ph.id, ai_text: stubRecommendation(inc),
      manager_outcome: inc.outcome,
      manager_name: 'manager',
      reviewed_at: occurredAt.toISOString(),
    });
  }
  console.log(`Inserted ${inserted} new near misses (all reviewed).`);

  // Generate a real report for the last 30 days using the live
  // generator — same code path the app uses, so the new layout +
  // 4-item agenda kick in automatically.
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const periodEnd = now.toISOString().split('T')[0];

  console.log(`\nGenerating report for ${periodStart} → ${periodEnd}…`);
  const [{ summary, agenda, previousSummary }, hotspots, trend] = await Promise.all([
    generatePeriodSummary(ph.id, periodStart, periodEnd),
    detectDrugErrorHotspots(ph.id, periodStart, periodEnd),
    getTrendSeries(ph.id, periodStart, periodEnd),
  ]);

  const { data: report, error: reportError } = await supabase.from('reports').insert({
    pharmacy_id: ph.id,
    period_start: periodStart, period_end: periodEnd,
    generated_by: 'seed',
    locked: false,
    period_summary: summary,
    previous_period_summary: previousSummary || null,
    agenda_items: agenda.map(text => ({ text, edited: false })),
    pattern_alerts: hotspots,
    trend_data: trend,
  }).select().single();

  if (reportError) {
    console.error('Report insert failed:', reportError.message);
    process.exit(1);
  }
  console.log(`Report ready. Open: /reports/${report.id}`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
