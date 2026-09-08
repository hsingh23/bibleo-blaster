# 003 — Structured JSON Gemini output with relaxed safety filters

Date: 2026-01-27 (recorded 2026-09-08) — Status: accepted

## Context

The review UI needs machine-usable data: a numeric score, a per-citation
list with status/correction/feedback, and predictable error handling. Free
text from an LLM would need fragile parsing. Separately, history papers
(war, disease, politics) can trip harm filters.

## Decision

`services/geminiService.ts` calls
`POST {BASE_URL}/{MODEL_NAME}:generateContent` (model
`gemini-3-flash-preview`) with:

- `generationConfig.responseMimeType: "application/json"` plus a
  hand-written `reviewSchema` (Gemini REST schema format) requiring
  `overallScore`, `summaryMessage`, `bibliographyReviews[]`
  (`originalText`, `status` in {correct, incorrect}, optional
  `correction`, `primaryAuthor`, `feedback`, `emoji`) and
  `footnoteReviews[]` (same minus `primaryAuthor`).
- `temperature: 0.2` for near-deterministic reviewing.
- `safetySettings` with all four harm categories at `BLOCK_NONE`
  (code comment: academic topics like wars and biology were being
  blocked).
- A system instruction ("high-energy ... assistant for kids") and a
  detailed Chicago-rules prompt: first citation of a source must be long
  form, subsequent ones short form, immediate repeats must use `Ibid.`.

The reply is read from `candidates[0].content.parts[0].text` and
`JSON.parse`d directly into `AnalysisResult`. A sibling function,
`extractTextFromImage`, uses the same endpoint for OCR with a transcription
prompt. Both map 400 responses mentioning "API key" to a sentinel
`INVALID_API_KEY` error.

## Consequences

- The UI can rely on typed shape; no response-text parsing heuristics.
- Prompt + schema encode the entire "grading rubric" — Chicago strictness
  changes happen in the prompt string only.
- `BLOCK_NONE` trades away guardrails for availability; acceptable here
  because input is the user's own document and the persona is fixed.
- Model name is hardcoded; a future model rename is a one-constant change.
