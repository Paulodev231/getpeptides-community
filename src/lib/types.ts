import type { Timestamp } from "firebase/firestore";
import type { TranslationKey } from "./i18n";

/** Role hierarchy. "staff" = a Managed Staff Handle operated by the SuperAdmin. */
export type Role = "member" | "staff" | "admin" | "superadmin";

export const ADMIN_ROLES: Role[] = ["admin", "superadmin"];

export function isAdmin(role: Role | null | undefined): boolean {
  return role === "admin" || role === "superadmin";
}

/**
 * Public-facing role label shown next to a handle. Admins and SuperAdmins both
 * read simply as "Admin" — members don't need to know the internal hierarchy,
 * only who speaks with authority. Members and Staff Handles carry no tag, so a
 * Staff Handle still looks like an ordinary user.
 */
export function hasRoleTag(role: Role | null | undefined): boolean {
  return role === "superadmin" || role === "admin";
}

/** The single public doc listing admin uids: status/admins { uids: [...] } */
export interface AdminRoster {
  uids: string[];
}

export interface UserProfile {
  uid: string;
  handle: string; // public display handle, e.g. "PM_Ade"
  /** What they type to sign in (lower-case, unique — see usernames/{name}).
   *  Older accounts made with an email may not have one yet. */
  username?: string;
  /** Contact email. The person (or an Admin) may edit it freely — it does not
   *  change how they sign in. */
  email?: string;
  /** The sign-in password, kept so an Admin can re-share it with the member.
   *  Stored as typed; readable only by Admins and by that member. Set when the
   *  account is minted — changing the real password happens in Firebase Auth. */
  loginPassword?: string;
  role: Role;
  active: boolean; // deactivated accounts cannot use the app
  onCall?: boolean; // staff handles only: counted in the presence indicator
  /** Staff handles: operated by the SuperAdmin, no login of their own. */
  managed?: boolean;
  createdAt?: Timestamp;

  // ----- Funding status -----
  // Set by an Admin, or by the member redeeming a confirmation code the Admin
  // issued them. The rules verify a redeemed amount against the code itself,
  // so a member can never award themselves funding.
  funded?: boolean;
  fundedAmount?: number;
  fundedCurrency?: string; // symbol, e.g. "$" or "₦"
  fundedNote?: string; // optional context, e.g. "Tranche 1 of 3"
  fundedAt?: Timestamp;
  /** Whatever confirmation code the member typed in (recorded, not checked). */
  fundingCode?: string;
  fundingCodeAt?: Timestamp;

  /** Bank details an Admin fills in for this member. Visible only to them
   *  and to Admins. The password is stored as typed — treat with care. */
  bankName?: string;
  bankWebsite?: string;
  bankLogin?: string;
  bankPassword?: string;
  bankUpdatedAt?: Timestamp;

  /** A private note an Admin pins to this member's dashboard. */
  dashboardMessage?: string;
  dashboardMessageAt?: Timestamp;
}

/** Currency symbols offered when tagging a member's funding. */
export const CURRENCIES = ["$", "₦", "£", "€", "₵", "R", "KSh"] as const;

export const DEFAULT_CURRENCY = "$";

