# GetPeptides Community — project notes for Claude Code

A Quora-style community forum for **GetPeptides.store**. It was built by copying
the "Kite" PM platform and reworking it, so a lot of the original
project-management code still exists but is **no longer part of the product**
(see "Legacy" below). The owner is a beginner working from a phone — keep
explanations simple and step-by-step, and never assume a local terminal.

## Stack & constraints
- Next.js App Router + TypeScript + Tailwind v4, deployed on Vercel (free tier).
- Firebase client SDK only: Auth (email/password under the hood — people sign in
  with a USERNAME), Firestore, Storage. NO Cloud Functions / Admin SDK (paid) —
  everything runs client-side and is enforced by `firestore.rules` /
  `storage.rules`.
- All Firebase pages are client components; `src/lib/firebase.ts` guards missing
  env vars so `next build` passes without configuration.
- **English only.** `src/lib/i18n/` now ships a single dictionary (`en.ts`)
  behind the `t()` API (`useT()`); the multi-language machinery was removed but
  the call sites are unchanged, so add every new UI string as a key in `en.ts`.
- **Theme:** GetPeptides emerald/teal. Colours are CSS variables in
  `src/app/globals.css` (`--brand`, `--brand-soft`, light + dark) — restyle
  there, don't hard-code colours.

## What the app is (the active surface)
- **Community feed** — `src/app/(app)/noticeboard/page.tsx`, collection
  `broadcast`. A Quora-style feed:
  - Posts carry `title`, `text`, optional `groupId`/`groupName`, and an optional
    image shown from an EXTERNAL URL (`mediaUrl` + `mediaType:"image"` — members
    can't upload to Storage, so pictures are links).
  - Only **admins / superadmins** post (plus Staff Handles via the Handle
    Console).
  - Anyone active **reacts** (one emoji each, `reactions` map) and **comments**
    (`broadcast/{id}/comments` — any active user writes their own; author or
    admin deletes; no edits). See `src/components/PostComments.tsx`.
- **Topic groups** — collection `groups` (Quora-style spaces). Admins manage
  them on **`/admin/groups`**; the composer files a post under one and the feed
  shows a filter chip row (filtered in JS — see the index rule below).
- **Accounts** — public **self-signup** at `/signup` creates a `member`; the
  Account tab (`src/components/AccountSettings.tsx`) edits handle / username /
  email / password.
- **Personas = Staff Handles — DO NOT TOUCH.** Operator accounts
  (`role:"staff"`, no login) run by the SuperAdmin from the Handle Console
  (`/admin/console`) via `src/lib/handleActions.ts` (`actingAsStaff`). They are
  the consultants; their creation and usage must stay intact.
- **Members directory** — `/members` lists everyone (members, admins and the
  Staff Handle consultants) from the public `directory` collection, so anyone
  can find and **DM** anyone. The SuperAdmin can promote a member to admin (or
  step one down) from each row.
- **Direct Messages** — `/messages` (inbox) + `/messages/with/{uid}` (thread)
  are a first-class feature. Tapping any handle/avatar anywhere opens a 1-on-1
  chat; the SuperAdmin triages every thread from the Handle Console inbox and
  replies as a Staff Handle.
- **Admin panel** — Users (account minting), Topic groups, and (superadmin)
  Console + Staff. Bottom nav is **Community + Members + Messages + Account**.

## Security model (do not weaken)
- Roles in `users/{uid}.role`: member | staff | admin | superadmin.
- **Sign-in is username + password.** New accounts get a random hidden Auth
  email (`newLoginEmail` in `src/lib/usernames.ts`); `usernames/{name}` →
  `{uid, loginEmail}` is world-gettable (never listable) so the login screen
  resolves it. Input containing `@` signs in as an email (the bootstrap
  superadmin and any legacy accounts).
- **Self-signup** (`signUpMember` in `usernames.ts`): creates the Auth account,
  then batch-writes `users/{uid}` (role forced to `member`, `active:true`, only
  the whitelisted fields) and claims `usernames/{name}`, using the mutual
  `getAfter` pattern (users doc ↔ usernames doc). The create rules must never
  let this path grant a privileged role, funding or bank fields.
- Admin/superadmin accounts are still minted by admins (`adminActions.ts`, a
  secondary Firebase app). The **first superadmin is seeded by hand** (SETUP.md).
- **Staff Handles have NO Auth account**; operated ONLY from the Handle Console
  via `actingAsStaff(uid)` (superadmin + target role == staff).
- `status/admins` (uids, world-readable to signed-in users) publishes who is an
  admin; admins self-heal into it on sign-in.
- **`directory/{uid}` is the public mirror of each account's `{handle, role}`**
  (and `managed` for Staff Handles). Private `users/{uid}` docs are NEVER
  world-readable (they hold emails, minted passwords, bank fields); the
  directory is the safe, readable surface that powers the Members list, lets
  anyone DM anyone, and drives the **Admin / SuperAdmin** tags (`AdminTag`
  reads the directory via `AuthContext`). The rules PIN a directory entry's
  role to the real `users/{uid}.role` (via `get()`), so nobody can forge a
  tag. Every signed-in user self-heals their own entry; admins mirror Staff
  Handles and run a one-pass `syncAllDirectory()` from the Members screen.
  **Only the SuperAdmin changes roles** (`setUserRole`, rules `isSuper`).
- Collections: `broadcast` posts are created by admins/handles, members may only
  change their own key in `reactions`; `broadcast/*/comments` — any active user
  creates their own, author or admin deletes; `groups` — read by active users,
  write by admins.
- **Never write a Firestore query that filters on one field and sorts by
  another** — it needs a composite index and fails silently without one. Filter
  in the query or in JS, sort in JS. (The feed loads newest-first and filters by
  group in JS for exactly this reason.)
- Presence is anonymous: `presence/{uid}` = a timestamp (+ a legacy `roomId`).

## Legacy (present in the repo, NOT part of the product)
The original Kite PM features still exist in code but are **unlinked from the
nav and dormant**: rooms, milestones, funding, bank details, forms, compliance
logs, reports, and admin alerts. (Member-to-member **DMs are now a live
product feature** — see above — so `src/app/(app)/messages` is NO LONGER
legacy.) Don't build on the dormant ones. To remove them fully, delete the
routes under `src/app/(app)/rooms` and
`src/app/(app)/admin/{milestones,alerts,reports,rooms,forms,logs,dashboard}`,
their components, and the matching `firestore.rules` blocks.

## Verify before pushing
`npm run lint && npm run build`
