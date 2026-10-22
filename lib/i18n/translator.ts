// Tiny, dependency-free translator shared by server and client components.
// Keys are type-checked dot paths into the message dictionary.

type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${P}${K}`
    : T[K] extends Record<string, unknown>
      ? Leaves<T[K], `${P}${K}.`>
      : never;
}[keyof T & string];

export type MessageKey<M> = Leaves<M>;
export type Values = Record<string, string | number>;

export type Translator<M> = {
  (key: MessageKey<M>, values?: Values): string;
  /** Plural-aware lookup: reads `${key}.${category}` and falls back to `.other`. */
  plural(key: string, count: number, values?: Values): string;
  /** Lookup with a runtime-built key (e.g. status codes); returns `fallback` when missing. */
  dynamic(key: string, fallback?: string, values?: Values): string;
};

function lookup(messages: unknown, path: string): string | undefined {
  let node: unknown = messages;
  for (const part of path.split(".")) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
}

export function interpolate(template: string, values?: Values): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match,
  );
}

export function createTranslator<M>(messages: M, localeTag: string): Translator<M> {
  const pluralRules = new Intl.PluralRules(localeTag);

  const translate = (key: MessageKey<M>, values?: Values): string => {
    const path: string = key;
    const message = lookup(messages, path);
    // Every key is checked at compile time and by tests/i18n.test.ts, so a miss
    // here is a programming error; render the key's last segment rather than crash.
    return interpolate(message ?? path.split(".").pop() ?? path, values);
  };

  const plural = (key: string, count: number, values?: Values): string => {
    const category = pluralRules.select(count);
    const message = lookup(messages, `${key}.${category}`) ?? lookup(messages, `${key}.other`) ?? key;
    return interpolate(message, { count, ...values });
  };

  const dynamic = (key: string, fallback?: string, values?: Values): string => {
    const message = lookup(messages, key);
    return interpolate(message ?? fallback ?? key, values);
  };

  return Object.assign(translate, { plural, dynamic });
}
