import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { normalizeDrugName } from '../lib/normalize.js';
import { comparisonBaseline } from '../lib/previousPeriod.js';
import { highRiskCategoryFor } from '../lib/highRiskDrugs.js';
import { inlineFixFor } from '../lib/factorSuggestions.js';

interface IncidentData {
  id: string;
  pharmacy_id: string;
  error_step?: string;
  error_types: string[];
  drug_name?: string;
  dispensed_drug?: string;
  prescribed_strength?: string;
  dispensed_strength?: string;
  correct_formulation?: string;
  dispensed_formulation?: string;
  where_caught?: string;
  time_of_day?: string;
  occurred_at?: string;
  factors: string[];
  notes?: string;
  other_entries?: { category: string; text: string }[];
}

const NZ_SYSTEM_PROMPT = `You are a safety advisor for a New Zealand community pharmacy. Your audience is pharmacy techs and pharmacists on the shop floor — not consultants or auditors. Write like a senior pharmacist talking to the team, not a policy document.

Write ONE short prevention recommendation for this near miss. Hard rules:
- Maximum 2 short sentences. Aim for under 40 words total.
- Plain language a non-pharmacist could follow. NO markdown, NO bold, NO headers, NO bullet points.
- Explain technical terms inline the first time you use them. Examples:
  * "TALLman lettering — write the unique letters BIG, e.g. amLODipine vs amIOdarone"
  * "CAL (Cautionary Advisory Label — the warning sticker)"
  * "NHI (patient ID number)"
  * "PSO (Practitioner's Supply Order — for clinic stock, not patient prescriptions)"
- Do NOT restate what happened — go straight to the action.
- Do NOT list the contributing factors at the end. They are shown elsewhere on the report and addressed separately by the system-factor panel.
- One concrete action a tech could do tomorrow morning. Name the actual drug, shelf, label, dose, or check step. No generic advice ("be careful", "review processes", "consider implementing").
- British spelling (colour, organise, centre, labelling).

Use NZ context where it adds real value — at most ONE source per recommendation, named only if directly relevant to the action:
- NZ Formulary (NZF) — dose checks, paediatric/renal/hepatic dosing, special populations
- Medsafe — safety alerts, recalls, LASA list
- NZULM — drug info and CAL (Cautionary Advisory Label) details
- Pharmac — Schedule funding, Special Authority, brand changes (bioequivalence-sensitive list)
- Pharmacy Council NZ — practice standards (counselling, two-identifier patient ID, compliance pack SOP)
- HQSC — distraction-reduction, no-interruption zones
- Misuse of Drugs Act / Regulations — controlled drugs, methadone, register
- Te Whatu Ora Pharmacy Procedures Manual — NHI, HPI, PSO, NZePS

NZ shop-floor language: dispensary software (not "PMS"), script (not "prescription"), pick (not "select"), shelf (not "storage location"), checker / checking pharmacist, blister pack / compliance pack, Pharmac brand, subsidy, NHI, dispense fee, cautionary advisory label.

If this is a clear repeat pattern, you may add ONE short final sentence flagging it — plain, no padding ("This is the third script-entry near miss this month — raise at next team meeting"). Always say "near miss" rather than "error" when describing the events themselves; an "error" implies it reached the patient (a dispensing error), which NearMissPro doesn't capture.`;

