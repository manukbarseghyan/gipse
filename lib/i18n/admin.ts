import hy from "@/messages/admin/hy.json";
import ru from "@/messages/admin/ru.json";
import en from "@/messages/admin/en.json";
import { localeTags, type Locale } from "./config";
import { createTranslator, type Translator } from "./translator";

export type AdminMessages = typeof hy;

const ruMessages: AdminMessages = ru;
const enMessages: AdminMessages = en;
const dictionaries: Record<Locale, AdminMessages> = { hy, ru: ruMessages, en: enMessages };

export function getAdminMessages(locale: Locale): AdminMessages {
  return dictionaries[locale];
}

export type AdminTranslator = Translator<AdminMessages>;

export function getAdminTranslator(locale: Locale): AdminTranslator {
  return createTranslator(dictionaries[locale], localeTags[locale]);
}
