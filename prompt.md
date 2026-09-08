# prompt.md — one-shot recreation spec for BiblioBlaster 3000

Give this entire document to a capable coding agent to rebuild the app from
scratch. Everything needed is specified below.

## Goal

Build **BiblioBlaster 3000**, a single-page, serverless web app that reviews
a student's paper against the *Chicago Manual of Style* (17th Edition,
Notes & Bibliography system) and returns gamified, kid-friendly feedback:
a 0–100 "Biblio-Score", per-citation verdicts with copyable corrections,
and confetti for excellent papers. The user brings their own Gemini API
key; nothing is stored on any server.

## Stack

- React 19 + TypeScript (~5.8, permissive config: `allowJs`, no `strict`,
  `moduleResolution: "bundler"`, `jsx: "react-jsx"`, `noEmit`)
- Vite 6 with `@vitejs/plugin-react`; dev server on port 3000,
  host `0.0.0.0`; path alias `@` -> repo root
- Tailwind CSS loaded from CDN (`cdn.tailwindcss.com`) — no
  `tailwind.config.js`, no PostCSS
- Fredoka font (weights 300/400/600) from Google Fonts; body background
  `#f8fafc` (slate-50)
- Runtime deps: `react`, `react-dom`, `react-confetti@6.1.0`,
  `mammoth@1.6.0`, `lottie-react@2.4.0`, `react-markdown@9.0.1`
  (also pinned in an `index.html` esm.sh import map)
- Gemini REST API, base
  `https://generativelanguage.googleapis.com/v1beta/models`, model
  `gemini-3-flash-preview`, endpoint `:generateContent?key=<KEY>`

## File layout to produce

```
index.html                   Shell (Tailwind CDN, import map, fonts, keyframes)
index.tsx                    createRoot + StrictMode mount on #root
App.tsx                      Whole UI + orchestration
components/CitationCard.tsx  One reviewed citation
services/geminiService.ts    analyzeBibliography + extractTextFromImage
types.ts                     Domain types + AppStatus enum
vite.config.ts tsconfig.json package.json .gitignore metadata.json
```

## Data model (types.ts)

```ts
interface CitationReview {
  originalText: string;
  status: 'correct' | 'incorrect';
  correction?: string;
  feedback: string;   // short, fun explanation
  emoji: string;
  primaryAuthor?: string;   // bibliography only; last name for cross-check
  foundInText?: boolean;    // computed client-side
  section?: 'bibliography' | 'footnote';
}
interface AnalysisResult {
  overallScore: number;      // 0-100
  bibliographyReviews: CitationReview[];
  footnoteReviews: CitationReview[];
  summaryMessage: string;    // short encouraging sentence
}
enum AppStatus { IDLE, READING_IMAGE, ANALYZING_TEXT, FETCHING_AI, COMPLETE, ERROR }
```

## APIs (services/geminiService.ts)

### `analyzeBibliography(bibliographyText: string, footnotesText: string | null, apiKey: string): Promise<AnalysisResult>`

- POST to `{BASE_URL}/{MODEL_NAME}:generateContent?key=<key>`,
  JSON body with `contents[0].parts[0].text` = the review prompt.
- `generationConfig`: `responseMimeType: "application/json"`,
  a `responseSchema` (REST schema format, types spelled `OBJECT`, `STRING`,
  `NUMBER`, `ARRAY`) requiring `overallScore`, `summaryMessage`,
  `bibliographyReviews[]` (fields: `originalText`, `status` enum
  `correct|incorrect`, `correction`, `primaryAuthor` — required:
  originalText, status, feedback, emoji, primaryAuthor) and
  `footnoteReviews[]` (same minus primaryAuthor), and
  `temperature: 0.2`.
- `safetySettings`: all four harm categories at `BLOCK_NONE` (academic
  history topics must not be blocked).
- `systemInstruction`: "helpful, high-energy coding assistant for kids.
  You love Chicago Style citations."
