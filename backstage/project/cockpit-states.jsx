// Cockpit state fixtures — five distinct people/scenarios so each artboard
// reads as a real snapshot, not a parameterized demo.

// Roadmap columns are floats 0..5 (six-week grid). today is also a float
// 0..6; we use 2 (start of week 3) as "now" everywhere for consistency.
const TODAY_COL = 2;

const WEEKS = [
  { label: 'wk 21' },
  { label: 'wk 22' },
  { label: 'wk 23' },
  { label: 'wk 24' },
  { label: 'wk 25' },
  { label: 'wk 26' },
];

// 1. ONBOARDING ------------------------------------------------------------
// Sara, day 6 of 90. Tracker shown, few tasks, allocation light.
const STATE_ONBOARDING = {
  me: {
    name: 'Sara Lindqvist',
    role: 'Production assistant',
    contract: 'Apprentice',
    lifecycleLabel: 'Onboarding',
    tenure: { label: 'Day 6 of 90', endsOn: '20 Aug' },
  },
  onboarding: {
    mentor: 'Tomás Reyes',
    steps: [
      { label: 'Welcome session', state: 'done' },
      { label: 'Sign NDA & policies', state: 'done' },
      { label: 'Studio tour', state: 'done' },
      { label: 'Tools setup', state: 'done' },
      { label: 'Meet your team', state: 'in_progress' },
      { label: 'Read role pack', state: 'not_started' },
      { label: 'Shadow a shoot day', state: 'not_started' },
      { label: 'First assigned task', state: 'not_started' },
      { label: 'Two-week check-in', state: 'not_started' },
    ],
  },
  tasks: [
    {
      status: 'in_progress',
      title: 'Read the production assistant role pack',
      project: 'Operations',
      with: null,
      due: 'Fri',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Shadow Tomás on Aurora shoot day',
      project: 'Aurora doc',
      with: 'Tomás Reyes',
      due: 'Mon',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Sit in on weekly post sync',
      project: 'Operations',
      with: null,
      due: 'Wed',
      overdue: false,
    },
  ],
  allocation: {
    total: 40,
    projects: [
      { project: 'Operations', percent: 25, color: SKAM.info },
      { project: 'Aurora doc',  percent: 15, color: '#7B8FA1' },
    ],
  },
  handoffs: {
    toFill: [],
    received: [
      {
        task: 'Aurora — shot log template & access',
        other: 'Tomás Reyes',
        blocksDone: false,
      },
    ],
  },
  roadmap: {
    weeks: WEEKS,
    todayCol: TODAY_COL,
    milestones: [
      {
        title: 'Two-week check-in',
        project: 'Operations',
        startCol: 0,
        endCol: 0,
        status: 'on_track',
      },
      {
        title: 'First shoot day shadowed',
        project: 'Aurora doc',
        startCol: 1,
        endCol: 1,
        status: 'on_track',
      },
      {
        title: 'Take over shot logs',
        project: 'Aurora doc',
        startCol: 3,
        endCol: 4,
        status: 'on_track',
      },
    ],
  },
};

// 2. ACTIVE ----------------------------------------------------------------
// Tomás, employee, fuller load, no onboarding tracker.
const STATE_ACTIVE = {
  me: {
    name: 'Tomás Reyes',
    role: 'Lead colorist',
    contract: 'Employee',
    lifecycleLabel: null,
    tenure: null,
  },
  onboarding: null,
  tasks: [
    {
      status: 'in_review',
      title: 'Color pass v3 — Helix trailer scenes 8–14',
      project: 'Helix trailer',
      with: 'Maya Okafor',
      due: 'Today',
      overdue: false,
    },
    {
      status: 'in_progress',
      title: 'Match Aurora ep. 3 to director references',
      project: 'Aurora doc',
      with: null,
      due: 'Thu',
      overdue: false,
    },
    {
      status: 'in_progress',
      title: 'Mentor 1:1 with Sara — week 1 review',
      project: 'Operations',
      with: 'Sara Lindqvist',
      due: 'Fri',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Define color pipeline doc for Vespera cinematics',
      project: 'Vespera (game)',
      with: null,
      due: 'Next Mon',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Render review with director — Helix v3',
      project: 'Helix trailer',
      with: 'Ada Brennan',
      due: '17 Jun',
      overdue: false,
    },
  ],
  allocation: {
    total: 85,
    projects: [
      { project: 'Helix trailer',   percent: 40, color: SKAM.info  },
      { project: 'Aurora doc',      percent: 25, color: '#7B8FA1' },
      { project: 'Vespera (game)',  percent: 15, color: '#5DCAA5' },
      { project: 'Operations',      percent: 5,  color: '#C9A6E0' },
    ],
  },
  handoffs: {
    toFill: [
      {
        task: 'Helix trailer — color pipeline notes for Maya',
        other: 'Maya Okafor',
        blocksDone: true,
      },
    ],
    received: [
      {
        task: 'Aurora — director reference reel from Ada',
        other: 'Ada Brennan',
        blocksDone: false,
      },
      {
        task: 'Vespera — engine LUT exports from Jonas',
        other: 'Jonas Weiß',
        blocksDone: false,
      },
    ],
  },
  roadmap: {
    weeks: WEEKS,
    todayCol: TODAY_COL,
    milestones: [
      {
        title: 'Helix trailer v3 locked',
        project: 'Helix trailer',
        startCol: 0,
        endCol: 1,
        status: 'on_track',
      },
      {
        title: 'Aurora ep. 3 picture lock',
        project: 'Aurora doc',
        startCol: 1,
        endCol: 2,
        status: 'at_risk',
      },
      {
        title: 'Vespera cinematic 01',
        project: 'Vespera (game)',
        startCol: 3,
        endCol: 5,
        status: 'on_track',
      },
      {
        title: 'Sara week-4 check-in',
        project: 'Operations',
        startCol: 4,
        endCol: 4,
        status: 'on_track',
      },
    ],
  },
};

