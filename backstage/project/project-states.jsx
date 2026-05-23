// Project workspace fixtures. One project — "Aurora doc" — used across all
// states so the data is consistent and recognizable.

const AURORA = {
  key: 'AUR',
  name: 'Aurora doc',
  status: 'On track',
  dates: '12 May — 22 Sep · ep. 1–4',
  leads: ['Ada Brennan', 'Tomás Reyes'],
  roles: [
    { name: 'Director',  filled: 1, target: 1, state: 'staffed' },
    { name: 'Editor',    filled: 2, target: 2, state: 'staffed' },
    { name: 'Colorist',  filled: 1, target: 1, state: 'staffed' },
    { name: 'Sound',     filled: 1, target: 2, state: 'under' },
    { name: 'PA',        filled: 1, target: 1, state: 'staffed' },
  ],
};

const AURORA_TASKS = [
  // Backlog
  {
    id: 'AUR-031',
    title: 'Score sketches for ep. 4 cold open',
    status: 'backlog',
    assignee: null,
    disciplines: ['music'],
    due: 'Aug',
  },
  {
    id: 'AUR-032',
    title: 'Color reference reel — ep. 4',
    status: 'backlog',
    assignee: 'Tomás Reyes',
    disciplines: ['color'],
    due: 'Aug',
  },
  // Unscoped
  {
    id: 'AUR-029',
    title: 'Press kit stills — who owns this?',
    status: 'unscoped',
    assignee: null,
    disciplines: ['marketing'],
  },
  {
    id: 'AUR-030',
    title: 'Festival deliverable specs — TBC',
    status: 'unscoped',
    assignee: null,
    disciplines: ['producer'],
  },
  // To do
  {
    id: 'AUR-024',
    title: 'Cut down director selects for ep. 3',
    status: 'todo',
    assignee: 'Noah Park',
    disciplines: ['editorial'],
    due: 'Mon',
    hasDeps: true,
  },
  {
    id: 'AUR-025',
    title: 'Shadow shoot day for Sara',
    status: 'todo',
    assignee: 'Sara Lindqvist',
    disciplines: ['production'],
    due: 'Mon',
  },
  {
    id: 'AUR-027',
    title: 'Score sync — ep. 4 cold open',
    status: 'todo',
    assignee: 'Maya Okafor',
    disciplines: ['sound', 'music'],
    due: 'Mon',
  },
  // In progress
  {
    id: 'AUR-018',
    title: 'Match ep. 3 to director color references',
    status: 'in_progress',
    assignee: 'Tomás Reyes',
    disciplines: ['color'],
    due: 'Thu',
  },
  {
    id: 'AUR-020',
    title: 'Foley pass — ep. 3 scene 14',
    status: 'in_progress',
    assignee: 'Maya Okafor',
    disciplines: ['sound'],
    due: 'Today',
  },
  {
    id: 'AUR-022',
    title: 'Assistant edit — ep. 3 act II',
    status: 'in_progress',
    assignee: 'Noah Park',
    disciplines: ['editorial'],
    due: 'Wed',
  },
  // In review
  {
    id: 'AUR-014',
    title: 'Final cut — ep. 2 director review',
    status: 'in_review',
    assignee: 'Noah Park',
    disciplines: ['editorial'],
    due: 'Tomorrow',
    handoffIncomplete: true, // notable: review gate looms
  },
  {
    id: 'AUR-016',
    title: 'Sound design pass — ep. 2 final mix bus',
    status: 'in_review',
    assignee: 'Maya Okafor',
    disciplines: ['sound'],
    due: '2 days ago',
    overdue: true,
  },
  // Done
  {
    id: 'AUR-008',
    title: 'Picture lock — ep. 1',
    status: 'done',
    assignee: 'Noah Park',
    disciplines: ['editorial'],
  },
  {
    id: 'AUR-010',
    title: 'Color pass v2 — ep. 2',
    status: 'done',
    assignee: 'Tomás Reyes',
    disciplines: ['color'],
  },
  {
    id: 'AUR-012',
    title: 'Sound design pass — ep. 1',
    status: 'done',
    assignee: 'Maya Okafor',
    disciplines: ['sound'],
  },
];

// The "ready" task — handoff completely filled — sits in the in_review
// column. Detail panel opens with everything ready and an active primary
// Move-to-Done button.
const TASK_READY = {
  ...AURORA_TASKS.find((t) => t.id === 'AUR-018'),
  handoff: {
    what:    'Color match pass for Aurora episode 3, conforming all scenes to the director\'s look reference (Aurora_LUTbook_v4).',
    current: 'All scenes graded in DaVinci. Director reviewed at 14:00 — three notes (scene 7 too cool, scene 14 sky band, scene 21 skin reds). Notes addressed.',
    done:    'Episode 3 conformed and graded, including notes. Stills exported for press. Final DRX delivered to editorial bin.',
    left:    'Render H264 review file for Ada, push to share. Park source project for archival.',
    files:   '/Volumes/skam/aurora/ep3/color/v4/  ·  Frame.io: Aurora ep3 — v4',
    gotchas: 'Scene 14 has two grades — use the v4b version (the v4a was dropped). The matte on the lighthouse shot leaks at the edge on broadcast safe — flagged for online.',
    asks:    ['Ada Brennan', 'Maya Okafor'],
  },
};

