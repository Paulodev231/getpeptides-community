"use client";

// Members directory: everyone in the community — members, admins and the
// Staff Handle consultants — so anyone can find and DM anyone. A SuperAdmin
// can also promote a member to admin (or step one back down) from here.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { syncAllDirectory, upsertDirectoryEntry, type DirectoryEntry } from "@/lib/directory";
import { setUserRole } from "@/lib/adminActions";
import AppShell from "@/components/AppShell";
import AdminTag from "@/components/AdminTag";

const ROLE_RANK: Record<string, number> = { superadmin: 0, admin: 1, staff: 2, member: 3 };

export default function MembersPage() {
  const router = useRouter();
  const { user, profile, directory } = useAuth();
  const { t } = useT();
  const [queryText, setQueryText] = useState("");
  const [busyUid, setBusyUid] = useState("");
  const [syncing, setSyncing] = useState(false);

  const isSuper = profile?.role === "superadmin";
  const isAdmin = profile?.role === "admin" || profile?.role === "superadmin";

  // Admins pull Staff Handles and any pre-directory accounts into the public
  // list automatically on first view (members never see the private profiles).
  useEffect(() => {
    if (!isAdmin) return;
    syncAllDirectory().catch(() => {});
  }, [isAdmin]);

  const members = useMemo(() => {
    const term = queryText.trim().toLowerCase();
    return [...directory.values()]
      .filter((m) => (term ? m.handle.toLowerCase().includes(term) : true))
      .sort(
        (a, b) =>
          (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) ||
          a.handle.localeCompare(b.handle),
      );
  }, [directory, queryText]);

  function messageMember(m: DirectoryEntry) {
    router.push(`/messages/with/${m.uid}?handle=${encodeURIComponent(m.handle)}`);
  }

  async function changeRole(m: DirectoryEntry, nextRole: "admin" | "member") {
    const msg = nextRole === "admin" ? "confirmMakeAdmin" : "confirmRemoveAdmin";
    if (!window.confirm(t(msg, { handle: m.handle }))) return;
    setBusyUid(m.uid);
    try {
      await setUserRole(m.uid, nextRole);
      // Reflect the new role in the public directory right away.
      await upsertDirectoryEntry(m.uid, m.handle, nextRole, m.managed);
    } finally {
      setBusyUid("");
    }
  }

  async function refresh() {
    setSyncing(true);
    try {
      await syncAllDirectory();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <AppShell title={`👥 ${t("membersTitle")}`}>
      <div className="mx-auto max-w-lg space-y-3 p-3">
        <div className="flex items-center gap-2">
          <input
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            placeholder={t("membersSearch")}
            className="flex-1 rounded-2xl border border-black/10 bg-surface px-4 py-2.5 text-sm outline-none focus:border-brand dark:border-white/10"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={refresh}
              disabled={syncing}
              className="shrink-0 rounded-2xl bg-brand-soft px-3 py-2.5 text-xs font-bold text-brand disabled:opacity-50"
            >
              {syncing ? t("syncingMembers") : t("syncMembers")}
            </button>
          )}
        </div>

        <p className="px-1 text-xs opacity-50">
          {t("membersCount", { n: String(members.length) })}
        </p>

        {members.length === 0 ? (
          <p className="pt-16 text-center text-sm opacity-50">{t("membersEmpty")}</p>
        ) : (
          <ul className="space-y-2">
            {members.map((m) => {
              const isSelf = m.uid === user?.uid;
              return (
                <li
                  key={m.uid}
                  className="app-chrome flex items-center gap-3 rounded-2xl bg-surface p-3 shadow-sm"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-bold text-white">
                    {m.handle.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate text-sm font-bold">
                      {m.handle}
                      {isSelf && <span className="text-[10px] opacity-50">· {t("memberYou")}</span>}
                      <AdminTag uid={m.uid} />
                    </p>
                    {isSuper && !isSelf && m.role === "member" && (
                      <button
                        type="button"
                        onClick={() => changeRole(m, "admin")}
                        disabled={busyUid === m.uid}
                        className="mt-1 text-[11px] font-semibold text-brand disabled:opacity-50"
                      >
                        {t("makeAdmin")}
                      </button>
                    )}
                    {isSuper && !isSelf && m.role === "admin" && (
                      <button
                        type="button"
                        onClick={() => changeRole(m, "member")}
                        disabled={busyUid === m.uid}
                        className="mt-1 text-[11px] font-semibold text-red-500 disabled:opacity-50"
                      >
                        {t("removeAdmin")}
                      </button>
                    )}
                  </div>
                  {!isSelf && (
                    <button
                      type="button"
                      onClick={() => messageMember(m)}
                      className="shrink-0 rounded-full bg-brand px-3.5 py-2 text-xs font-bold text-white active:opacity-80"
                    >
                      {t("memberMessage")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <p className="px-1 pt-2 text-center text-[11px] opacity-40">{t("membersStaffNote")}</p>
      </div>
    </AppShell>
  );
}