- Prompt persona: "BiblioBlaster", fun energetic robot for kids. Rules:
  Bibliography — check punctuation/formatting/alphabetization, extract
  primary author. Footnotes — first citation of a source must be LONG FORM
  (full details, commas for periods, specific pages); subsequent citations
  SHORT FORM (Author, *Title*, page); immediate consecutive repeats must
  use `Ibid.` / `Ibid., page`; be strict about sequence. Feedback SHORT and
  FUN, kid language ("Oopsie!", "Nailed it!", "Forgot the Ibid!"); messy
  entries get the fix in `correction`. The footnotes/bibliography text is
  interpolated into triple-quoted labeled blocks; missing sections become
  `=== NO FOOTNOTES FOUND ===` / `=== NO BIBLIOGRAPHY FOUND ===`.
- Response handling: read `candidates[0].content.parts[0].text`,
  `JSON.parse` into `AnalysisResult`; empty -> throw "No response from AI".
- HTTP 400 whose message contains "API key" -> throw sentinel
  `new Error("INVALID_API_KEY")`; other failures rethrow message.

### `extractTextFromImage(base64Data: string, mimeType: string, apiKey: string): Promise<string>`

- Same endpoint; `contents[0].parts` = `inline_data` (mime_type, base64
  data) + instruction text: "Transcribe all the text from this document
  accurately. Preserve newlines and basic formatting. If you see footnotes
  at the bottom, include them clearly."
- Same `INVALID_API_KEY` contract; prefix failures with "I couldn't read
  that image! Try a clearer picture."

## App behavior (App.tsx)

### API-key gate

- On mount, read `localStorage['gemini_api_key']`; valid per
  `isValidKeyFormat` (trimmed, starts with `AIza`, length >= 30; validator
  at module scope — deliberately loose) -> skip gate.
- Gate screen: rotated 1deg card that straightens on hover, bouncing robot
  emoji, 4-step numbered instructions to create a free key at
  `https://aistudio.google.com/app/apikey` (starts with `AIza`), password
  input (Enter submits), sky-colored "Start Blasting! 🚀" button, inline
  error box on invalid format.
- "Change Key" (header) clears storage + all state, returns to gate.

### Input

- Big monospace textarea (h-80) with gradient glow ring; paste, drag-drop
  (overlay: sky backdrop, "DROP IT LIKE IT'S HOT!"), and clipboard-file
  paste all funnel into `processFile`.
- File types: images -> `READING_IMAGE` status -> `extractTextFromImage`;
  `.docx` (mammoth `extractRawText({ arrayBuffer })`, also reuses
  READING_IMAGE status) -> raw text appended; `text/plain`, `.txt`, `.md`
  -> plain append; anything else -> friendly error. Extracted text is
  appended to existing textarea content with `\n\n`.
- "Try the 'History of Space' Example" button loads a bundled sample paper
  (body with numbered markers `[1]`.., `## Notes` with 7 footnotes
  including two `Ibid.`/short-form cases, `## Bibliography` with 3 entries,
  one containing deliberate errors).
- Clear button (X) on textarea; "Check Another Paper" resets after results.

### Analysis flow (`handleReview`)

1. Empty input -> error "Please paste your report or drop a file first."
2. Match `BIBLIOGRAPHY_REGEX` = `(?:^|\n)\s*(?:#{1,6}\s*)?(?:[\*_~]*)(?:Bibliography|References|Works Cited|Sources)(?:[\*_~]*)(?:\s*:)?\s*(?:\n|$)` (case-insensitive) and `FOOTNOTES_REGEX` = same shape matching
   `Notes|Footnotes|Endnotes`. Neither found -> error telling user to
   title sections clearly.
