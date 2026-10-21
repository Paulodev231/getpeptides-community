// Translations for the whole app — every screen a person can open, including
// the Admin Panel and the Handle Console.
//
// The language follows the phone automatically; anyone can override it from
// their dashboard. Add a key to `en` first: the other languages are typed
// `Record<TranslationKey, string>`, so a missing translation is a build error.
import { en } from "./en";

// English-only app. (The multi-language machinery is kept so `t(...)` call
// sites stay unchanged, but there is a single dictionary.)
export const LANGUAGES = [
  { code: "en", label: "English", flag: "\u{1F1EC}\u{1F1E7}" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];
export type TranslationKey = keyof typeof en;

/** Values substituted into a translation, written as {name} in the text. */
export type TranslationParams = Record<string, string | number>;

/** No right-to-left languages are enabled (English only). */
export function isRtl(lang: Lang): boolean {
  return (lang as string) === "ar";
}

const DICTIONARIES: Record<Lang, Record<TranslationKey, string>> = { en };

/** Always English. */
export function detectLanguage(): Lang {
  return "en";
}

export function translate(
  lang: Lang,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  let text: string = DICTIONARIES[lang]?.[key] ?? en[key];
  if (params) {
    for (const [name, value] of Object.entries(params)) {
      text = text.split(`{${name}}`).join(String(value));
    }
  }
  return text;
}

/** Translation key for each role, so every screen names them identically. */
export const ROLE_KEYS = {
  member: "roleMember",
  staff: "roleStaff",
  admin: "roleAdmin",
  superadmin: "roleSuperadmin",
} as const satisfies Record<string, TranslationKey>;

/** Translation key for each milestone status. */
export const MILESTONE_STATUS_KEYS = {
  planned: "msPlanned",
  in_progress: "msInProgress",
  blocked: "msBlocked",
  completed: "msCompleted",
} as const satisfies Record<string, TranslationKey>;
