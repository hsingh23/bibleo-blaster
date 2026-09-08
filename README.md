# BiblioBlaster 3000

A fun, high-energy **Chicago Style citation checker** for students. Paste a
report (or drop a `.docx` / image of it), and a kid-friendly AI robot reviews
the Bibliography and Footnotes/Notes sections against the *Chicago Manual of
Style* (17th Edition, Notes & Bibliography system): formatting, long-form vs
short-form citations, `Ibid.` usage, and whether each bibliography entry is
actually referenced in the paper.

## Why

Citation rules (first citation = long form, subsequent = short form,
consecutive = `Ibid.`) are fiddly and citation checkers in word processors
don't explain mistakes to kids. BiblioBlaster 3000 gamifies the review: a
0–100 "Biblio-Score", confetti for scores >= 90, short emoji-tagged feedback
per citation, and one-click copyable corrections.

## Features

- **Paste, drop, or paste-file input** — plain text, `.docx` (extracted with
  mammoth), `.txt` / `.md`, and photos of papers (OCR via Gemini vision).
- **Section extraction before AI** — regex finds `Bibliography` /
  `References` / `Works Cited` / `Sources` and `Notes` / `Footnotes` /
  `Endnotes` headers (tolerating Markdown bold/italic/heading decoration),
  so only the citation sections are sent to the model (token savings, with a
  50k-character cap).
- **AI review with strict JSON output** — Gemini returns a typed review
  (status, correction, feedback, emoji) shaped by a response schema.
- **Cross-reference check** — each bibliography entry's primary author is
  searched for in the body text client-side; unreferenced entries get a
  "TEXT REF MISSING?" badge.
- **Fun UX** — rotating joke loading messages, Lottie rocket animation,
  full-screen loading overlay, confetti at 90+, "Try the History of Space"
  example paper, Cmd/Ctrl+Enter shortcut.
- **BYO key** — users paste their own free Google AI Studio API key; it is
  stored in `localStorage` (no server, no key on any server).

## Stack

- React 19 + TypeScript ~5.8, Vite 6 (`@vitejs/plugin-react`)
- Tailwind CSS via CDN (`cdn.tailwindcss.com`) + Fredoka font
- esm.sh import map for `react`, `react-dom`, `react-confetti`, `mammoth`,
  `lottie-react`, `react-markdown` (AI Studio export convention; Vite also
  resolves these from `package.json` for local dev/build)
- Gemini REST API (`generativelanguage.googleapis.com/v1beta`, model
  `gemini-3-flash-preview`) with JSON response schema

## Quickstart

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` environment variable name in `.env.local` (names
   only are needed by the Vite config; the app itself asks for a key at
   runtime and keeps it in `localStorage`)
3. Run the app:
   `npm run dev`

Then open the printed local URL (Vite serves on port 3000), paste your
Google AI Studio API key (starts with `AIza`), and blast some citations.

Other scripts: `npm run build` (production bundle), `npm run preview`.

## Project structure

```
App.tsx                     Entire UI: key gate, input, analysis flow, results
components/CitationCard.tsx Per-citation card (status, correction, copy, feedback)
services/geminiService.ts   Gemini REST calls: analyzeBibliography, extractTextFromImage
types.ts                    CitationReview, AnalysisResult, AppStatus
index.tsx                   React root mount (StrictMode)
index.html                  Tailwind CDN, import map, fonts, fade-in keyframes
vite.config.ts              Port 3000, '@' alias to repo root, env defines
metadata.json               Google AI Studio app metadata
Party Dance.lottie          Bundled Lottie asset (rocket animation is fetched remotely)
```

## Origin

Exported from Google AI Studio — original app:
https://ai.studio/apps/drive/1CaEeVZvvfxkz_qG88wB0HuXi4SJbC59l

See [CHANGELOG.md](CHANGELOG.md) for history, [AGENTS.md](AGENTS.md) for
working conventions, [prompt.md](prompt.md) for a one-shot recreation spec,
and [architectural-diary/](architectural-diary/) for design decisions.
