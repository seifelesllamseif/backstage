export const PROFILE_THEMES = ['dark', 'paper', 'mocha', 'ocean'] as const

export type ProfileTheme = (typeof PROFILE_THEMES)[number]

export const DEFAULT_PROFILE_THEME: ProfileTheme = 'dark'

export const PROFILE_THEME_LABELS: Record<ProfileTheme, string> = {
  dark: 'Dark',
  paper: 'Paper',
  mocha: 'Mocha',
  ocean: 'Ocean'
}

// Mirror the palettes in styles/globals.css. Picker swatches only; runtime
// styling on the bento comes from the CSS tokens.
export const PROFILE_THEME_PREVIEW: Record<
  ProfileTheme,
  { bg: string; card: string; accent: string; fg: string }
> = {
  dark: { bg: '#0E0E10', card: '#161618', accent: '#E24B4A', fg: '#F2F2F0' },
  paper: { bg: '#F7F6F2', card: '#FFFFFF', accent: '#D63E3D', fg: '#1A1816' },
  mocha: { bg: '#F5EFE6', card: '#FFFAF2', accent: '#8B5A2B', fg: '#3D2914' },
  ocean: { bg: '#0F1419', card: '#1A2128', accent: '#5DCAA5', fg: '#E8EEF2' }
}

export function isProfileTheme(v: unknown): v is ProfileTheme {
  return (
    typeof v === 'string' && (PROFILE_THEMES as readonly string[]).includes(v)
  )
}

export function resolveProfileTheme(
  v: string | null | undefined
): ProfileTheme {
  return isProfileTheme(v) ? v : DEFAULT_PROFILE_THEME
}
