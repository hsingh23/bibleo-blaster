# Architectural Diary — BiblioBlaster 3000

## What this app is

BiblioBlaster 3000 is a single-page, client-only web app that reviews a
student's paper against the *Chicago Manual of Style* (17th ed.,
Notes & Bibliography). It was generated/exported from Google AI Studio and
landed in this repository essentially whole, in one big commit. There was no
iterative design history inside the repo — the "history" is the set of
decisions baked into that export, recorded here after the fact.

## Timeline

- **2026-01-27 — repo seeded (5bb8fcf, was 2233f1e).** README only: the AI
  Studio "Built with AI Studio" boilerplate. No code.
- **2026-01-27 — the app lands (db90523, was 11be69c).** The complete
  Vite + React + TypeScript project: `App.tsx` (641 lines, the whole UI),
  `services/geminiService.ts` (Gemini REST with strict JSON schema),
  `components/CitationCard.tsx`, `types.ts`, build config, and assets.
- **2026-09-08 — documentation pass.** Messages-only history rewrite
  (one weak message improved; hashes changed, trees did not — see
  CHANGELOG.md), then README/AGENTS/CHANGELOG/prompt.md and this diary
  were added.

## Shape of the system

One component tree, no router, no state library, no server. `App.tsx` owns
all state (`useState`/`useRef`) and orchestrates: key gate -> text
ingestion (paste / DOCX / image OCR) -> regex section split -> Gemini call
-> client-side cross-check -> results render. `CitationCard` is a pure
display component per reviewed citation; `geminiService` is the only
network layer. The `AppStatus` enum is the single UI state machine.

## Decisions

Numbered records in `decisions/`:

1. [001 — Bring-your-own Gemini key in localStorage](decisions/001-byok-gemini-key-in-localstorage.md)
2. [002 — Client-side section extraction before the AI call](decisions/002-client-side-section-extraction.md)
3. [003 — Structured JSON Gemini output with relaxed safety filters](decisions/003-structured-json-gemini-output.md)
4. [004 — CDN Tailwind + esm.sh import map from the AI Studio export](decisions/004-cdn-tailwind-and-esm-importmap.md)

## Regrets / open threads

- `App.tsx` is a single 641-line component; extraction logic (regexes,
  splitting) would be cleaner in its own module if the app grows.
- `Party Dance.lottie` is committed but unused; the rocket animation is
  fetched from a remote Lottie URL at runtime.
- No tests, no lockfile, no CI; `npm run build` is the only gate.
- DOCX parsing reuses the `READING_IMAGE` status, so the loading overlay
  copy is slightly misleading for Word files.
