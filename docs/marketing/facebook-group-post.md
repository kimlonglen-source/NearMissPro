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

## Canned reply — security / data model due-diligence question
(Answer honestly, match the actual build, be upfront that it's pre-launch and
under independent review. Never overclaim on security.)

> Really glad you asked — this is exactly the right question to ask before any real data goes in, and I take it seriously. Quick heads-up: it's pre-launch, and before any pharmacy loads real data I'm having the security and privacy set-up independently reviewed. Here's where it stands:
>
> Hosting & location: Data's in Supabase (managed PostgreSQL), hosted in Australia (Sydney) — not offshore to the US.
>
> Tenant separation: Yes — every request is scoped to the logged-in pharmacy, so one pharmacy can't see another's data. I'm having the database-level access rules independently verified too, as part of the review.
>
> Encryption: In transit (HTTPS) and at rest (Supabase's at-rest encryption). Passwords are hashed, never stored in plain text.
>
> 2FA: Admin access uses app-based 2FA (TOTP). Pharmacy logins use device verification — a new device has to be approved by email first, so a leaked password alone won't get anyone in. Per-user 2FA for staff is on the list.
>
> AI & third parties: AI is optional — you can switch it off entirely. When it's on, only the drug name, the type of near miss, and the contributing factors are sent to the provider (Anthropic). No patient identifiers and no staff identity — near misses are anonymous by design, and there are no patient-name/NHI fields at all. The provider doesn't use API data to train its models, and it isn't retained for training.
>
> Audit, backups, export & deletion: Yes to all — a per-pharmacy audit log, daily backups, you can export all your data any time, and if you leave, it's deleted on request.
>
> It's built around the NZ frameworks that apply — the Privacy Act 2020 and the Health Information Privacy Code — though it's a tool to support your obligations, not a substitute for them, and it's not certified by any regulator. Happy to go deeper on any of these, or share the independent review once it's done.

### Notes on accuracy (keep it honest)
- Tenant isolation is enforced in the app on every request; RLS at the DB layer is being verified in the independent review — don't claim more than that.
- Founder/admin = TOTP 2FA. Staff = device verification (email-approved). Per-user staff 2FA = roadmap, not built.
- Backups depend on the Supabase plan — keep saying "daily backups via Supabase" only if that's your plan.
- Don't claim certifications you don't have.
