# 001 — Bring-your-own Gemini key in localStorage

Date: 2026-01-27 (recorded 2026-09-08) — Status: accepted

## Context

The app calls the Gemini REST API but ships as a static, serverless bundle
(AI Studio export / GitHub-hostable). Someone has to hold an API key, and
the target users are students using the app casually, possibly on a shared
machine.

## Decision

Bring-your-own-key: the first screen is a "BiblioBlaster Setup" gate that
instructs the user to create a free key at Google AI Studio, validates it
loosely (starts with `AIza`, trimmed length >= 30), and stores it in
`localStorage` under `gemini_api_key`. A "Change Key" button clears it and
resets the session. The key travels as a URL query parameter on the Gemini
`generateContent` calls. Loose validation was chosen deliberately (comment
in code: "relaxed ... to be robust against slight variations") after a
stricter format check caused false rejections; a closure-staleness bug led
to hoisting the validator to module scope.

## Consequences

- No server, no billing for the maintainer, no proxy to maintain.
- The key is visible to the user's own browser profile only, but IS passed
  as a query string on fetches (fine for Google's API, worth knowing).
- `vite.config.ts` still defines `process.env.API_KEY` /
  `process.env.GEMINI_API_KEY` from a `GEMINI_API_KEY` env name — a
  leftover parallel path from the AI Studio template; the runtime flow
  uses localStorage, not env.
- `INVALID_API_KEY` (detected by string-matching 400 responses that mention
  "API key") is the one error with bespoke UI ("Fix API Key" button).
