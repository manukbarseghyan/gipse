import { describe, expect, it } from "vitest";
import { slugify, SLUG_PATTERN } from "@/lib/slug";
import { sanitizeSearchTerm } from "@/lib/data/catalog";
import { validateImageFile, MAX_IMAGE_BYTES } from "@/components/admin/image-uploader";
import { parseCatalogParams } from "@/lib/catalog-params";

describe("slugify", () => {
  it.each([
    ["Angel Figurine", "angel-figurine"],
    ["Հրեշտակ", "hreshtak"],
    ["Գիպսե կատու", "gipse-katu"],
    ["Ангел с крыльями", "angel-s-krylyami"],
    ["  --Crème brûlée!!  ", "creme-brulee"],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
    expect(SLUG_PATTERN.test(slugify(input))).toBe(true);
  });
});

describe("search term sanitising", () => {
  it("strips PostgREST filter syntax", () => {
    expect(sanitizeSearchTerm("cat),name_hy.eq.(x")).toBe("cat name_hy eq x");
    expect(sanitizeSearchTerm("a*b%c")).toBe("a b c");
    expect(sanitizeSearchTerm("x".repeat(100))).toHaveLength(60);
  });

  it("parses catalog query params defensively", () => {
    expect(parseCatalogParams({ sort: "evil", page: "-3", q: ["one", "two"] })).toEqual({ q: "one", category: "", sort: "newest", page: 1 });
    expect(parseCatalogParams({ sort: "price_desc", page: "2", category: "figurines" })).toMatchObject({ sort: "price_desc", page: 2, category: "figurines" });
  });
});

describe("image upload validation", () => {
  it("accepts supported images under 5 MB", () => {
    expect(validateImageFile({ type: "image/webp", size: 1000 })).toBe("ok");
    expect(validateImageFile({ type: "image/jpeg", size: MAX_IMAGE_BYTES })).toBe("ok");
  });

  it("rejects other types and oversized files", () => {
    expect(validateImageFile({ type: "image/svg+xml", size: 10 })).toBe("type");
    expect(validateImageFile({ type: "application/pdf", size: 10 })).toBe("type");
    expect(validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toBe("size");
  });
});
