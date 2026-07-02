// Backdated seed for FOUR full historical reports so the pharmacy
// owner can see how a real report history looks.
//
// Creates:
//   - Period 0 (about 4 months ago): 25 near misses  -> locked report
//   - Period 1 (about 3 months ago): 25 near misses  -> locked report
//   - Period 2 (about 2 months ago): 27 near misses  -> locked report
//   - Period 3 (about 1 month ago):  23 near misses  -> locked report
//
// Each period is a calendar month. Reports are generated with the
// live period-summary + hotspot + trend helpers so their layout
// matches what a manager would see today. Period 0 exists so that
// even the OLDEST visible report has a previous period to compare
// against — every report's "Follow-up from last review" section has
// real data instead of the first-review placeholder.
//
// Run from project root:
//   npm -w server run seed-three-reports
//
// Cleanup later (this script only — leaves the other seed data alone):
//   delete from incidents where notes like '[SEED-3R]%';
//   delete from reports where generated_by = 'seed-three-reports';
//   delete from audit_log where performed_by = 'seed-three-reports';

import { supabase } from '../config/supabase.js';
import { generatePeriodSummary, detectDrugErrorHotspots, getTrendSeries } from '../services/ai.js';

const NOTE_TAG = '[SEED-3R]';
const GENERATED_BY = 'seed-three-reports';