// ── NZ-grounded stub recommendation ─────────────────────────────
// Used when ANTHROPIC_API_KEY is not configured. Produces a specific
// recommendation that references the drug, stage, factor and — where
// relevant — the specific NZ guidance source (NZ Formulary, Medsafe,
// Pharmac, Pharmacy Council NZ, HQSC, NZULM, Misuse of Drugs Act).
// Substring matching on the new taxonomy labels so every path is covered.
function nzStubRecommendation(incident: IncidentData): string {
  const drug = incident.drug_name?.trim();
  const drugRef = drug ? ` for ${drug}` : '';
  const errors = (incident.error_types || []).map(e => e.toLowerCase());
  const stage = (incident.error_step || '').toLowerCase();
  const factors = incident.factors || [];
  // Factors are shown on the incident's metadata line and analysed in the
  // 'What's behind these errors?' panel with system-level suggestions, so
  // we no longer repeat them in the recommendation body — that was just
  // restating data the manager already sees.
  const factorNote = '';
  // Suppress unused-var warning while keeping the data available for
  // future stub paths that may want to reference it.
  void factors;
  const hasAny = (kw: string[]) => errors.some(e => kw.some(k => e.includes(k)));
  const drugLabel = drug || 'this medicine';

  // Look-alike tablets/capsules — the pills themselves look alike (not the box)
  if (hasAny(['look-alike tablet', 'look-alike capsule'])) {
    return `${drugLabel} and the drug it was confused with look alike once out of the pack. Keep the two stock bottles well apart and clearly labelled, don't rely on appearance alone at the check, and use a second-pharmacist check for this pair. A shelf note flagging the look-alike helps (Medsafe LASA guidance).${factorNote}`;
  }

  // Look-alike / sound-alike — Medsafe & NZ LASA guidance
  if (hasAny(['look-alike'])) {
    return `Move ${drugLabel} away from look-alike items on the shelf. Use TALLman lettering — write the unique letters BIG (e.g. amLODipine vs amIOdarone). Stick a bright warning label on each, and have a second pharmacist check picking (Medsafe LASA guidance).${factorNote}`;
  }
  if (hasAny(['sound-alike'])) {
    return `When entering ${drugLabel} into the dispensary software, read it back to whoever called it in. Flag known sound-alike pairs in your software (Medsafe NZ SALAD list). For phone orders, ask for written confirmation before dispensing.${factorNote}`;
  }

  // Strength / dose
  if (hasAny(['strength', 'dose'])) {
    return `Use colour-coded bins on the shelf to separate ${drugLabel} strengths. Look up unusual doses in the NZ Formulary before dispensing. Make the strength stand out on the dispensing label — bigger or bolder text.${factorNote}`;
  }

  // Quantity / volume counted or measured
  if (hasAny(['quantity', 'volume']) && stage.includes('counted')) {
    return `Always double-count ${drugLabel} — a second person checks, or use a calibrated tablet counter. Set up a no-interruption zone during counting (e.g. wear a tabard or display a "do not disturb" sign) — HQSC distraction-reduction guidance.${factorNote}`;
  }

  // Wrong patient (data entry, bag, label) — NZ NHI guidance
  if (hasAny(['wrong patient'])) {
    return `At every step (data entry, final check, handout), check both the patient's NHI number and date of birth. For patients with similar names, add a flag in your dispensary software. Pharmacy Council NZ requires two identifiers at handout.${factorNote}`;
  }

  // Allergy / interaction / duplicate therapy — clinical decision support
  if (hasAny(['allergy', 'interaction', 'duplicate therapy', 'same drug'])) {
    return `When the dispensary software flags an allergy, interaction, or duplicate medicine, the staff member should have to type a reason — not just tap-to-dismiss. The pharmacist-in-charge should review the override log weekly (Pharmacy Council NZ standard 1.8).${factorNote}`;
  }

  // Renal / hepatic / paediatric / geriatric / pregnancy dose
  if (hasAny(['renal', 'hepatic', 'kidney', 'liver', 'paediatric', 'geriatric', 'pregnancy', 'breastfeeding'])) {
    return `Look up ${drugLabel} in the NZ Formulary for the special-population dose (kidney, liver, paediatric, etc.). Set up a software alert for these high-risk patient groups, and add a pharmacist review step before dispensing.${factorNote}`;
  }

  // Pharmac funding / Special Authority / brand
  if (hasAny(['pharmac', 'special authority', 'subsidy'])) {
    return `Check the Pharmac Schedule funding rules and Special Authority (SA) number before dispensing. Confirm the SA hasn't expired. Pharmac updates monthly — sign up for their email notifications so you're not caught out.${factorNote}`;
  }
  if (hasAny(['brand'])) {
    return `${drug || 'This drug'} is sensitive to brand changes — switching brands can affect how it works in the body (Medsafe alert list). Talk to the patient about any brand change and write it down. Set up a software flag so brand swaps don't happen silently.${factorNote}`;
  }

  // NHI/HPI, NZePS, PSO
  if (hasAny(['nhi', 'hpi'])) {
    return `At data entry, check the NHI (patient ID) number against the patient's ID document. Te Whatu Ora's Pharmacy Procedures Manual covers patient identification.${factorNote}`;
  }
  if (hasAny(['nzeps'])) {
    return `Look up the NZePS (electronic prescription) rejection reason in your dispensary software log. If you need to resubmit, check with the prescriber first. Don't manually override a rejected electronic prescription.${factorNote}`;
  }
  if (hasAny(['pso'])) {
    return `Practitioner's Supply Orders (PSOs — orders for a clinic's stock, not a patient) follow different funding and labelling rules from patient prescriptions. Read the PSO section of Te Whatu Ora's Pharmacy Procedures Manual and refresh the team on spotting PSO forms.${factorNote}`;
  }

  // Out-of-date / forged prescription
  if (hasAny(['out-of-date', 'forged', 'altered'])) {
    return `Check the script is still within its valid dispensing period before you dispense — your dispensary software will flag an expired script, and controlled drugs have a shorter window. If anything looks altered, ring the prescriber to verify and keep the original (Medicines Regulations 1984).${factorNote}`;
  }

  // Verbal / phone order
  if (hasAny(['verbal', 'phone order'])) {
    return `For a verbal or phone order, read it back to confirm, and get the written script (an NZePS electronic prescription or the signed original) before you dispense — don't rely on the verbal alone.${factorNote}`;
  }

  // Label typo / spelling / directions (dose, frequency, route, timing) / CAL
  if (hasAny(['typo', 'spelling', "doesn't make sense", 'directions', 'sig', 'frequency', 'route', 'timing', 'wrong dose'])) {
    return `At final check, read the dispensing label word-for-word against the prescription. The pharmacist-in-charge should review label templates every 3 months. If your dispensary software shortens directions, manually override per NZULM.${factorNote}`;
  }
  if (hasAny(['cal'])) {
    return `Check the Cautionary Advisory Label (CAL — the warning sticker, e.g. "may cause drowsiness") requirements for ${drug || 'this medicine'} in NZULM or the NZ Formulary. CAL prompts in your software shouldn't be dismissed without a review. Print CALs on a bright background so they stand out.${factorNote}`;
  }
  if (hasAny(['label on wrong item', 'missing label'])) {
    return `One label, one item — never batch-print labels and apply them later. Stick the label on the correct pack as soon as it prints. The pharmacist-in-charge final check must confirm the label matches the pack.${factorNote}`;
  }
  if (hasAny(['pharmacist initials'])) {
    return `The dispensing pharmacist's initials must appear on the label (Pharmacy Council NZ standard). Add them to your software's label template so they're automatic. Don't dispense if missing.${factorNote}`;
  }

  // Stock / expiry / recall / damaged / pack size / Section 29
  if (hasAny(['expired'])) {
    return `Check stock expiry dates monthly. Stick a coloured sticker on anything within 3 months of expiry. Use first-in-first-out (FIFO) so older stock leaves first. Subscribe to Medsafe alerts for short-dated stock.${factorNote}`;
  }
  if (hasAny(['recalled'])) {
    return `Check Medsafe recall alerts every day — subscribe to their recall email feed. Remove recalled stock right away and put it in quarantine. Write down what you did (Medicines Act 1981).${factorNote}`;
  }
  if (hasAny(['damaged'])) {
    return `Check packs for damage when they arrive AND when you pick them. Don't dispense damaged tablets or strips — send them back to the supplier with a credit note and record the batch number.${factorNote}`;
  }
  if (hasAny(['pack size'])) {
    return `At picking, check the pack size matches the prescribed quantity. Your software should pop a warning if they don't match. If the pack size doesn't match, use original-pack dispensing where you can.${factorNote}`;
  }

  // Repeat / continuity
  if (hasAny(['repeat'])) {
    return `Check the dispensing history for ${drugLabel} before processing a repeat. Set a software alert for the minimum repeat interval. Ask the patient when they last collected.${factorNote}`;
  }

  // Compliance pack
  if (stage.includes('compliance pack')) {
    return `Check compliance pack contents against the medication chart twice — at packing AND at final check (two pharmacists for controlled drugs). Stick a flag on any pack with changes (Pharmacy Council NZ compliance-pack SOP).${factorNote}`;
  }

  // CD dispensing — Misuse of Drugs Act
  if (stage.includes('controlled') || hasAny(['cd ', 'methadone'])) {
    return `Review your controlled drugs (CD) SOP under the Misuse of Drugs Act/Regulations: log it in the CD register before dispensing, have two people check, observe methadone doses where required. Audit the CD register this week, and the pharmacist-in-charge reviews the log weekly.${factorNote}`;
  }

  // Formulation swap
  if (hasAny(['formulation'])) {
    return `Keep different formulations (tablet, capsule, liquid, immediate-release IR, slow-release SR) of ${drugLabel} apart on the shelf. Confirm the formulation with the patient at handout. Set up a software warning when the formulation changes for the same drug.${factorNote}`;
  }

  // Counselling / handout
  if (hasAny(['counselling', 'inhaler', 'driving', 'alcohol'])) {
    return `Pharmacy Council NZ requires counselling for all new medicines. For inhalers, injectables and other devices, show the patient how to use them in-store. Record that you counselled them in the dispensary software.${factorNote}`;
  }

  // Bag mix-up
  if (hasAny(['bag mixed', 'bag missing', 'bag contains extra'])) {
    return `One bag per patient — never mix patients in the same bag. At handout, confirm the patient's name and date of birth. For multi-item bags, show the patient each item and check it against the prescription.${factorNote}`;
  }

  // Unspecified / quick log
  if (errors[0]?.includes('unspecified')) {
    return `This was logged as "submitted in error" or as a quick-log. Talk through it at the team meeting to decide whether a full record is needed, or remove it via Void if it wasn't a genuine near-miss.${factorNote}`;
  }

  // Fallback — still references the specific stage
  const stagePart = incident.error_step ? ` at the ${incident.error_step} stage` : '';
  return `Look at the dispensing workflow for ${drugLabel}${stagePart}. Talk through it at the next team meeting and agree a specific prevention action. Write down what you decided.${factorNote}`;
}