// 3. OVERLOADED ------------------------------------------------------------
// Maya, sound. 125% across four projects. Allocation red, one overdue task.
const STATE_OVERLOADED = {
  me: {
    name: 'Maya Okafor',
    role: 'Sound designer',
    contract: 'Employee',
    lifecycleLabel: null,
    tenure: null,
  },
  onboarding: null,
  tasks: [
    {
      status: 'in_progress',
      title: 'Final mix — Helix trailer v3',
      project: 'Helix trailer',
      with: 'Tomás Reyes',
      due: '2 days ago',
      overdue: true,
    },
    {
      status: 'in_review',
      title: 'Foley pass — Aurora ep. 3 scene 14',
      project: 'Aurora doc',
      with: null,
      due: 'Today',
      overdue: false,
    },
    {
      status: 'in_progress',
      title: 'Combat SFX layer — Vespera v0.4',
      project: 'Vespera (game)',
      with: 'Jonas Weiß',
      due: 'Thu',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Score sync — Aurora ep. 4 cold open',
      project: 'Aurora doc',
      with: null,
      due: 'Mon',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Cleanup ambient bed — Lighthouse short',
      project: 'Lighthouse',
      with: null,
      due: '18 Jun',
      overdue: false,
    },
  ],
  allocation: {
    total: 125,
    projects: [
      { project: 'Helix trailer',  percent: 40, color: SKAM.info  },
      { project: 'Aurora doc',     percent: 35, color: '#7B8FA1' },
      { project: 'Vespera (game)', percent: 30, color: '#5DCAA5' },
      { project: 'Lighthouse',     percent: 20, color: '#C9A6E0' },
    ],
  },
  handoffs: {
    toFill: [
      {
        task: 'Helix — mix bus settings note for Tomás',
        other: 'Tomás Reyes',
        blocksDone: true,
      },
      {
        task: 'Vespera — middleware export brief for Jonas',
        other: 'Jonas Weiß',
        blocksDone: false,
      },
    ],
    received: [],
  },
  roadmap: {
    weeks: WEEKS,
    todayCol: TODAY_COL,
    milestones: [
      {
        title: 'Helix v3 mix delivered',
        project: 'Helix trailer',
        startCol: 0,
        endCol: 0,
        status: 'at_risk',
      },
      {
        title: 'Aurora ep. 3 sound lock',
        project: 'Aurora doc',
        startCol: 1,
        endCol: 2,
        status: 'at_risk',
      },
      {
        title: 'Vespera v0.4 SFX pass',
        project: 'Vespera (game)',
        startCol: 2,
        endCol: 4,
        status: 'on_track',
      },
      {
        title: 'Aurora ep. 4 cold open',
        project: 'Aurora doc',
        startCol: 4,
        endCol: 5,
        status: 'on_track',
      },
    ],
  },
};

// 4. EMPTY -----------------------------------------------------------------
// Day 1. Lyra. The whole right side is "you're clear", roadmap is empty.
// Onboarding tracker shows almost nothing done.
const STATE_EMPTY = {
  me: {
    name: 'Lyra Chen',
    role: 'Editorial assistant',
    contract: 'Apprentice',
    lifecycleLabel: 'Onboarding',
    tenure: { label: 'Day 1 of 90', endsOn: '15 Sep' },
  },
  onboarding: {
    mentor: 'Ada Brennan',
    steps: [
      { label: 'Welcome session', state: 'in_progress' },
      { label: 'Sign NDA & policies', state: 'not_started' },
      { label: 'Studio tour', state: 'not_started' },
      { label: 'Tools setup', state: 'not_started' },
      { label: 'Meet your team', state: 'not_started' },
      { label: 'Read role pack', state: 'not_started' },
      { label: 'Shadow a shoot day', state: 'not_started' },
      { label: 'First assigned task', state: 'not_started' },
      { label: 'Two-week check-in', state: 'not_started' },
    ],
  },
  tasks: [],
  allocation: {
    total: 0,
    projects: [],
  },
  handoffs: {
    toFill: [],
    received: [],
  },
  roadmap: {
    weeks: WEEKS,
    todayCol: TODAY_COL,
    milestones: [],
  },
};

