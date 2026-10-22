// Admin-only operations, callable from the Admin Panel UI.
// Security rules enforce all of these server-side as well — the UI checks
// are for experience, the rules are the actual lock.
import { deleteApp, initializeApp } from "firebase/app";
import { createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";
import { db, firebaseAuth } from "@/lib/firebase";
import { logEvent } from "@/lib/log";
import { upsertDirectoryEntry } from "@/lib/directory";
import type { Role } from "@/lib/types";
import { isUsernameTaken, isValidUsername, newLoginEmail, normalizeUsername } from "@/lib/usernames";

function actorUid(): string {
  return firebaseAuth().currentUser?.uid ?? "unknown";
}

/**
 * Keeps status/admins in step with who is actually an admin. That doc is the
 * only way members — who cannot read other profiles — learn which handles
 * carry the "Admin" tag. It holds uids and nothing else.
 */
async function syncAdminRoster(uid: string, isAdminRole: boolean) {
  await setDoc(
    doc(db(), "status", "admins"),
    { uids: isAdminRole ? arrayUnion(uid) : arrayRemove(uid) },
    { merge: true },
  ).catch(() => {});
}

/**
 * Recounts, exactly, how many Staff Handles are BOTH On-Call AND added to a
 * given room, and stores it on the room. A room's "Active Now" uses this, so
 * its number reflects that room rather than the whole platform.
 *
 * Recomputed from scratch (never incremented) so the figure cannot drift out
 * of step with reality.
 */
export async function recountRoomOnCall(roomId: string) {
  try {
    const aclSnap = await getDoc(doc(db(), "rooms", roomId, "acl", "members"));
    const uids: string[] = aclSnap.data()?.uids ?? [];
    let count = 0;
    for (const uid of uids) {
      const userSnap = await getDoc(doc(db(), "users", uid));
      const u = userSnap.data();
      if (u?.role === "staff" && u?.active !== false && u?.onCall === true) count += 1;
    }
    await updateDoc(doc(db(), "rooms", roomId), { onCallStaffCount: count });
  } catch {
    // Never let a counter refresh break the action that triggered it.
  }
}

/** Recounts every room a given user belongs to. */
async function recountRoomsFor(uid: string) {
  try {
    const memberships = await getDocs(collection(db(), "users", uid, "memberships"));
    for (const m of memberships.docs) await recountRoomOnCall(m.id);
  } catch {}
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Creates a new account WITHOUT signing the current Admin out. Uses a
 * throwaway secondary Firebase app so the Admin's own session is untouched.
 * The Admin then hands the username + password to the invited member (closed,
 * invite-only model — there is no public sign-up).
 *
 * No email is needed: the account signs in with its username, backed by a
 * hidden login address (see src/lib/usernames.ts). `email` is optional
 * contact info only. Throws "username-invalid" or "username-taken".
 */
export async function createManagedAccount(
  rawUsername: string,
  email: string,
  password: string,
  handle: string,
  role: Role,
): Promise<string> {
  const username = normalizeUsername(rawUsername);
  if (!isValidUsername(username)) throw new Error("username-invalid");
  // Checked before minting the login so a clash never leaves an orphan.
  if (await isUsernameTaken(username)) throw new Error("username-taken");

  const loginEmail = newLoginEmail();
  const secondary = initializeApp(firebaseConfig, `acct-mgr-${Date.now()}`);
  try {
    const cred = await createUserWithEmailAndPassword(getAuth(secondary), loginEmail, password);
    const uid = cred.user.uid;
    const batch = writeBatch(db());
    batch.set(doc(db(), "users", uid), {
      handle,
      username,
      // Contact email only — sign-in uses the username.
      ...(email ? { email } : {}),
      // The sign-in password, stored so the Admin can re-share it with the
      // member later (closed, admin-distributes-credentials model). Readable
      // only by Admins and by that member — never written to the audit log.
      loginPassword: password,
      role,
      active: true,
      ...(role === "staff" ? { onCall: false } : {}),
      createdAt: serverTimestamp(),
    });
    batch.set(doc(db(), "usernames", username), { uid, loginEmail });
    await batch.commit();
    await signOut(getAuth(secondary));
    if (role === "admin") await syncAdminRoster(uid, true);
    await upsertDirectoryEntry(uid, handle, role, role === "staff" ? true : undefined);
    logEvent(actorUid(), "account_created", { newUid: uid, role });
    return uid;
  } finally {
    await deleteApp(secondary).catch(() => {});
  }
}

/**
 * Tags a member as Funded / Not funded with an amount. Admin-only: the
 * security rules let members edit their handle and nothing else, so a member
 * can never mark themselves funded.
 */
export async function setUserFunding(
  uid: string,
  funded: boolean,
  amount: number,
  currency: string,
  note: string,
) {
  await updateDoc(doc(db(), "users", uid), {
    funded,
    fundedAmount: funded ? amount : 0,
    fundedCurrency: currency,
    fundedNote: note,
    fundedAt: serverTimestamp(),
  });
  logEvent(actorUid(), funded ? "funding_granted" : "funding_cleared", {
    uid,
    amount: String(funded ? amount : 0),
  });
}

/**
 * Creates a Managed Staff Handle — an operator identity with NO login of its
 * own. There is no email and no password: the SuperAdmin switches into the
 * handle from inside the app and posts, reacts and replies as it.
 * To members it looks like any other user.
 */
export async function createStaffHandle(handle: string): Promise<string> {
  const ref = doc(collection(db(), "users"));
  await setDoc(ref, {
    handle: handle.trim(),
    role: "staff",
    active: true,
    onCall: false,
    managed: true, // operated by the SuperAdmin, never signs in
    createdAt: serverTimestamp(),
  });
  await upsertDirectoryEntry(ref.id, handle.trim(), "staff", true);
  logEvent(actorUid(), "staff_handle_created", { uid: ref.id });
  return ref.id;
}

export interface BulkHandleResult {
  created: string[];
  /** `reason` is a code the screen translates: length | exists | failed. */
  skipped: { name: string; reason: "length" | "exists" | "failed" }[];
}

/**
 * Creates several Staff Handles at once from a pasted list. Names are trimmed,
 * de-duplicated against each other and against handles that already exist, and
 * validated for length. One bad line never stops the rest.
 */
export async function createStaffHandles(
  rawNames: string[],
  existingHandles: string[] = [],
): Promise<BulkHandleResult> {
  const result: BulkHandleResult = { created: [], skipped: [] };
  const taken = new Set(existingHandles.map((h) => h.toLowerCase()));

  for (const raw of rawNames) {
    const name = raw.trim();
    if (!name) continue;
    if (name.length < 2 || name.length > 24) {
      result.skipped.push({ name, reason: "length" });
      continue;
    }
    if (taken.has(name.toLowerCase())) {
      result.skipped.push({ name, reason: "exists" });
      continue;
    }
    try {
      await createStaffHandle(name);
      taken.add(name.toLowerCase());
      result.created.push(name);
    } catch {
      result.skipped.push({ name, reason: "failed" });
    }
  }
  return result;
}

export async function renameStaffHandle(uid: string, handle: string) {
  await updateDoc(doc(db(), "users", uid), { handle: handle.trim() });
  await upsertDirectoryEntry(uid, handle.trim(), "staff", true);
  logEvent(actorUid(), "staff_handle_renamed", { uid });
}

/**
 * Records (or corrects) the email shown in the admin directory for accounts
 * created before emails were stored — including the hand-made SuperAdmin.
 * This is a record only: it does NOT change the person's actual login, which
 * lives in Firebase Auth.
 */
export async function setUserEmailRecord(uid: string, email: string) {
  await updateDoc(doc(db(), "users", uid), { email: email.trim() });
  logEvent(actorUid(), "email_recorded", { uid });
}

/** SuperAdmin: change someone's role. */
export async function setUserRole(uid: string, role: Role) {
  await updateDoc(doc(db(), "users", uid), { role });
  await syncAdminRoster(uid, role === "admin" || role === "superadmin");
  // Mirror the new role into the public directory so the tag updates at once.
  const snap = await getDoc(doc(db(), "users", uid)).catch(() => null);
  const u = snap?.data() as { handle?: string; managed?: boolean } | undefined;
  if (u?.handle) await upsertDirectoryEntry(uid, u.handle, role, u.managed);
  logEvent(actorUid(), "role_changed", { uid, role });
}

/**
 * Saves the bank details an Admin fills in for a member. They appear on that
 * member's dashboard and are readable only by them and by Admins.
 * The password is stored as typed — this is the most sensitive data in the
 * app, so keep admin accounts locked down.
 */
export async function setBankDetails(
  uid: string,
  bank: { name: string; website: string; login: string; password: string },
) {
  await updateDoc(doc(db(), "users", uid), {
    bankName: bank.name.trim(),
    bankWebsite: bank.website.trim(),
    bankLogin: bank.login.trim(),
    bankPassword: bank.password,
    bankUpdatedAt: serverTimestamp(),
  });
  // Metadata only — the log never records the credentials themselves.
  logEvent(actorUid(), "bank_details_updated", { uid });
}

/** Pins a private note to one member's dashboard (Admins only). */
export async function setDashboardMessage(uid: string, message: string) {
  await updateDoc(doc(db(), "users", uid), {
    dashboardMessage: message.trim(),
    dashboardMessageAt: serverTimestamp(),
  });
  logEvent(actorUid(), message.trim() ? "dashboard_message_set" : "dashboard_message_cleared", {
    uid,
  });
}

export async function setAccountActive(uid: string, active: boolean) {
  await updateDoc(doc(db(), "users", uid), { active });
  // A banned handle stops counting as active in its rooms.
  await recountRoomsFor(uid);
  logEvent(actorUid(), active ? "account_activated" : "account_deactivated", { uid });
}

/** SuperAdmin: flip a Staff Handle On-Call/Off-Call and keep the public
 *  anonymous counter (status/staff.onCallCount) in sync. */
export async function setStaffOnCall(uid: string, onCall: boolean, wasOnCall: boolean) {
  if (onCall === wasOnCall) return;
  const batch = writeBatch(db());
  batch.update(doc(db(), "users", uid), { onCall });
  batch.set(
    doc(db(), "status", "staff"),
    { onCallCount: increment(onCall ? 1 : -1) },
    { merge: true },
  );
  await batch.commit();
  await recountRoomsFor(uid);
  logEvent(actorUid(), onCall ? "staff_oncall_on" : "staff_oncall_off", { staffUid: uid });
}

export async function createRoom(name: string, topic: string, createdBy: string) {
  const roomRef = doc(collection(db(), "rooms"));
  const batch = writeBatch(db());
  batch.set(roomRef, { name, topic, createdBy, createdAt: serverTimestamp() });
  batch.set(doc(db(), "rooms", roomRef.id, "acl", "members"), { uids: [] });
  await batch.commit();
  logEvent(actorUid(), "room_created", { roomId: roomRef.id });
  return roomRef.id;
}

/**
 * Renames a room. The name is denormalized onto each member's own
 * `users/{uid}/memberships/{roomId}` doc (so they see the new name in their
 * room list), so both are updated together. Milestone `roomName` snapshots are
 * historical and left untouched.
 */
export async function renameRoom(roomId: string, name: string) {
  const clean = name.trim();
  if (!clean) return;
  const aclSnap = await getDoc(doc(db(), "rooms", roomId, "acl", "members"));
  const uids: string[] = aclSnap.data()?.uids ?? [];
  const batch = writeBatch(db());
  batch.update(doc(db(), "rooms", roomId), { name: clean });
  // Mirror onto each participant's membership doc. merge keeps the existing
  // addedAt and never removes a participant who belongs in the room.
  for (const uid of uids) {
    batch.set(doc(db(), "users", uid, "memberships", roomId), { name: clean }, { merge: true });
  }
  await batch.commit();
  logEvent(actorUid(), "room_renamed", { roomId });
}

/** Adds/removes a member. Membership is mirrored in two places:
 *  - rooms/{id}/acl/members  (Admin-only visibility — the participant list)
 *  - users/{uid}/memberships/{roomId}  (lets the member list their own rooms) */
export async function setRoomMembership(
  roomId: string,
  roomName: string,
  memberUid: string,
  present: boolean,
) {
  const batch = writeBatch(db());
  const aclRef = doc(db(), "rooms", roomId, "acl", "members");
  const membershipRef = doc(db(), "users", memberUid, "memberships", roomId);
  if (present) {
    batch.set(aclRef, { uids: arrayUnion(memberUid) }, { merge: true });
    batch.set(membershipRef, { name: roomName, addedAt: serverTimestamp() });
  } else {
    batch.set(aclRef, { uids: arrayRemove(memberUid) }, { merge: true });
    batch.delete(membershipRef);
  }
  await batch.commit();
  await recountRoomOnCall(roomId);
  logEvent(actorUid(), present ? "room_member_added" : "room_member_removed", {
    roomId,
    memberUid,
  });
}

/** Correct the wording of an announcement after posting. */
export async function editPostText(postId: string, text: string) {
  await updateDoc(doc(db(), "broadcast", postId), {
    text: text.trim(),
    editedAt: serverTimestamp(),
  });
  logEvent(actorUid(), "post_edited", { postId });
}

/** Pin an announcement to the top of the Noticeboard (or unpin it). */
export async function setPostPinned(postId: string, pinned: boolean) {
  await updateDoc(doc(db(), "broadcast", postId), {
    pinned,
    pinnedAt: serverTimestamp(),
  });
  logEvent(actorUid(), pinned ? "post_pinned" : "post_unpinned", { postId });
}

/** Correct the wording of a room message. */
export async function editRoomMessage(roomId: string, messageId: string, text: string) {
  await updateDoc(doc(db(), "rooms", roomId, "messages", messageId), {
    text: text.trim(),
    editedAt: serverTimestamp(),
  });
  logEvent(actorUid(), "message_edited", { roomId, messageId });
}

export async function deleteBroadcastPost(postId: string) {
  await deleteDoc(doc(db(), "broadcast", postId));
  logEvent(actorUid(), "post_deleted", { postId });
}

export async function deleteRoomMessage(roomId: string, messageId: string) {
  await deleteDoc(doc(db(), "rooms", roomId, "messages", messageId));
  logEvent(actorUid(), "message_deleted", { roomId, messageId });
}

/** Removes a direct message. The rules let a participant delete their OWN
 *  message and the SuperAdmin delete any. */
export async function deleteDmMessage(threadId: string, messageId: string) {
  await deleteDoc(doc(db(), "dms", threadId, "messages", messageId));
  logEvent(actorUid(), "dm_message_deleted", { threadId, messageId });
}

/**
 * Permanently removes a user from the platform: their profile, their room
 * memberships (and ACL entries) and their presence doc. They are locked out
 * instantly — with no profile document, the rules deny them everything.
 * Their username is freed straight away. Note: the login record in Firebase
 * *Authentication* cannot be deleted from the client; remove it in Firebase
 * Console → Authentication → Users if you want an old email address reusable.
 */
export async function deleteUserAccount(uid: string) {
  const username = (await getDoc(doc(db(), "users", uid))).data()?.username;
  const memberships = await getDocs(collection(db(), "users", uid, "memberships"));
  const roomIds = memberships.docs.map((m) => m.id);
  const batch = writeBatch(db());
  memberships.forEach((m) => {
    batch.delete(m.ref);
    batch.set(doc(db(), "rooms", m.id, "acl", "members"), { uids: arrayRemove(uid) }, { merge: true });
  });
  batch.delete(doc(db(), "presence", uid));
  batch.delete(doc(db(), "users", uid));
  // Frees the username so it can be given to someone else.
  if (typeof username === "string" && username) batch.delete(doc(db(), "usernames", username));
  await batch.commit();
  await syncAdminRoster(uid, false);
  for (const roomId of roomIds) await recountRoomOnCall(roomId);
  logEvent(actorUid(), "account_deleted", { uid });
}