// Look up the pharmacy size so the AI can adapt its advice — sole-charge
// pharmacies shouldn't be told to "have a second pharmacist check".
async function getPharmacySize(pharmacyId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from('pharmacies').select('pharmacy_size').eq('id', pharmacyId).single();
    return (data?.pharmacy_size as string | null) || null;
  } catch { return null; }
}

function pharmacySizeContext(size: string | null): string {
  if (size === 'sole') return 'Pharmacy context: this is a sole-charge pharmacy — only ONE pharmacist on duty. Do NOT recommend "second pharmacist check" or "two-person verification". Suggest solo-workflow controls instead (pre-pick script review, self-check pause, dispensary software prompt, no-interruption zone, paper checklist).';
  if (size === 'multi') return 'Pharmacy context: this pharmacy has multiple pharmacists rostered together — second-pharmacist checks and two-person verification are realistic options to suggest where appropriate.';
  // 'pharmacist_plus_tech' or null — generic default.
  return '';
}

// Per-pharmacy AI switch. When a pharmacy turns AI off in Settings, we
// skip every external AI call for them and fall back to the built-in
// NZ-grounded recommendations/summary — nothing about their near misses
// leaves the system. Defaults to ON if the column is missing or the
// lookup fails, so an infrastructure hiccup never silently strips a
// feature the pharmacy expects. This is the switch behind the public
// promise "turn AI off and you still get recommendations".
export async function isAiEnabledForPharmacy(pharmacyId: string): Promise<boolean> {
  try {
    const { data } = await supabase.from('pharmacies').select('ai_enabled').eq('id', pharmacyId).single();
    return data?.ai_enabled !== false;
  } catch { return true; }
}

