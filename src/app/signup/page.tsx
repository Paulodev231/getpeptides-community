"use client";

// Public self-registration. Anyone can create a free member account to post,
// comment and react. Admin accounts are still created from the Admin Panel.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signUpMember } from "@/lib/usernames";
import { useAuth } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";

export default function SignUpPage() {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
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
        <p className="max-w-sm text-sm opacity-70">{t("setupBody")}</p>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signUpMember(displayName, username, password, email || undefined);
      router.replace("/noticeboard");
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "handle-invalid"
          ? t("handleInvalid")
          : code === "username-invalid"
            ? t("usernameInvalid")
            : code === "username-taken"
              ? t("usernameTaken")
              : code === "password-weak"
                ? t("passwordWeak")
                : t("signUpFailed"),
      );
    } finally {
      setBusy(false);
    }
  }

  const inputCls =
    "w-full rounded-2xl border border-black/10 bg-surface px-4 py-3.5 text-base outline-none focus:border-brand dark:border-white/10";

  return (
    <div className="flex min-h-dvh flex-col justify-center bg-background p-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="app-chrome mb-8 flex flex-col items-center gap-2">
          <span className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand text-3xl shadow-lg">
            👥
          </span>
          <h1 className="text-2xl font-extrabold">{t("signUpTitle")}</h1>
          <p className="text-center text-xs font-medium opacity-60">{t("signUpSubtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            required
            placeholder={t("displayName")}
            maxLength={24}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputCls}
          />
          <input
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder={t("username")}
            maxLength={25}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={inputCls}
          />
          <input
            type="email"
            autoComplete="email"
            placeholder={`${t("email")} (${t("optional")})`}
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputCls}
          />
          <input
            type="password"
            required
            autoComplete="new-password"
            minLength={6}
            placeholder={t("password")}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputCls}
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
            {busy ? t("creatingAccount") : t("createAccount")}
          </button>
        </form>

        <p className="mt-6 text-center text-xs opacity-70">
          {t("haveAccount")}{" "}
          <Link href="/login" className="font-bold text-brand">
            {t("signIn")}
          </Link>
        </p>
      </div>
    </div>
  );
}
