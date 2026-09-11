import { describe, expect, it } from "vitest";
import {
  PALETTES,
  contrastRatio,
  resolveSystemColorScheme,
  themeColorForScheme,
} from "./theme";

describe("resolveSystemColorScheme", () => {
  it("uses dark when the system prefers dark", () => {
    expect(resolveSystemColorScheme(true)).toBe("dark");
  });

  it("uses light when the system prefers light", () => {
    expect(resolveSystemColorScheme(false)).toBe("light");
  });

  it("falls back to light when preference is unknown", () => {
    expect(resolveSystemColorScheme(undefined)).toBe("light");
  });
});

describe("themeColorForScheme", () => {
  it("returns the dark chrome color", () => {
    expect(themeColorForScheme("dark")).toBe(PALETTES.dark.bg);
  });

  it("returns the light chrome color", () => {
    expect(themeColorForScheme("light")).toBe(PALETTES.light.bg);
  });

  it("rejects an unknown scheme", () => {
    expect(() => themeColorForScheme("sepia" as "light")).toThrow(/unknown color scheme/i);
  });
});

describe("contrastRatio", () => {
  it("returns 21 for black on white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBe(21);
  });

  it("returns 1 for identical colors", () => {
    expect(contrastRatio("#f4f3ef", "#f4f3ef")).toBe(1);
  });

  it("rejects an invalid hex", () => {
    expect(() => contrastRatio("green", "#000")).toThrow(/invalid hex/i);
  });
});

describe("PALETTES", () => {
  it("meets WCAG AA for text, buttons, and accent on both schemes", () => {
    for (const palette of Object.values(PALETTES)) {
      expect(contrastRatio(palette.text, palette.bg)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(palette.fab, palette.onFab)).toBeGreaterThanOrEqual(7);
      expect(contrastRatio(palette.accent, palette.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.danger, palette.onDanger)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("does not use teal-green for primary actions", () => {
    const teal = "#2a9d8f";
    expect(PALETTES.light.fab.toLowerCase()).not.toBe(teal);
    expect(PALETTES.dark.fab.toLowerCase()).not.toBe(teal);
    expect(PALETTES.light.accent.toLowerCase()).not.toBe("#3d7a62");
    expect(PALETTES.dark.accent.toLowerCase()).not.toBe("#81b29a");
  });
});
