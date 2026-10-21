"use client";

// Account page: profile header, notification + account settings, sign out.
// (The project-management dashboard sections were removed — this is a
// community app now.)
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import { hasRoleTag, isAdmin } from "@/lib/types";
import AppShell from "@/components/AppShell";
import AccountSettings from "@/components/AccountSettings";
import NotificationSettings from "@/components/NotificationSettings";

export default function AccountPage() {
  const { profile, logout } = useAuth();
  const { t } = useT();
  const router = useRouter();

  return (
    <AppShell title={`👤 ${t("myProfile")}`}>
      <div className="mx-auto max-w-lg space-y-4 p-4">
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-surface p-6 shadow-sm">
          <span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-3xl font-bold text-white">
            {(profile?.handle ?? "?").slice(0, 1).toUpperCase()}
          </span>
          <p className="text-lg font-extrabold">{profile?.handle}</p>
          {hasRoleTag(profile?.role) && (
            <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
              {t("adminTag")}
            </span>
          )}
          {profile?.username && (
            <p className="text-xs font-semibold opacity-60">@{profile.username}</p>
          )}
          {profile?.email && <p className="text-xs opacity-50">{profile.email}</p>}
        </div>

        <NotificationSettings />

        <AccountSettings />

        <div className="overflow-hidden rounded-3xl bg-surface shadow-sm">
          {isAdmin(profile?.role) && (
            <Link
              href="/admin"
              className="app-chrome flex items-center gap-3 border-b border-black/5 px-5 py-4 text-sm font-semibold active:bg-brand-soft dark:border-white/10"
            >
              🛡️ {t("adminPanel")} <span className="ml-auto opacity-30">›</span>
            </Link>
          )}
          <button
            type="button"
            onClick={async () => {
              await logout();
              router.replace("/login");
            }}
            className="app-chrome flex w-full items-center gap-3 px-5 py-4 text-left text-sm font-semibold text-red-500 active:bg-red-500/10"
          >
            🚪 {t("signOut")}
          </button>
        </div>

        <p className="text-center text-[10px] leading-relaxed opacity-40">
          {t("profileFooter")}
          <br />
          {t("profileFooterPrivacy")}
        </p>
      </div>
    </AppShell>
  );
}
