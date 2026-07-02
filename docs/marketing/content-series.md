# NearMissPro — LinkedIn content series

Five posts covering the four themes: the pain point, the benefits, the AI, and security & data.
Voice: the founder (a NZ pharmacy owner). Plain English, honest that it's pre-launch.

**Order to post:** 1 → 2 → 3 (pain + benefit, no hard sell), then 4 → 5 (AI + the security answer).
Posts 4 and 5 are a pair: 4 raises the "AI makes me nervous" worry, 5 answers it.
Add the waitlist link to the end of posts 3, 4, and 5 once the form is live.

All copy is plain text (no asterisks) so it pastes clean into LinkedIn.

---

## POST 1 — THE PAIN (recording)

The near-miss logbook nobody fills in.

Every NZ pharmacy has one. An A4 book by the bench, or a spreadsheet someone set up once. And on a busy day, it's the first thing that gets skipped.

You catch the wrong strength at the final check, fix it, and keep moving — because there are ten scripts in the queue and no time to stop and write a paragraph.

So the near miss vanishes. No record, no pattern, nothing to learn from. Not because anyone's careless — because logging it is friction, and friction loses to a busy Friday every time.

The problem was never that pharmacies don't care about near misses. It's that recording them properly costs time you don't have at the bench.

What if logging one took ten seconds — a few taps, no paragraph, no name attached?

That's the first thing I set out to fix.

Honestly: how much does your team log, versus catch-and-move-on? 👇

#PatientSafety #CommunityPharmacy #Pharmacy #NZPharmacy #Pharmacist #MedicationSafety #QualityImprovement #Healthcare

---

## POST 2 — THE PAIN (reviewing) + BENEFIT

The monthly near-miss review that goes nowhere.

You sit down once a month, flick through the logbook, nod at a few entries, and… that's it. Next month: same drugs, same mistakes, same nodding.

The review isn't the hard part. Turning it into change is. And here's the bit almost no logbook does — it never tells you whether the change you made last month actually worked.

You moved the methadone register. You added a second check on the look-alikes. Did it help? Most pharmacies never find out, because last month's data and this month's never get compared.

That's the piece I care most about: every review compared to the one before it. Each problem from last time is followed up and marked — gone, happening less, or still happening. So you can finally see whether what you changed reduced the next near miss.

That's the difference between a logbook and genuine continuous improvement — the thing the Pharmacy Council actually looks for.

Does your review ever tell you if last month's fix worked? 👇

#PatientSafety #CommunityPharmacy #Pharmacy #NZPharmacy #QualityImprovement #Pharmacist #MedicationSafety #Healthcare

---

## POST 3 — THE BENEFIT (prevention, plain)

We spend a lot of energy catching near misses. Almost none learning from them.

Catching the wrong strength at the final check is a win. But if the same near miss keeps happening — same drug, same look-alike box, same busy afternoon — then catching it every time is just luck wearing thin.

The goal isn't to catch more. It's to need to catch fewer.

That's the whole idea behind what I'm building: log a near miss in seconds, let the patterns surface on their own, make one small system change, and measure whether it worked next month. Capture, act, measure, repeat.

Fewer repeat near misses. A clean improvement record for the Pharmacy Council. And a bit less of that quiet dread that one might slip through.

Prevention, not paperwork.

What's the one near miss that keeps coming back in your pharmacy? 👇

#PatientSafety #CommunityPharmacy #Pharmacy #NZPharmacy #QualityImprovement #Pharmacist #Healthcare #MedicationSafety

---

## POST 4 — THE AI

I didn't want AI that sounds clever. I wanted AI that's actually useful at the bench.

There's a lot of hype about AI in healthcare, and most of it is noise. For a busy pharmacy, a suggestion is only worth something if it's simple enough to actually do on Monday.

So the AI in what I'm building does one job: look at a near miss and suggest a plain, practical change, grounded in NZ pharmacy best practice. Move the stock. Add a warning label. Separate the look-alikes. Not a lecture — one small change you can make this week.

And it's advisory, always. The pharmacist-in-charge makes every decision. The AI suggests; the human decides. You can even switch it off completely and the tool still works.

Simple, effective, NZ-grounded. That's the bar — and if it can't clear it, it's not worth having.

Does practical AI like this appeal — or does AI in the dispensary make you nervous? (If it's the second one, good. Read my next post.) 👇

#PatientSafety #Pharmacy #CommunityPharmacy #NZPharmacy #AI #HealthTech #Pharmacist #MedicationSafety

---

## POST 5 — SECURITY & DATA

"But isn't AI a privacy risk?" Yes — if you do it wrong.

You've seen the stories: businesses pasting sensitive information into AI tools and landing in hot water. In a pharmacy, that fear is completely justified — you're holding people's health information, and the rules are strict for good reason.

So I built NearMissPro to be safe by design, not as an afterthought:

• Near misses are anonymous — the tool doesn't record which staff member logged what.
• No patient details — there are no patient-name or NHI fields, and if someone accidentally types one into the notes, the app flags it as they type.
• The AI never sees a patient — only the drug name, the type of near miss, and the contributing factors are sent. Nothing that identifies a person, and your data isn't used to train the AI.
• Your data stays put — stored encrypted in Australia (Sydney), locked to your pharmacy, passwords never held in plain text.
• You stay in control — turn the AI off entirely and the tool still does its job.

It's designed around the NZ frameworks that apply to a pharmacy — the Privacy Act 2020 and the Health Information Privacy Code — though it's a tool to support your obligations, not a replacement for them, and it isn't certified by any regulator.

The point: using AI in a pharmacy and protecting patient privacy aren't opposites. You just have to design for both from the very start.

What's your biggest worry about data and AI in the pharmacy? 👇

#PatientSafety #Pharmacy #CommunityPharmacy #NZPharmacy #DataPrivacy #HealthTech #Pharmacist #PrivacyAct

---

## Notes

- Every claim in Post 5 matches what the app actually does (anonymous records, no patient fields + PHI scanner, AI receives only drug/error/factors and no identifiers, Supabase Sydney, per-pharmacy isolation, hashed passwords, AI can be disabled). Keep it that way — don't add claims the product doesn't back up, and never imply regulator certification.
- Matching brand graphics: reuse `nearmiss-general.png` (no logo) for the pain/benefit posts, `nearmiss.png` (with logo) for the AI/security posts. Per-post custom graphics can be generated on request.
