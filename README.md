# 🧪 GetPeptides Community

A **Quora-style community forum** for GetPeptides.store that installs and
behaves like a native mobile app (PWA). Admins (and consultant "personas")
post topics with optional image links under topic groups; members sign
themselves up, comment and react.

**Stack:** Next.js (App Router) + React + Tailwind v4 on **Vercel** ·
**Firebase** (Authentication, Cloud Firestore, Storage). 100% free-tier.
English only.

> 🚀 **New here? Open [`SETUP.md`](./SETUP.md)** — a phone-friendly,
> step-by-step guide from zero to a live installed app.

## What it does

| Area | Status |
|---|---|
| Quora-style community feed — admins/superadmins post topics | ✅ |
| Topic = title + body + optional image via an EXTERNAL LINK | ✅ |
| Topic groups (spaces) + filter bar — managed at `/admin/groups` | ✅ |
| Comments under every post (any signed-in member) | ✅ |
| One-emoji reactions per person (+ stacked persona reactions) | ✅ |
| Public **self-signup** (`/signup`) — members create their own account | ✅ |
| Username + password sign-in (hidden email under the hood) | ✅ |
| Account dashboard — edit display name, username, email, password | ✅ |
| Consultant **personas** = Staff Handles via the Handle Console | ✅ |
| Admin panel — accounts, topic groups, console, staff | ✅ |
| Role hierarchy: member / staff / admin / superadmin | ✅ |
| GetPeptides emerald/teal theme (light + dark) | ✅ |
| Firestore + Storage security rules enforcing all of the above | ✅ |
| Native-feel installable PWA (bottom nav, drawer, transitions) | ✅ |

## Project map

```
src/
  app/
    login/              Username / password sign-in
    signup/             Public self-registration
    (app)/              Everything behind auth
      noticeboard/      The community feed (collection: broadcast)
      profile/          Account settings (handle / username / email / password)
      admin/            Admin panel
        groups/         Topic-group management
        users/          Account minting
        console/        Handle Console (personas) — superadmin
        staff/          Staff handles — superadmin
  components/           App shell, PostComments, media, user badge…
  context/AuthContext   Session, role, presence
  lib/                  firebase, types, usernames (incl. signUpMember), handleActions…
  lib/i18n/en.ts        All UI text (English only)
firestore.rules         THE security model — paste into Firebase
storage.rules           Media permissions — paste into Firebase
SETUP.md                Phone-friendly deployment guide
```

> The repo also contains **dormant project-management code** from the original
> "Kite" template (rooms, milestones, funding, forms, logs, DMs). It is
> unlinked from the app — see [`CLAUDE.md`](./CLAUDE.md) → "Legacy".

## Local development

Set your Firebase web config as `NEXT_PUBLIC_FIREBASE_*` environment variables
(in `.env.local` locally, or in Vercel — see `SETUP.md`), then:

```bash
npm install
npm run dev
```

`src/lib/firebase.ts` guards missing keys, so `npm run build` succeeds even
without configuration (the app just shows a "connect Firebase" screen until the
keys are set).
