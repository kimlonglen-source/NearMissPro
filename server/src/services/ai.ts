import { env } from '../config/env.js';
import { supabase } from '../config/supabase.js';

interface IncidentData {
  id: string;
  pharmacy_id: string;
  error_types: string[];
  drug_name?: string;
  dispensed_drug?: string;
  prescribed_strength?: string;
  dispensed_strength?: string;
  correct_formulation?: string;
  dispensed_formulation?: string;
  where_caught?: string;
  time_of_day?: string;
  factors: string[];
  notes?: string;
  other_entries?: { category: string; text: string }[];
}

const NZ_SYSTEM_PROMPT = `You are a pharmacy safety advisor for a New Zealand community pharmacy operating under the Medicines Act 1981 and Pharmacy Council of NZ standards.

Generate a specific, actionable prevention recommendation for this near miss incident. Follow these rules:
- 2-3 sentences maximum
- Reference NZ pharmacy practice where relevant (e.g. Pharmacy Council NZ guidelines, NZULM, Medsafe alerts)
- Be specific to the drug/situation — no generic advice like "be more careful"
- Suggest practical workflow changes: shelf separation, alert stickers, double-check protocols, tallman lettering
- If this involves look-alike/sound-alike drugs, suggest specific differentiation strategies
- If this is a repeat pattern, flag it clearly and suggest systemic change
- Consider NZ-specific context: Pharmac brand changes, subsidised vs non-subsidised, common NZ generics
- For dose errors: suggest checking the NZ Formulary or contacting the prescriber
- For CAL errors: reference the NZ CAL requirements
- Keep language plain and suitable for a team meeting discussion`;

export async function generateRecommendation(incident: IncidentData): Promise<string> {
  if (!env.anthropicApiKey) {
    // Generate a useful stub recommendation based on the error type
    const stubs: Record<string, string> = {
      'Wrong drug': `Review shelf placement for ${incident.drug_name || 'this medication'} and similar-looking products. Consider tallman lettering or alert stickers to differentiate look-alike medications. Add a second check at the dispensing stage.`,
      'Wrong dose': `Verify ${incident.drug_name || 'this medication'} strength against the prescription and NZ Formulary. Consider highlighting unusual doses with a flag label. Ensure the correct strength is at eye level on the shelf.`,
      'Wrong formulation': `Check ${incident.drug_name || 'this medication'} formulation matches the prescription. Separate different formulations on the shelf. Add formulation to the verbal confirmation at patient counselling.`,
      'Wrong patient': 'Confirm patient identity at every stage: data entry, dispensing, labelling, and handover. Use date of birth as a second identifier. Consider a two-person check for high-risk medications.',
      'Repeat dispensed early': 'Check the dispensing history before processing repeats. Set up alerts for minimum repeat intervals. Confirm with the patient when they last collected this medication.',
      'Wrong quantity': `Count ${incident.drug_name || 'medication'} twice before labelling. Use the original pack where possible. Cross-check quantity against the prescription at final check.`,
      'Expired medication': 'Implement a monthly expiry check rotation. Move short-dated stock to the front of the shelf. Mark items within 3 months of expiry with a coloured sticker.',
      'Wrong directions on label': 'Compare label directions word-for-word against the prescription at final check. Read directions aloud during patient counselling to catch discrepancies.',
      'CAL missing or incorrect': 'Review the NZ CAL requirements for this medication class. Add a CAL checklist step to the dispensing workflow. Ensure the dispensing software CAL prompts are not being dismissed.',
      'Label on wrong item': 'Match each label to its physical item immediately after printing. Never batch-label multiple prescriptions. Use a one-label-one-item workflow.',
    };

    const primaryError = incident.error_types[0] || '';
    const recommendation = stubs[primaryError] || `Review the dispensing workflow for ${incident.drug_name || 'this medication'}. Discuss at the next team meeting and agree on a specific prevention action. Document the agreed change.`;

    await saveRecommendation(incident.id, incident.pharmacy_id, recommendation);
    return recommendation;
  }

  try {
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

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
        max_tokens: 300,
        system: NZ_SYSTEM_PROMPT,
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

    const result = await response.json();
    const aiText = result.content?.[0]?.text || 'Unable to generate recommendation.';
    await saveRecommendation(incident.id, incident.pharmacy_id, aiText);
    return aiText;
  } catch (err) {
    console.error('AI recommendation error:', err);
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

export async function detectPatterns(pharmacyId: string): Promise<string | null> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const { data: incidents } = await supabase.from('incidents')
    .select('error_types, drug_name, factors, time_of_day')
    .eq('pharmacy_id', pharmacyId).gte('submitted_at', periodStart).eq('status', 'active');

  if (!incidents || incidents.length < 3) return null;

  const drugCounts: Record<string, number> = {};
  const factorCounts: Record<string, number> = {};
  const timeCounts: Record<string, number> = {};

  for (const i of incidents) {
    if (i.drug_name) drugCounts[i.drug_name] = (drugCounts[i.drug_name] || 0) + 1;
    if (i.time_of_day) timeCounts[i.time_of_day] = (timeCounts[i.time_of_day] || 0) + 1;
    for (const f of i.factors || []) factorCounts[f] = (factorCounts[f] || 0) + 1;
  }

  const alerts: string[] = [];
  for (const [drug, count] of Object.entries(drugCounts)) { if (count >= 3) alerts.push(`${drug} appears in ${count} incidents`); }
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
        system: 'You are a NZ pharmacy safety advisor. Analyse these near miss patterns and identify the most significant finding in one plain-language sentence. Be specific and actionable.',
        messages: [{ role: 'user', content: JSON.stringify({ patterns: alerts, incident_count: incidents.length }) }],
      }),
    });
    const result = await response.json();
    return result.content?.[0]?.text || alerts.join('. ');
  } catch { return alerts.join('. '); }
}

