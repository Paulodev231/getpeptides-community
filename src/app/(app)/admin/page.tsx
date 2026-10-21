"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import type { DmThread } from "@/lib/types";
import AppShell from "@/components/AppShell";

export default function AdminHome() {
  const { profile } = useAuth();
  const { t } = useT();
  const superadmin = profile?.role === "superadmin";
  const [inboxUnread, setInboxUnread] = useState(0);

  // Live 🔴 badge for the master inbox (SuperAdmin only).
  useEffect(() => {
    if (!superadmin) return;
    let staffUids = new Set<string>();
    let threads: DmThread[] = [];
    const recount = () =>
      setInboxUnread(
        threads.filter((t) => {
          const staffUid = t.participants?.find((p) => staffUids.has(p));
          if (!staffUid || !t.lastSenderUid || t.lastSenderUid === staffUid) return false;
          if (!t.staffReadAt) return true;
          return (t.updatedAt?.toMillis() ?? 0) > t.staffReadAt.toMillis();
        }).length,
      );
    const unsubStaff = onSnapshot(
      query(collection(db(), "users"), where("role", "==", "staff")),
      (snap) => {
        staffUids = new Set(snap.docs.map((d) => d.id));
        recount();
      },
    );
    const unsubThreads = onSnapshot(
      query(collection(db(), "dms"), orderBy("updatedAt", "desc"), limit(200)),
      (snap) => {
        threads = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DmThread);
        recount();
      },
    );
    return () => {
      unsubStaff();
      unsubThreads();
    };
  }, [superadmin]);

  // Community app: only account + persona (Staff Handle) management remains.
  const items = [
    {
      href: "/admin/users",
      icon: "👥",
      title: t("admUsers"),
      desc: t("admUsersDesc"),
      badge: 0,
    },
    ...(superadmin
      ? [
          {
            href: "/admin/console",
            icon: "🎛️",
            title: t("admConsole"),
            desc: t("admConsoleDesc"),
            badge: inboxUnread,
          },
          {
            href: "/admin/staff",
            icon: "🎧",
            title: t("admStaff"),
            desc: t("admStaffDesc"),
            badge: 0,
          },
        ]
      : []),
  ];

  return (
    <AppShell title={`🛡️ ${t("adminPanel")}`}>
      <div className="mx-auto max-w-lg space-y-2 p-3">
        <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide opacity-40">
          {superadmin ? t("admSuperCenter") : t("admConsoleLabel")}
        </p>
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="app-chrome flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-sm active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-soft text-xl">
              {item.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">
                {item.title}
                {item.badge > 0 && (
                  <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                    {t("admUnreadDms", { n: item.badge })}
                  </span>
                )}
              </p>
              <p className="text-xs leading-snug opacity-50">{item.desc}</p>
            </div>
            <span className="opacity-30">›</span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
