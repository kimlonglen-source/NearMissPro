import { supabase } from '../config/supabase.js';

// Returns the end date of any locked (signed-off) report whose period
// covers `iso`, scoped to the pharmacy. Used to refuse late entries,
// edits, and post-sign-off recommendation actions that would silently
// mutate a report a manager has already signed and printed. Pharmacy
// Council Standard 1.8 expects signed reports to represent the data
// at the moment they were signed.
export async function lockedPeriodCoveringDate(pharmacyId: string, iso: string): Promise<string | null> {
  const { data } = await supabase.from('reports')
    .select('period_start, period_end')
    .eq('pharmacy_id', pharmacyId)
    .eq('locked', true)
    .lte('period_start', iso)
    .gte('period_end', iso)
    .limit(1);
  if (data && data.length > 0) return data[0].period_end as string;
  return null;
}
