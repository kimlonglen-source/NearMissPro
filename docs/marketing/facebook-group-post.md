# Facebook post — NZ community pharmacy group

De-spammed for reach: conversational (not an ad), NO link and NO price in the
post body — those go in the FIRST COMMENT. Post the screen recording as native
video. Facebook buries promo-looking posts and link posts in groups, even
mod-approved ones.

Waitlist link: https://tally.so/r/D4YgQl

---

## THE POST (paste this, attach the video, no link in the body)

Kia ora everyone,

A question I've been chewing on as a pharmacist: when we catch a near miss, what actually happens to it?

Most of the time we fix it, feel the relief, and get back to the queue. It might make it into the logbook — but that's usually the end of it, until the same one turns up again. Same look-alike box, same busy Friday.

It always bugged me that all that catching never really added up to anything. The logbook records what happened, but it never told us what was repeating, or whether the change we made last month made any difference.

So I've started building something to help — a simple way to log a near miss in seconds, see the patterns that keep coming back, and actually tell whether a change worked. The aim is prevention: stopping the same slip before it reaches a patient. No blame, no names.

It's early days. There's a short clip below showing how it works.

Mostly though, I'd genuinely love to hear from you: how does your pharmacy handle near misses at the moment? Does anything turn that logbook into real change — or does it just get fixed and forgotten?

---

## THE FIRST COMMENT (post this yourself, right after — useful tip + soft mention + question)

Something I reckon most of us don't get around to: after a near miss you'll make a change — shift a drug on the shelf, add an extra check — but then no one goes back to see if it actually helped. A month goes by, you're flat out with everything else, and it's forgotten. Even a quick count before and after would show you whether it worked.

That's pretty much why I started building NearMissPro — so you can tell whether last month's change actually brought the near misses down. Have a look if you like: https://tally.so/r/D4YgQl

Does your pharmacy ever get time to check if a change worked, or does the day just take over?

---

### Alternative first comments (rotate / pick per group)

**No-blame reporting:** Something we learned the hard way: the moment staff feel a near miss might come back on them, they quietly stop reporting — and you lose the very information that keeps patients safe. Making it anonymous and no-blame noticeably lifted how much our team logged. That's a big reason NearMissPro keeps every entry anonymous to the team. Early look if useful: https://tally.so/r/D4YgQl — how do you keep reporting blame-free in your pharmacy?

**Spot the patterns:** At the monthly check, don't just count near misses — group them. If the same drug or look-alike box turns up two or three times, that pattern is where the next real error is hiding. Fix the pattern (move the stock, add a warning label, separate the boxes) and you prevent a whole run of them. That's the itch I'm scratching with NearMissPro — it surfaces those repeats for you. Early look if useful: https://tally.so/r/D4YgQl — what's the one pattern that keeps coming back in yours?

---

## Why this reaches further
- No external link in the post body — links are the #1 reach-killer in FB groups.
- Conversational and question-led, not a feature list with a price (that reads as an ad).
- Post the screen recording as NATIVE video (upload it), don't link to it.
- Put the link + price in your own first comment.
- Reply to early comments quickly — engagement in the first hour drives reach.
- Don't edit the post straight after posting; edits can re-trigger review / hurt reach.

## Canned reply if someone asks about cost/AI
> Everyone gets the first 3 months free, then $30 + GST/month per pharmacy (about a dollar a day), cancel anytime. It also suggests simple fixes based on NZ best practice — but that's advisory only, the pharmacist stays in complete control. It earns its keep in time alone: seconds to log instead of writing it up, and the monthly review done in minutes instead of a whole evening.

## Planned pricing (keep consistent everywhere)
- Everyone gets the first 3 months free, then $30 NZD/month per pharmacy (or $300/year). Excl GST. Cancel anytime.

---

## Canned reply — "how is this different from [other app]? / who's behind it?"
(Stay gracious — never rubbish a competitor in a small community.)

> Good question! I haven't really looked at the other one, so I can't compare them fairly. This one's built by me, a NZ pharmacist, and it does just one thing — the near-miss cycle, kept fast and simple.
>
> Three things really: quick to log (a few taps, no essay), it suggests a fix based on NZ best practice (advisory only — you decide), and it writes the monthly report for you, so the meeting just closes the loop: did last month's change work, or not.
>
> Happy to answer anything else!

---

## Canned reply — security / data model due-diligence question (plain English)
(Answer honestly, match the actual build, be upfront that it's pre-launch and under
independent review. Never overclaim on security. No certification claims.)