export async function generatePeriodSummary(pharmacyId: string, periodStart: string, periodEnd: string): Promise<{ summary: string; agenda: string[]; previousSummary?: string }> {
  const { data: incidents } = await supabase.from('incidents')
    .select('*, recommendations(*)').eq('pharmacy_id', pharmacyId)
    .gte('submitted_at', periodStart).lte('submitted_at', periodEnd).eq('status', 'active');

  const { data: lastReport } = await supabase.from('reports')
    .select('period_summary, agenda_items').eq('pharmacy_id', pharmacyId)
    .lt('period_end', periodStart).order('period_end', { ascending: false }).limit(1).single();

  const incidentCount = incidents?.length || 0;
  const errorSummary = incidents?.flatMap(i => i.error_types).reduce<Record<string, number>>((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {}) || {};
  const topErrors = Object.entries(errorSummary).sort((a, b) => b[1] - a[1]).slice(0, 3);

  const stub = {
    summary: incidentCount === 0
      ? 'No incidents were recorded this period. Continue to encourage staff to report all near misses — a low count may indicate under-reporting rather than absence of errors.'
      : `This period recorded ${incidentCount} near miss${incidentCount > 1 ? 'es' : ''}. ${topErrors.length > 0 ? `Most common: ${topErrors.map(([e, c]) => `${e} (${c})`).join(', ')}.` : ''} Review the incident log below and discuss prevention actions at the team meeting.`,
    agenda: [
      'Acknowledge the team for continuing to report near misses — this culture of openness keeps patients safe.',
      ...(topErrors.length > 0 ? [`Discuss the ${topErrors[0][1]} ${topErrors[0][0]} incident${topErrors[0][1] > 1 ? 's' : ''} and agree on a specific prevention action.`] : []),
      'Review any accepted recommendations and confirm they have been implemented.',
      'Identify any training needs or workflow changes required.',
      'Confirm the date of the next review meeting.',
    ],
    previousSummary: lastReport ? 'Review the actions agreed at the last meeting and assess whether they have reduced incidents.' : undefined,
  };

  if (!env.anthropicApiKey || incidentCount === 0) return stub;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6', max_tokens: 500,
        system: 'You are a NZ pharmacy safety advisor writing a brief improvement summary for a pharmacy team meeting report. Write 3-5 sentences in plain language. Be specific about what happened and what needs to change. Reference NZ pharmacy practice standards where relevant.',
        messages: [{ role: 'user', content: JSON.stringify({ incidents: incidents?.map(i => ({ error_types: i.error_types, drug_name: i.drug_name, factors: i.factors, recommendation: i.recommendations?.[0]?.ai_text, outcome: i.recommendations?.[0]?.manager_outcome })), previous_period_summary: lastReport?.period_summary }) }],
      }),
    });
    const result = await response.json();
    return {
      summary: result.content?.[0]?.text || stub.summary,
      agenda: stub.agenda,
      previousSummary: lastReport ? (result.content?.[0]?.text || stub.previousSummary) : undefined,
    };
  } catch { return stub; }
}
