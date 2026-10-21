// Username sign-in on top of Firebase email/password Auth.
//
// Firebase Auth only knows emails, so every account created with a username
// gets a hidden, random login address that nobody ever sees or types. The
// public lookup `usernames/{username}` → { uid, loginEmail } turns the
// username typed on the sign-in screen into that address. Because the login
// address never changes, a person can rename their username freely, and the
// email on their profile is just contact info they can edit at will.
//
// Older accounts made with a real email keep working: anything typed with an
// "@" on the sign-in screen is used as an email directly.
import { createUserWithEmailAndPassword } from "firebase/auth";
import { collection, doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase";

/** Same pattern as `usernames/{name}` in firestore.rules. */
const USERNAME_RE = /^[a-z0-9._-]{3,24}$/;

/** Lower-cases and drops spaces / a leading "@" so "  @Ade.P " → "ade.p". */
export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return USERNAME_RE.test(username);
}

export async function isUsernameTaken(username: string): Promise<boolean> {
  return (await getDoc(doc(db(), "usernames", username))).exists();
}

/** The hidden Auth email behind a username, or null if there is none. */
export async function loginEmailFor(username: string): Promise<string | null> {
  const snap = await getDoc(doc(db(), "usernames", username));
  const email = snap.data()?.loginEmail;
  return typeof email === "string" ? email : null;
}

/**
 * The domain for the hidden login addresses. These are never delivered to —
 * they only need a valid, stable email FORMAT — so we build it from the project
 * id, which is always clean (lowercase letters, digits and hyphens), on
 * Firebase's own `firebaseapp.com`. We deliberately do NOT use
 * `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: it is not part of the required config, so
 * it is often unset, blank or pasted with an `https://` prefix / trailing
 * slash, any of which produced an invalid address and the `auth/invalid-email`
 * error when creating accounts.
 */
function loginDomain(): string {
  const projectId = (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "");
  return projectId ? `${projectId}.firebaseapp.com` : "kite.local";
}

/**
 * A random, never-shown Auth address for a new account. It sits on the
 * project's own Firebase domain so it is always a valid email, and it is
 * random (not the username) so renaming never touches the login.
 */
export function newLoginEmail(): string {
  const id = doc(collection(db(), "usernames")).id.toLowerCase();
  return `u-${id}@${loginDomain()}`;
}

/**
 * Public self-signup. Creates the Firebase Auth account (on a hidden login
 * address behind the chosen username), then writes the member profile and
 * claims the username in one atomic batch. Throws "handle-invalid",
 * "username-invalid", "password-weak" or "username-taken"; if the profile
 * write is rejected, the just-created Auth account is removed so nothing is
 * left orphaned.
 */
export async function signUpMember(
  rawHandle: string,
  rawUsername: string,
  password: string,
  rawEmail?: string,
) {
  const handle = rawHandle.trim();
  const name = normalizeUsername(rawUsername);
  const email = rawEmail?.trim();
  if (handle.length < 2 || handle.length > 24) throw new Error("handle-invalid");
  if (!isValidUsername(name)) throw new Error("username-invalid");
  if (password.length < 6) throw new Error("password-weak");
  if (await isUsernameTaken(name)) throw new Error("username-taken");

  const loginEmail = newLoginEmail();
  const cred = await createUserWithEmailAndPassword(firebaseAuth(), loginEmail, password);
  const uid = cred.user.uid;
  try {
    const batch = writeBatch(db());
    batch.set(doc(db(), "users", uid), {
      handle,
      username: name,
      role: "member",
      active: true,
      ...(email ? { email } : {}),
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db(), "usernames", name), { uid, loginEmail });
    await batch.commit();
  } catch (err) {
    // The profile write was rejected — don't leave a sign-in-able account with
    // no profile. Remove the Auth user we just created.
    await cred.user.delete().catch(() => {});
    throw err;
  }
}

/**
 * Claims `next` for the signed-in user and frees their old username, in one
 * atomic write. Throws "username-invalid" or "username-taken".
 */
export async function changeOwnUsername(
  uid: string,
  loginEmail: string,
  previous: string | undefined,
  next: string,
) {
  if (!isValidUsername(next)) throw new Error("username-invalid");
  if (next === previous) return;
  if (await isUsernameTaken(next)) throw new Error("username-taken");
  const batch = writeBatch(db());
  batch.update(doc(db(), "users", uid), { username: next });
  batch.set(doc(db(), "usernames", next), { uid, loginEmail });
  if (previous) batch.delete(doc(db(), "usernames", previous));
  await batch.commit();
}
