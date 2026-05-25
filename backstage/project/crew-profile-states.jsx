// Crew profile fixtures — four lifecycle states.

// ---------- INCOMING -----------------------------------------------------
const PROFILE_INCOMING = {
  name: 'Lyra Chen',
  role: 'Editorial assistant',
  contract: 'Apprentice',
  pronouns: 'she/her',
  stage: 'incoming',
  startDate: '17 Jun',
  tenure: { label: 'Starts in 12 days', dates: '17 Jun → 15 Sep' },
  skills: {
    primary: {
      name: 'Editorial assistant',
      level: 1,
      note: 'Self-rated at intake. Confirmed during week-2 check-in.'
    },
    secondaryGroups: [
      {
        family: 'Post',
        skills: [
          { name: 'DaVinci Resolve', level: 1 },
          { name: 'Premiere', level: 2 },
          { name: 'Sound editing', level: 1 }
        ]
      },
      {
        family: 'Creative',
        skills: [
          { name: 'Screenwriting (short form)', level: 1 },
          { name: 'Storyboarding', level: 1 }
        ]
      }
    ]
  },
  availability: {
    start: '17 Jun',
    end: '15 Sep',
    mode: 'In studio',
    weekly: 32
  },
  allocations: { total: 0, projects: [] },
  contributions: [],
  redeploymentHistory: []
}

// ---------- ACTIVE -------------------------------------------------------
const PROFILE_ACTIVE = {
  name: 'Tomás Reyes',
  role: 'Lead colorist',
  contract: 'Employee',
  pronouns: 'he/him',
  stage: 'active',
  tenure: { label: '2 yrs 4 mo', dates: 'Joined 18 Feb 2024' },
  skills: {
    primary: {
      name: 'Colorist',
      level: 4,
      note: 'Lead on all Verbivoredoc and trailer pieces since Q2 2024. Mentors apprentices.'
    },
    secondaryGroups: [
      {
        family: 'Post',
        skills: [
          { name: 'DaVinci Resolve', level: 4 },
          { name: 'Conform & finishing', level: 3 },
          { name: 'VFX supervision', level: 2 }
        ]
      },
      {
        family: 'Creative',
        skills: [
          { name: 'Cinematography', level: 2 },
          { name: 'Direction of photography', level: 1 }
        ]
      },
      {
        family: 'Tech',
        skills: [{ name: 'Color pipeline / LUT design', level: 4 }]
      }
    ]
  },
  availability: {
    start: '18 Feb 2024',
    end: 'No end date',
    mode: 'Hybrid · 3 days in',
    weekly: 40
  },
  allocations: {
    total: 85,
    projects: [
      {
        project: 'Helix trailer',
        role: 'Lead colorist',
        percent: 40,
        color: SKAM.info
      },
      {
        project: 'Aurora doc',
        role: 'Lead colorist',
        percent: 25,
        color: '#7B8FA1'
      },
      {
        project: 'Vespera (game)',
        role: 'Color pipeline',
        percent: 15,
        color: SKAM.success
      },
      {
        project: 'Operations',
        role: 'Mentor — Sara',
        percent: 5,
        color: '#C9A6E0'
      }
    ]
  },
  contributions: [
    {
      kind: 'milestone',
      title: 'Helix trailer v2 — color locked',
      project: 'Helix trailer',
      date: '14 May'
    },
    {
      kind: 'task',
      title: 'Aurora ep. 1 — final color pass',
      project: 'Aurora doc',
      date: '02 May'
    },
    {
      kind: 'milestone',
      title: 'Aurora ep. 1 — picture lock',
      project: 'Aurora doc',
      date: '28 Apr'
    },
    {
      kind: 'task',
      title: 'Vespera v0.3 — LUT pack delivered',
      project: 'Vespera (game)',
      date: '14 Apr'
    },
    {
      kind: 'project',
      title: 'Lighthouse short — color (shipped)',
      project: 'Lighthouse',
      date: '03 Apr'
    },
    {
      kind: 'task',
      title: 'Trailer — Vespera reveal grade',
      project: 'Vespera (game)',
      date: '22 Mar'
    }
  ],
  redeploymentHistory: [
    {
      date: '18 Mar',
      from: 'Helix trailer',
      to: 'Aurora doc',
      reason: 'Helix paused 3 weeks · Aurora ep. 1 finishing crunch'
    }
  ]
}

