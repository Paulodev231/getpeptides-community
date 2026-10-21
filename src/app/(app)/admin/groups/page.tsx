"use client";

// Admin-only topic-group management: create and delete the topics people can
// file their posts under in the community feed.
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
import type { TopicGroup } from "@/lib/types";
import AppShell from "@/components/AppShell";

export default function AdminGroupsPage() {
  const { user } = useAuth();
  const { t } = useT();
  const [groups, setGroups] = useState<TopicGroup[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const q = query(collection(db(), "groups"), orderBy("name", "asc"));
    return onSnapshot(q, (snap) =>
      setGroups(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as TopicGroup)),
    );
  }, []);

  async function add() {
    const n = name.trim();
    if (!n || !user || busy) return;
    setBusy(true);
    try {
      await addDoc(collection(db(), "groups"), {
        name: n,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
      });
      setName("");
    } finally {
      setBusy(false);
    }
  }

  async function remove(g: TopicGroup) {
    if (!window.confirm(t("groupDelete"))) return;
    await deleteDoc(doc(db(), "groups", g.id)).catch(() => {});
  }

  return (
    <AppShell title={`🗂️ ${t("admGroups")}`}>
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="space-y-2 rounded-3xl bg-surface p-4 shadow-sm">
          <p className="text-sm font-bold">{t("groupManage")}</p>
          <p className="text-[11px] leading-relaxed opacity-50">{t("admGroupsDesc")}</p>
          <div className="flex gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("groupNewName")}
              className="flex-1 rounded-xl border border-black/10 bg-background px-3 py-2.5 text-sm outline-none focus:border-brand dark:border-white/10"
            />
            <button
              type="button"
              onClick={add}
              disabled={busy || !name.trim()}
              className="app-chrome rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-40"
            >
              {t("groupAdd")}
            </button>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl bg-surface shadow-sm">
          {groups.length === 0 ? (
            <p className="p-5 text-center text-sm opacity-50">{t("groupEmpty")}</p>
          ) : (
            <ul className="divide-y divide-black/5 dark:divide-white/10">
              {groups.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-2 px-5 py-3">
                  <span className="text-sm font-semibold">{g.name}</span>
                  <button
                    type="button"
                    onClick={() => remove(g)}
                    className="app-chrome rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-500"
                  >
                    🗑️
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
