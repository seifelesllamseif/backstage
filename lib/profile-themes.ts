// Per-member profile theme presets — see docs/decisions/0020-profile-theme-presets.md.
//
// Single source of truth for: the zod enum in the server action, the picker
// in the bento edit form, and the [data-theme="..."] selectors in
// styles/globals.css. Adding a preset means touching all three.

export const PROFILE_THEMES = ["dark", "paper", "mocha", "ocean"] as const;

export type ProfileTheme = (typeof PROFILE_THEMES)[number];

export const DEFAULT_PROFILE_THEME: ProfileTheme = "dark";

export const PROFILE_THEME_LABELS: Record<ProfileTheme, string> = {
  dark: "Dark",
  paper: "Paper",
  mocha: "Mocha",
  ocean: "Ocean",
};

// Preview swatches for the picker. Hex values mirror the same palettes
// declared in styles/globals.css under each [data-theme="..."] selector.
// Used only for the small swatch UI in edit mode — runtime styling on the
// bento itself comes from the CSS tokens.
export const PROFILE_THEME_PREVIEW: Record<
  ProfileTheme,
  { bg: string; card: string; accent: string; fg: string }
> = {
  dark: { bg: "#0E0E10", card: "#161618", accent: "#E24B4A", fg: "#F2F2F0" },
  paper: { bg: "#F7F6F2", card: "#FFFFFF", accent: "#D63E3D", fg: "#1A1816" },
  mocha: { bg: "#F5EFE6", card: "#FFFAF2", accent: "#8B5A2B", fg: "#3D2914" },
  ocean: { bg: "#0F1419", card: "#1A2128", accent: "#5DCAA5", fg: "#E8EEF2" },
};

export function isProfileTheme(v: unknown): v is ProfileTheme {
  return typeof v === "string" && (PROFILE_THEMES as readonly string[]).includes(v);
}

export function resolveProfileTheme(v: string | null | undefined): ProfileTheme {
  return isProfileTheme(v) ? v : DEFAULT_PROFILE_THEME;
}
