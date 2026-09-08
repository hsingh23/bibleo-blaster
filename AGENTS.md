# AGENTS.md — working guide for coding agents

## Commands

- `npm install` — install dependencies (no lockfile is committed; expect
  floating semver resolution)
- `npm run dev` — Vite dev server on port 3000, host `0.0.0.0`
- `npm run build` — production build (the only real "does it compile" check)
- `npm run preview` — serve the built bundle

There are **no tests, no linter, and no CI** in this repo. `npm run build`
(exit code) is the closest thing to a verification gate.

## Architecture map

```
index.html                 Shell: Tailwind CDN, esm.sh import map, Fredoka font
  └─ index.tsx             ReactDOM.createRoot, StrictMode
       └─ App.tsx          Everything else (single 641-line component)
            ├─ services/geminiService.ts   Gemini REST: analyzeBibliography,
            │                              extractTextFromImage (OCR)
            └─ components/CitationCard.tsx One reviewed citation
types.ts                   CitationReview / AnalysisResult / AppStatus (enum)
```

### Data flow

1. User supplies a Gemini API key (gate screen); validated loosely
   (`starts with 'AIza'` and length >= 30) and persisted in `localStorage`
   under `gemini_api_key`.
2. Input arrives via paste, drag-and-drop, or clipboard-file paste:
   images -> Gemini OCR (`extractTextFromImage`), `.docx` ->
   `mammoth.extractRawText`, `.txt`/`.md` -> `FileReader`. Extracted text is
   appended to the textarea.
3. `handleReview` splits the text with `BIBLIOGRAPHY_REGEX` and
   `FOOTNOTES_REGEX` (module-level regexes in `App.tsx`) into body /
   Notes / Bibliography; rejects inputs whose citation sections exceed 50k
   characters.
4. `analyzeBibliography` POSTs the citation sections to Gemini
   (`gemini-3-flash-preview`, `temperature: 0.2`, JSON `responseSchema`,
   all safety thresholds `BLOCK_NONE`) and parses the strict-JSON reply.
5. Client-side cross-check: each bibliography `primaryAuthor` is
   lowercased and searched in the body text -> `foundInText` flag.
6. Results render as two columns (Footnotes, Bibliography) of
   `CitationCard`s; `overallScore >= 90` fires confetti for 5s.

### State

`AppStatus` enum drives the UI: `IDLE -> ANALYZING_TEXT -> FETCHING_AI ->
COMPLETE | ERROR` (plus `READING_IMAGE` reused for OCR *and* DOCX parsing).
Loading overlay shows for the three busy states.

## Conventions

- Conventional Commit subjects, imperative mood, <= 72 chars (history was
  rewritten on 2026-09-08 to enforce this; see CHANGELOG.md).
- One functional component per file under `components/`; services under
  `services/`; shared types in root `types.ts`.
- Tailwind utility classes inline; custom font (`Fredoka`) and the
  `animate-fade-in` keyframes live in `index.html`.
- Comments in code are English, informal/kid-toned in user-facing strings.

## Gotchas

- **Tailwind is CDN-loaded** (`cdn.tailwindcss.com` in `index.html`). There
  is no `tailwind.config.js` and no PostCSS pipeline — don't assume one.
- **esm.sh import map** in `index.html` coexists with the same deps in
  `package.json` (AI Studio export convention). Vite bundles from
  `node_modules`; the import map mainly serves the raw-AI-Studio preview.
  Keep both lists in sync when adding a dependency.
- `mammoth` usage carries an `@ts-ignore`; `tsconfig.json` is permissive
  (`allowJs`, no `strict`). Don't tighten TS config casually.
- `Party Dance.lottie` is committed but unused — the rocket animation is
  fetched at runtime from `assets9.lottiefiles.com` with a CSS-spinner
  fallback.
- The API key lives in `localStorage` only; `vite.config.ts` also defines
  `process.env.API_KEY` / `process.env.GEMINI_API_KEY` from
  `GEMINI_API_KEY`. Env var NAME only in docs — never commit a value.
- Error contract: services throw `Error("INVALID_API_KEY")` for 400s
  mentioning "API key"; `App.tsx` string-matches that message.
- Regexes were deliberately moved to module scope to avoid closure
  staleness and were relaxed to tolerate Markdown decoration — preserve
  that when editing.

## Verify changes

1. `npm run build` exits 0.
2. `npm run dev`, paste the built-in "History of Space" example, run an
   analysis with a valid key, and confirm: score card renders, both columns
   populate, an incorrect citation shows a strikethrough original plus a
   copyable correction.

## Pointers

- One-shot recreation spec: `prompt.md`
- History: `CHANGELOG.md` (includes the 2026-09-08 messages-only history
  rewrite note)
- Decision records: `architectural-diary/decisions/`
- Narrative: `architectural-diary/main.md`