3. Slice each section (up to the other section's start, else EOF); body =
   everything before the first section, lowercased.
4. Combined citation text > 50,000 chars -> error asking to trim.
5. `FETCHING_AI` -> `analyzeBibliography`; then client-side cross-check:
   for each bibliography review, `found = body.includes(review.primaryAuthor.toLowerCase())`.
6. `COMPLETE`: render results, smooth-scroll to them; if
   `overallScore >= 90` fire confetti (500 pieces, colors sky/emerald/
   amber/rose, gravity 0.2) for 5 seconds.
7. Errors: `INVALID_API_KEY` -> friendly key message + "Fix API Key"
   button; others show raw message.
8. Global shortcut: Cmd/Ctrl+Enter triggers review when text exists and
   status is IDLE/COMPLETE/ERROR.

### Loading overlay

Full-screen white overlay for READING_IMAGE / ANALYZING_TEXT / FETCHING_AI:
Lottie rocket (fetched once from
`https://assets9.lottiefiles.com/packages/lf20_96bovdur.json`, looped; CSS
spinner fallback if fetch fails) above a rotating joke message (change
every 2500ms, e.g. "Scanning for missing commas... 🧐", "Beep boop...
looking for Ibid... 🤖", "Consulting the library ghosts... 👻", "Teaching
the robot Chicago style... 📚") and an uppercase "Processing your
citations..." caption.

### Results

- Dark score card (slate-800, stardust texture, sky-to-emerald gradient
  clip-text score, pill label "Biblio-Score") showing `overallScore` and
  quoted `summaryMessage`.
- Two columns: Footnotes (emerald accents) and Bibliography (sky accents),
  each with count pill and empty-state dashed box.
- Each `CitationCard`: emoji, CORRECT (emerald) / NEEDS EDIT (rose) badge,
  optional FOUND REF / TEXT REF MISSING? badge, monospace original
  (struck-through + faded when incorrect) rendered with `react-markdown`,
  green "Correction" block with copy-to-clipboard button (shows checkmark
  2s), italic feedback line rendered as Markdown.

### Design language

Playful kid-robot: slate-50 canvas with a `transparenttextures.com` cubes
pattern, white rounded-2xl cards with thick borders, heavy `font-black`
headings, sky-500 primary color, emerald/amber/rose accents, sticky white
header with 4px sky bottom border, hover lifts/rotates, kbd-styled
shortcut hint, `animate-fade-in` on results/overlay.

## Vite config specifics

`define` maps `process.env.API_KEY` and `process.env.GEMINI_API_KEY` from
env name `GEMINI_API_KEY` (loaded via `loadEnv(mode, '.', '')`). Alias
`@` -> project root. (Runtime key flow is the localStorage gate; env
defines are a template leftover, kept for parity.)

## Phased build order

1. Scaffold Vite + React + TS project; `index.html` with Tailwind CDN,
   Fredoka, import map, fade-in keyframes; `types.ts`.
2. `services/geminiService.ts`: schema, safety settings, prompt, both
   functions, error contract.
3. Key gate + localStorage persistence + loose validator.
4. Input surface: textarea, drag/drop, paste-files, `processFile` (image
   OCR, DOCX, txt/md), example loader, clear.
5. `handleReview`: regex split, guards, AI call, cross-check, states.
6. Results UI: score card, two columns, `CitationCard` (markdown +
   clipboard), confetti, scroll, shortcuts, loading overlay + jokes +
   Lottie.
7. Polish: metadata.json, README, .gitignore; verify `npm run build`.

## Acceptance criteria

1. `npm install && npm run dev` serves on port 3000; `npm run build`
   exits 0.
2. With no stored key, the setup gate appears; a non-`AIza` key is
   rejected inline; a valid key persists across reloads; "Change Key"
   fully resets.
3. The example paper loads; Cmd/Ctrl+Enter (or the ANALYZE button)
   produces a score card, populated Footnotes and Bibliography columns,
   and at least one NEEDS EDIT card with a copyable correction (clipboard
   receives the corrected string).
4. The example's `Ibid.` footnotes and short-form notes are specifically
   evaluated (prompt rules visible in feedback wording).
5. A bibliography entry whose author never appears in the body shows
   "TEXT REF MISSING?".
6. Score >= 90 triggers confetti; loading overlay shows rocket + rotating
   jokes during the AI call.
7. Dropping a `.docx` appends its text; an unsupported file shows the
   friendly error; input with no recognizable section headers errors with
   the "title them clearly" message; >50k citation text errors with the
   trim message.
8. No API key or secret values appear in the repo; only the env NAME
   `GEMINI_API_KEY` is referenced.
