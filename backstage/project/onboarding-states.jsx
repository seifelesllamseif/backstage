// Onboarding tracker fixtures.

const STD_STEPS = [
  { label: 'Welcome session' },
  { label: 'Sign NDA & policies' },
  { label: 'Studio tour' },
  { label: 'Tools setup' },
  { label: 'Meet your team' },
  { label: 'Read role pack' },
  { label: 'Shadow a senior on a real piece of work' },
  { label: 'First assigned task' },
  { label: 'Two-week check-in' },
];

function steps(...states) {
  return STD_STEPS.map((s, i) => ({ ...s, state: states[i] || 'not_started' }));
}

// Six newcomers across the tracker — happy-path + the two flagged states
// the brief calls out (no mentor, agreements unsigned).
const OB_DEFAULT = {
  summary: {
    onboarding: 6,
    roleCount: 5,
    unmentored: 1,
    unsigned: 2,
    finishing: 1,
  },
  people: [
    {
      id: 'sara',
      name: 'Sara Lindqvist',
      role: 'Production assistant',
      contract: 'Apprentice',
      startDate: '15 May',
      tenureLabel: 'Day 6 of 90',
      mentor: 'Tomás Reyes',
      mentorRole: 'Lead colorist',
      steps: steps('done','done','done','done','in_progress'),
      agreements: [
        { name: 'NDA',                  signed: true,  signedOn: '15 May' },
        { name: 'Studio policies',      signed: true,  signedOn: '15 May' },
        { name: 'Equipment loan terms', signed: true,  signedOn: '16 May' },
      ],
      pack: [
        { title: 'Production assistant — role guide', verified: true },
        { title: 'On-set conduct & safety',           verified: true },
        { title: 'Shot log conventions',              verified: true },
      ],
    },
    {
      id: 'lyra',
      name: 'Lyra Chen',
      role: 'Editorial assistant',
      contract: 'Apprentice',
      startDate: '17 Jun',
      tenureLabel: 'Starts in 12 days',
      mentor: 'Ada Brennan',
      mentorRole: 'Director / showrunner',
      steps: steps('in_progress'),
      agreements: [
        { name: 'NDA',                  signed: false },
        { name: 'Studio policies',      signed: false },
        { name: 'Equipment loan terms', signed: false },
      ],
      pack: [
        { title: 'Editorial assistant — role guide', verified: true },
        { title: 'Premiere project structure',       verified: true },
        { title: 'Selects bin conventions',          state: 'Draft', verified: false },
      ],
    },
    {
      id: 'jakub',
      name: 'Jakub Nowak',
      role: 'Sound apprentice',
      contract: 'Apprentice',
      startDate: '22 May',
      tenureLabel: 'Day 1 of 90',
      mentor: null,
      mentorRole: null,
      steps: steps('in_progress'),
      agreements: [
        { name: 'NDA',                  signed: true,  signedOn: '22 May' },
        { name: 'Studio policies',      signed: false },
      ],
      pack: [
        { title: 'Sound apprentice — role guide', verified: true },
        { title: 'Studio recording setup',        verified: true },
      ],
    },
    {
      id: 'priya',
      name: 'Priya Sundaram',
      role: 'Game designer',
      contract: 'Employee',
      startDate: '06 May',
      tenureLabel: 'Day 14 of 90',
      mentor: 'Jonas Weiß',
      mentorRole: 'Engine programmer',
      steps: steps('done','done','done','done','done','done','in_progress'),
      agreements: [
        { name: 'NDA',                  signed: true,  signedOn: '06 May' },
        { name: 'Studio policies',      signed: true,  signedOn: '06 May' },
        { name: 'IP & contributor terms', signed: true, signedOn: '07 May' },
      ],
      pack: [
        { title: 'Game designer — role guide',  verified: true },
        { title: 'Vespera bible v0.4',           verified: true },
        { title: 'Engine onboarding — Vespera', verified: true },
      ],
    },
    {
      id: 'amani',
      name: 'Amani Okello',
      role: 'Writer',
      contract: 'Apprentice',
      startDate: '08 Apr',
      tenureLabel: 'Day 28 of 90',
      mentor: 'Ada Brennan',
      mentorRole: 'Director / showrunner',
      steps: steps('done','done','done','done','done','done','done','in_progress'),
      agreements: [
        { name: 'NDA',                  signed: true,  signedOn: '08 Apr' },
        { name: 'Studio policies',      signed: true,  signedOn: '08 Apr' },
      ],
      pack: [
        { title: 'Writer — role guide',       verified: true },
        { title: 'Aurora story bible',         verified: true },
        { title: 'House style & voice',        verified: true },
      ],
    },
    {
      id: 'milos',
      name: 'Miloš Petrović',
      role: 'Editor',
      contract: 'Apprentice',
      startDate: '04 Mar',
      tenureLabel: 'Day 84 of 90',
      mentor: 'Ada Brennan',
      mentorRole: 'Director / showrunner',
      steps: steps('done','done','done','done','done','done','done','done','done'),
      agreements: [
        { name: 'NDA',                  signed: true,  signedOn: '04 Mar' },
        { name: 'Studio policies',      signed: true,  signedOn: '04 Mar' },
      ],
      pack: [
        { title: 'Editor — role guide', verified: true },
        { title: 'Premiere project structure', verified: true },
      ],
    },
  ],
};

// Empty / first-run state — no one onboarding.
const OB_EMPTY = {
  summary: { onboarding: 0, unmentored: 0, unsigned: 0, finishing: 0 },
  people: [],
};

Object.assign(window, { OB_DEFAULT, OB_EMPTY });
