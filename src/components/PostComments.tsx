"use client";

// The Quora-style comment thread under a community post. Any active signed-in
// user may add their own comment; the author or an Admin may delete one.
import { useEffect, useState } from "react";
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
import { isAdmin, type PostComment } from "@/lib/types";
import UserBadge from "@/components/UserBadge";

export default function PostComments({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const { t } = useT();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const admin = isAdmin(profile?.role);

  useEffect(() => {
    const q = query(
      collection(db(), "broadcast", postId, "comments"),
      orderBy("createdAt", "asc"),
    );
    return onSnapshot(q, (snap) =>
      setComments(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PostComment)),
    );
  }, [postId]);

  async function add() {
    const body = text.trim();
    if (!body || !user || !profile || busy) return;
    setBusy(true);
    try {
      await addDoc(collection(db(), "broadcast", postId, "comments"), {
        authorUid: user.uid,
        authorHandle: profile.handle,
        text: body,
        createdAt: serverTimestamp(),
      });
      setText("");
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
            <li key={c.id} className="rounded-xl bg-background px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <UserBadge uid={c.authorUid} handle={c.authorHandle} />
                <span className="text-[10px] opacity-40">
                  {c.createdAt?.toDate().toLocaleString() ?? ""}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.text}</p>
              {canDelete(c) && (
                <button
                  type="button"
                  onClick={() => remove(c)}
                  className="mt-1 text-[11px] font-semibold text-red-500"
                >
                  🗑️
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {profile && (
        <div className="mt-2 flex items-end gap-2">
          <textarea
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
      )}
    </div>
  );
}
