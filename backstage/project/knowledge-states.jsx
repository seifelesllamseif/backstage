// Knowledge base fixtures — populated state, empty state, gap list.

const KB_DOCS = [
  // Production
  { id: 'd01', title: 'Shot log conventions',                kind: 'SOP',     scope: 'Company',         owner: 'Ada Brennan',  status: 'verified', lastVerified: '08 May' },
  { id: 'd02', title: 'On-set safety checklist',             kind: 'Policy',  scope: 'Company',         owner: 'Ada Brennan',  status: 'verified', lastVerified: '14 Apr' },
  { id: 'd03', title: 'Production assistant — role guide',   kind: 'Role',    scope: 'Company',         owner: 'Tomás Reyes',  status: 'verified', lastVerified: '02 May' },
  // Editorial / post
  { id: 'd04', title: 'Premiere project structure',          kind: 'SOP',     scope: 'Company',         owner: 'Noah Park',    status: 'outdated', lastVerified: '12 Dec' },
  { id: 'd05', title: 'Selects bin conventions',             kind: 'SOP',     scope: 'Aurora doc',      owner: 'Noah Park',    status: 'draft',    lastVerified: null },
  { id: 'd06', title: 'Conform & finishing checklist',       kind: 'SOP',     scope: 'Company',         owner: null,           status: 'verified', lastVerified: '20 Feb' },
  { id: 'd07', title: 'Color pipeline / LUT design',         kind: 'Guide',   scope: 'Company',         owner: 'Tomás Reyes',  status: 'verified', lastVerified: '16 May' },
  // Sound
  { id: 'd08', title: 'Final mix bus settings',              kind: 'SOP',     scope: 'Company',         owner: 'Maya Okafor',  status: 'expired',  lastVerified: '14 Nov' },
  { id: 'd09', title: 'Foley conventions',                    kind: 'SOP',     scope: 'Company',         owner: 'Maya Okafor',  status: 'verified', lastVerified: '03 May' },
  // Game
  { id: 'd10', title: 'Vespera bible',                        kind: 'Guide',   scope: 'Vespera (game)',  owner: 'Jonas Weiß',   status: 'verified', lastVerified: '21 Apr' },
  { id: 'd11', title: 'Engine onboarding — Vespera',          kind: 'Guide',   scope: 'Vespera (game)',  owner: 'Jonas Weiß',   status: 'verified', lastVerified: '14 Apr' },
  // Operations / HR
  { id: 'd12', title: 'Apprentice handbook',                 kind: 'Policy',  scope: 'Company',         owner: 'Ada Brennan',  status: 'verified', lastVerified: '06 May' },
  { id: 'd13', title: 'Mentor playbook',                      kind: 'Guide',   scope: 'Company',         owner: 'Ada Brennan',  status: 'verified', lastVerified: '14 May' },
  { id: 'd14', title: 'How handoffs work',                    kind: 'Guide',   scope: 'Company',         owner: 'Tomás Reyes',  status: 'verified', lastVerified: '10 May' },
  { id: 'd15', title: 'Equipment loan terms',                kind: 'Policy',  scope: 'Company',         owner: null,           status: 'expired',  lastVerified: '02 Nov' },
  // Marketing / press
  { id: 'd16', title: 'Press kit deliverables',              kind: 'SOP',     scope: 'Aurora doc',      owner: 'Ada Brennan',  status: 'empty',    lastVerified: null },
  { id: 'd17', title: 'Festival application kit',            kind: 'Guide',   scope: 'Aurora doc',      owner: null,           status: 'draft',    lastVerified: null },
];

const KB_GAPS = [
  {
    question: 'Where do I put the final render of an Aurora episode?',
    askers: ['Sara Lindqvist', 'Noah Park', 'Jakub Nowak'],
    count: 7,
    lastAsked: '3 days ago',
  },
  {
    question: 'What\'s the LUT for daylight exteriors on Aurora ep. 3?',
    askers: ['Maya Okafor'],
    count: 2,
    lastAsked: '5 days ago',
  },
  {
    question: 'Who approves an extension to an apprentice contract?',
    askers: ['Tomás Reyes', 'Ada Brennan'],
    count: 4,
    lastAsked: 'yesterday',
  },
  {
    question: 'How do we credit composers on the deliverable lower-third?',
    askers: ['Amani Okello'],
    count: 1,
    lastAsked: 'today',
  },
  {
    question: 'Where do I file expenses for an on-location shoot?',
    askers: ['Sara Lindqvist', 'Priya Sundaram'],
    count: 3,
    lastAsked: '2 days ago',
  },
];

const KB_DEFAULT = {
  summary: {
    me: 'Ada Brennan',
    total: KB_DOCS.length,
    totalSub: '14 verified · 3 work in progress',
    verified: 11,
    verifiedPct: 65,
    mine: KB_DOCS.filter((d) => d.owner === 'Ada Brennan').length,
    attention: KB_DOCS.filter((d) => ['expired','outdated','empty'].includes(d.status) || !d.owner).length,
    gaps: KB_GAPS.length,
  },
  docs: KB_DOCS,
  gaps: KB_GAPS,
};

const KB_EMPTY = {
  summary: { me: 'Ada Brennan', total: 0, verified: 0, verifiedPct: 0, mine: 0, attention: 0, gaps: 0 },
  docs: [],
  gaps: [],
};

Object.assign(window, { KB_DEFAULT, KB_EMPTY, KB_DOCS, KB_GAPS });
