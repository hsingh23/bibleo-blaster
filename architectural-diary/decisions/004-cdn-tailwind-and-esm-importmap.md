# 004 — CDN Tailwind + esm.sh import map from the AI Studio export

Date: 2026-01-27 (recorded 2026-09-08) — Status: accepted (as-is)

## Context

The app originated as a Google AI Studio export. AI Studio previews run in
a browser sandbox where dependencies load from CDN import maps rather than
a bundler. The export therefore carries both CDN wiring and a normal
`package.json` for local Vite development.

## Decision

Keep the export's dual setup rather than normalize it:

- `index.html` loads Tailwind from `https://cdn.tailwindcss.com` (no
  `tailwind.config.js`, no PostCSS), loads the Fredoka font from Google
  Fonts, and defines an `<script type="importmap">` pinning `react`,
  `react-dom`, `react-confetti`, `mammoth`, `lottie-react`, and
  `react-markdown` to esm.sh builds.
- The same libraries are also declared in `package.json`, so Vite resolves
  them from `node_modules` for `npm run dev` / `build`.
- Small custom CSS (`.animate-fade-in` keyframes, body font/background)
  lives inline in `index.html`.

## Consequences

- Zero build config for styling; class changes apply instantly in the AI
  Studio-style preview.
- Two sources of truth for dependency versions — adding a dependency
  means updating both `package.json` and the import map (or accepting the
  map is only for CDN-style preview).
- `mammoth`'s `@ts-ignore` and the permissive `tsconfig.json` are part of
  the same "keep the export working as-is" stance.
- CDN Tailwind is a development-style runtime; fine for a toy tool, not a
  production-hardened choice.
