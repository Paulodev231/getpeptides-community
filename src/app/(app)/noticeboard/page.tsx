"use client";

// 🏠 Community — a Quora-style feed. Admins / SuperAdmins (and Staff Handles
// via the Handle Console) post topics with an optional image link; everyone
// active can react with an emoji and comment underneath.
import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import {
  isAdmin,
  REACTION_EMOJIS,
  tallyReactions,
  type BroadcastPost,
  type TopicGroup,
} from "@/lib/types";
import { logEvent } from "@/lib/log";
import { deleteBroadcastPost, setPostPinned } from "@/lib/adminActions";
import { markSeen, seenKeys } from "@/lib/seen";
import AppShell from "@/components/AppShell";
import MediaAttachment from "@/components/MediaAttachment";
import UserBadge from "@/components/UserBadge";
import PostComments from "@/components/PostComments";

export default function CommunityPage() {
  const { user, profile } = useAuth();
  const { t } = useT();
  const [posts, setPosts] = useState<BroadcastPost[]>([]);
  const admin = isAdmin(profile?.role);

  // Topic groups
  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");

  // Admin composer
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [groupId, setGroupId] = useState("");
  const [posting, setPosting] = useState(false);

  // Admin edit
  const [editingId, setEditingId] = useState<string | null>(null);
  const [eTitle, setETitle] = useState("");
  const [eBody, setEBody] = useState("");
  const [eImage, setEImage] = useState("");

  // Which posts have their comment thread open
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const q = query(collection(db(), "broadcast"), orderBy("createdAt", "desc"), limit(60));
    return onSnapshot(q, (snap) =>
      setPosts(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as BroadcastPost)),
    );
  }, []);

  useEffect(() => {
    const q = query(collection(db(), "groups"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) =>
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TopicGroup)),
    );
  }, []);

  useEffect(() => {
    if (posts.length > 0) markSeen(seenKeys.broadcast);
  }, [posts]);

  async function addGroup() {
    const name = newGroupName.trim();
    if (!name || !user) return;
    await addDoc(collection(db(), "groups"), {
      name,
      createdBy: user.uid,
      createdAt: serverTimestamp(),
    }).catch(() => {});
    setNewGroupName("");
  }

  async function removeGroup(g: TopicGroup) {
    if (!window.confirm(t("groupDelete"))) return;
    await deleteDoc(doc(db(), "groups", g.id)).catch(() => {});
    if (selectedGroup === g.id) setSelectedGroup(null);
    if (groupId === g.id) setGroupId("");
  }

  async function createPost() {
    if (!user || !profile || posting) return;
    const tt = title.trim();
    const bb = body.trim();
    const img = imageUrl.trim();
    if (!tt && !bb && !img) return;
    const group = groups.find((g) => g.id === groupId);
    setPosting(true);
    try {
      await addDoc(collection(db(), "broadcast"), {
        authorUid: user.uid,
        authorHandle: profile.handle,
        title: tt,
        text: bb,
        reactions: {},
        pinned: false,
        ...(group ? { groupId: group.id, groupName: group.name } : {}),
        ...(img ? { mediaUrl: img, mediaType: "image" as const } : {}),
        createdAt: serverTimestamp(),
      });
      logEvent(user.uid, "broadcast_post", img ? { media: "image" } : {});
      setTitle("");
      setBody("");
      setImageUrl("");
    } finally {
      setPosting(false);
    }
  }

  function startEdit(p: BroadcastPost) {
    setEditingId(p.id);
    setETitle(p.title ?? "");
    setEBody(p.text ?? "");
    setEImage(p.mediaType === "image" && p.mediaUrl ? p.mediaUrl : "");
  }

  async function saveEdit(id: string) {
    const img = eImage.trim();
    await updateDoc(doc(db(), "broadcast", id), {
      title: eTitle.trim(),
      text: eBody.trim(),
      mediaUrl: img ? img : deleteField(),
      mediaType: img ? "image" : deleteField(),
      editedAt: serverTimestamp(),
    }).catch(() => {});
    setEditingId(null);
  }

  /** One reaction per person per post: tapping the same emoji clears it. */
  async function react(post: BroadcastPost, emoji: string) {
    if (!user) return;
    const mine = post.reactions?.[user.uid];
    await updateDoc(doc(db(), "broadcast", post.id), {
      [`reactions.${user.uid}`]: mine === emoji ? deleteField() : emoji,
    }).catch(() => {});
  }

  // Pinned posts first, then newest.
  const ordered = [...posts].sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0);
  });
  // Filter in JS by the selected group (never query filter+sort — it needs a
  // composite index and the listener fails silently without one).
  const visible = selectedGroup ? ordered.filter((p) => p.groupId === selectedGroup) : ordered;

  const canPost = Boolean(title.trim() || body.trim() || imageUrl.trim());

  return (
    <AppShell title={`🏠 ${t("noticeboard")}`}>
      <div className="mx-auto flex min-h-full max-w-lg flex-col">
        {/* Admin / SuperAdmin composer */}
        {admin && (
          <div className="border-b border-black/5 bg-surface p-3 dark:border-white/10">
            {/* Manage topic groups */}
            <div className="mb-2">
              <p className="mb-1 text-[11px] font-semibold opacity-50">{t("groupManage")}</p>
              {groups.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {groups.map((g) => (
                    <span
                      key={g.id}
                      className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-semibold text-brand"
                    >
                      {g.name}
                      <button
                        type="button"
                        aria-label="remove"
                        onClick={() => removeGroup(g)}
                        className="opacity-60"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t("groupNewName")}
                  className="flex-1 rounded-xl border border-black/10 bg-background px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/10"
                />
                <button
                  type="button"
                  onClick={addGroup}
                  disabled={!newGroupName.trim()}
                  className="rounded-xl bg-background px-3 py-2 text-xs font-bold disabled:opacity-40"
                >
                  {t("groupAdd")}
                </button>
              </div>
            </div>

            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t("qTitlePlaceholder")}
              className="w-full rounded-xl border border-black/10 bg-background px-3 py-2.5 text-base font-semibold outline-none focus:border-brand dark:border-white/10"
            />
            <textarea
              rows={2}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder={t("qBodyPlaceholder")}
              className="mt-2 w-full resize-none rounded-xl border border-black/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-white/10"
            />
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder={t("qImageUrl")}
              inputMode="url"
              className="mt-2 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/10"
            />
            {imageUrl.trim() && <MediaAttachment url={imageUrl.trim()} type="image" />}
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              className="mt-2 w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/10"
            >
              <option value="">{t("groupNone")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={createPost}
              disabled={posting || !canPost}
              className="mt-2 w-full rounded-xl bg-brand py-2.5 text-sm font-bold text-white disabled:opacity-40"
            >
              {posting ? t("qPosting") : t("qPost")}
            </button>
          </div>
        )}

        {/* Topic filter */}
        {groups.length > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-black/5 bg-surface px-3 py-2 dark:border-white/10">
            <button
              type="button"
              onClick={() => setSelectedGroup(null)}
              className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                selectedGroup === null ? "bg-brand text-white" : "bg-background"
              }`}
            >
              {t("groupsAll")}
            </button>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroup(g.id)}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold transition ${
                  selectedGroup === g.id ? "bg-brand text-white" : "bg-background"
                }`}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 space-y-3 p-3">
          {visible.length === 0 && (
            <p className="pt-16 text-center text-sm opacity-50">{t("noticeboardEmpty")}</p>
          )}

          {visible.map((p) => {
            const mine = user ? p.reactions?.[user.uid] : undefined;
            const tally = tallyReactions(p.reactions, p.handleReactions);
            const editing = editingId === p.id;
            const showComments = !!openComments[p.id];
            return (
              <article
                key={p.id}
                className={`rounded-2xl bg-surface p-4 shadow-sm ${p.pinned ? "ring-1 ring-brand" : ""}`}
              >
                {p.pinned && (
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand">
                    📌 {t("pinned")}
                  </p>
                )}

                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <UserBadge uid={p.authorUid} handle={p.authorHandle} />
                  <span className="text-[10px] opacity-40">
                    {p.createdAt?.toDate().toLocaleString() ?? ""}
                    {p.editedAt ? ` · ${t("edited")}` : ""}
                  </span>
                </div>

                {editing ? (
                  <div className="space-y-2">
                    <input
                      value={eTitle}
                      onChange={(e) => setETitle(e.target.value)}
                      placeholder={t("qTitlePlaceholder")}
                      className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm font-semibold outline-none focus:border-brand dark:border-white/10"
                    />
                    <textarea
                      rows={4}
                      value={eBody}
                      onChange={(e) => setEBody(e.target.value)}
                      placeholder={t("qBodyPlaceholder")}
                      className="w-full resize-none rounded-xl border border-black/10 bg-background px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/10"
                    />
                    <input
                      value={eImage}
                      onChange={(e) => setEImage(e.target.value)}
                      placeholder={t("qImageUrl")}
                      className="w-full rounded-xl border border-black/10 bg-background px-3 py-2 text-sm outline-none focus:border-brand dark:border-white/10"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="app-chrome flex-1 rounded-xl bg-background py-2 text-xs font-bold"
                      >
                        {t("cancel")}
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(p.id)}
                        className="app-chrome flex-1 rounded-xl bg-brand py-2 text-xs font-bold text-white"
                      >
                        {t("saveChanges")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    {p.groupName && (
                      <span className="mb-1 mr-1 inline-block rounded-full bg-brand-soft px-2 py-0.5 text-[10px] font-bold text-brand">
                        {p.groupName}
                      </span>
                    )}
                    {p.title && <h2 className="text-lg font-bold leading-snug">{p.title}</h2>}
                    {p.text && (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{p.text}</p>
                    )}
                    {p.mediaUrl && (
                      <MediaAttachment url={p.mediaUrl} type={p.mediaType} name={p.mediaName} />
                    )}
                  </>
                )}

                {/* Reaction tally */}
                {tally.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {tally.map((item) => (
                      <span
                        key={item.emoji}
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          mine === item.emoji ? "bg-brand text-white" : "bg-background"
                        }`}
                      >
                        {item.emoji} {item.count}
                      </span>
                    ))}
                  </div>
                )}

                {/* Reaction bar */}
                <div className="mt-2 flex flex-wrap gap-1 border-t border-black/5 pt-2 dark:border-white/10">
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => react(p, emoji)}
                      aria-label={t("cnReactAria", { emoji })}
                      className={`app-chrome flex h-9 w-9 items-center justify-center rounded-xl text-lg transition active:scale-125 ${
                        mine === emoji ? "bg-brand-soft ring-1 ring-brand" : "active:bg-brand-soft"
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>

                {/* Comments */}
                <button
                  type="button"
                  onClick={() => setOpenComments((m) => ({ ...m, [p.id]: !m[p.id] }))}
                  className="mt-2 text-xs font-semibold text-brand"
                >
                  💬 {showComments ? t("qHideComments") : t("qComments")}
                </button>
                {showComments && <PostComments postId={p.id} />}

                {/* Admin controls */}
                {admin && !editing && (
                  <div className="mt-2 flex gap-1.5 border-t border-black/5 pt-2 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => startEdit(p)}
                      className="app-chrome flex-1 rounded-lg bg-background py-1.5 text-[11px] font-bold"
                    >
                      {t("edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPostPinned(p.id, !p.pinned)}
                      className={`app-chrome flex-1 rounded-lg py-1.5 text-[11px] font-bold ${
                        p.pinned ? "bg-brand text-white" : "bg-background"
                      }`}
                    >
                      {p.pinned ? t("unpin") : t("pin")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(t("cnDeletePostConfirm"))) deleteBroadcastPost(p.id);
                      }}
                      className="app-chrome rounded-lg bg-red-500/10 px-3 py-1.5 text-[11px] font-bold text-red-500"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </AppShell>
  );
}