// ---------- WRAPPING UP --------------------------------------------------
const PROFILE_WRAPPING = {
  name: 'Noah Park',
  role: 'Editor',
  contract: 'Apprentice',
  pronouns: 'he/him',
  stage: 'wrapping_up',
  tenure: { label: 'Day 84 of 90', dates: '15 Mar → 14 Jun' },
  daysLeft: 6,
  skills: {
    primary: {
      name: 'Editor',
      level: 2,
      note: 'Assistant editor on Aurora since week 3. Took over ep. 2 cutdown solo from week 8.'
    },
    secondaryGroups: [
      {
        family: 'Post',
        skills: [
          { name: 'Premiere', level: 3 },
          { name: 'Avid Media Composer', level: 1 },
          { name: 'Sound editing', level: 2 }
        ]
      },
      {
        family: 'Creative',
        skills: [
          { name: 'Story structure', level: 2 },
          { name: 'Pacing notes', level: 2 }
        ]
      },
      {
        family: 'Production',
        skills: [{ name: 'Continuity logging', level: 2 }]
      }
    ]
  },
  availability: {
    start: '15 Mar',
    end: '14 Jun',
    endAccent: 'warning',
    mode: 'In studio',
    weekly: 32
  },
  allocations: {
    total: 70,
    projects: [
      {
        project: 'Aurora doc',
        role: 'Assistant editor',
        percent: 60,
        color: '#7B8FA1'
      },
      {
        project: 'Operations',
        role: 'Handoff writing',
        percent: 10,
        color: '#C9A6E0'
      }
    ]
  },
  contributions: [
    {
      kind: 'milestone',
      title: 'Aurora ep. 2 — picture lock (pending review)',
      project: 'Aurora doc',
      date: '08 Jun'
    },
    {
      kind: 'task',
      title: 'Aurora ep. 2 — director notes pass v3',
      project: 'Aurora doc',
      date: '02 Jun'
    },
    {
      kind: 'task',
      title: 'Aurora ep. 1 — assistant edit',
      project: 'Aurora doc',
      date: '12 May'
    },
    {
      kind: 'task',
      title: 'Aurora ep. 1 — selects bins & continuity',
      project: 'Aurora doc',
      date: '24 Apr'
    },
    {
      kind: 'milestone',
      title: 'Studio shadowing — completed (week 2)',
      project: 'Operations',
      date: '01 Apr'
    },
    {
      kind: 'task',
      title: 'Lighthouse short — assistant edit',
      project: 'Lighthouse',
      date: '28 Mar'
    }
  ],
  redeploymentHistory: [
    {
      date: '02 Apr',
      from: 'Lighthouse',
      to: 'Aurora doc',
      reason: 'Lighthouse delivered · Aurora ep. 1 needed an assistant edit'
    }
  ]
}

// ---------- ALUMNI -------------------------------------------------------
const PROFILE_ALUMNI = {
  name: 'Iris Salomon',
  role: 'Editor',
  contract: 'Apprentice',
  pronouns: 'she/her',
  stage: 'alumni',
  alumniDates: '12 Jan → 12 Apr 2026',
  skills: {
    primary: {
      name: 'Editor',
      level: 3,
      note: 'Final assessment by Ada Brennan. Recommended for return as employee in autumn intake.'
    },
    secondaryGroups: [
      {
        family: 'Post',
        skills: [
          { name: 'Premiere', level: 4 },
          { name: 'Avid Media Composer', level: 2 }
        ]
      },
      {
        family: 'Creative',
        skills: [
          { name: 'Story structure', level: 3 },
          { name: 'Pacing notes', level: 3 },
          { name: 'Screenwriting (short form)', level: 2 }
        ]
      }
    ]
  },
  availability: {
    start: '12 Jan 2026',
    end: '12 Apr 2026',
    mode: 'In studio',
    weekly: 32
  },
  allocations: null,
  contributions: [
    {
      kind: 'project',
      title: 'Lighthouse short — editor (shipped)',
      project: 'Lighthouse',
      date: '03 Apr'
    },
    {
      kind: 'milestone',
      title: 'Lighthouse — picture lock',
      project: 'Lighthouse',
      date: '28 Mar'
    },
    {
      kind: 'task',
      title: 'Helix trailer v1 — assistant edit',
      project: 'Helix trailer',
      date: '14 Mar'
    },
    {
      kind: 'task',
      title: 'Aurora ep. 1 — selects bins',
      project: 'Aurora doc',
      date: '02 Mar'
    },
    {
      kind: 'milestone',
      title: 'Mid-term review — passed',
      project: 'Operations',
      date: '24 Feb'
    },
    {
      kind: 'task',
      title: 'Lighthouse — first cut',
      project: 'Lighthouse',
      date: '08 Feb'
    }
  ],
  redeploymentHistory: [
    {
      date: '14 Feb',
      from: 'Aurora doc',
      to: 'Lighthouse',
      reason: 'Lighthouse went into edit · Aurora was overstaffed'
    }
  ]
}

Object.assign(window, {
  PROFILE_INCOMING,
  PROFILE_ACTIVE,
  PROFILE_WRAPPING,
  PROFILE_ALUMNI
})