export async function generateRecommendation(incident: IncidentData): Promise<string> {
  // No API key, OR this pharmacy has turned AI off in Settings → use the
  // built-in NZ-grounded stub. Nothing about the near miss leaves the system.
  if (!env.anthropicApiKey || !(await isAiEnabledForPharmacy(incident.pharmacy_id))) {
    const recommendation = nzStubRecommendation(incident);
    await saveRecommendation(incident.id, incident.pharmacy_id, recommendation);
    return recommendation;
  }

  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const pharmacySize = await getPharmacySize(incident.pharmacy_id);
    const sizeNote = pharmacySizeContext(pharmacySize);

    const [drugCount, factorCounts] = await Promise.all([
      incident.drug_name
        ? supabase.from('incidents').select('id', { count: 'exact', head: true })
            .eq('pharmacy_id', incident.pharmacy_id).gte('submitted_at', periodStart)
            .eq('drug_name', incident.drug_name).eq('status', 'active')
            .then(r => r.count || 0)
        : Promise.resolve(0),
      incident.factors.length > 0
        ? supabase.from('incidents').select('factors', { count: 'exact', head: true })
            .eq('pharmacy_id', incident.pharmacy_id).gte('submitted_at', periodStart)
            .overlaps('factors', incident.factors).eq('status', 'active')
            .then(r => r.count || 0)
        : Promise.resolve(0),
    ]);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 150,
        system: sizeNote ? `${NZ_SYSTEM_PROMPT}\n\n${sizeNote}` : NZ_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: JSON.stringify({
            error_types: incident.error_types,
            drug_name: incident.drug_name,
            dispensed_drug: incident.dispensed_drug,
            prescribed_strength: incident.prescribed_strength,
            dispensed_strength: incident.dispensed_strength,
            correct_formulation: incident.correct_formulation,
            dispensed_formulation: incident.dispensed_formulation,
            where_caught: incident.where_caught,
            time_of_day: incident.time_of_day,
            factors: incident.factors,
            // Free-text notes are deliberately NOT sent to the AI. It's the one
            // box a staff member could accidentally type patient info into, and
            // the structured fields above are what actually drive the advice.
            // The manager still sees the note in review and on the report.
            prior_same_drug_count: drugCount,
            prior_same_factor_count: factorCounts,
            other_text: incident.other_entries?.map(e => e.text).join('; '),
          }),
        }],
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic ${response.status} ${response.statusText}: ${body}`);
    }
    const result = await response.json();
    const aiText = result.content?.[0]?.text || 'Unable to generate recommendation.';
    await saveRecommendation(incident.id, incident.pharmacy_id, aiText);
    return aiText;
  } catch (err) {
    console.error('[ai] generateRecommendation failed, falling back to NZ stub:', err);
    // Same NZ-grounded stub we use when no API key is configured —
    // gives the manager something useful (Medsafe / HQSC / Pharmacy
    // Council aligned guidance based on the error type) instead of a
    // generic "AI unavailable, decide manually" line. The dashboard
    // still labels this as an AI recommendation; the failure is
    // logged server-side for the founder to investigate.
    const fallback = nzStubRecommendation(incident);
    await saveRecommendation(incident.id, incident.pharmacy_id, fallback);
    return fallback;
  }
}

async function saveRecommendation(incidentId: string, pharmacyId: string, aiText: string) {
  await supabase.from('recommendations').insert({
    incident_id: incidentId, pharmacy_id: pharmacyId, ai_text: aiText,
  });
}

export async function detectPatterns(pharmacyId: string, since?: string, until?: string): Promise<string | null> {
  // Default window: start of current month → now. Callers (the dashboard)
  // pass the manager's selected range so the alert matches the visible
  // incident list — otherwise "16 near misses" can show next to a stat
  // card that says 5.
  const periodStart = since || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  let q = supabase.from('incidents')
    .select('error_types, drug_name, factors, time_of_day')
    .eq('pharmacy_id', pharmacyId).gte('submitted_at', periodStart).eq('status', 'active');
  if (until) {
    const u = /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until;
    q = q.lte('submitted_at', u);
  }
  const { data: incidents } = await q;

  if (!incidents || incidents.length < 3) return null;

  // Drugs are counted by normalised key but displayed using the first
  // spelling the user entered, so "Atorvastatin" / "atorvastatin" merge.
  const drugCounts: Record<string, number> = {};
  const drugDisplay: Record<string, string> = {};
  const factorCounts: Record<string, number> = {};
  const timeCounts: Record<string, number> = {};

  for (const i of incidents) {
    if (i.drug_name) {
      const key = normalizeDrugName(i.drug_name);
      if (key) {
        drugCounts[key] = (drugCounts[key] || 0) + 1;
        if (!drugDisplay[key]) drugDisplay[key] = i.drug_name.trim();
      }
    }
    if (i.time_of_day) timeCounts[i.time_of_day] = (timeCounts[i.time_of_day] || 0) + 1;
    for (const f of i.factors || []) factorCounts[f] = (factorCounts[f] || 0) + 1;
  }

  const alerts: string[] = [];
  for (const [key, count] of Object.entries(drugCounts)) { if (count >= 3) alerts.push(`${drugDisplay[key]} appears in ${count} incidents`); }
  for (const [factor, count] of Object.entries(factorCounts)) { if (count >= 3) alerts.push(`"${factor}" is a factor in ${count} incidents`); }
  for (const [time, count] of Object.entries(timeCounts)) { if (count >= 3) alerts.push(`${count} incidents during ${time}`); }

  if (alerts.length === 0) return null;

  if (!env.anthropicApiKey) {
    return alerts.join('. ') + '.';
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 150,
        system: 'You are a NZ community pharmacy safety advisor writing for shop-floor staff. In ONE plain-language sentence, name the most significant pattern across these near misses and the single concrete action to take. No markdown. British spelling. NZ shop language ("script", "dispensary software", "checking pharmacist", "Pharmac brand"). Reference an NZ source (NZ Formulary, Medsafe, NZULM, Pharmac, Pharmacy Council NZ) only if directly relevant to the action.',
        messages: [{ role: 'user', content: JSON.stringify({ patterns: alerts, incident_count: incidents.length }) }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic ${response.status} ${response.statusText}: ${body}`);
    }
    const result = await response.json();
    return result.content?.[0]?.text || alerts.join('. ');
  } catch (err) {
    console.error('[ai] detectPatterns failed:', err);
    return alerts.join('. ');
  }
}

