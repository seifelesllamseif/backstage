// Crew Board state fixtures.
// Three states: default (balanced-ish May), cliff (Sept warning), empty.

// ---------- DEFAULT (May) -------------------------------------------------
const CB_DEFAULT = {
  summary: {
    total: 34,
    totalSub: '6 apprentices · 28 employees',
    staffed: 14,
    staffedSub: 'of 18 roles',
    needsHire: 2,
    needsHireSub: 'sound mixer, animator',
    surplus: 2,
    surplusSub: 'editor, PA',
  },
  families: [
    {
      label: 'Production',
      roles: [
        { name: 'Producer',           actual: 2, range: [2, 3], state: 'staffed'  },
        { name: 'Production assistant', actual: 4, range: [2, 3], state: 'surplus' },
        { name: 'Location scout',     actual: 1, range: [1, 1], state: 'staffed'  },
      ],
    },
    {
      label: 'Post',
      roles: [
        { name: 'Editor',          actual: 4, range: [2, 3], state: 'surplus'  },
        { name: 'Colorist',        actual: 2, range: [2, 2], state: 'staffed'  },
        { name: 'Sound designer',  actual: 1, range: [2, 3], state: 'under'    },
        { name: 'Sound mixer',     actual: 0, range: [1, 1], state: 'critical' },
      ],
    },
    {
      label: 'Creative',
      roles: [
        { name: 'Director',        actual: 2, range: [2, 2], state: 'staffed' },
        { name: 'Writer',          actual: 2, range: [2, 3], state: 'under'   },
        { name: 'Art director',    actual: 1, range: [1, 1], state: 'staffed' },
      ],
    },
    {
      label: 'Game',
      roles: [
        { name: 'Game designer',   actual: 1, range: [1, 2], state: 'under'   },
        { name: 'Animator',        actual: 1, range: [2, 3], state: 'critical' },
        { name: 'Engine programmer', actual: 1, range: [1, 1], state: 'staffed' },
      ],
    },
    {
      label: 'Tech',
      roles: [
        { name: 'IT generalist',   actual: 1, range: [1, 1], state: 'staffed' },
      ],
    },
    {
      label: 'Growth',
      roles: [
        { name: 'Brand & comms',   actual: 1, range: [1, 2], state: 'under'   },
      ],
    },
    {
      label: 'Operations',
      roles: [
        { name: 'People & ops',    actual: 2, range: [2, 2], state: 'staffed' },
        { name: 'Mentor pool',     actual: 6, range: [4, 6], state: 'staffed' },
      ],
    },
  ],
  redeployment: [
    {
      person: 'Noah Park',
      fromRole: 'Editor (surplus)',
      toRole: 'Sound designer',
      toRoleState: 'under',
      reasonKind: 'skill',
      reason: 'Foley + sound editing on Lighthouse short',
    },
    {
      person: 'Sara Lindqvist',
      fromRole: 'Production assistant (surplus)',
      toRole: 'Writer',
      toRoleState: 'under',
      reasonKind: 'learning',
      reason: 'Wants to learn story structure — listed as goal at intake',
    },
    {
      person: 'Pia Holm',
      fromRole: 'Editor (surplus)',
      toRole: 'Animator',
      toRoleState: 'critical',
      reasonKind: 'skill',
      reason: 'Motion graphics — After Effects credit on three pieces',
    },
  ],
  forecast: {
    months: [
      { label: 'May',  sub: 'now' },
      { label: 'Jun' },
      { label: 'Jul' },
      { label: 'Aug' },
      { label: 'Sep' },
    ],
    rows: [
      { role: 'Producer',           cells: cells([[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed']], [2,3]) },
      { role: 'Production assistant', cells: cells([[4,'surplus'],[4,'surplus'],[3,'staffed'],[2,'staffed'],[2,'staffed']], [2,3]) },
      { role: 'Editor',             cells: cells([[4,'surplus'],[3,'surplus'],[3,'surplus'],[2,'staffed'],[2,'staffed']], [2,3]) },
      { role: 'Colorist',           cells: cells([[2,'staffed'],[2,'staffed'],[2,'staffed'],[1,'under'],[1,'under']], [2,2]) },
      { role: 'Sound designer',     cells: cells([[1,'under'],[1,'under'],[2,'staffed'],[2,'staffed'],[2,'staffed']], [2,3]) },
      { role: 'Sound mixer',        cells: cells([[0,'critical'],[1,'staffed'],[1,'staffed'],[1,'staffed'],[1,'staffed']], [1,1]) },
      { role: 'Director',           cells: cells([[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed']], [2,2]) },
      { role: 'Writer',             cells: cells([[2,'under'],[2,'under'],[2,'under'],[3,'staffed'],[3,'staffed']], [2,3]) },
      { role: 'Animator',           cells: cells([[1,'critical'],[1,'critical'],[2,'under'],[2,'under'],[2,'under']], [2,3]) },
      { role: 'Game designer',      cells: cells([[1,'under'],[1,'under'],[1,'under'],[2,'staffed'],[2,'staffed']], [1,2]) },
    ],
    cliff: null,
  },
};

function cells(pairs, range) {
  return pairs.map(([count, state]) => ({ count, state, range }));
}

// ---------- CLIFF (September drop) ---------------------------------------
// Same population, but viewed from the start of August. Several apprentices
// end in September, which drops three roles below target — the forecast
// surfaces this so the company can hire in time.
const CB_CLIFF = JSON.parse(JSON.stringify(CB_DEFAULT));
CB_CLIFF.summary = {
  total: 34,
  totalSub: '6 apprentices end in Sept',
  staffed: 13,
  staffedSub: 'of 18 roles',
  needsHire: 3,
  needsHireSub: 'sound, color, edit by Sept',
  surplus: 1,
  surplusSub: 'PA',
};
CB_CLIFF.forecast = {
  months: [
    { label: 'Aug',  sub: 'now' },
    { label: 'Sep' },
    { label: 'Oct' },
    { label: 'Nov' },
    { label: 'Dec' },
  ],
  rows: [
    { role: 'Producer',             cells: cells([[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed']], [2,3]) },
    { role: 'Production assistant', cells: cells([[3,'staffed'],[1,'under'],[1,'under'],[1,'under'],[2,'staffed']], [2,3]) },
    { role: 'Editor',               cells: cliffCells([
      [3,'staffed'], [1,'under',true], [1,'under'], [2,'staffed'], [2,'staffed']
    ], [2,3]) },
    { role: 'Colorist',             cells: cliffCells([
      [2,'staffed'], [0,'critical',true], [1,'under'], [1,'under'], [2,'staffed']
    ], [2,2]) },
    { role: 'Sound designer',       cells: cliffCells([
      [2,'staffed'], [0,'critical',true], [0,'critical'], [1,'under'], [2,'staffed']
    ], [2,3]) },
    { role: 'Sound mixer',          cells: cells([[1,'staffed'],[1,'staffed'],[1,'staffed'],[1,'staffed'],[1,'staffed']], [1,1]) },
    { role: 'Director',             cells: cells([[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed']], [2,2]) },
    { role: 'Writer',               cells: cells([[3,'staffed'],[2,'under'],[2,'under'],[3,'staffed'],[3,'staffed']], [2,3]) },
    { role: 'Animator',             cells: cells([[2,'under'],[2,'under'],[2,'under'],[2,'under'],[3,'staffed']], [2,3]) },
    { role: 'Game designer',        cells: cells([[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed'],[2,'staffed']], [1,2]) },
  ],
  cliff: { month: 'Sept', detail: '3 roles drop below target' },
};

function cliffCells(pairs, range) {
  return pairs.map(([count, state, isCliff]) => ({
    count,
    state,
    range,
    cliff: !!isCliff,
  }));
}

// Critical row in the cliff view: surface the redeployment more loudly.
CB_CLIFF.redeployment = [
  {
    person: 'Pia Holm',
    fromRole: 'Production assistant (surplus)',
    toRole: 'Editor',
    toRoleState: 'under',
    reasonKind: 'skill',
    reason: 'Assistant edit credit on Aurora ep. 2',
  },
  {
    person: 'Yusuf Ahmed',
    fromRole: 'Brand & comms (surplus)',
    toRole: 'Writer',
    toRoleState: 'under',
    reasonKind: 'skill',
    reason: 'Wrote two long-form pieces for Aurora press kit',
  },
  // No one to redeploy into sound or color — that's exactly why those rows
  // are critical and need hiring.
];

// Also tune the capacity rows to match the August snapshot.
CB_CLIFF.families = CB_DEFAULT.families.map((f) => ({
  ...f,
  roles: f.roles.map((r) => {
    if (r.name === 'Sound designer') return { ...r, actual: 2, state: 'staffed' };
    if (r.name === 'Sound mixer')    return { ...r, actual: 1, state: 'staffed' };
    if (r.name === 'Editor')         return { ...r, actual: 3, state: 'staffed' };
    if (r.name === 'Colorist')       return { ...r, actual: 2, state: 'staffed' };
    if (r.name === 'Production assistant') return { ...r, actual: 3, state: 'staffed' };
    if (r.name === 'Writer')         return { ...r, actual: 3, state: 'staffed' };
    if (r.name === 'Animator')       return { ...r, actual: 2, state: 'under' };
    return r;
  }),
}));

// ---------- EMPTY --------------------------------------------------------
const CB_EMPTY = {
  summary: null,
  families: [],
  redeployment: [],
  forecast: null,
};

Object.assign(window, { CB_DEFAULT, CB_CLIFF, CB_EMPTY });