type Incident = {
  dayOfMonth: number;
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

// ── Data for each of the four months ────────────────────────────────
// Same drug patterns recur so the follow-up section has something
// interesting to show:
//   Atorvastatin wrong-strength: 7 -> 6 -> 3 -> 1 (action working)
//   Simvastatin sound-alike:     3 -> 0 -> 0 -> 0 (resolved after period 0)
//   Pantoprazole look-alike:     0 -> 0 -> 2 -> 4 (new pattern, growing)
//   Methadone process errors:    2 -> 2 -> 1 -> 1 (steady low-level)
//   Warfarin (high-risk):        1 -> 1 -> 1 -> 2

const PERIOD_0_INCIDENTS: Incident[] = [
  // Atorvastatin at its worst — 7 this month, before any action
  { dayOfMonth: 1, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'accepted' },
  { dayOfMonth: 4, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '80mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 7, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '10mg', dispensed_strength: '20mg', where_caught: 'Initial pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'accepted' },
  { dayOfMonth: 11, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '80mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'modified' },
  { dayOfMonth: 15, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '10mg', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 20, hour: 15, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 26, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '10mg', dispensed_strength: '40mg', where_caught: 'Initial pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'accepted' },
  // Simvastatin sound-alike — 3 this month, resolved entirely after this period
  { dayOfMonth: 3, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — sound-alike name'], drug_name: 'Simvastatin', dispensed_drug: 'Atorvastatin', where_caught: 'Initial pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
  { dayOfMonth: 13, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — sound-alike name'], drug_name: 'Simvastatin', dispensed_drug: 'Atorvastatin', where_caught: 'Final pharmacist check', factors: ['Similar drug names', 'Busy period'], outcome: 'modified' },
  { dayOfMonth: 23, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — sound-alike name'], drug_name: 'Simvastatin', dispensed_drug: 'Atorvastatin', where_caught: 'Initial pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
  // Methadone / CD
  { dayOfMonth: 6, hour: 14, error_step: 'Controlled drug dispensing', error_types: ['CD register entry missed'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 18, hour: 11, error_step: 'Controlled drug dispensing', error_types: ['CD second-check skipped'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  // High-risk
  { dayOfMonth: 9, hour: 10, error_step: 'Script entered into dispensary software', error_types: ['Wrong strength entered'], drug_name: 'Warfarin', prescribed_strength: '1mg', dispensed_strength: '3mg', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 12, hour: 13, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Methotrexate', where_caught: 'Final pharmacist check', factors: ['Unfamiliar drug'], outcome: 'modified', notes: 'Directions labelled daily instead of weekly.' },
  // One-offs
  { dayOfMonth: 2, hour: 12, error_step: 'Script entered into dispensary software', error_types: ['Typo / mistyped'], drug_name: 'Metformin', where_caught: 'Data entry check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 5, hour: 15, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Tramadol', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 8, hour: 13, error_step: 'Bagging / handed to patient', error_types: ['Counselling missed or wrong'], drug_name: 'Prednisone', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'no_action' },
  { dayOfMonth: 10, hour: 16, error_step: 'Bagging / handed to patient', error_types: ['Wrong patient given the bag'], where_caught: 'Final pharmacist check', factors: ['Similar patient name'], outcome: 'accepted' },
  { dayOfMonth: 14, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation picked'], drug_name: 'Salbutamol', correct_formulation: 'Inhaler', dispensed_formulation: 'Nebules', where_caught: 'Technician spotted it', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 16, hour: 14, error_step: 'Labelling', error_types: ['Missing warning label (CAL)'], drug_name: 'Codeine phosphate', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 17, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong pack size'], drug_name: 'Paracetamol', where_caught: 'Technician spotted it', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 19, hour: 13, error_step: 'Bagging / handed to patient', error_types: ['Bag missing an item'], where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 21, hour: 12, error_step: 'Script entered into dispensary software', error_types: ['Typo / mistyped'], drug_name: 'Sertraline', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 22, hour: 15, error_step: 'Script entered into dispensary software', error_types: ['Allergy warning ignored'], drug_name: 'Amoxicillin', where_caught: 'Initial pharmacist check', factors: ['Usual process skipped'], outcome: 'modified', notes: 'Penicillin allergy alert dismissed without checking.' },
  { dayOfMonth: 24, hour: 11, error_step: 'Compliance pack packing', error_types: ['Wrong day or time slot'], where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'accepted' },
];

const PERIOD_1_INCIDENTS: Incident[] = [
  // Atorvastatin cluster — the dominant pattern this period
  { dayOfMonth: 2, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'accepted' },
  { dayOfMonth: 4, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '20mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 8, hour: 15, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '10mg', dispensed_strength: '40mg', where_caught: 'Initial pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'modified' },
  { dayOfMonth: 12, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '80mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 18, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '10mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 24, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'accepted' },
  // High-risk drugs (one each)
  { dayOfMonth: 6, hour: 10, error_step: 'Script entered into dispensary software', error_types: ['Wrong strength entered'], drug_name: 'Warfarin', prescribed_strength: '1mg', dispensed_strength: '3mg', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted', notes: 'Wrong strength typed at data entry — caught before printing.' },
  { dayOfMonth: 15, hour: 13, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Methotrexate', where_caught: 'Final pharmacist check', factors: ['Unfamiliar drug', 'Message not passed on'], outcome: 'modified', notes: 'Directions labelled daily instead of weekly.' },
  // Methadone / CD
  { dayOfMonth: 9, hour: 14, error_step: 'Controlled drug dispensing', error_types: ['CD register entry missed'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 22, hour: 11, error_step: 'Controlled drug dispensing', error_types: ['CD second-check skipped'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  // Other single-instance patterns
  { dayOfMonth: 3, hour: 15, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Codeine phosphate', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'accepted' },
  { dayOfMonth: 7, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation picked'], drug_name: 'Salbutamol', correct_formulation: 'Inhaler', dispensed_formulation: 'Nebules', where_caught: 'Technician spotted it', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 10, hour: 9, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Amoxicillin', dispensed_drug: 'Amlodipine', where_caught: 'Initial pharmacist check', factors: ['Similar drug names', 'New staff member'], outcome: 'accepted' },
  { dayOfMonth: 13, hour: 16, error_step: 'Bagging / handed to patient', error_types: ['Wrong patient given the bag'], where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'no_action' },
  { dayOfMonth: 16, hour: 11, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Tramadol', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 17, hour: 14, error_step: 'Script entered into dispensary software', error_types: ['Wrong directions'], drug_name: 'Metformin', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 19, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong pack size'], drug_name: 'Paracetamol', where_caught: 'Technician spotted it', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 20, hour: 15, error_step: 'Labelling', error_types: ['Missing warning label (CAL)'], drug_name: 'Ibuprofen', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 21, hour: 13, error_step: 'Script entered into dispensary software', error_types: ['Typo / mistyped'], drug_name: 'Sertraline', where_caught: 'Data entry check', factors: ['Interruption or distraction', 'Busy period'], outcome: 'accepted' },
  { dayOfMonth: 23, hour: 12, error_step: 'Bagging / handed to patient', error_types: ['Counselling missed or wrong'], drug_name: 'Prednisone', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'no_action' },
  { dayOfMonth: 25, hour: 11, error_step: 'Counted / measured', error_types: ['Wrong volume measured (liquid)'], drug_name: 'Amoxicillin', where_caught: 'Final pharmacist check', factors: ['New staff member'], outcome: 'accepted' },
  { dayOfMonth: 26, hour: 14, error_step: 'Compliance pack packing', error_types: ['Wrong day or time slot'], where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'modified' },
  { dayOfMonth: 27, hour: 16, error_step: 'Bagging / handed to patient', error_types: ['Bag mixed up between patients'], where_caught: 'Final pharmacist check', factors: ['Busy period', 'Similar patient name'], outcome: 'accepted' },
  { dayOfMonth: 28, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — sound-alike name'], drug_name: 'Fluoxetine', dispensed_drug: 'Fluticasone', where_caught: 'Initial pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
  { dayOfMonth: 29, hour: 15, error_step: 'Script entered into dispensary software', error_types: ['Allergy warning ignored'], drug_name: 'Flucloxacillin', where_caught: 'Initial pharmacist check', factors: ['Usual process skipped'], outcome: 'modified', notes: 'Penicillin allergy alert dismissed.' },
];

const PERIOD_2_INCIDENTS: Incident[] = [
  // Atorvastatin — down to 3 (action helping)
  { dayOfMonth: 5, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '40mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 14, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '20mg', where_caught: 'Initial pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 22, hour: 15, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '20mg', dispensed_strength: '10mg', where_caught: 'Final pharmacist check', factors: ['Similar packaging'], outcome: 'accepted' },
  // Pantoprazole — emerging new pattern (2 this month)
  { dayOfMonth: 8, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Similar drug names', 'Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 20, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
  // High-risk
  { dayOfMonth: 10, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Insulin glargine', prescribed_strength: '100u/ml', dispensed_strength: '300u/ml', where_caught: 'Final pharmacist check', factors: ['Unfamiliar drug', 'Similar packaging'], outcome: 'accepted', notes: 'Concentration mix-up between Lantus and Toujeo cartridges.' },
  { dayOfMonth: 17, hour: 13, error_step: 'Script entered into dispensary software', error_types: ['Wrong directions'], drug_name: 'Warfarin', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  // Methadone (down to 1)
  { dayOfMonth: 6, hour: 14, error_step: 'Controlled drug dispensing', error_types: ['CD register entry missed'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Shift changeover'], outcome: 'modified' },
  // Others
  { dayOfMonth: 2, hour: 15, error_step: 'Script entered into dispensary software', error_types: ['Typo / mistyped'], drug_name: 'Metformin', where_caught: 'Data entry check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 3, hour: 12, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Tramadol', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 7, hour: 16, error_step: 'Drug picked from shelf', error_types: ['Wrong Pharmac brand supplied'], drug_name: 'Quetiapine', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'no_action' },
  { dayOfMonth: 9, hour: 11, error_step: 'Bagging / handed to patient', error_types: ['Wrong bag collected from pickup shelf'], where_caught: 'Final pharmacist check', factors: ['Busy period', 'Similar patient name'], outcome: 'accepted' },
  { dayOfMonth: 11, hour: 13, error_step: 'Labelling', error_types: ['Wrong warning label (CAL)'], drug_name: 'Prednisone', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 12, hour: 10, error_step: 'Script entered into dispensary software', error_types: ['Wrong directions'], drug_name: 'Amoxicillin', where_caught: 'Data entry check', factors: ['Handwriting hard to read'], outcome: 'accepted' },
  { dayOfMonth: 13, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation picked'], drug_name: 'Fluticasone', correct_formulation: 'Inhaler', dispensed_formulation: 'Nasal spray', where_caught: 'Initial pharmacist check', factors: ['New staff member'], outcome: 'accepted' },
  { dayOfMonth: 15, hour: 15, error_step: 'Script entered into dispensary software', error_types: ['Allergy warning ignored'], drug_name: 'Ibuprofen', where_caught: 'Initial pharmacist check', factors: ['Message not passed on'], outcome: 'modified', notes: 'Aspirin allergy overridden without confirming with prescriber.' },
  { dayOfMonth: 16, hour: 11, error_step: 'Compliance pack packing', error_types: ['Missing dose from compliance pack'], drug_name: 'Bisoprolol', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 18, hour: 14, error_step: 'Bagging / handed to patient', error_types: ['Counselling missed or wrong'], drug_name: 'Salbutamol', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'no_action', notes: 'Inhaler technique not shown to first-time user.' },
  { dayOfMonth: 19, hour: 9, error_step: 'Drug picked from shelf', error_types: ['Expired stock'], drug_name: 'Cefaclor', where_caught: 'Initial pharmacist check', factors: [], outcome: 'accepted' },
  { dayOfMonth: 21, hour: 13, error_step: 'Script entered into dispensary software', error_types: ['Wrong patient'], where_caught: 'Data entry check', factors: ['Similar patient name'], outcome: 'accepted' },
  { dayOfMonth: 23, hour: 16, error_step: 'Labelling', error_types: ['Label on wrong item or bottle'], drug_name: 'Losartan', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'modified' },
  { dayOfMonth: 24, hour: 10, error_step: 'Bagging / handed to patient', error_types: ['Bag missing an item'], where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 25, hour: 12, error_step: 'Counted / measured', error_types: ['Tablet-splitting error'], drug_name: 'Furosemide', where_caught: 'Final pharmacist check', factors: ['New staff member'], outcome: 'accepted' },
  { dayOfMonth: 26, hour: 14, error_step: 'Script entered into dispensary software', error_types: ['Drug interaction missed'], drug_name: 'Clopidogrel', where_caught: 'Initial pharmacist check', factors: ['Usual process skipped'], outcome: 'modified', notes: 'Clopidogrel + omeprazole interaction not flagged.' },
  { dayOfMonth: 27, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Damaged tablets'], drug_name: 'Prednisone', where_caught: 'Technician spotted it', factors: [], outcome: 'accepted' },
  { dayOfMonth: 28, hour: 15, error_step: 'Compliance pack packing', error_types: ['Wrong drug in compliance pack'], drug_name: 'Metoprolol', dispensed_drug: 'Metformin', where_caught: 'Final pharmacist check', factors: ['Similar drug names', 'Trainee or intern involved'], outcome: 'modified' },
];

const PERIOD_3_INCIDENTS: Incident[] = [
  // Atorvastatin — down to 1 (colour-coded bins working)
  { dayOfMonth: 15, hour: 13, error_step: 'Drug picked from shelf', error_types: ['Wrong strength picked'], drug_name: 'Atorvastatin', prescribed_strength: '40mg', dispensed_strength: '20mg', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'accepted' },
  // Pantoprazole — up to 4 (getting worse — needs action)
  { dayOfMonth: 4, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Similar drug names', 'Similar packaging'], outcome: 'accepted' },
  { dayOfMonth: 11, hour: 14, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names'], outcome: 'accepted' },
  { dayOfMonth: 18, hour: 10, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Similar packaging', 'Busy period'], outcome: 'modified' },
  { dayOfMonth: 25, hour: 15, error_step: 'Drug picked from shelf', error_types: ['Wrong drug — look-alike packaging'], drug_name: 'Pantoprazole', dispensed_drug: 'Omeprazole', where_caught: 'Final pharmacist check', factors: ['Similar drug names', 'Similar packaging'], outcome: 'accepted' },
  // High-risk (warfarin ×2, methotrexate ×1)
  { dayOfMonth: 6, hour: 10, error_step: 'Labelling', error_types: ['Wrong directions'], drug_name: 'Warfarin', where_caught: 'Final pharmacist check', factors: ['Message not passed on'], outcome: 'modified', notes: '"5mg daily" labelled as "5mg twice daily" — caught at final check.' },
  { dayOfMonth: 20, hour: 13, error_step: 'Script entered into dispensary software', error_types: ['Wrong strength entered'], drug_name: 'Warfarin', prescribed_strength: '1mg', dispensed_strength: '5mg', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 12, hour: 11, error_step: 'Script entered into dispensary software', error_types: ['Wrong directions'], drug_name: 'Methotrexate', where_caught: 'Data entry check', factors: ['Unfamiliar drug'], outcome: 'modified' },
  // Methadone
  { dayOfMonth: 8, hour: 14, error_step: 'Controlled drug dispensing', error_types: ['Methadone wrong dose dispensed'], drug_name: 'Methadone', where_caught: 'Final pharmacist check', factors: ['Shift changeover'], outcome: 'modified' },
  // Others
  { dayOfMonth: 2, hour: 12, error_step: 'Script entered into dispensary software', error_types: ['Typo / mistyped'], drug_name: 'Amoxicillin', where_caught: 'Data entry check', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 3, hour: 15, error_step: 'Drug picked from shelf', error_types: ['Wrong formulation picked'], drug_name: 'Salbutamol', correct_formulation: 'Inhaler', dispensed_formulation: 'Syrup', where_caught: 'Initial pharmacist check', factors: ['New staff member'], outcome: 'accepted' },
  { dayOfMonth: 5, hour: 11, error_step: 'Drug picked from shelf', error_types: ['Wrong pack size'], drug_name: 'Paracetamol', where_caught: 'Technician spotted it', factors: ['Busy period'], outcome: 'accepted' },
  { dayOfMonth: 7, hour: 13, error_step: 'Labelling', error_types: ['Missing warning label (CAL)'], drug_name: 'Codeine phosphate', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 9, hour: 16, error_step: 'Bagging / handed to patient', error_types: ['Wrong patient given the bag'], where_caught: 'Final pharmacist check', factors: ['Similar patient name', 'Busy period'], outcome: 'accepted' },
  { dayOfMonth: 10, hour: 10, error_step: 'Counted / measured', error_types: ['Wrong quantity counted'], drug_name: 'Diazepam', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 13, hour: 14, error_step: 'Script entered into dispensary software', error_types: ['Wrong quantity entered'], drug_name: 'Prednisone', where_caught: 'Data entry check', factors: ['Interruption or distraction'], outcome: 'accepted' },
  { dayOfMonth: 14, hour: 11, error_step: 'Compliance pack packing', error_types: ['Extra dose in compliance pack'], drug_name: 'Furosemide', where_caught: 'Final pharmacist check', factors: ['Trainee or intern involved'], outcome: 'modified' },
  { dayOfMonth: 16, hour: 15, error_step: 'Script entered into dispensary software', error_types: ['Dose not adjusted for age, kidney or liver'], drug_name: 'Metformin', where_caught: 'Initial pharmacist check', factors: ['Usual process skipped'], outcome: 'modified', notes: 'Renal dose not adjusted for eGFR 35.' },
  { dayOfMonth: 17, hour: 12, error_step: 'Drug picked from shelf', error_types: ['Wrong Pharmac brand supplied'], drug_name: 'Losartan', where_caught: 'Final pharmacist check', factors: ['Usual process skipped'], outcome: 'no_action' },
  { dayOfMonth: 19, hour: 9, error_step: 'Bagging / handed to patient', error_types: ['Counselling missed or wrong'], drug_name: 'Prednisone', where_caught: 'Final pharmacist check', factors: ['Busy period'], outcome: 'no_action' },
  { dayOfMonth: 22, hour: 14, error_step: 'Script entered into dispensary software', error_types: ['Patient already on the same drug'], drug_name: 'Omeprazole', where_caught: 'Initial pharmacist check', factors: ['Usual process skipped'], outcome: 'modified' },
  { dayOfMonth: 24, hour: 11, error_step: 'Bagging / handed to patient', error_types: ['Bag missing an item'], where_caught: 'Final pharmacist check', factors: ['Busy period', 'Shift changeover'], outcome: 'accepted' },
  { dayOfMonth: 26, hour: 16, error_step: 'Labelling', error_types: ['Label on wrong item or bottle'], drug_name: 'Sertraline', where_caught: 'Final pharmacist check', factors: ['Interruption or distraction'], outcome: 'modified' },
];

const PERIODS = [
  { monthsAgo: 4, incidents: PERIOD_0_INCIDENTS },
  { monthsAgo: 3, incidents: PERIOD_1_INCIDENTS },
  { monthsAgo: 2, incidents: PERIOD_2_INCIDENTS },
  { monthsAgo: 1, incidents: PERIOD_3_INCIDENTS },
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
  if (inc.error_types.some(e => e.includes('Wrong strength'))) {
    return `Use colour-coded bins on the shelf to separate ${drug} strengths. Make the strength stand out on the dispensing label — bigger or bolder text.`;
  }
  if (inc.error_types.some(e => e.includes('look-alike') || e.includes('sound-alike') || e.includes('Wrong drug'))) {
    return `Move ${drug} away from look-alike items on the shelf. Use TALLman lettering — write the unique letters BIG (e.g. amLODipine vs amIOdarone). Stick a bright warning label on each.`;
  }
  if (inc.error_types.some(e => e.includes('directions'))) {
    return `At final check, read the dispensing label word-for-word against the prescription. Review label templates every 3 months.`;
  }
  if (inc.error_types.some(e => e.includes('quantity') || e.includes('volume'))) {
    return `Always double-count ${drug} — a second person checks, or use a calibrated tablet counter. Set up a no-interruption zone during counting.`;
  }
  if (inc.error_types.some(e => e.includes('formulation'))) {
    return `Keep different formulations (tablet, capsule, liquid, inhaler) of ${drug} apart on the shelf. Confirm the formulation with the patient at handout.`;
  }
  if (inc.error_types.some(e => e.includes('patient') || e.includes('bag'))) {
    return `At every step (data entry, final check, handout), check both the patient's NHI number and date of birth. Two identifiers at handout — Pharmacy Council NZ standard.`;
  }
  if (inc.error_types.some(e => e.includes('Allergy'))) {
    return `When the dispensary software flags an allergy, staff should type a reason — not tap-to-dismiss. Review the override log weekly.`;
  }
  if (inc.error_types.some(e => e.includes('CD') || e.includes('Methadone'))) {
    return `Reinforce the CD sign-off SOP with a two-person check at every dispense. Review the register weekly.`;
  }
  return `Review the dispensing workflow for ${drug} at the next team meeting and agree a specific prevention action.`;
}

async function findPharmacy(): Promise<{ id: string; name: string } | null> {
  const { data, error } = await supabase.from('pharmacies').select('id, name, subscription_status').order('created_at', { ascending: true });
  if (error) {
    console.error('Could not read the pharmacies table:', error.message);
    console.error('Check server/.env has the right SUPABASE_URL and SUPABASE_SERVICE_KEY.');
    return null;
  }
  if (!data || data.length === 0) return null;
  console.log('Pharmacies in the database:');
  for (const p of data) {
    console.log(`  - ${p.name}  (status: ${p.subscription_status})`);
  }
  const demo = data.find(p => p.name?.toLowerCase().includes('demo') || p.name?.toLowerCase().includes('test'))
    || data.find(p => p.subscription_status === 'trial' || p.subscription_status === 'active')
    || data[0];
  return { id: demo.id, name: demo.name };
}

// Return YYYY-MM-DD for the first and last day of the month N months ago.
function monthBounds(monthsAgo: number): { start: string; end: string; year: number; month: number; lastDay: number } {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const nextMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0);
  const lastDay = nextMonth.getDate();
  const y = target.getFullYear();
  const m = target.getMonth();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
    year: y,
    month: m,
    lastDay,
  };
}

async function cleanup(pharmacyId: string) {
  console.log('Cleaning up any previous run of this script…');
  await supabase.from('incidents').delete().eq('pharmacy_id', pharmacyId).like('notes', `${NOTE_TAG}%`);
  await supabase.from('reports').delete().eq('pharmacy_id', pharmacyId).eq('generated_by', GENERATED_BY);
  await supabase.from('audit_log').delete().eq('pharmacy_id', pharmacyId).eq('performed_by', GENERATED_BY);
}

async function seed() {
  const ph = await findPharmacy();
  if (!ph) {
    console.error('No pharmacy found. Sign up a pharmacy first, or approve a pending signup.');
    process.exit(1);
  }
  console.log(`\n>>> Seeding into: ${ph.name}`);
  console.log('>>> IMPORTANT: log in to the app as THIS pharmacy to see the reports.\n');

  await cleanup(ph.id);

  let totalInserted = 0;
  let totalRecs = 0;

  for (const period of PERIODS) {
    const bounds = monthBounds(period.monthsAgo);
    console.log(`\n— Period ${bounds.start} to ${bounds.end}: ${period.incidents.length} near misses`);

    for (const inc of period.incidents) {
      const occurredAt = new Date(bounds.year, bounds.month, Math.min(inc.dayOfMonth, bounds.lastDay), inc.hour, 30, 0, 0);
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
        status: 'active',
      }).select().single();

      if (error || !incident) {
        console.error(`  !! Near-miss insert FAILED for day ${inc.dayOfMonth}: ${error?.message || 'no row returned'}`);
        console.error('     Fix the error above and re-run the seed.');
        process.exit(1);
      }
      totalInserted++;

      const rec = stubRecommendation(inc);
      const { data: recommendation } = await supabase.from('recommendations').insert({
        incident_id: incident.id, pharmacy_id: ph.id, ai_text: rec,
        manager_outcome: inc.outcome,
        manager_name: 'manager',
        reviewed_at: occurredAt.toISOString(),
      }).select().single();

      if (recommendation) {
        totalRecs++;
        await supabase.from('audit_log').insert({
          pharmacy_id: ph.id, action: `recommendation_${inc.outcome}`,
          performed_by: GENERATED_BY, details: { recommendation_id: recommendation.id },
        });
      }
    }
  }

  console.log(`\n— Generating ${PERIODS.length} locked historical reports (real generator — matches the app)`);
  let reportsCreated = 0;
  for (const period of PERIODS) {
    const bounds = monthBounds(period.monthsAgo);
    try {
      const [{ summary, agenda, previousSummary }, hotspots, trend] = await Promise.all([
        generatePeriodSummary(ph.id, bounds.start, bounds.end),
        detectDrugErrorHotspots(ph.id, bounds.start, bounds.end),
        getTrendSeries(ph.id, bounds.start, bounds.end),
      ]);

      const { data: report, error: reportErr } = await supabase.from('reports').insert({
        pharmacy_id: ph.id,
        period_start: bounds.start,
        period_end: bounds.end,
        generated_by: GENERATED_BY,
        locked: true,
        period_summary: summary,
        previous_period_summary: previousSummary || null,
        agenda_items: agenda.map(text => ({ text, edited: false })),
        pattern_alerts: hotspots,
        trend_data: trend,
      }).select().single();

      if (reportErr || !report) {
        console.error(`  !! Report insert FAILED for ${bounds.start}: ${reportErr?.message || 'no row returned'}`);
        console.error('     Fix the error above and re-run the seed.');
        process.exit(1);
      }

      reportsCreated++;
      console.log(`  ✓ Report ${bounds.start} → ${bounds.end}`);
      console.log(`    open it at: http://localhost:5173/reports/${report.id}`);
      await supabase.from('audit_log').insert({
        pharmacy_id: ph.id, action: 'report_signed_off',
        performed_by: GENERATED_BY,
        details: { report_id: report.id, report_period: `${bounds.start} — ${bounds.end}`, locked_at: new Date().toISOString(), incident_count: period.incidents.length },
      });
    } catch (err) {
      console.error(`  !! Report for ${bounds.start} FAILED:`, err instanceof Error ? err.message : err);
      console.error('     Fix the error above and re-run the seed.');
      process.exit(1);
    }
  }

  // Read-back proof: don't trust "inserted", count what's actually there.
  const { count: reportCount } = await supabase.from('reports')
    .select('id', { count: 'exact', head: true })
    .eq('pharmacy_id', ph.id);

  console.log(`\nDone.`);
  console.log(`  ${totalInserted} near misses created`);
  console.log(`  ${totalRecs} recommendations created (all with manager outcomes)`);
  console.log(`  ${reportsCreated} locked historical reports created this run`);
  console.log(`  ${reportCount ?? '?'} reports now exist in total for ${ph.name}`);
  console.log(`\n>>> In the app: log in as "${ph.name}", go to Reports.`);
  console.log(`\nTo wipe later:`);
  console.log(`  delete from incidents where notes like '${NOTE_TAG}%';`);
  console.log(`  delete from reports where generated_by = '${GENERATED_BY}';`);
  console.log(`  delete from audit_log where performed_by = '${GENERATED_BY}';`);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