// Drug + error-type hotspots. A hotspot is a (drug_name, error_type) pair
// that has appeared `minCount` or more times in the window. Used by the
// period-summary section of the monthly report.
export interface DrugErrorHotspot { drug: string; errorType: string; count: number; }
export async function detectDrugErrorHotspots(
  pharmacyId: string,
  since: string,
  until?: string,
  minCount = 2,
): Promise<DrugErrorHotspot[]> {
  let q = supabase.from('incidents').select('drug_name, error_types')
    .eq('pharmacy_id', pharmacyId).eq('status', 'active').gte('submitted_at', since);
  if (until) {
    const u = /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until;
    q = q.lte('submitted_at', u);
  }
  const { data, error } = await q;
  if (error) { console.error('[ai] detectDrugErrorHotspots failed:', error); return []; }
  // Match using normalised drug names so "Atorvastatin" / "atorvastatin" /
  // "ATORVASTATIN" all group as one pattern. Display recovers the first
  // version the staff actually typed for the matched key.
  const counts: Record<string, number> = {};
  for (const row of data || []) {
    const original = (row as { drug_name?: string }).drug_name;
    const drugKey = normalizeDrugName(original);
    if (!drugKey) continue;
    for (const et of (row as { error_types?: string[] }).error_types || []) {
      const k = `${drugKey}|||${et}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .filter(([, c]) => c >= minCount)
    .map(([k, count]) => {
      const [drugKey, errorType] = k.split('|||');
      const display = (data || []).find(r => normalizeDrugName((r as { drug_name?: string }).drug_name) === drugKey)
        ?.drug_name?.trim() || drugKey;
      return { drug: display, errorType, count };
    })
    .sort((a, b) => b.count - a.count || a.drug.localeCompare(b.drug));
}

// Weekly trend series for a pharmacy over the given window. Used by the
// report's trend chart. Empty weeks come back as count 0.
export interface TrendPoint { weekStart: string; count: number; }
export async function getTrendSeries(pharmacyId: string, since: string, until?: string): Promise<TrendPoint[]> {
  const startOfWeekKey = (d: Date): string => {
    const nd = new Date(d); nd.setHours(0, 0, 0, 0);
    const day = nd.getDay() || 7;
    nd.setDate(nd.getDate() - day + 1);
    return nd.toISOString().slice(0, 10);
  };
  let q = supabase.from('incidents').select('submitted_at, occurred_at')
    .eq('pharmacy_id', pharmacyId).eq('status', 'active').gte('submitted_at', since);
  if (until) {
    const u = /^\d{4}-\d{2}-\d{2}$/.test(until) ? `${until}T23:59:59.999Z` : until;
    q = q.lte('submitted_at', u);
  }
  const { data, error } = await q;
  if (error) { console.error('[ai] getTrendSeries failed:', error); return []; }
  // Build bucket keys covering [since, until].
  const start = new Date(since);
  const end = until ? new Date(until) : new Date();
  const keys: string[] = [];
  const firstKey = startOfWeekKey(start);
  let cursor = new Date(firstKey);
  const endKey = startOfWeekKey(end);
  while (cursor.toISOString().slice(0, 10) <= endKey) {
    keys.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 7);
  }
  const counts: Record<string, number> = Object.fromEntries(keys.map(k => [k, 0]));
  for (const row of data || []) {
    const when = new Date((row as { occurred_at?: string; submitted_at: string }).occurred_at || (row as { submitted_at: string }).submitted_at);
    const key = startOfWeekKey(when);
    if (key in counts) counts[key] += 1;
  }
  return keys.map(k => ({ weekStart: k, count: counts[k] }));
}

// Deterministic near-miss-rate bullet, appended AFTER the AI/stub
// summary so the maths never depends on the model. Only present when
// the manager entered the period's script total.
function rateLine(incidentCount: number, scriptsDispensed: number | null | undefined): string {
  if (!scriptsDispensed || scriptsDispensed <= 0 || incidentCount <= 0) return '';
  const pct = (incidentCount / scriptsDispensed) * 100;
  const pctLabel = pct >= 0.1 ? pct.toFixed(1) : pct.toFixed(2);
  const oneIn = Math.round(scriptsDispensed / incidentCount);
  return `• Near-miss rate: ${incidentCount} of ${scriptsDispensed.toLocaleString('en-NZ')} scripts dispensed — ${pctLabel}% (about 1 in ${oneIn.toLocaleString('en-NZ')} scripts).`;
}

export async function generatePeriodSummary(pharmacyId: string, periodStart: string, periodEnd: string, scriptsDispensed?: number | null): Promise<{ summary: string; agenda: string[]; previousSummary?: string }> {
  // YYYY-MM-DD coerces to midnight UTC; bump to end-of-day so incidents
  // submitted later on periodEnd still count.
  const endBound = /^\d{4}-\d{2}-\d{2}$/.test(periodEnd) ? `${periodEnd}T23:59:59.999Z` : periodEnd;
  const { data: incidents } = await supabase.from('incidents')
    .select('*, recommendations(*)').eq('pharmacy_id', pharmacyId)
    .gte('submitted_at', periodStart).lte('submitted_at', endBound).eq('status', 'active');

  const { data: lastReport } = await supabase.from('reports')
    .select('period_summary, agenda_items').eq('pharmacy_id', pharmacyId)
    .lt('period_end', periodStart).order('period_end', { ascending: false }).limit(1).single();

  const incidentCount = incidents?.length || 0;
  const errorSummary = incidents?.flatMap(i => i.error_types).reduce<Record<string, number>>((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {}) || {};
  const topErrors = Object.entries(errorSummary).sort((a, b) => b[1] - a[1]).slice(0, 3);

  // Top contributing factors this period — drives the "system causes"
  // narrative and the auto-generated agenda items.
  const factorCounts = (incidents || []).flatMap(i => i.factors || []).reduce<Record<string, number>>((acc, f) => { acc[f] = (acc[f] || 0) + 1; return acc; }, {});
  const topFactors: [string, number][] = Object.entries(factorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const topFactorLine = topFactors.length > 0 && topFactors[0][1] >= 2
    ? `Top contributing factor: ${topFactors[0][0]} (${topFactors[0][1]} incidents).`
    : '';

  // High-risk-drug incidents (Medsafe-aligned categories) — surface separately
  // because these warrant heightened vigilance regardless of overall trend.
  const highRiskIncidents = (incidents || []).filter(i =>
    !!highRiskCategoryFor(i.drug_name) || !!highRiskCategoryFor(i.dispensed_drug)
  );
  const highRiskLine = highRiskIncidents.length > 0
    ? `${highRiskIncidents.length} of these involved a high-risk medicine (insulin, anticoagulant, opioid, etc.) — these need extra care.`
    : '';

  // Peak time-of-day and day-of-week — woven into the summary so the
  // manager doesn't have to flip between paragraphs and the heatmap
  // to know when errors are clustering.
  const timeBucketCounts = (incidents || []).reduce<Record<string, number>>((acc, i) => {
    if (i.time_of_day) acc[i.time_of_day] = (acc[i.time_of_day] || 0) + 1;
    return acc;
  }, {});
  const timeBucketEntries: [string, number][] = Object.entries(timeBucketCounts).sort((a, b) => b[1] - a[1]);
  const dayCounts = (incidents || []).reduce<Record<string, number>>((acc, i) => {
    const when = i.occurred_at || i.submitted_at;
    if (!when) return acc;
    const d = new Date(when as string);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[d.getDay()];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const dayEntries: [string, number][] = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
  let peakLine = '';
  if (incidentCount >= 3) {
    const topTime = timeBucketEntries[0];
    const topDay = dayEntries[0];
    if (topTime && topTime[1] >= 2) {
      // Format: "Most happened during Lunch 12-2pm (5 of 10), mostly on Sunday and Monday."
      const timePart = `Most clustered around ${topTime[0]} (${topTime[1]} of ${incidentCount})`;
      const dayPart = topDay && topDay[1] >= 2 ? `, mostly on ${topDay[0]}` : '';
      peakLine = `${timePart}${dayPart}.`;
    }
  }

  // Compute the previous-period comparison so we can seed the editable
  // "Last period improvements" section with the actually meaningful
  // narrative ("Atorvastatin wrong-strength: 5 → 1, action working")
  // instead of generic placeholder text.
  // Previous period: the previous GENERATED report's dates (report to
  // report), falling back to the previous calendar month when there's
  // no earlier report. Shared with the period-comparison endpoint so
  // the agenda and the report's follow-up section use identical dates.
  const { prevStartIso, prevEndIso } = await comparisonBaseline(pharmacyId, periodStart, periodEnd);
  const { data: prevIncidents } = await supabase.from('incidents')
    .select('drug_name, error_types, recommendations(manager_outcome)')
    .eq('pharmacy_id', pharmacyId).eq('status', 'active')
    .gte('submitted_at', prevStartIso).lte('submitted_at', prevEndIso);

  type PatStat = { count: number; actioned: boolean };
  const buildPatternMap = (rows: { drug_name?: string | null; error_types?: string[] | null; recommendations?: { manager_outcome?: string | null }[] }[]): Map<string, PatStat> => {
    const m = new Map<string, PatStat>();
    for (const r of rows || []) {
      // Key by the normalised drug name so the agenda's "still
      // happening" count uses the SAME grouping as the report's
      // follow-up section (period-comparison endpoint also uses
      // normalizeDrugName). No skip on missing drug — drug-less
      // recurring problems (bag mix-ups, wrong day) must count too, and
      // the endpoint counts them, so skipping here would desync the two.
      const drug = normalizeDrugName(r.drug_name);
      const wasActioned = Array.isArray(r.recommendations)
        && r.recommendations.some(rc => rc.manager_outcome === 'accepted' || rc.manager_outcome === 'modified');
      for (const et of r.error_types || []) {
        const key = `${drug}|||${et}`;
        const cur = m.get(key) || { count: 0, actioned: false };
        cur.count += 1;
        if (wasActioned) cur.actioned = true;
        m.set(key, cur);
      }
    }
    return m;
  };
  const curPatterns = buildPatternMap(incidents || []);
  const prevPatterns = buildPatternMap(prevIncidents || []);
  const allKeys = new Set<string>([...curPatterns.keys(), ...prevPatterns.keys()]);
  const comparisonLines: string[] = [];
  const wins: string[] = [];
  const concerns: string[] = [];
  const recurring: string[] = [];
  for (const key of allKeys) {
    const [drug, et] = key.split('|||');
    const cur = curPatterns.get(key)?.count || 0;
    const prev = prevPatterns.get(key)?.count || 0;
    const wasActioned = prevPatterns.get(key)?.actioned || false;
    if (prev > 0 && cur === 0) {
      wins.push(`${drug} ${et}: ${prev} → 0${wasActioned ? ' (action worked)' : ''}`);
    } else if (prev > 0 && cur < prev && wasActioned) {
      recurring.push(`${drug} ${et}: ${prev} → ${cur} (action helping)`);
    } else if (prev > 0 && cur >= prev) {
      // "Still happening" — same definition as the report's follow-up
      // section (section 2), so the agenda's count always matches the
      // number the reader can verify on the page. NEW patterns are
      // deliberately NOT counted here — they're not "still happening
      // despite a change", and the review agenda item already calls
      // out the top new pattern by name.
      concerns.push(`${drug} ${et}: ${prev} → ${cur}${wasActioned ? ' (action so far not enough)' : ''}`);
    }
  }
  let comparisonNarrative = '';
  if (prevIncidents && prevIncidents.length > 0) {
    const netDelta = incidentCount - (prevIncidents.length || 0);
    // Headline only — the per-pattern detail (Resolved / Improving /
    // Needs attention) lives in the WHAT WORKED panel directly below
    // the summary on the report. Listing them here just duplicated
    // that panel and turned the summary into a wall of text.
    const headline = netDelta < 0
      ? `${Math.abs(netDelta)} fewer near misses than last period (${incidentCount} vs ${prevIncidents.length}).`
      : netDelta > 0
        ? `${netDelta} more near misses than last period (${incidentCount} vs ${prevIncidents.length}).`
        : `Same total as last period (${incidentCount}).`;
    let counts = '';
    if (wins.length > 0 || concerns.length > 0) {
      const bits: string[] = [];
      if (wins.length > 0) bits.push(`${wins.length} pattern${wins.length > 1 ? 's' : ''} resolved`);
      if (concerns.length > 0) bits.push(`${concerns.length} need${concerns.length === 1 ? 's' : ''} attention`);
      counts = ` ${bits.join(', ')} — see "What worked" below.`;
    }
    comparisonNarrative = headline + counts;
    comparisonLines.push(comparisonNarrative);
  }

  // Most-affected drug+error pair this period. Used in the summary and
  // agenda so they name the actual drug ("Atorvastatin wrong strength")
  // rather than just the error class ("wrong strength picked").
  const sortedCurPatterns = [...curPatterns.entries()].sort((a, b) => b[1].count - a[1].count);
  const topPair = sortedCurPatterns[0];
  const topPairLabel = topPair && topPair[1].count >= 1
    ? `${topPair[0].split('|||')[0]} ${topPair[0].split('|||')[1].toLowerCase()}`
    : null;
  const topPairCount = topPair?.[1].count || 0;

  // Distinct high-risk classes touched this period — used in agenda.
  const highRiskClasses: string[] = [...new Set(
    (highRiskIncidents as Array<{ drug_name?: string | null; dispensed_drug?: string | null }>).map(i => highRiskCategoryFor(i.drug_name) || highRiskCategoryFor(i.dispensed_drug)).filter((c): c is string => !!c)
  )];

  // Period summary — short labelled bullet lines instead of a flowing
  // paragraph. Managers said the paragraph form was hard to read aloud
  // and hard to scan; a fixed label at the start of each line ("What
  // happened", "Biggest pattern"…) means staff always know where to
  // look for each fact. Rendered with whitespace-pre-wrap so the
  // newlines survive on screen and in print.
  const bulletLines: string[] = [];

  if (incidentCount > 0) {
    // 1. What happened — BOTH raw counts side by side, then the trend
    //    word, so the reader never has to do the subtraction.
    let happened: string;
    if (prevIncidents && prevIncidents.length > 0) {
      const netDelta = incidentCount - prevIncidents.length;
      const trendWord = netDelta < 0 ? `down ${Math.abs(netDelta)}` : netDelta > 0 ? `up ${netDelta}` : 'no change';
      happened = `${incidentCount} near misses this period vs ${prevIncidents.length} last period — ${trendWord}.`;
    } else {
      happened = `${incidentCount} near miss${incidentCount > 1 ? 'es' : ''} recorded.`;
    }
    if (wins.length > 0) happened += ` ${wins.length} earlier problem${wins.length > 1 ? 's' : ''} resolved.`;
    bulletLines.push(`• What happened: ${happened}`);

    // 2. Biggest pattern — names the actual drug and error.
    if (topPairLabel && topPairCount >= 2) {
      bulletLines.push(`• Biggest pattern: ${topPairLabel} — ${topPairCount} times this period.`);
    }

    // 3. Biggest cause + its fix.
    const meaningfulFactors = topFactors.filter(([, count]) => count >= 2).slice(0, 1);
    if (meaningfulFactors.length > 0) {
      const [firstName, firstCount] = meaningfulFactors[0];
      bulletLines.push(`• Biggest cause: ${firstName.toLowerCase()} (${firstCount} of ${incidentCount}) — ${inlineFixFor(firstName)}.`);
    }

    // 4. When they clustered — only when there's a real cluster.
    if (peakLine) bulletLines.push(`• When: ${peakLine.charAt(0).toLowerCase()}${peakLine.slice(1)}`);

    // 5. High-risk callout — stands out as its own line.
    if (highRiskLine) bulletLines.push(`• High-risk: ${highRiskLine}`);
  }

  const rate = rateLine(incidentCount, scriptsDispensed);
  if (rate) bulletLines.push(rate);

  // Deterministic vs-last-period line for the AI path. The stub's
  // "What happened" bullet already carries both counts; the AI writes
  // its own opening line, so this guarantees the raw numbers appear
  // regardless of what the model produces.
  const vsDelta = prevIncidents && prevIncidents.length > 0 ? incidentCount - prevIncidents.length : null;
  const vsLine = (prevIncidents && prevIncidents.length > 0 && incidentCount > 0)
    ? `• Vs last period: ${incidentCount} near misses this period, ${prevIncidents.length} last period (${vsDelta === 0 ? 'no change' : vsDelta! > 0 ? `up ${vsDelta}` : `down ${Math.abs(vsDelta!)}`}).`
    : '';

  const stubSummaryText = incidentCount === 0
    ? 'No near misses were recorded this period. Keep encouraging staff to report — a quiet log usually means under-reporting, not zero risk.'
    : bulletLines.join('\n');

  // Agenda — runs the meeting. Four items, max. A community pharmacy
  // team meeting is ~30 minutes; nine bullet points just gets skipped.
  // Conditional detail is woven INSIDE each item rather than spawning
  // a new bullet.
  //
  // Flow:
  //   1. OPEN     — culture + what worked since last meeting
  //   2. REVIEW   — top pattern, other near misses, high-risk
  //   3. DECIDE   — ONE system change + revisit recurring concerns
  //   4. CLOSE    — training, sign-off, next meeting date
  const agendaItems: string[] = [];

  // Each agenda item is written as a direct instruction to the
  // manager: read this, ask that, write this here. A first-time
  // manager should be able to run the whole meeting just by working
  // down the list. Optional context (top pattern, high-risk drugs,
  // dominant factor) is appended as a brief tag so the meeting
  // script stays scannable.

  // ── 1. OPEN ──
  let openItem = 'Read "This month at a glance" (section 1, below) out loud to the team. Remind everyone: we don\'t track who reported what — this is about learning, not blame.';
  if (wins.length > 0) {
    openItem += ` Good news to share — ${wins.length} problem${wins.length > 1 ? 's have' : ' has'} not happened again since the last meeting. Thank the team.`;
  } else if (recurring.length > 0) {
    openItem += ` Worth flagging — ${recurring.length} problem${recurring.length > 1 ? 's are' : ' is'} happening less often. The changes are helping but not done yet.`;
  }
  agendaItems.push(openItem);

  // ── 2. REVIEW ──
  if (incidentCount > 0) {
    let reviewItem = 'Go through the follow-up (section 2) and each near miss (section 3) with the action chosen. Make sure the team understands what we\'re changing — and note anything they\'d want handled differently next time.';
    if (topPairLabel && topPairCount >= 2) {
      reviewItem += ` Start with ${topPairLabel} — it came up ${topPairCount} times this period.`;
    }
    if (highRiskClasses.length > 0) {
      reviewItem += ` Pay extra attention to high-risk medicines (${highRiskClasses.join(', ')}).`;
    }
    agendaItems.push(reviewItem);
  }

  // ── 3. DECIDE — only when there's genuinely something for the
  //   team to decide. The manager has already actioned every near
  //   miss before the meeting; the one real team-decision moment is
  //   when a problem KEPT happening despite last month's change —
  //   the fix failed, so the team agrees what to try next. Months
  //   where everything is sorted get a 3-step agenda instead. ──
  if (incidentCount > 0 && concerns.length > 0) {
    let decideItem = `${concerns.length} problem${concerns.length > 1 ? 's' : ''} from last review ${concerns.length > 1 ? 'are' : 'is'} still happening (see section 2). As a team, agree what to try next — name who'll do it and the date it'll be done by.`;
    if (topFactors.length > 0 && topFactors[0][1] >= 2) {
      decideItem += ` The biggest factor this period was "${topFactors[0][0]}" — a good place to focus.`;
    }
    agendaItems.push(decideItem);
  }

  // Quiet period — no incidents at all. Single item replaces 2 + 3.
  if (incidentCount === 0) {
    agendaItems.push('No near misses this period — encourage the team to keep reporting. A quiet log usually means under-reporting, not zero risk.');
  }

  // ── 4. CLOSE ──
  agendaItems.push('Pass the printed report around — everyone writes their initials and today\'s date in the signature table at the bottom. Then set the date for next month\'s meeting.');

  const stub = {
    summary: stubSummaryText,
    agenda: agendaItems,
    // "Notes from last meeting" is left blank for the manager to type
    // their own observations. We previously seeded it with the
    // comparison narrative, but that duplicates the "Did our actions
    // work?" panel and clutters the report. A small placeholder is
    // shown only when there's a prior report but nothing else to say.
    previousSummary: lastReport ? undefined : undefined,
  };

  // No API key, no incidents, OR this pharmacy has AI switched off → return
  // the built-in NZ-grounded summary. The report still generates fully.
  if (!env.anthropicApiKey || incidentCount === 0 || !(await isAiEnabledForPharmacy(pharmacyId))) return stub;

  const summarySize = await getPharmacySize(pharmacyId);
  const summarySizeNote = pharmacySizeContext(summarySize);
  const summarySystemBase = `You are a NZ community pharmacy safety advisor writing the period summary for a team-meeting report. Audience is the dispensary team — techs and pharmacists, some with English as a second language.

Output EXACTLY three lines, each starting with "• " and a fixed label, in this order:
• What happened: <one short sentence — what dominated the period: drug, near-miss type, or factor>
• Biggest pattern: <one short sentence naming the actual drug and error, with the count>
• What we're changing: <one short sentence — the single most useful concrete change>

Hard rules: each line maximum 20 words after the label. Plain language, no markdown/bold, British spelling. NZ shop-floor terms: script, dispensary software, checking pharmacist, Pharmac brand, blister pack, NHI, CAL. Always say "near miss", never "error" (an error implies it reached the patient). One NZ reference maximum across all three lines (Medsafe, NZ Formulary, Pharmac, Pharmacy Council NZ, HQSC), only if directly relevant. No preamble, no extra lines.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 220,
        system: summarySizeNote ? `${summarySystemBase}\n\n${summarySizeNote}` : summarySystemBase,
        messages: [{ role: 'user', content: JSON.stringify({
          incidents: (incidents as Array<{ error_types?: string[]; drug_name?: string | null; factors?: string[]; recommendations?: { ai_text?: string; manager_outcome?: string }[] }> | null | undefined)?.map(i => ({ error_types: i.error_types, drug_name: i.drug_name, factors: i.factors, recommendation: i.recommendations?.[0]?.ai_text, outcome: i.recommendations?.[0]?.manager_outcome })),
          previous_period_summary: lastReport?.period_summary,
          // Hand the AI the comparison so it can reference real outcomes
          // ("the action on Atorvastatin appears to be working") instead
          // of generic advice.
          comparison_with_previous: comparisonNarrative || undefined,
        }) }],
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic ${response.status} ${response.statusText}: ${body}`);
    }
    const result = await response.json();
    const aiSummary = result.content?.[0]?.text || stub.summary;
    // Vs-last-period + rate bullets are appended deterministically —
    // the AI is never trusted with the arithmetic. Skipped when the
    // AI call fell back to the stub (which already includes them).
    const extras = aiSummary !== stub.summary
      ? [vsLine, rate].filter(Boolean).join('\n')
      : '';
    return {
      summary: extras ? `${aiSummary}\n${extras}` : aiSummary,
      agenda: stub.agenda,
      // "Last period improvements" is now seeded with the comparison
      // narrative (computed above) so it shows what actually happened
      // since the last meeting — wins, still-recurring patterns, and new
      // concerns — rather than a verbatim copy of last month's text.
      // Pharmacist can still edit before saving.
      previousSummary: stub.previousSummary,
    };
  } catch (err) {
    console.error('[ai] generatePeriodSummary failed:', err);
    return stub;
  }
}