// 5. WRAPPING UP -----------------------------------------------------------
// Noah, day 84 of 90. Gentle nudge banner above tracker (tracker hidden —
// he's no longer onboarding). Most tasks aimed at wrapping clean handoffs.
const STATE_WRAPPING = {
  me: {
    name: 'Noah Park',
    role: 'Editor',
    contract: 'Apprentice',
    lifecycleLabel: 'Wrapping up',
    tenure: { label: 'Day 84 of 90', endsOn: '14 Jun' },
  },
  onboarding: null,
  wrappingUp: { daysLeft: 6 },
  tasks: [
    {
      status: 'in_progress',
      title: 'Final cut — Aurora ep. 2 director review',
      project: 'Aurora doc',
      with: 'Ada Brennan',
      due: 'Tomorrow',
      overdue: false,
    },
    {
      status: 'in_review',
      title: 'Selects archive — Aurora ep. 1–3',
      project: 'Aurora doc',
      with: null,
      due: 'Wed',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Write handoff doc — Aurora editorial bench',
      project: 'Aurora doc',
      with: null,
      due: 'Fri',
      overdue: false,
    },
    {
      status: 'todo',
      title: 'Exit summary draft',
      project: 'Operations',
      with: null,
      due: '13 Jun',
      overdue: false,
    },
  ],
  allocation: {
    total: 70,
    projects: [
      { project: 'Aurora doc', percent: 60, color: '#7B8FA1' },
      { project: 'Operations', percent: 10, color: '#C9A6E0' },
    ],
  },
  handoffs: {
    toFill: [
      {
        task: 'Aurora editorial bench — selects, bins, conform notes',
        other: 'Sara Lindqvist',
        blocksDone: true,
      },
      {
        task: 'Aurora ep. 2 cutdown rationale doc',
        other: 'Ada Brennan',
        blocksDone: false,
      },
    ],
    received: [
      {
        task: 'Aurora — final director notes from Ada',
        other: 'Ada Brennan',
        blocksDone: false,
      },
    ],
  },
  roadmap: {
    weeks: WEEKS,
    todayCol: TODAY_COL,
    milestones: [
      {
        title: 'Aurora ep. 2 picture lock',
        project: 'Aurora doc',
        startCol: 0,
        endCol: 0,
        status: 'at_risk',
      },
      {
        title: 'Editorial bench handed off',
        project: 'Aurora doc',
        startCol: 0,
        endCol: 1,
        status: 'on_track',
      },
      {
        title: 'Exit summary signed',
        project: 'Operations',
        startCol: 1,
        endCol: 1,
        status: 'on_track',
      },
    ],
  },
};

Object.assign(window, {
  STATE_ONBOARDING,
  STATE_ACTIVE,
  STATE_OVERLOADED,
  STATE_EMPTY,
  STATE_WRAPPING,
});

// ---------- Spotlight per state ------------------------------------------
// Cockpit-embedded Spotlight (§6.9) — three flavors across the five states:
// default (someone else is spotlit), you (the viewer is spotlit), and none
// (no current spotlight). Reuses the §6.9 component directly.
const SP_MAYA = {
  people: ['Maya Okafor'],
  period: 'May 2026',
  reason:
    "Quietly held the entire post stage of Aurora together. Two finals, one cross-project rescue, and she still found time to teach Sara the Foley basics from scratch.",
  nominatedBy: 'Ada Brennan',
  confirmedBy: 'Marko Pavlović',
};
const SP_TOMAS = {
  people: ['Tomás Reyes'],
  period: 'May 2026',
  reason:
    "Color pipeline doc that finally killed our three-LUT chaos. Every project since has been calmer because of it.",
  nominatedBy: 'Ada Brennan',
  confirmedBy: 'Marko Pavlović',
};

STATE_ONBOARDING.spotlight = SP_MAYA;       // Sara views Maya — default
STATE_ACTIVE.spotlight     = SP_TOMAS;      // Tomás views Tomás — YOU treatment
STATE_OVERLOADED.spotlight = SP_MAYA;       // Maya views Maya — YOU treatment
STATE_EMPTY.spotlight      = null;          // Lyra, day 1, no current spotlight
STATE_WRAPPING.spotlight   = SP_MAYA;       // Noah views Maya — default
