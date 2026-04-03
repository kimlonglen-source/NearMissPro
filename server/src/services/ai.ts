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

export async function generateRecommendation(incident: IncidentData): Promise<string> {
  if (!env.anthropicApiKey) {
    const fallback = `[AI stub] Review incident with error types: ${incident.error_types.join(', ')}. Consider reviewing procedures for ${incident.drug_name || 'the medication involved'}.`;
    await saveRecommendation(incident.id, incident.pharmacy_id, fallback);
    return fallback;
  }

  try {
    // Count prior incidents with same drug this period
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
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 300,
        system: 'You are a pharmacy safety advisor for a New Zealand community pharmacy. Generate a specific actionable prevention recommendation. 2-3 sentences maximum. Practical changes only. No generic advice. Note if this is a repeat pattern.',
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

  // Count drug frequencies
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
    return `[Pattern detected] ${alerts.join('. ')}.`;
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.anthropicApiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514',
        max_tokens: 150,
        system: 'Analyse these pharmacy near miss incidents and identify the most significant pattern in plain language. One sentence maximum.',
        messages: [{ role: 'user', content: JSON.stringify({ patterns: alerts, incident_count: incidents.length }) }],
      }),
    });
    const result = await response.json();
    return result.content?.[0]?.text || alerts.join('. ');
  } catch {
    return alerts.join('. ');
  }
}

export async function generatePeriodSummary(pharmacyId: string, periodStart: string, periodEnd: string): Promise<{ summary: string; agenda: string[]; previousSummary?: string }> {
  const { data: incidents } = await supabase.from('incidents')
    .select('*, recommendations(*)').eq('pharmacy_id', pharmacyId)
    .gte('submitted_at', periodStart).lte('submitted_at', periodEnd).eq('status', 'active');

  const { data: lastReport } = await supabase.from('reports')
    .select('period_summary, agenda_items').eq('pharmacy_id', pharmacyId)
    .lt('period_end', periodStart).order('period_end', { ascending: false }).limit(1).single();

  const incidentCount = incidents?.length || 0;
  const stub = {
    summary: `This period recorded ${incidentCount} near miss incidents. Review the incident log for details and discuss prevention strategies at the team meeting.`,
    agenda: [
      'Celebrate: the team continues to report near misses — this culture of openness keeps patients safe.',
      `Review the ${incidentCount} incidents recorded this period.`,
      'Discuss any recurring patterns and agree on prevention actions.',
      'Confirm all staff understand the updated procedures.',
    ],
    previousSummary: lastReport ? 'Review of actions from last period and their effectiveness.' : undefined,
  };

  if (!env.anthropicApiKey || incidentCount === 0) return stub;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': env.anthropicApiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6-20250514', max_tokens: 500,
        system: 'You are a pharmacy safety advisor writing a brief improvement summary for a NZ pharmacy report. Write 3-5 sentences in plain language suitable for reading at a team meeting. Be specific about what improved and what needs more time.',
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
