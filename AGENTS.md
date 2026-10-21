# GetPeptides Community — agent notes

Read **[`CLAUDE.md`](./CLAUDE.md)** first — it is the source of truth for this
project. In short: a **Quora-style community forum** (Next.js + Firebase)
reworked from the "Kite" template.

Key rules for agents:
- **English only** — add every new UI string to `src/lib/i18n/en.ts`.
- **Firebase client SDK only** (no Cloud Functions / Admin SDK); all access is
  enforced by `firestore.rules` / `storage.rules`.
- **Never** write a Firestore query that filters on one field and sorts by
  another — it needs a composite index and fails silently. Filter/sort in JS.
- **Do NOT touch** the persona / Staff Handle system (`handleActions.ts`, the
  Handle Console, account minting in `adminActions.ts`).
- Theme via CSS variables in `src/app/globals.css` — don't hard-code colours.
- Verify with `npm run lint && npm run build` before pushing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
