"use client";

// The Quora-style comment thread under a community post. Any active signed-in
// user may add their own comment; the author or an Admin may delete one.
import { useEffect, useRef, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { isAdmin, type PostComment, type QuotedMessage } from "@/lib/types";
import { commentAsHandle } from "@/lib/handleActions";
import UserBadge from "@/components/UserBadge";

export default function PostComments({
  postId,
  collapsed = false,
  onCount,
}: {
  postId: string;
  /** When true, keep listening (so the count stays live) but render nothing. */
  collapsed?: boolean;
  /** Reports the live comment count so the toggle can always show it. */
  onCount?: (n: number) => void;
}) {
  const { user, profile, directory } = useAuth();
  const { t } = useT();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [asUid, setAsUid] = useState(""); // "" = comment as myself
  const [replyTo, setReplyTo] = useState<QuotedMessage | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const admin = isAdmin(profile?.role);
  const isSuper = profile?.role === "superadmin";
  // Staff Handle consultants the SuperAdmin can comment as. Guard against any
  // directory entry missing a handle — an unguarded sort there would throw
  // during render and blank the whole thread for the SuperAdmin only.
  const personas = isSuper
    ? [...directory.values()]
        .filter((e) => e.role === "staff" && typeof e.handle === "string" && e.handle.length > 0)
        .sort((a, b) => a.handle.localeCompare(b.handle))
    : [];

  // Keep the latest callback without re-subscribing the listener.
  const onCountRef = useRef(onCount);
  useEffect(() => {
    onCountRef.current = onCount;
  });

  useEffect(() => {
    const q = query(
      collection(db(), "broadcast", postId, "comments"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PostComment);
        setComments(list);
        onCountRef.current?.(list.length);
      },
      (err) => console.error("Comments listener error", err),
    );
  }, [postId]);

  // Collapsed: the listener above still runs (count stays live), but the
  // thread itself is hidden.
  if (collapsed) return null;

  function startReply(c: PostComment) {
    setReplyTo({ id: c.id, handle: c.authorHandle, text: c.text.slice(0, 160) });
    inputRef.current?.focus();
  }

  async function add() {
    const body = text.trim();
    if (!body || !user || !profile || busy) return;
    setBusy(true);
    try {
      const persona = personas.find((p) => p.uid === asUid);
      if (persona) {
        // SuperAdmin commenting as one of their Staff Handle consultants.
        await commentAsHandle(
          { uid: persona.uid, handle: persona.handle },
          postId,
          body,
          user.uid,
          replyTo,
        );
      } else {
        await addDoc(collection(db(), "broadcast", postId, "comments"), {
          authorUid: user.uid,
          authorHandle: profile.handle,
          text: body,
          ...(replyTo ? { replyTo } : {}),
          createdAt: serverTimestamp(),
        });
      }
      setText("");
      setReplyTo(null);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: PostComment) {
    if (!window.confirm(t("qDeleteComment"))) return;
    await deleteDoc(doc(db(), "broadcast", postId, "comments", c.id)).catch(() => {});
  }

  const canDelete = (c: PostComment) => admin || c.authorUid === user?.uid;

  return (
    <div className="mt-2 border-t border-black/5 pt-2 dark:border-white/10">
      {comments.length === 0 ? (
        <p className="px-1 py-1 text-xs opacity-50">{t("qNoComments")}</p>
      ) : (
        <ul className="space-y-2">
          {comments.map((c) => (
            <li
              key={c.id}
              className={`rounded-xl bg-background px-3 py-2 ${
                replyTo?.id === c.id ? "ring-2 ring-brand" : ""
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <UserBadge uid={c.authorUid} handle={c.authorHandle} />
                <span className="text-[10px] opacity-40">
                  {c.createdAt?.toDate().toLocaleString() ?? ""}
                </span>
              </div>
              {c.replyTo && (
                <div className="mt-1 border-l-2 border-brand/50 bg-brand-soft/40 px-2 py-1 text-[11px] leading-snug">
                  <span className="font-bold text-brand">{c.replyTo.handle}</span>
                  <span className="ml-1 opacity-70">{c.replyTo.text}</span>
                </div>
              )}
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
              <div className="mt-1 flex items-center gap-3">
                {profile && (
                  <button
                    type="button"
                    onClick={() => startReply(c)}
                    className="text-[11px] font-semibold text-brand"
                  >
                    ↩︎ {t("qReply")}
                  </button>
                )}
                {canDelete(c) && (
                  <button
                    type="button"
                    onClick={() => remove(c)}
                    className="text-[11px] font-semibold text-red-500"
                  >
                    🗑️
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {profile && (
        <div className="mt-2 space-y-2">
          {isSuper && personas.length > 0 && (
            <label className="flex items-center gap-2 text-[11px] font-semibold opacity-70">
              {t("commentAsLabel")}
              <select
                value={asUid}
                onChange={(e) => setAsUid(e.target.value)}
                className="rounded-lg border border-black/10 bg-background px-2 py-1 text-xs dark:border-white/10"
              >
                <option value="">{`${t("commentAsSelf")} (${profile.handle})`}</option>
                {personas.map((p) => (
                  <option key={p.uid} value={p.uid}>
                    {p.handle}
                  </option>
                ))}
              </select>
            </label>
          )}
          {replyTo && (
            <div className="flex items-center gap-2 rounded-xl border-l-2 border-brand bg-brand-soft/40 px-2 py-1.5 text-[11px]">
              <div className="min-w-0 flex-1 leading-snug">
                <span className="font-bold text-brand">{t("qReplyingTo", { handle: replyTo.handle })}</span>
                <span className="ml-1 block truncate opacity-70">{replyTo.text}</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                aria-label={t("qCancelReply")}
                className="shrink-0 rounded-full px-1.5 font-bold opacity-60"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={text}
              placeholder={t("qAddComment")}
              onChange={(e) => setText(e.target.value)}
              className="max-h-28 flex-1 resize-none rounded-2xl border border-black/10 bg-background px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/10"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !text.trim()}
              className="shrink-0 rounded-full bg-brand px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              {t("qSendComment")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
