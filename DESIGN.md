# Kickoff design rules

The rules behind the Kickoff UI, each with its reason. They follow
[Emil Kowalski’s design-engineering skills](https://github.com/emilkowalski/skills)
(installed in `.claude/skills`); when you change the UI, keep to these or update this file.

## Colour

| Rule                                                                                                | Why                                                                                   |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Red `#DC052D` is the one accent: primary actions, “you”, live states.                               | One loud colour reads as brand; two read as noise.                                    |
| Bayern blue `#0066B2` is the supporting colour: info, U-Bahn, second chart series, recovered seats. | It is Bayern’s second colour and separates cleanly from red for colour-blind viewers. |
| Slate is “today / baseline” in charts.                                                              | Comparison series should recede so the Fair Seat line leads.                          |
| Surfaces use tokens (`ink-950 … ink-600`, `fg`, `fg-2`, `fg-3`), never hex in components.           | One set of utilities renders both themes; hex values break dark mode.                 |
| Cards use a 1px shadow ring, not a border.                                                          | A semi-transparent ring blends with any background; a solid border looks pasted on.   |
| Status text uses `text-ok / text-warn / text-bad / text-info`.                                      | These are tuned to ≥ 4.5:1 on cards in both themes.                                   |

## Type

| Rule                                                                                 | Why                                                                                |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| Inter Variable everywhere, display sizes at `-0.035em` tracking (`display` utility). | Inter’s optical sizes tighten automatically; large headings need tighter tracking. |
| All changing numbers use `tabular` (or NumberFlow).                                  | Digits must not jitter when values change.                                         |
| Body copy is `text-pretty`, headings `text-balance`, leads capped near 65ch.         | No orphans, comfortable line length.                                               |

## Motion

| Rule                                                                                                                              | Why                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Easing tokens: `--ease-out` (enter/exit), `--ease-in-out` (on-screen movement), linear only for constant motion. Never `ease-in`. | `ease-in` delays the moment the user is watching.                                   |
| UI transitions 150–300 ms; press feedback `scale(0.97)` at 160 ms (`press` utility).                                              | Responsiveness is perceived in the first frames.                                    |
| Animate `transform`, `opacity`, `clip-path` only. Bars scale with `scaleX`, not `width`.                                          | Compositor-only properties stay smooth while the page is busy.                      |
| No animation on keyboard-initiated changes (segmented arrows move instantly).                                                     | Repeated actions must feel instant.                                                 |
| One entrance per container; stagger only small groups (≤ 300 ms total).                                                           | Users should never wait for choreography.                                           |
| Lists that grow (chat, engine log, alerts) animate only new items (`AnimatePresence initial={false}`).                            | History must not replay on mount.                                                   |
| Springs (`bounce` ≤ 0.25) only for rare celebratory moments: ticket reveal, push offer.                                           | Delight belongs to rare events, not everyday controls.                              |
| Number animations finish before the next update (hero counter: 300 ms roll, 560 ms cadence).                                      | A number that is always mid-roll cannot be read.                                    |
| Explanatory loops pause off-screen; `prefers-reduced-motion` keeps fades and drops movement and loops.                            | Motion should explain, never cost attention or comfort.                             |
| Inline transform values are rounded (`toFixed(4)`).                                                                               | Browsers serialise floats differently; unrounded values cause hydration mismatches. |

## Feedback

| Rule                                                                                              | Why                                                                      |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Toasts (Sonner) only for actions without a visible result: copy, smart picks applied, demo reset. | A toast that repeats what is on screen covers the next action on phones. |
| AI text always carries its source badge (Gemini / Demo AI / safe fallback).                       | Trust: the fan always knows what wrote the sentence.                     |
| Loading keeps the old content, softened (`opacity-50 blur-[1.5px]`), instead of a skeleton flash. | No layout jump while a new answer arrives.                               |

## Mobile

| Rule                                                                                        | Why                                                                                             |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No tap highlight, `touch-action: manipulation`, `user-select: none` on controls only.       | Removes the “website in a browser” tells without blocking copy of content.                      |
| Inputs are 16 px on coarse pointers.                                                        | iOS zooms into smaller inputs and never zooms back.                                             |
| `viewport-fit=cover` + `env(safe-area-inset-*)` on the header and menus.                    | Content clears the notch and home indicator.                                                    |
| Grid/flex children that hold wide content get `min-w-0`; decorations live in clipped boxes. | One over-wide element silently widens the mobile layout viewport (the e2e checks device width). |
| Device frames disappear below `sm`.                                                         | A phone drawn inside a phone wastes the screen.                                                 |

## Language

| Rule                                                                                                                           | Why                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Every UI string lives in `lib/i18n/messages/{en,de}.ts`; `de` is typed as `Messages`.                                          | The compiler catches a missing translation.                                                   |
| Engine output is localised from structured facts (`lib/i18n/domain.ts`, `lib/i18n/journey.ts`), not by editing engine strings. | The engines’ tests pin their English; numbers must stay byte-identical for the numbers guard. |
| Facts are localised before they reach Gemini or the templates.                                                                 | Replies never mix languages.                                                                  |
