"use client";

// The "Admin" chip shown beside a handle. Reads the public admin roster
// (status/admins), which is the only way members can tell who is an
// administrator — they cannot read anyone else's profile.
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";

export default function AdminTag({ uid }: { uid: string }) {
  const { adminUids, superAdminUids } = useAuth();
  const { t } = useT();
  if (!uid) return null;
  if (superAdminUids.has(uid)) {
    return (
      <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
        {t("superAdminTag")}
      </span>
    );
  }
  if (adminUids.has(uid)) {
    return (
      <span className="rounded-full bg-brand px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
        {t("adminTag")}
      </span>
    );
  }
  return null;
}
