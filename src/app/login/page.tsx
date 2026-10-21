"use client";

// Sign in. Anyone can create a free account from here; Admin accounts are
// still minted from the Admin Panel.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signInWithEmailAndPassword } from "firebase/auth";
import { firebaseAuth } from "@/lib/firebase";
import { loginEmailFor, normalizeUsername } from "@/lib/usernames";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { user, loading, configured } = useAuth();
  const { t } = useT();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace("/noticeboard");
  }, [loading, user, router]);

  if (!configured) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
        <span className="text-5xl" aria-hidden>
          🛠️
        </span>
        <h1 className="text-lg font-bold">{t("setupTitle")}</h1>
        <p className="max-w-sm text-sm opacity-70">
          {t("setupBody")}
        </p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      // Usernames resolve to the account's hidden login address. Anything
      // with an "@" is treated as an email, so older accounts still work.
      const typed = username.trim();
      const email = typed.includes("@") && !typed.startsWith("@")
        ? typed
        : await loginEmailFor(normalizeUsername(typed));
      if (!email) throw new Error("unknown-username");
      await signInWithEmailAndPassword(firebaseAuth(), email, password);
      router.replace("/noticeboard");
    } catch {
      setError(t("signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background p-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="app-chrome mb-8 flex flex-col items-center gap-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-3xl shadow-lg">
            👥
          </span>
          <h1 className="text-2xl font-extrabold">Community</h1>
          <p className="text-center text-xs font-medium opacity-60">
            {t("signInTitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("username")}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-surface px-4 py-3.5 text-base outline-none focus:border-brand dark:border-white/10"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-surface px-4 py-3.5 text-base outline-none focus:border-brand dark:border-white/10"
          />
          {error && (
            <p className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-medium text-red-500">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="app-chrome w-full rounded-2xl bg-brand py-3.5 text-base font-bold text-white shadow-md active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? t("signingIn") : t("signIn")}
          </button>
        </form>

        <p className="mt-6 text-center text-xs opacity-70">
          {t("noAccount")}{" "}
          <Link href="/signup" className="font-bold text-brand">
            {t("signUpCta")}
          </Link>
        </p>
      </div>
    </div>
  );
}
