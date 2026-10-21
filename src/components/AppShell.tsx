"use client";

// The native-app chrome: fixed header (with presence counter + drawer),
// scrollable content area, and a fixed bottom tab bar.
import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { useNotifications } from "@/context/NotificationContext";
import { hasRoleTag, isAdmin } from "@/lib/types";
import PresenceCounter from "@/components/PresenceCounter";
import OfflineBanner from "@/components/OfflineBanner";

const TABS = [
  { href: "/noticeboard", key: "navNoticeboard", icon: "🏠" },
  { href: "/members", key: "navMembers", icon: "👥" },
  { href: "/messages", key: "navMessages", icon: "💬" },
  { href: "/profile", key: "navDashboard", icon: "👤" },
] as const;

export default function AppShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { profile, logout } = useAuth();
  const { t } = useT();
  const { broadcastUnread } = useNotifications();
  const admin = isAdmin(profile?.role);
  const badgeFor = (href: string) => (href === "/noticeboard" ? broadcastUnread : 0);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* Header */}
      <header className="app-chrome safe-top z-20 bg-brand text-white shadow-md dark:bg-surface">
        <div className="flex h-14 items-center gap-3 px-3">
          <button
            type="button"
            aria-label={t("openMenu")}
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-xl active:bg-white/15"
          >
            ☰
          </button>
          <h1 className="flex-1 truncate text-base font-bold">{title}</h1>
          <PresenceCounter />
        </div>
      </header>

      <OfflineBanner />

      {/* Screen content */}
      <main className="screen flex-1 overflow-y-auto no-scrollbar">{children}</main>

      {/* Bottom tab bar */}
      <nav className="app-chrome safe-bottom z-20 border-t border-black/5 bg-surface shadow-[0_-2px_10px_rgba(0,0,0,0.06)] dark:border-white/10">
        <div className="mx-auto flex max-w-lg">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            const badge = badgeFor(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors ${
                  active ? "text-brand" : "opacity-50"
                } active:opacity-80`}
              >
                <span className="relative text-xl leading-none">
                  {tab.icon}
                  {badge > 0 && (
                    <span className="absolute -right-2.5 -top-1 min-w-[16px] rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {t(tab.key)}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t("closeMenu")}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="app-chrome safe-top absolute left-0 top-0 h-full w-72 max-w-[80vw] bg-surface p-4 shadow-2xl">
            <div className="mb-6 flex items-center gap-3 pt-2">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white">
                {(profile?.handle ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <div>
                <p className="text-sm font-bold">{profile?.handle ?? "…"}</p>
                {hasRoleTag(profile?.role) && (
                  <p className="text-xs font-semibold text-brand">{t("adminTag")}</p>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {TABS.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold active:bg-brand-soft"
                >
                  <span>{tab.icon}</span> {t(tab.key)}
                </Link>
              ))}
              {admin && (
                <Link
                  href="/admin"
                  onClick={() => setDrawerOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-brand active:bg-brand-soft"
                >
                  <span>🛡️</span> {t("adminPanel")}
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  router.replace("/login");
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold text-red-500 active:bg-red-500/10"
              >
                <span>🚪</span> {t("signOut")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
