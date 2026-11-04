# FC Bayern Fan AI-DEATION — submission answers

Ready to paste into the form (deadline **16 Nov 2026**). English; the app’s AI also writes German.

## What is the title of your idea?

**FCB Fair Seat — more fans in the Arena, never higher prices** (with the Matchday Journey Agent “Vom Sofa bis zum Sitz”)

## Summarize your idea briefly (≤ 1,000 characters)

> FCB Fair Seat makes the toughest ticket in football the fairest. Losglück mit System shows every member their odds before applying, adds a visible “Pechvogel” bonus for every unsuccessful application, suggests the matches where they are most likely to get in, and runs a publicly verifiable draw. Kein Platz bleibt leer predicts seats likely to stay empty, lets Gemini ask the season-ticket holder kindly, and with one tap passes the seat at face value to the next fan on the ballot waitlist, right up to kick-off. Vom Sofa bis zum Sitz plans the matchday: when to leave, U6 crowding, best gate and kiosk, and a staggered return around strikes or rain. For members, fan clubs, international fans and families. What makes it special: deterministic engines decide, Gemini only explains in the fan’s language, a numbers guard blocks invented figures, no dynamic pricing, no biometrics. Working prototype: ~+940 fans per match in our simulation.

## Category

**Ticketing** (also covers Stadium experience and Digital Fan Experience)

## Who is your idea intended for?

- [x] Fans in the stadium
- [x] Fans who follow games at home or on the road
- [x] Fans from Germany
- [x] International Fans
- [x] Members and Fan Clubs
- [x] Children and adolescents (youth fan-club seat gifting)
- [x] Families (group applications never split)
- [x] Fans with special needs (accessible-space priority, step-free routing)

## What is the most important benefit or added value?

More members see the Allianz Arena — without raising a single price. Every empty season seat that comes back is a fan who lost the ballot getting in at face value (≈ +940 fans per match, ≈ 16,000 per Bundesliga season in our model), and every “no” finally comes with odds, a reason and a better chance next time.

## What would be the first step to test your idea?

A pilot on one low-demand home match with 500 opt-in season-ticket holders: measure release rate, refill rate, minutes from release to a new fan, and satisfaction of both holders and receiving fans against today’s Ticket Exchange. In parallel, publish odds and per-Pechvogel win rates for one ballot phase and co-design the loyalty rules with the Fan Dialogue working group.

## What challenges might arise?

- [x] Data Protection — opt-in signals only, on-device estimate, no biometrics
- [x] Data Security — verifiable draws, server-side facts, rate limits
- [x] Technical Implementation — integration with the app-only ticket wallet and exchange
- [x] Acceptance among fans — fairness must be visible; prices never change
- [x] Multilingualism — Gemini writes in any language; demo templates EN/DE
- [x] Accessibility — accessible spaces prioritised; WCAG-tested UI

## Have you already developed anything for your idea?

**I have created a demo or a test** — a working web prototype with three products, a full-size verifiable ballot, a two-phone live seat-recycling demo, a journey agent with disruption re-planning, and an automated test suite (unit, property-based and end-to-end).

## On which AI model is your idea currently based?

**Google Gemini** (`gemini-flash-latest` via the official `@google/genai` SDK) for conversation, intent understanding (structured JSON) and multilingual letters/narration — grounded by deterministic, tested engines; a numbers guard verifies every figure Gemini writes.

## Upload

Attach: screenshots from `docs/screenshots/`, a short screen recording of the `/live` stage demo, and the repository link.
