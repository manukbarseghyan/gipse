import hy from "@/messages/hy.json";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";
import { localeTags, type Locale } from "./config";
import { createTranslator, type Translator } from "./translator";

/** Armenian is the source of truth for the dictionary shape. */
export type Messages = typeof hy;

// Typed assignments: a missing key in ru/en is a compile error.
const ruMessages: Messages = ru;
const enMessages: Messages = en;

const dictionaries: Record<Locale, Messages> = { hy, ru: ruMessages, en: enMessages };

export function getMessages(locale: Locale): Messages {
  return dictionaries[locale];
}

export function getTranslator(locale: Locale): Translator<Messages> {
  return createTranslator(dictionaries[locale], localeTags[locale]);
}

export type StoreTranslator = Translator<Messages>;
