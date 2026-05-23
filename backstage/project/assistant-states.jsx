// Assistant fixtures.

// SOURCED conversation — clean, multi-turn, sources on every answer.
const ASSIST_SOURCED = {
  viewer: 'Sara Lindqvist',
  messages: [
    {
      role: 'user',
      text: 'What are our shot log conventions?',
    },
    {
      role: 'assistant',
      kind: 'sourced',
      text:
        'Each shooting day gets one log. Filenames follow {project_short}_{ep}_{day}_{shot}_{take} — e.g. AUR_ep3_d04_07_T03. Slate the take verbally on every roll, and mark circle takes with a "C" in the comments column. Continuity notes go in the second comments row, not the take row, so the take row stays parseable [1]. For sound, the assistant sound recordist owns the .TC column and matches it against camera at lunch and at wrap [2].',
      sources: [
        { kind: 'SOP',   title: 'Shot log conventions',           owner: 'Ada Brennan',  scope: 'Company', status: 'verified' },
        { kind: 'Guide', title: 'On-set safety checklist',        owner: 'Ada Brennan',  scope: 'Company', status: 'verified' },
      ],
    },
    {
      role: 'user',
      text: 'And what changes if it\'s a single-camera doc shoot?',
    },
    {
      role: 'assistant',
      kind: 'sourced',
      text:
        'For doc, drop the slate column — it\'s assumed — and use a "moment" column instead of "take" to mark interview chapters or beats [1]. The shot/take filename pattern stays the same so the editorial bin matches. On Aurora specifically, Ada\'s doc-mode template is the source of truth and overrides anything in the company SOP [3].',
      sources: [
        { kind: 'SOP',   title: 'Shot log conventions',                owner: 'Ada Brennan', scope: 'Company',         status: 'verified' },
        { kind: 'Guide', title: 'Aurora — doc-mode shot log template', owner: 'Ada Brennan', scope: 'Aurora doc',      status: 'verified' },
      ],
    },
  ],
};

// UNSOURCED conversation — the assistant has something to say but no
// verified source. The answer reads visibly less certain (warning treatment,
// italic, explicit "verify before relying" banner).
const ASSIST_UNSOURCED = {
  viewer: 'Noah Park',
  messages: [
    {
      role: 'user',
      text: 'What\'s the LUT for Aurora ep. 3 daylight exteriors?',
    },
    {
      role: 'assistant',
      kind: 'unsourced',
      text:
        'Based on the Vault posts from Tomás this week, the daylight pass uses a cool blue undertone close to the "Aurora_LUTbook_v4" — but the LUTbook isn\'t in the knowledge base, so I can\'t verify the exact file. Ask Tomás directly, or check the project share at /aurora/ep3/color/v4/.',
    },
  ],
};

// GAP conversation — the assistant has nothing at all and refuses to guess.
const ASSIST_GAP = {
  viewer: 'Sara Lindqvist',
  messages: [
    {
      role: 'user',
      text: 'Where do I put the final render of an Aurora episode?',
    },
    {
      role: 'assistant',
      kind: 'gap',
      question: 'Where do I put the final render of an Aurora episode?',
      askedCount: 7,
    },
  ],
};

// EMPTY — first turn, no conversation yet.
const ASSIST_EMPTY = {
  viewer: 'Sara Lindqvist',
  messages: [],
};

Object.assign(window, {
  ASSIST_SOURCED,
  ASSIST_UNSOURCED,
  ASSIST_GAP,
  ASSIST_EMPTY,
});
