# Changelog

All notable changes to BiblioBlaster 3000. Newest first.

> **History note (2026-09-08):** Commit messages were improved via a
> messages-only history rewrite (`git filter-branch --msg-filter`). Tree
> contents and commit count are unchanged; only messages differ. Hashes below
> are the post-rewrite hashes. A pre-rewrite snapshot branch,
> `backup/pre-docs-20260908`, exists locally for reference.

## 2026-01-27 — db90523 (previously 11be69c)

**feat: Initialize BiblioBlaster 3000 project structure**

- Adds the full application in one commit: Vite + React 19 + TypeScript
  scaffold (`package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
  with Tailwind CDN + esm.sh importmap, `index.tsx`, `.gitignore`).
- Implements the complete Chicago-style citation checker in `App.tsx`:
  BYO Gemini key (localStorage), regex extraction of Notes/Bibliography
  sections, drag-and-drop/paste ingestion of `.docx` (mammoth), `.txt`,
  `.md`, and images (Gemini OCR), Lottie rocket loading overlay, confetti
  on scores >= 90, and Cmd/Ctrl+Enter to analyze.
- Adds `services/geminiService.ts` (Gemini REST calls with strict JSON
  response schema + image transcription), `components/CitationCard.tsx`
  (per-citation results with copy-to-clipboard corrections), `types.ts`
  (core domain types and `AppStatus`), `metadata.json`, the
  `Party Dance.lottie` asset, and README run instructions.

## 2026-01-27 — 5bb8fcf (previously 2233f1e)

**docs: add AI Studio boilerplate README**

- Seeds the repository with the AI Studio app-export README containing the
  "Built with AI Studio" banner and link. No application code yet.
