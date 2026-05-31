import type { SupabaseClient } from '@supabase/supabase-js'

type ProfileSample = {
  email: string
  avatarUrl?: string | null
  bio: string
  socialInstagram?: string | null
  socialLinkedin?: string | null
  socialWhatsapp?: string | null
  languages: string[]
}

export const PROFILE_SAMPLES: readonly ProfileSample[] = [
  {
    email: 'iona.douglas@verbivore.app',
    bio: 'Founder of Verbivore. Builds the team and the product, in that order. Less interested in being right than in shipping what gets used.',
    languages: ['English']
  },
  {
    email: 'seifelesllam.seif@verbivore.app',
    bio: 'Full-stack at Verbivore. Backend to UI, takes things end to end. Believes the boring path is usually the fastest.',
    languages: ['English']
  },
  {
    email: 'maryam.baig@verbivore.app',
    bio: 'Full-stack at Verbivore. Reads RFCs for fun, ships small PRs. Cares about the test that catches the regression before it ships.',
    languages: ['English']
  },
  {
    email: 'asim.selim@verbivore.app',
    bio: 'UI/UX at Verbivore. Flows, components, the friction nobody asked about until it was gone. First sketch fast, ninth iteration slow.',
    languages: ['English']
  },
  {
    email: 'oheneba.bosompem@verbivore.app',
    bio: 'Frontend at Verbivore. React, accessibility, the polish that ships. Thinks rough is faster than wrong and shares early.',
    languages: ['English']
  },
  {
    email: 'corentin.boissie@verbivore.app',
    bio: 'Cybersecurity at Verbivore. Threat models, audits, the controls nobody notices until they save you. Reads incident postmortems on weekends.',
    languages: ['English']
  },
  {
    email: 'radmila.tantaeva@verbivore.app',
    bio: 'Transcription at Verbivore. Captures the spoken word with the precision the written one needs. Faster than you would expect, accurate where it counts.',
    languages: ['English']
  }
]

export async function seedProfileFields(
  supabase: SupabaseClient,
  companyId: string
): Promise<{ updated: number; skipped: number; missing: number }> {
  let updated = 0
  let skipped = 0
  let missing = 0

  for (const profile of PROFILE_SAMPLES) {
    const { data: member, error: lookupErr } = await supabase
      .from('team_members')
      .select('id, bio, languages')
      .eq('company_id', companyId)
      .eq('email', profile.email)
      .maybeSingle()
    if (lookupErr) throw new Error(`profile lookup failed for ${profile.email}: ${lookupErr.message}`)
    if (!member) {
      missing += 1
      continue
    }

    const existingBio = (member.bio as string | null) ?? ''
    const existingLanguages = (member.languages as string[] | null) ?? []
    if (existingBio.trim().length > 0 || existingLanguages.length > 0) {
      skipped += 1
      continue
    }

    const { error: updateErr } = await supabase
      .from('team_members')
      .update({
        bio: profile.bio,
        social_instagram: profile.socialInstagram ?? null,
        social_linkedin: profile.socialLinkedin ?? null,
        social_whatsapp: profile.socialWhatsapp ?? null,
        languages: profile.languages,
        avatar_url: profile.avatarUrl ?? null
      })
      .eq('id', member.id)
    if (updateErr) throw new Error(`profile update failed for ${profile.email}: ${updateErr.message}`)
    updated += 1
  }

  return { updated, skipped, missing }
}
