// Plain-language fix suggestions for each contributing factor.
// Used both by the factor-analysis endpoint (live panel on the dashboard)
// and by the period-summary generator (so the report's narrative paragraph
// can weave the factor names and fixes inline as one flowing sentence
// per factor, rather than splitting it into a separate bulleted panel).
//
// Each suggestion is one sentence — short enough to embed inside a
// paragraph without becoming a wall of text. Technical terms are
// explained inline (TALLman lettering = writing the unique letters BIG)
// so a non-pharmacist reader can follow without a glossary.

export const FACTOR_SUGGESTIONS: Record<string, string> = {
  'Busy period': 'Check whether near misses happen more on certain days or times. Adjust the roster, or change how you manage queues at peak times.',
  'Interruption or distraction': 'Set up a no-interruption zone for the dispensing-critical steps. The dispensing pharmacist can wear a tabard or display a "do not disturb" sign so the team knows not to interrupt (HQSC distraction-reduction guidance).',
  'Similar packaging': 'Move the look-alike products apart on the shelf. Use TALLman lettering — write the unique letters BIG, e.g. amLODipine vs amIOdarone. Add a bright warning sticker on each (Medsafe LASA guidance).',
  'Similar drug names': 'Use TALLman lettering on the bin label (e.g. cefaLEXin vs cefacLOR). Set up a popup warning in your dispensary software when these drugs are picked (NZ SALAD list / Medsafe LASA).',
  'Similar patient name': 'Set up a flag in your dispensary software for patients with similar names. At every step, check both the NHI and date of birth (Pharmacy Council NZ two-identifier standard).',
  'Script not checked against original': 'Keep the original prescription visible at every check (data entry, picking, final check). The pharmacist-in-charge audits weekly to make sure it\'s happening.',
  'Understaffed': 'Compare your roster against when you actually get busy. Have a backup pharmacist on call for unexpectedly busy periods.',
  'Dispensary system slow or down': 'Record the problem with your dispensary-software vendor. Write down a paper-based backup process so you can keep dispensing safely during outages, and review your override policy — alerts should not be dismissable with one tap (Pharmacy Council NZ standard 1.8).',
  'Handwriting hard to read': 'Use a standard "please clarify" callback message to the prescriber. Never dispense from an unclear prescription — Medicines Regulations 1984 require it to be legible.',
  'Unusual dose or strength': 'Look up unusual doses in the NZ Formulary. Flag them at data entry. Require an explicit confirmation step before dispensing.',
  'New staff member': 'Create an onboarding checklist (with a sign-off step). Have new staff supervised in their first few weeks. Show them recent near-miss patterns when they start.',
  'Trainee or intern involved': 'Pair trainees or interns with an experienced staff member for the whole dispensing chain, not just the checking step. Add a "learner on duty" flag so the pharmacist-in-charge knows to spot-check more often that shift.',
  'Shift changeover': 'Use a written handover checklist for anything mid-flight (partially dispensed scripts, callbacks owed, patients on the pickup shelf). No verbal-only handovers.',
  'Language barrier': 'Keep a list of interpreter phone lines by common languages in your area. For counselling, use written pictograms or the drug\'s CMI (Consumer Medicine Information) sheet in the patient\'s language where possible.',
  'Unfamiliar drug': 'Pause and look up the drug in NZULM or the NZ Formulary before dispensing. This may also be a sign that the team needs more training on this drug class.',
  'Usual process skipped': 'Run an SOP refresher with a sign-off log. Add visual workflow reminders at each work station.',
  'Message not passed on': 'Use a standard handover phrase. Write down what was passed on at each handoff (Te Whatu Ora Pharmacy Procedures Manual).',
  'No obvious reason': 'No single cause stood out. Before assuming a fix is needed, check whether these share a drug, a time of day, or a step — a hidden pattern is often the real cause. If they are genuinely one-offs, "no change this time" is an honest, valid answer.',
};

/** Get the fix text for a factor name, or a neutral fallback if not in the table. */
export function fixFor(factor: string): string {
  return FACTOR_SUGGESTIONS[factor] || 'Discuss at the next team meeting and agree a specific system-level change.';
}

/** A shorter inline-friendly version of the fix — drops the parenthetical
 * citation and keeps just the action so it can be woven into a paragraph
 * without overwhelming it. Falls back to the full fix if no abridged form
 * is defined. */
const FACTOR_INLINE_FIXES: Record<string, string> = {
  'Busy period': 'check whether near misses cluster on specific days or times and adjust the roster or queue management at peak',
  'Interruption or distraction': 'trial a no-interruption zone during dispensing — e.g. the pharmacist counting wears a tabard or displays a "do not disturb" sign',
  'Similar packaging': 'move look-alike products apart on the shelf, use TALLman lettering (writing the unique letters BIG, e.g. amLODipine vs amIOdarone), and add a bright warning sticker on each',
  'Similar drug names': 'use TALLman lettering on the bin label (e.g. cefaLEXin vs cefacLOR) and set up a popup warning in your dispensary software',
  'Similar patient name': 'flag similar-name patients in your software and check both the NHI and date of birth at every step',
  'Script not checked against original': 'keep the original prescription visible at every check, with the pharmacist-in-charge auditing weekly',
  'Understaffed': 'compare your roster against actual peak times and have a backup pharmacist on call',
  'Dispensary system slow or down': 'log the problem with your vendor, document a paper-backup process for outages, and review your override policy so alerts cannot be one-tap dismissed',
  'Handwriting hard to read': 'use a standard callback to the prescriber and never dispense from an unclear prescription',
  'Unusual dose or strength': 'look up unusual doses in the NZ Formulary and require explicit confirmation before dispensing',
  'New staff member': 'use an onboarding checklist with a sign-off step and supervised dispensing in the first weeks',
  'Trainee or intern involved': 'pair trainees with an experienced staff member across the whole dispensing chain and add a "learner on duty" flag so the pharmacist-in-charge spot-checks more often that shift',
  'Shift changeover': 'use a written handover checklist for anything mid-flight — partial scripts, callbacks owed, pickup-shelf items — with no verbal-only handovers',
  'Language barrier': 'keep interpreter phone-line numbers handy and use pictograms or the drug\'s CMI sheet in the patient\'s language for counselling',
  'Unfamiliar drug': 'pause and look up the drug in NZULM or the NZ Formulary before dispensing',
  'Usual process skipped': 'run an SOP refresher with a sign-off log and add visual workflow reminders at each station',
  'Message not passed on': 'use a standard handover phrase and write down what was passed on',
  'No obvious reason': 'check whether these share a drug, time of day, or step — a hidden pattern is often the real cause; if they are genuine one-offs, "no change this time" is a valid answer',
};

export function inlineFixFor(factor: string): string {
  return FACTOR_INLINE_FIXES[factor] || 'discuss at the next team meeting';
}