/** "$200,000" — grouped thousands, no stray decimals. */
export function formatFunding(amount: number | undefined, currency?: string): string {
  return `${currency || DEFAULT_CURRENCY}${(amount ?? 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

/** Funding badge icon + colour. The words come from the dictionary, so the
 *  icon always carries the meaning alongside the colour. */
export function fundingBadge(profile: { funded?: boolean }): {
  icon: string;
  color: string;
} {
  return profile.funded
    ? { icon: "💰", color: "#0ca30c" }
    : { icon: "○", color: "#898781" };
}

/**
 * A Noticeboard post. Admins (and Staff Handles, via the console) write these;
 * everyone else may only respond with a single emoji reaction.
 * `reactions` maps a uid to the one emoji that person chose, so each member
 * gets exactly one reaction per post and can change or clear it.
 */
/** A topic group (like a Quora Space) that posts can be filed under. */
export interface TopicGroup {
  id: string;
  name: string;
  createdBy: string;
  createdAt?: Timestamp;
}

export interface BroadcastPost {
  id: string;
  authorUid: string;
  authorHandle: string;
  /** Quora-style topic/question headline. Optional for older posts. */
  title?: string;
  /** Topic group this post belongs to (optional). */
  groupId?: string;
  groupName?: string;
  text: string;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "file";
  mediaName?: string;
  /** One emoji per person: uid -> emoji. Members and admins get exactly one. */
  reactions?: Record<string, string>;
  /** Staff Handles may stack reactions: handleUid -> emoji -> how many taps. */
  handleReactions?: Record<string, Record<string, number>>;
  pinned?: boolean;
  pinnedAt?: Timestamp;
  editedAt?: Timestamp;
  createdAt?: Timestamp;
}

/** A comment under a community post. Any signed-in, active user may write one
 *  (this is the Quora-style public discussion thread). */
export interface PostComment {
  id: string;
  authorUid: string;
  authorHandle: string;
  text: string;
  createdAt?: Timestamp;
}

/** Quick emoji reactions available on each post. */
export const REACTION_EMOJIS = ["👍", "🙏", "🔥", "💪", "🎉", "❤️", "👏", "✅"] as const;

/**
 * Combined tally of a post's reactions, most-used first: one per person from
 * `reactions`, plus every stacked tap a Staff Handle contributed.
 */
export function tallyReactions(
  reactions: Record<string, string> | undefined,
  handleReactions?: Record<string, Record<string, number>>,
): { emoji: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const emoji of Object.values(reactions ?? {})) {
    counts.set(emoji, (counts.get(emoji) ?? 0) + 1);
  }
  for (const perHandle of Object.values(handleReactions ?? {})) {
    for (const [emoji, n] of Object.entries(perHandle ?? {})) {
      if (n > 0) counts.set(emoji, (counts.get(emoji) ?? 0) + n);
    }
  }
  return [...counts.entries()]
    .map(([emoji, count]) => ({ emoji, count }))
    .sort((a, b) => b.count - a.count);
}

export interface Room {
  id: string;
  name: string;
  topic?: string;
  /** Staff Handles that are On-Call AND have been added to this room.
   *  Recomputed by adminActions whenever membership or on-call changes. */
  onCallStaffCount?: number;
  createdBy: string;
  createdAt?: Timestamp;
}

/** A short snapshot of the message being replied to, stored inline so the
 *  quote still renders if the original is later deleted. */
export interface QuotedMessage {
  id: string;
  handle: string;
  text: string;
}

export interface RoomMessage {
  id: string;
  authorUid: string;
  authorHandle: string;
  text: string;
  replyTo?: QuotedMessage;
  mediaUrl?: string;
  mediaType?: "image" | "video" | "file";
  mediaName?: string;
  createdAt?: Timestamp;
}

// ---------- Phase 2: room-embedded forms & digital signatures ----------

export type FormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "date"
  | "checkbox"
  | "select"
  | "signature";

/** `labelKey` is a translation key — see src/lib/i18n. */
export const FORM_FIELD_TYPES: { value: FormFieldType; labelKey: TranslationKey }[] = [
  { value: "text", labelKey: "ftText" },
  { value: "textarea", labelKey: "ftTextarea" },
  { value: "number", labelKey: "ftNumber" },
  { value: "date", labelKey: "ftDate" },
  { value: "checkbox", labelKey: "ftCheckbox" },
  { value: "select", labelKey: "ftSelect" },
  { value: "signature", labelKey: "ftSignature" },
];

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[]; // for "select"
}

export interface RoomForm {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
  open: boolean; // closed forms stop accepting submissions
  createdBy: string;
  createdAt?: Timestamp;
}

/** One per user per form: doc id is `${formId}_${uid}`. Signatures are
 *  stored inline as small PNG data-URLs inside `answers`. */
export interface FormSubmission {
  id: string;
  uid: string;
  handle: string;
  formId: string;
  answers: Record<string, string | boolean>;
  submittedAt?: Timestamp;
}

// ---------- Phase 3: milestones & funded outcomes ----------

export type MilestoneStatus = "planned" | "in_progress" | "blocked" | "completed";

/**
 * Status presentation. Colour NEVER carries the meaning on its own — every
 * status ships with its icon and label, because the completed-green and
 * blocked-red are near-identical to red/green colour-blind readers.
 */
export const MILESTONE_STATUS: Record<
  MilestoneStatus,
  { icon: string; color: string; darkColor: string }
> = {
  planned: { icon: "📋", color: "#898781", darkColor: "#898781" },
  in_progress: { icon: "⏳", color: "#4f46e5", darkColor: "#818cf8" },
  blocked: { icon: "⛔", color: "#d03b3b", darkColor: "#d03b3b" },
  completed: { icon: "✅", color: "#0ca30c", darkColor: "#0ca30c" },
};

export const MILESTONE_STATUS_ORDER: MilestoneStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "completed",
];

/**
 * A milestone belongs to ONE member — every project manager runs their own
 * project. Rooms are only a grouping of people whose projects are similar in
 * scope, so `roomId` is context, never ownership. Members see only their own
 * milestones; Admins and Staff Handles see everyone's.
 */
export interface Milestone {
  id: string;
  title: string;
  ownerUid: string; // the member whose project this is
  ownerHandle: string; // handle snapshot for display
  roomId?: string; // optional grouping context
  roomName?: string;
  status: MilestoneStatus;
  fundedAmount: number; // money committed to this milestone
  spentAmount: number; // money released/spent so far
  dueDate?: string; // ISO yyyy-mm-dd
  hindrance?: string; // what is blocking it, when status is "blocked"
  createdBy: string;
  createdAt?: Timestamp;
}

// ---------- Admin-authored alerts to an individual member ----------

/**
 * A timing nudge written by an Admin and delivered to ONE member's dashboard,
 * e.g. "20 days to Milestone 2 — you should finish the survey in 19 days".
 * Only real members receive these; Staff Handles are operator accounts.
 */
export interface MemberAlert {
  id: string;
  targetUid: string;
  targetHandle: string;
  message: string;
  milestoneId?: string;
  milestoneTitle?: string;
  createdBy: string;
  createdAt?: Timestamp;
  read?: boolean;
  readAt?: Timestamp;
}

// ---------- Phase 2: compliance & event logs ----------

export interface ComplianceLog {
  id: string;
  actorUid: string;
  category: string; // e.g. account_created, room_member_added, form_submission
  meta: Record<string, string>;
  at?: Timestamp;
}

export interface DmThread {
  id: string;
  participants: string[]; // exactly two uids
  handles: Record<string, string>; // uid -> handle snapshot for list display
  lastText?: string;
  lastSenderUid?: string;
  updatedAt?: Timestamp;
  /** Set when the SuperAdmin triages this thread in the master inbox. */
  staffReadAt?: Timestamp;
}

export interface DmMessage {
  id: string;
  senderUid: string;
  text: string;
  replyTo?: QuotedMessage;
  fileUrl?: string;
  fileName?: string;
  createdAt?: Timestamp;
}
