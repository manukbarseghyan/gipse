import { Cormorant_Garamond, Manrope, Noto_Sans_Armenian, Noto_Serif_Armenian } from "next/font/google";

// Latin/Cyrillic faces are paired with Noto Armenian faces; the browser picks
// glyphs per character, so Armenian, Russian and English all render in a
// matching style.

export const bodyFont = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-body",
  display: "swap",
});

export const headingFont = Cormorant_Garamond({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-heading",
  display: "swap",
});

export const armenianSans = Noto_Sans_Armenian({
  subsets: ["armenian"],
  variable: "--font-armenian-sans",
  display: "swap",
});

export const armenianSerif = Noto_Serif_Armenian({
  subsets: ["armenian"],
  weight: ["400", "500", "600"],
  variable: "--font-armenian-serif",
  display: "swap",
});

export const fontVariables = [bodyFont.variable, headingFont.variable, armenianSans.variable, armenianSerif.variable].join(" ");