> Really glad you asked — and honestly you've listed exactly the right things to check, so let me go through them in turn.
>
> Where it's hosted & keeping pharmacies separate: the data's on secure servers in Australia (Sydney) — the nearest region my provider offers, and a jurisdiction with privacy laws comparable to ours (not the US or Europe). Each pharmacy's data is completely walled off — one pharmacy can never see another's.
>
> Encrypted at rest: yes — encrypted both while it's stored and when it travels between your computer and the servers. Passwords are scrambled so even I never see them.
>
> 2FA: the admin login uses two-factor (an authenticator code). For pharmacy logins, any new device has to be approved by email first — so no one can log in from home with just the password. That "logging in from outside the pharmacy" worry was a big one for me.
>
> AI — is anything sent to a third party, kept, or used to train models: You can turn the external AI off completely — and you still get recommendations, they're just generated from built-in NZ best-practice logic with nothing leaving the system. When the AI is on, it only ever sees the drug name, the type of near miss, and the contributing factors — never patient details, and never who logged it. The provider doesn't keep that data or use it to train anything.
>
> Audit logs, backups, export & deletion if you leave: yes to all — a full activity log for your pharmacy, daily backups, you can download all your data any time, and if you ever leave, it's deleted on request.
>
> And underneath all of it: it's built not to hold patient details in the first place. No patient name or NHI fields anywhere, near misses are anonymous, and if someone types a patient detail into the notes by accident, it flags it on the spot.
>
> It's pre-launch, and I'm getting the whole set-up independently reviewed before any pharmacy puts real data in. Happy to go deeper on any of these.

### Justification for Sydney hosting (if challenged that it's "overseas")
Australia IS overseas from NZ — never claim otherwise. Justify: nearest region the
provider offers (no NZ region); Australia has comparable privacy law; chosen over
US/Europe; allowed under the Privacy Act 2020 with disclosure + safeguards (being
checked in the independent review); open to NZ-only if a pharmacy needs it.

### Notes on accuracy (keep it honest)
- Tenant isolation is enforced in the app on every request; RLS at the DB layer is being verified in the independent review — don't claim more than that.
- Founder/admin = TOTP 2FA. Staff = device approval (new device must be approved by email) — this is the deliberate choice, not a gap; don't promise per-staff 2FA.
- Backups depend on the Supabase plan — keep saying "daily backups via Supabase" only if that's your plan.
- Don't claim certifications you don't have.

---

## Canned reply — "why Sydney / isn't that overseas?" (short)

> Fair question — and yes, Sydney is technically overseas. Short version: it's the nearest region my hosting provider offers (there's no NZ option), and I picked Australia over the US or Europe on purpose. It has privacy laws comparable to ours, so your data stays well-protected and right next door. It's a common, accepted setup for NZ health and software products, allowed under the Privacy Act with the right safeguards — and I'm having the cross-border side checked in the independent review. If NZ hosting becomes available, I'll move to it.

---

## Canned reply — reassurance for anyone concerned about Sydney hosting

> If anyone's uneasy about the data being in Sydney, totally fair — here's the reassurance.
>
> The biggest one first: there are no patient details in there to worry about. No names, no NHI — near misses are anonymous by design. So it isn't patient records sitting offshore; it's anonymous safety data.
>
> On the hosting itself: Sydney is simply the nearest data centre my provider offers (there's no NZ region yet), and Australia has privacy laws comparable to ours — it's been the standard choice for NZ software, including in health. It's allowed under the Privacy Act with the right safeguards, which I'm having independently checked.
>
> And if a NZ hosting option opens up, or a pharmacy needs its data kept onshore, I'm happy to look at it.

---

## Canned reply — "you could just build a form / needs to be as fast as paper"
(Concede the speed point hard — it's valid and it's the north star. Reframe: the
form is the easy 10%, the value is the analysis + review loop. Never defensive.)

> Cheers — and you've nailed the most important point: if it's not as fast as the book, no one on the frontline will use it, and it's dead in the water. That's exactly the bar I'm building to — logging has to be a few taps and done, no slower than pen and paper. The connection/speed thing is on my radar too; it needs to be quick even on a flat-out day.
>
> You're also right that the form itself is dead simple — ChatGPT or a Google Form could knock one up. But honestly, the form was never the hard part, or the point. The value is what happens after you've logged them: it spots which near misses keep repeating, writes your monthly review for you, and tells you whether the change you made last month actually worked. A pile of entries in a CSV doesn't do that — someone still has to sit down and make sense of it, which is the bit no one has time for.
>
> So the goal's both: log it fast (your point, and non-negotiable), and let it do the analysis and the review so you don't have to.
>
> Genuinely appreciate the frontline take though — that's exactly the input I need. What would "fast enough" look like for you?