// The "gate" task — Done attempt with handoff incomplete. AUR-014 (ep. 2
// final cut). Three of the six handoff fields empty.
const TASK_GATE = {
  ...AURORA_TASKS.find((t) => t.id === 'AUR-014'),
  status: 'in_review',
  handoff: {
    what:    'Final picture cut of Aurora episode 2 for director review.',
    current: 'Cut at 47:12. Three open notes from yesterday\'s pass.',
    done:    '',
    left:    '',
    files:   '/Volumes/skam/aurora/ep2/edit/v8_final/',
    gotchas: '',
    asks:    [],
  },
};

// Timeline data: 8 weeks across 5 swimlanes. Visibility set on milestones
// to exercise the restricted view.
const TIMELINE_WEEKS = [
  { label: 'wk 21', dates: '19 May' },
  { label: 'wk 22', dates: '26 May' },
  { label: 'wk 23', dates: '2 Jun' },
  { label: 'wk 24', dates: '9 Jun' },
  { label: 'wk 25', dates: '16 Jun' },
  { label: 'wk 26', dates: '23 Jun' },
  { label: 'wk 27', dates: '30 Jun' },
  { label: 'wk 28', dates: '7 Jul' },
];

const AURORA_TIMELINE = {
  weeks: TIMELINE_WEEKS,
  todayCol: 2.5,
  swimlanes: [
    {
      label: 'Episode 2',
      sub: 'finishing',
      items: [
        { kind: 'task',      title: 'Edit notes pass',      startCol: 0, endCol: 0, status: 'on_track', visibility: 'project' },
        { kind: 'milestone', title: 'Picture lock',         startCol: 1, endCol: 1, status: 'at_risk',  visibility: 'project' },
        { kind: 'task',      title: 'Color + sound finishing', startCol: 1, endCol: 3, status: 'on_track', visibility: 'project' },
        { kind: 'milestone', title: 'Delivery to network',  startCol: 4, endCol: 4, status: 'on_track', visibility: 'leads' },
      ],
    },
    {
      label: 'Episode 3',
      sub: 'in finishing',
      items: [
        { kind: 'task',      title: 'Director notes pass',  startCol: 0, endCol: 1, status: 'on_track', visibility: 'project' },
        { kind: 'task',      title: 'Color + sound pass',   startCol: 2, endCol: 4, status: 'at_risk',  visibility: 'project' },
        { kind: 'milestone', title: 'Picture lock',         startCol: 5, endCol: 5, status: 'on_track', visibility: 'project' },
      ],
    },
    {
      label: 'Episode 4',
      sub: 'in production',
      items: [
        { kind: 'task',      title: 'Shoot block 2',        startCol: 1, endCol: 2, status: 'on_track', visibility: 'project' },
        { kind: 'task',      title: 'Reshoots',             startCol: 4, endCol: 4, status: 'on_track', visibility: 'leads' },
        { kind: 'task',      title: 'Assistant edit',       startCol: 3, endCol: 6, status: 'on_track', visibility: 'project' },
      ],
    },
    {
      label: 'Distribution',
      sub: 'leads + producers',
      items: [
        { kind: 'milestone', title: 'Festival application',  startCol: 2, endCol: 2, status: 'on_track', visibility: 'leads' },
        { kind: 'milestone', title: 'Network screening',     startCol: 5, endCol: 5, status: 'on_track', visibility: 'restricted' },
        { kind: 'task',      title: 'Press kit & stills',    startCol: 3, endCol: 5, status: 'on_track', visibility: 'leads' },
      ],
    },
    {
      label: 'Talent & legal',
      sub: 'restricted',
      items: [
        { kind: 'milestone', title: 'Cast renegotiation',    startCol: 1, endCol: 1, status: 'on_track', visibility: 'restricted' },
        { kind: 'task',      title: 'Composer agreement',    startCol: 2, endCol: 3, status: 'on_track', visibility: 'restricted' },
        { kind: 'milestone', title: 'Distribution signed',   startCol: 6, endCol: 6, status: 'on_track', visibility: 'restricted' },
      ],
    },
  ],
};

const EMPTY_PROJECT = {
  key: 'CIN',
  name: 'Vespera — cinematics',
  status: null,
  dates: 'Starts 1 Sep · planning',
  leads: ['Jonas Weiß'],
  roles: [
    { name: 'Director',   filled: 1, target: 1, state: 'staffed' },
    { name: 'Animator',   filled: 0, target: 3, state: 'critical' },
    { name: 'Sound',      filled: 0, target: 1, state: 'critical' },
  ],
};

Object.assign(window, {
  AURORA,
  AURORA_TASKS,
  TASK_READY,
  TASK_GATE,
  AURORA_TIMELINE,
  EMPTY_PROJECT,
});
