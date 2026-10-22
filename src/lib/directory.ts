// Public member directory.
//
// Member profiles (users/{uid}) are deliberately private — they can hold
// contact emails, minted passwords and bank fields, so they are NEVER made
// world-readable. Instead we mirror ONLY the two public facts everyone needs
// — handle + role — into directory/{uid}, which every active user may read.
// That is what powers the Members list, lets anyone DM anyone (including Staff
// Handles), and drives the Admin / SuperAdmin tags.
//
// The rules guarantee a directory entry's role always equals the real role in
// users/{uid}, so nobody can forge an "Admin" tag they don't actually hold.
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Role } from "@/lib/types";

export interface DirectoryEntry {
  uid: string;
  handle: string;
  role: Role;
  managed?: boolean;
}

/** Upsert the signed-in user's OWN public directory entry. Safe to call often;
 *  the rules require handle + role to match the caller's real profile. */
export async function upsertOwnDirectory(
  uid: string,
  handle: string,
  role: Role,
  managed?: boolean,
): Promise<void> {
  const data: Record<string, unknown> = { handle, role };
  if (managed) data.managed = true;
  await setDoc(doc(db(), "directory", uid), data, { merge: true }).catch(() => {});
}

/** Admin/SuperAdmin helper: write/refresh ONE account's directory entry
 *  (used when minting accounts, creating or renaming Staff Handles, or
 *  changing a role, so the change shows up immediately). */
export async function upsertDirectoryEntry(
  uid: string,
  handle: string,
  role: Role,
  managed?: boolean,
): Promise<void> {
  const data: Record<string, unknown> = { handle, role };
  if (managed) data.managed = true;
  await setDoc(doc(db(), "directory", uid), data, { merge: true }).catch(() => {});
}

/** Admin/SuperAdmin: mirror every users doc into the public directory in one
 *  pass. Covers Staff Handles (which never sign in) and any account created
 *  before the directory existed. Returns how many entries were synced. */
export async function syncAllDirectory(): Promise<number> {
  const snap = await getDocs(collection(db(), "users"));
  let n = 0;
  for (const d of snap.docs) {
    const u = d.data() as { handle?: string; role?: Role; managed?: boolean };
    if (!u.handle || !u.role) continue;
    await upsertDirectoryEntry(d.id, u.handle, u.role, u.managed);
    n += 1;
  }
  return n;
}
