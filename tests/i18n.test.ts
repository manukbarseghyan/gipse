import { describe, expect, it } from "vitest";
import hy from "@/messages/hy.json";
import ru from "@/messages/ru.json";
import en from "@/messages/en.json";
import adminHy from "@/messages/admin/hy.json";
import adminRu from "@/messages/admin/ru.json";
import adminEn from "@/messages/admin/en.json";
import { getTranslator } from "@/lib/i18n/messages";
import { createTranslator } from "@/lib/i18n/translator";
import { localized, localizedFromMap } from "@/lib/i18n/localized";
import { isLocale, locales } from "@/lib/i18n/config";

type Tree = { [key: string]: string | Tree };

const PLURAL_CATEGORIES = new Set(["zero", "one", "two", "few", "many", "other"]);

/** Flattens to dot paths; plural objects collapse to their parent key. */
function flatten(tree: Tree, prefix = ""): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, [value]);
    else if (Object.keys(value).every((k) => PLURAL_CATEGORIES.has(k))) out.set(path, Object.values(value) as string[]);
    else for (const [k, v] of flatten(value, path)) out.set(k, v);
  }
  return out;
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe.each([
  ["storefront", { hy, ru, en }],
  ["admin", { hy: adminHy, ru: adminRu, en: adminEn }],
])("%s dictionaries", (_name, dictionaries) => {
  const flat = Object.fromEntries(Object.entries(dictionaries).map(([locale, tree]) => [locale, flatten(tree as Tree)]));
  const reference = flat.hy!;

  it("have exactly the same keys in Armenian, Russian and English", () => {
    for (const locale of ["ru", "en"]) {
      expect([...flat[locale]!.keys()].sort()).toEqual([...reference.keys()].sort());
    }
  });

  it("contain no empty or untranslated placeholder strings", () => {
    for (const [locale, entries] of Object.entries(flat)) {
      for (const [key, values] of entries) {
        for (const value of values) {
          expect(value.trim(), `${locale}:${key}`).not.toBe("");
          expect(value, `${locale}:${key}`).not.toMatch(/TODO|TRANSLATE|^\w+\.\w+$/);
        }
      }
    }
  });

  it("use the same interpolation variables in every language", () => {
    for (const [key, values] of reference) {
      const expected = placeholders(values[0]!);
      for (const locale of ["ru", "en"]) {
        for (const value of flat[locale]!.get(key)!) expect(placeholders(value), `${locale}:${key}`).toEqual(expected);
      }
    }
  });
});

describe("translator", () => {
  it("translates and interpolates in all locales", () => {
    expect(getTranslator("hy")("home.heroCta")).toBe("Դիտել ապրանքները");
    expect(getTranslator("ru")("home.heroCta")).toBe("Смотреть товары");
    expect(getTranslator("en")("home.heroCta")).toBe("Shop Products");
    expect(getTranslator("en")("meta.orderTitle", { number: "GP-1001" })).toBe("Order GP-1001");
  });

  it("selects Russian plural forms correctly", () => {
    const t = getTranslator("ru");
    expect(t.plural("catalog.results", 1)).toBe("1 товар");
    expect(t.plural("catalog.results", 3)).toBe("3 товара");
    expect(t.plural("catalog.results", 5)).toBe("5 товаров");
    expect(t.plural("catalog.results", 21)).toBe("21 товар");
    expect(getTranslator("en").plural("catalog.results", 1)).toBe("1 product");
    expect(getTranslator("en").plural("catalog.results", 2)).toBe("2 products");
  });

  it("falls back for dynamic keys instead of showing raw keys", () => {
    const t = createTranslator({ a: { b: "B" } }, "en");
    expect(t.dynamic("a.b")).toBe("B");
    expect(t.dynamic("a.missing", "fallback")).toBe("fallback");
  });

  it("recognises supported locales only", () => {
    expect(locales).toEqual(["hy", "ru", "en"]);
    expect(isLocale("hy")).toBe(true);
    expect(isLocale("de")).toBe(false);
    expect(isLocale(undefined)).toBe(false);
  });
});

describe("database content fallback", () => {
  const product = { name_hy: "Հրեշտակ", name_ru: "", name_en: null, description_hy: "Նկարագրություն", description_ru: "Описание", description_en: "  " };

  it("uses the requested language when present", () => {
    expect(localized(product, "name", "hy")).toBe("Հրեշտակ");
    expect(localized(product, "description", "ru")).toBe("Описание");
  });

  it("falls back to Armenian (then the other language) when missing", () => {
    expect(localized(product, "name", "ru")).toBe("Հրեշտակ");
    expect(localized(product, "name", "en")).toBe("Հրեշտակ");
    expect(localized(product, "description", "en")).toBe("Նկարագրություն");
    expect(localized({ name_hy: "", name_ru: "Только русский", name_en: null }, "name", "en")).toBe("Только русский");
  });

  it("applies the same rules to order snapshots", () => {
    expect(localizedFromMap({ hy: "Հրեշտակ", en: "Angel" }, "en")).toBe("Angel");
    expect(localizedFromMap({ hy: "Հրեշտակ" }, "ru")).toBe("Հրեշտակ");
    expect(localizedFromMap(null, "ru")).toBe("");
  });
});
