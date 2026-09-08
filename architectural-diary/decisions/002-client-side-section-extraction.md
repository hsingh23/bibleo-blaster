# 002 — Client-side section extraction before the AI call

Date: 2026-01-27 (recorded 2026-09-08) — Status: accepted

## Context

Whole student papers can be long, but only two sections matter for citation
review: the Bibliography and the Footnotes/Notes. Sending entire papers to
the model wastes tokens and invites the model to wander. Headers also arrive
in varied forms (`## **Works Cited**`, `Notes:`, `# References`, ...).

## Decision

Do the splitting client-side with two module-level regexes in `App.tsx`:

- `BIBLIOGRAPHY_REGEX` matches `Bibliography | References | Works Cited |
  Sources`, optionally decorated with Markdown heading marks or
  bold/italic/underline characters, with an optional trailing colon.
- `FOOTNOTES_REGEX` matches `Notes | Footnotes | Endnotes` the same way.

`handleReview` locates both sections, slices each up to the other's start
(or end of text), and treats everything before the first section as the
body. Guards: if neither section is found, a friendly error is shown; if
the combined citation text exceeds 50,000 characters, the user is asked to
trim. The body text (lowercased) is kept client-side for a cross-check:
each bibliography entry's `primaryAuthor` (from the model) is searched in
the body, producing the `foundInText` badge ("FOUND REF" vs
"TEXT REF MISSING?") — a check the model never performs.

## Consequences

- Token cost scales with citation count, not paper length.
- Deterministic section boundaries; the model only ever sees citation lists.
- Header recognition is heuristic — exotic headings (e.g. `Sources
  Consulted`) fall through to the "couldn't find a section" error.
- The regexes were updated once (per code comments) to handle Markdown
  decoration and moved out of the component to dodge a stale-closure bug;
  treat them as load-bearing.
