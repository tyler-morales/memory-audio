export type ColorScheme = "light" | "dark";

export type ThemePalette = {
  bg: string;
  text: string;
  fab: string;
  onFab: string;
  accent: string;
  danger: string;
  onDanger: string;
  focus: string;
};

/** Sand + ink surfaces with amber/terracotta chroma. Keep in sync with `app.css`. */
export const PALETTES: Record<ColorScheme, ThemePalette> = {
  light: {
    bg: "#f4f3ef",
    text: "#1c1917",
    fab: "#1c1917",
    onFab: "#faf8f5",
    accent: "#9a3412",
    danger: "#c2410c",
    onDanger: "#fff7ed",
    focus: "#b45309",
  },
  dark: {
    bg: "#121212",
    text: "#f5f2eb",
    fab: "#efece4",
    onFab: "#1c1917",
    accent: "#e8c48a",
    danger: "#e07a5f",
    onDanger: "#1c0c08",
    focus: "#e8c48a",
  },
};

/** Browser chrome / status bar. Keep in sync with `--bg` in `app.css` and `index.html`. */
export const THEME_COLORS = {
  light: PALETTES.light.bg,
  dark: PALETTES.dark.bg,
} as const;

export function resolveSystemColorScheme(
  prefersDark: boolean | undefined,
): ColorScheme {
  return prefersDark === true ? "dark" : "light";
}

export function themeColorForScheme(scheme: ColorScheme): string {
  const color = THEME_COLORS[scheme];
  if (!color) {
    throw new Error(`Unknown color scheme: ${scheme}`);
  }
  return color;
}

export function contrastRatio(a: string, b: string): number {
  const lighter = Math.max(relativeLuminance(a), relativeLuminance(b));
  const darker = Math.min(relativeLuminance(a), relativeLuminance(b));
  return roundContrast((lighter + 0.05) / (darker + 0.05));
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(channelLuminance);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

function parseHex(hex: string): [number, number, number] {
  const raw = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return [
      Number.parseInt(raw[0] + raw[0], 16),
      Number.parseInt(raw[1] + raw[1], 16),
      Number.parseInt(raw[2] + raw[2], 16),
    ];
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return [
      Number.parseInt(raw.slice(0, 2), 16),
      Number.parseInt(raw.slice(2, 4), 16),
      Number.parseInt(raw.slice(4, 6), 16),
    ];
  }
  throw new Error(`Invalid hex color: ${hex}`);
}

function roundContrast(value: number): number {
  return Math.round(value * 100) / 100;
}
