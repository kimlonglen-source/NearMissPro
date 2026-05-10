import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';
import { normalizeDrugName } from '../lib/normalize.js';
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
- Medsafe — safety alerts, recalls, LASA list, Section 29 unapproved medicines
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
  if (hasAny(['allergy', 'interaction', 'duplicate therapy'])) {
    return `When the dispensary software flags an allergy, interaction, or duplicate medicine, the staff member should have to type a reason — not just tap-to-dismiss. The pharmacist-in-charge should review the override log weekly (Pharmacy Council NZ standard 1.8).${factorNote}`;
  }

  // Renal / hepatic / paediatric / geriatric / pregnancy dose
  if (hasAny(['renal', 'hepatic', 'paediatric', 'geriatric', 'pregnancy', 'breastfeeding'])) {
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
    return `Check the prescription date when you receive it — most scripts are valid for 6 months (controlled drugs only 3 months). If anything looks altered, ring the prescriber to verify and keep the original (Medicines Regulations 1984).${factorNote}`;
  }

  // Verbal / phone / fax order
  if (hasAny(['verbal', 'phone order', 'faxed'])) {
    return `For verbal or phone orders, always read it back to confirm. Faxed prescriptions must be followed by the original paper within 7 days (Medicines Regulations) — keep the original hardcopy.${factorNote}`;
  }

  // Label typo / directions / CAL
  if (hasAny(['typo', 'directions', 'sig'])) {
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
  if (hasAny(['section 29'])) {
    return `Section 29 (unapproved medicines — i.e. not formally approved by Medsafe) needs special paperwork: the prescriber must acknowledge the medicine is unapproved, and you keep records for 10 years. Read Medsafe's Section 29 guidance.${factorNote}`;
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

export async function generateRecommendation(incident: IncidentData): Promise<string> {
  if (!env.anthropicApiKey) {
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
            notes: incident.notes,
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
    console.error('[ai] generateRecommendation failed:', err);
    const fallback = 'AI recommendation unavailable. Please review this incident manually.';
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

export async function generatePeriodSummary(pharmacyId: string, periodStart: string, periodEnd: string): Promise<{ summary: string; agenda: string[]; previousSummary?: string }> {
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
  const topFactors = Object.entries(factorCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
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
  const timeBucketEntries = Object.entries(timeBucketCounts).sort((a, b) => b[1] - a[1]);
  const dayCounts = (incidents || []).reduce<Record<string, number>>((acc, i) => {
    const when = i.occurred_at || i.submitted_at;
    if (!when) return acc;
    const d = new Date(when as string);
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const day = days[d.getDay()];
    acc[day] = (acc[day] || 0) + 1;
    return acc;
  }, {});
  const dayEntries = Object.entries(dayCounts).sort((a, b) => b[1] - a[1]);
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
  const startMs = new Date(periodStart).getTime();
  const endMs = new Date(endBound).getTime();
  const periodMs = endMs - startMs;
  const prevEndIso = new Date(startMs - 1).toISOString();
  const prevStartIso = new Date(startMs - periodMs - 1).toISOString();
  const { data: prevIncidents } = await supabase.from('incidents')
    .select('drug_name, error_types, recommendations(manager_outcome)')
    .eq('pharmacy_id', pharmacyId).eq('status', 'active')
    .gte('submitted_at', prevStartIso).lte('submitted_at', prevEndIso);

  type PatStat = { count: number; actioned: boolean };
  const buildPatternMap = (rows: { drug_name?: string | null; error_types?: string[] | null; recommendations?: { manager_outcome?: string | null }[] }[]): Map<string, PatStat> => {
    const m = new Map<string, PatStat>();
    for (const r of rows || []) {
      if (!r.drug_name) continue;
      const drug = r.drug_name.trim(); if (!drug) continue;
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
    } else if (cur < prev && wasActioned) {
      recurring.push(`${drug} ${et}: ${prev} → ${cur} (action helping)`);
    } else if (cur > prev && wasActioned) {
      concerns.push(`${drug} ${et}: ${prev} → ${cur} (action so far not enough — revisit)`);
    } else if (prev === 0 && cur >= 2) {
      concerns.push(`${drug} ${et}: new pattern this period (${cur} incidents)`);
    }
  }
  let comparisonNarrative = '';
  if (prevIncidents && prevIncidents.length > 0) {
    const netDelta = incidentCount - (prevIncidents.length || 0);
    const headline = netDelta < 0
      ? `${Math.abs(netDelta)} fewer near misses than last period (${incidentCount} vs ${prevIncidents.length}).`
      : netDelta > 0
        ? `${netDelta} more near misses than last period (${incidentCount} vs ${prevIncidents.length}).`
        : `Same total as last period (${incidentCount}).`;
    const parts = [headline];
    if (wins.length > 0) parts.push(`Resolved: ${wins.slice(0, 4).join('; ')}.`);
    if (recurring.length > 0) parts.push(`Improving: ${recurring.slice(0, 3).join('; ')}.`);
    if (concerns.length > 0) parts.push(`Needs attention: ${concerns.slice(0, 3).join('; ')}.`);
    comparisonNarrative = parts.join(' ');
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
  const highRiskClasses = [...new Set(
    highRiskIncidents.map(i => highRiskCategoryFor(i.drug_name) || highRiskCategoryFor(i.dispensed_drug)).filter((c): c is string => !!c)
  )];

  // Period summary — a single flowing paragraph that weaves together the
  // headline number, the most-affected pattern (if any), the top
  // contributing factors WITH their fixes inline, and any high-risk
  // callouts. Reads as one cohesive story rather than a series of
  // bulleted facts followed by a separate factor panel.
  const summaryParts: string[] = [];

  // Opener: count + trend + top pattern (when there's a real pattern).
  if (comparisonNarrative) {
    summaryParts.push(comparisonNarrative);
  } else if (incidentCount > 0) {
    let line = `${incidentCount} near miss${incidentCount > 1 ? 'es' : ''} this period.`;
    if (topPairLabel && topPairCount >= 2) {
      line += ` ${topPairLabel.charAt(0).toUpperCase() + topPairLabel.slice(1)} happened ${topPairCount} times.`;
    }
    summaryParts.push(line);
  }

  // Factor + fix inline — up to the top 3, woven into the paragraph.
  // First factor uses "The biggest cause was X (N of M) — <fix>." The
  // second and beyond use "X also came up N times — <fix>." This reads
  // as a continuous narrative instead of a bulleted list.
  const meaningfulFactors = topFactors.filter(([, count]) => count >= 2).slice(0, 3);
  if (meaningfulFactors.length > 0 && incidentCount > 0) {
    const [firstName, firstCount] = meaningfulFactors[0];
    summaryParts.push(`The biggest cause was ${firstName.toLowerCase()} (${firstCount} of ${incidentCount}) — ${inlineFixFor(firstName)}.`);
    for (let i = 1; i < meaningfulFactors.length; i++) {
      const [name, count] = meaningfulFactors[i];
      summaryParts.push(`${name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()} also came up ${count} time${count > 1 ? 's' : ''} — ${inlineFixFor(name)}.`);
    }
  }

  // When errors clustered (peak time-of-day + day) — woven into the
  // paragraph so the heatmap insight reads as part of the narrative.
  if (peakLine) summaryParts.push(peakLine);

  // High-risk drug callout — separate sentence so it stands out.
  if (highRiskLine) summaryParts.push(highRiskLine);

  // The closing "At the meeting, focus on X" line was here. It's been
  // removed because the agenda below already contains the action prompt
  // ("Decide ONE specific change… what targets X?"), and having both the
  // summary and the agenda point at the same action made the report feel
  // like it was repeating itself. Summary now ends with the facts; the
  // agenda owns the meeting flow.

  const stubSummaryText = incidentCount === 0
    ? 'No near misses were recorded this period. Continue to encourage staff to report all near misses — a low count may indicate under-reporting rather than the absence of any.'
    : summaryParts.join(' ').replace(/\s+/g, ' ').trim();

  // Agenda — runs the meeting. Each item is action-oriented (a discussion
  // prompt or a decision to make). The agenda deliberately does NOT
  // restate the headline numbers, peak times, or factor counts — those
  // live in the summary above and would just be read twice.
  //
  // Flow:
  //   OPEN     — culture + safety framing
  //   CLOSE    — close the loop on last meeting's actions
  //   ANALYSE  — root cause + SOP review for the top pattern
  //   ACT      — decide ONE change targeting the top factor
  //   ESCALATE — high-risk medicines need extra attention
  //   ACKNOWLEDGE — wins worth celebrating
  //   ADDRESS  — concerns where prior action wasn't enough
  //   LEARN    — training + share with wider team
  //   DOCUMENT — sign-off + next meeting date
  //
  // Each conditional item only appears when there's data behind it.
  // Regulator anchors (Pharmacy Council NZ, Medsafe, HQSC) are kept on
  // the items where they directly apply, so the saved report doubles as
  // audit evidence.
  const agendaItems: string[] = [];

  // ── OPEN — no-blame culture (Pharmacy Council NZ CQI principle) ──
  agendaItems.push('Open: we use anonymised data here — the goal is learning, not blame (Pharmacy Council NZ continuous quality improvement principle).');

  // ── CLOSE — close last loop using the data, not a remembered agreement.
  //   The manager has already accepted/modified per-incident
  //   recommendations during review, so the meeting isn't deciding
  //   those again. What the meeting DOES need to reflect on is whether
  //   prior SYSTEM changes have reduced the targeted patterns. The
  //   "Did our actions work?" panel above answers this directly. ──
  if (lastReport) {
    agendaItems.push('Look at the "Did our actions work?" panel above: which patterns reduced after the changes we made, and which kept happening despite them?');
  }

  // ── ANALYSE — root cause for the top pattern + SOP review (combined
  //              so they read as one discussion topic, not two) ──
  if (topPairLabel && topPairCount >= 2) {
    agendaItems.push(`Root cause for ${topPairLabel}: walk through the chain of events. Were the SOPs followed? Do any need updating? (Pharmacy Council NZ standard 1.8 — clinical decision support)`);
  } else if (incidentCount > 0) {
    // No single recurring pattern — still review the SOPs against the
    // incidents in the log.
    agendaItems.push('SOP review: walk through the incidents in the log. Were the SOPs followed? Do any need updating?');
  }

  // ── ACT — agree ONE SYSTEM-level change as a team. The manager has
  //   already actioned per-incident recommendations during review;
  //   THIS item is the broader workspace/SOP/layout/software change
  //   that needs team buy-in and someone to own it. ──
  if (topFactors.length > 0 && topFactors[0][1] >= 2) {
    agendaItems.push(`Agree ONE system change for this month — what workspace, SOP, layout, or software change will target ${topFactors[0][0].toLowerCase()}? Decide as a team and assign an owner (HQSC quality-improvement guidance).`);
  } else if (incidentCount > 0) {
    agendaItems.push('Agree ONE system change for this month — workspace, SOP, layout, or software. Decide as a team and assign an owner.');
  }

  // ── ESCALATE — high-risk medicines (Medsafe) ──
  if (highRiskClasses.length > 0) {
    const word = highRiskClasses.length === 1 ? 'class' : 'classes';
    agendaItems.push(`High-risk medicine ${word} this period: ${highRiskClasses.join(', ')}. Refresh the safety-check protocol for these (Medsafe high-risk medicines guidance).`);
  }

  // ── ACKNOWLEDGE — wins (sustains reporting culture) ──
  if (wins.length > 0) {
    agendaItems.push(`Acknowledge: ${wins.length} previous pattern${wins.length > 1 ? 's have' : ' has'} been resolved since the last meeting — thank the team.`);
  }

  // ── ADDRESS — recurring concerns (closed-loop accountability) ──
  if (concerns.length > 0) {
    agendaItems.push(`Revisit: ${concerns.length} pattern${concerns.length > 1 ? 's' : ''} where the last action hasn't been enough — agree a stronger change today.`);
  }

  // ── LEARN — training + share (Pharmacy Council NZ continuing competence) ──
  agendaItems.push('Training: does anyone need extra learning on what we discussed? Share the key learning with the wider team (Pharmacy Council NZ continuing competence).');

  // Quiet-period note (no incidents at all)
  if (incidentCount === 0) {
    agendaItems.push('Reporting culture: no near misses this period — encourage staff to keep reporting, as under-reporting is the bigger risk than a quiet log.');
  }

  // ── DOCUMENT — sign-off + next meeting date (audit trail).
  //   Confirms the SYSTEM change agreed at this meeting (not the
  //   per-incident decisions, which were already actioned during
  //   review). The staff acknowledgement evidences that the team
  //   was briefed on what happened and on the system change going
  //   forward. ──
  agendaItems.push('Sign off: write down the system change we agreed today, who owns it, and by when. Sign the staff acknowledgement and set the next meeting date.');

  const stub = {
    summary: stubSummaryText,
    agenda: agendaItems,
    // "Last period improvements" now seeded with the actual outcome of
    // last meeting's decisions, so the pharmacist can simply tweak rather
    // than recall and re-type each month. Editable as before.
    previousSummary: comparisonNarrative || (lastReport ? 'Review the actions agreed at the last meeting and assess whether they have reduced incidents.' : undefined),
  };

  if (!env.anthropicApiKey || incidentCount === 0) return stub;

  const summarySize = await getPharmacySize(pharmacyId);
  const summarySizeNote = pharmacySizeContext(summarySize);
  const summarySystemBase = `You are a NZ community pharmacy safety advisor writing the period summary for a team-meeting report. Audience is the dispensary team — techs and pharmacists.

Write 3-5 short sentences in plain language. No markdown, no bold, no bullets. British spelling.

Cover, in this order: what dominated the period (drug, near-miss type, or factor), one concrete change to make, and ONE NZ-grounded reference if directly relevant (NZ Formulary, Medsafe, NZULM, Pharmac, Pharmacy Council NZ standards, HQSC, Misuse of Drugs Act, Te Whatu Ora Pharmacy Procedures Manual). Use NZ shop-floor language: script, dispensary software, checking pharmacist, Pharmac brand, blister pack, NHI, CAL. Always say "near miss" when describing the events — these are events caught before reaching the patient, so calling them "errors" is technically incorrect.

Skip preamble like "this period saw" or "it is recommended that". Don't restate counts the report already shows.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 500,
        system: summarySizeNote ? `${summarySystemBase}\n\n${summarySizeNote}` : summarySystemBase,
        messages: [{ role: 'user', content: JSON.stringify({
          incidents: incidents?.map(i => ({ error_types: i.error_types, drug_name: i.drug_name, factors: i.factors, recommendation: i.recommendations?.[0]?.ai_text, outcome: i.recommendations?.[0]?.manager_outcome })),
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
    return {
      summary: result.content?.[0]?.text || stub.summary,
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
