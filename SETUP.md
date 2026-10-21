# 🧪 GetPeptides Community — Setup Guide (phone-friendly, no coding)

A Quora-style community for **GetPeptides.store**: admins post topics (with
optional image links) under topic groups; members sign themselves up, comment
and react. Built on Next.js + Firebase, deployed free on Vercel. You can do
every step below in a phone browser.

---

## Step 0 — What you need
- A **Google account** (for Firebase).
- The **GitHub repo** `Paulodev231/getpeptides-community`.
- A **Vercel account** (sign in with GitHub).

---

## Step 1 — Create the Firebase project (free)
1. Go to **console.firebase.google.com → Add project** → give it a name → create.
2. **Build → Authentication → Get started → Sign-in method → Email/Password →
   Enable → Save.** (This is the login method; usernames sit on top of it.)
3. **Build → Firestore Database → Create database → Production mode →** pick a
   location → **Enable**.
4. *(Optional)* **Build → Storage → Get started.** You can **skip** this —
   pictures are added as external links, so Storage isn't required.

---

## Step 2 — Install the security rules (VERY important)
1. **Firestore Database → Rules** tab → delete everything there → paste the full
   contents of **`firestore.rules`** from this repo → **Publish**.
   - Self-signup, comments and topic groups all depend on these rules. Skip this
     and those features will be blocked.
2. *(Only if you turned on Storage)* **Storage → Rules** → paste **`storage.rules`**
   → **Publish**.

---

## Step 3 — Get your 6 app keys
**Project settings (⚙️) → Your apps → Web app (`</>`)** → register an app → copy
these six values:
`apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.

---

## Step 4 — Deploy on Vercel (free)
1. **vercel.com → Add New → Project →** import **`getpeptides-community`**.
2. Set the **Production Branch** to the branch you deploy (e.g.
   `claude/community-forum`, or whatever you merge it into).
3. Under **Environment Variables**, add the six keys with these **exact** names:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
4. **Deploy.** Then **Settings → Domains → add `community.getpeptides.store`**
   (this is the subdomain your store's "Join the community" buttons link to).

---

## Step 5 — Make yourself the first admin (one-time, by hand)
Self-signup only creates regular members, so you bootstrap your own admin:
1. **Firebase → Authentication → Users → Add user** → your email + a strong
   password → **Add user**. Copy the **User UID**.
2. **Firestore → Data → Start collection** → Collection ID `users` → **Document
   ID = your UID (exactly)** → add fields:
   - `handle` (string) → your name, e.g. `Paul`
   - `role` (string) → `superadmin`
   - `active` (boolean) → `true`
3. **Save.** That document makes you the SuperAdmin 👑.

---

## Step 6 — Go live
1. Open your community URL → **sign in**: type your **email** into the Username
   box (anything with `@` is treated as an email) + your password.
2. Go to **Account → Change my username**, set a real username, and use it from
   then on. Your admin login now works across the whole app.
3. **Admin panel → Topic groups** → add a few (e.g. *Peptides, Dosing,
   Suppliers, General*).
4. Post your first topic (paste an **image link** to show a picture). New users
   join themselves at **`/signup`**, then comment and react.
5. *(Optional)* Install it like an app: **Android/Chrome** menu ⋮ → *Add to Home
   screen*; **iPhone/Safari** Share → *Add to Home Screen*.

---

## How it works (quick tour)
- **Community tab** — the feed. Admins/superadmins (and personas via the Handle
  Console) post topics; everyone comments + reacts; filter by topic group.
- **Account tab** — edit your display name, username, email and password.
- **Admin panel** — *Users* (create accounts), *Topic groups*, and for
  SuperAdmins the *Handle Console* (your consultant personas) and *Staff*.

## Personas (your consultants)
Staff Handles are named accounts you operate from **Admin → Handle Console**.
They post and react as consultants without ever logging in. Create and manage
them there. (They are left exactly as in the original platform.)

## Images in posts
Members can't upload files. To show a picture, paste an **image URL** (a direct
link ending in `.jpg`/`.png`, or any direct image link) into the **Image link**
box when posting — it displays inside the topic.

## Notes
- The app is **English only**.
- Legacy project-management features from the original template (rooms,
  milestones, funding, forms, reports, etc.) are hidden and not used.
