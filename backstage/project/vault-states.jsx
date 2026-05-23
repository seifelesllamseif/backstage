// Vault fixtures.

const VAULT_POSTS = [
  {
    id: 'v01',
    kind: 'quote',
    author: 'Ada Brennan',
    posted: '2 days ago',
    body: 'A film is a ribbon of dreams. The camera is much more than a recording apparatus; it is a medium via which messages reach us from another world.',
    attribution: 'Orson Welles',
    votes: 14,
    comments: 3,
  },
  {
    id: 'v02',
    kind: 'inspiration',
    author: 'Tomás Reyes',
    posted: '3 days ago',
    palette: ['#7B8FA1', '#3D6584', '#1A2B3A'],
    body: 'Aurora ep. 3 reference — the cold blue undertone in the lighthouse scene. Almost monochrome, almost grey.',
    url: '#',
    urlLabel: 'criterion.com/films/the-lighthouse',
    votes: 11,
    comments: 5,
    voted: true,
  },
  {
    id: 'v03',
    kind: 'idea',
    author: 'Maya Okafor',
    posted: '4 days ago',
    title: 'A sound bible per project',
    body: 'A 1-page doc per project that says what the world sounds like — room tones, ambience palette, music families. We waste a week each project arguing about this in headphones.',
    votes: 22,
    comments: 7,
  },
  {
    id: 'v04',
    kind: 'source',
    author: 'Jonas Weiß',
    posted: '5 days ago',
    title: "A pixel artist's notes on staging colour",
    url: '#',
    urlLabel: 'pixeljoint.com/forum/notes-on-staging-colour',
    body: 'Especially the section on tertiary palettes — applies just as well to grading.',
    votes: 6,
    comments: 0,
  },
  {
    id: 'v05',
    kind: 'project',
    author: 'Noah Park',
    posted: '6 days ago',
    project: 'Side · Lighthouse',
    role: 'editor',
    title: 'The first cut of my short — feedback welcome',
    body: '11 minutes, locked picture but no sound yet. Posting because I keep getting feedback in 1:1s and I\'d like everyone\'s eyes.',
    votes: 18,
    comments: 12,
  },
  {
    id: 'v06',
    kind: 'inspiration',
    author: 'Sara Lindqvist',
    posted: '1 wk ago',
    palette: ['#F5C26B', '#D97E3E', '#8B3A1F'],
    body: 'The warm palette in Past Lives — terracotta + ochre + a deep desaturated red. We don\'t use yellows enough.',
    votes: 9,
    comments: 2,
  },
  {
    id: 'v07',
    kind: 'quote',
    author: 'Priya Sundaram',
    posted: '1 wk ago',
    body: 'You can\'t connect the dots looking forward; you can only connect them looking backwards.',
    attribution: 'Steve Jobs',
    votes: 4,
    comments: 1,
  },
  {
    id: 'v08',
    kind: 'idea',
    author: 'Amani Okello',
    posted: '1 wk ago',
    title: 'Subtitle every internal screening',
    body: 'Subs catch pacing problems your ears miss. Cheap, easy, and our test screenings keep showing it.',
    votes: 7,
    comments: 4,
  },
];

// A "fresh" post with no votes/comments yet — design.md state.
const FRESH_POST = {
  id: 'vNEW',
  kind: 'idea',
  author: 'Jakub Nowak',
  posted: 'just now',
  title: 'A sound test room — even just a closet',
  body: 'We mix in the open studio and it shows. A single small treated room would save hours of cleanup per ep.',
  votes: 0,
  comments: 0,
};

const VAULT_CONTRIBUTORS = [
  { name: 'Ada Brennan',  posts: 9 },
  { name: 'Maya Okafor',  posts: 7 },
  { name: 'Tomás Reyes',  posts: 6 },
  { name: 'Noah Park',    posts: 5 },
  { name: 'Sara Lindqvist', posts: 4 },
  { name: 'Jonas Weiß',   posts: 3 },
];

function countByKind(posts) {
  const c = { total: posts.length, idea: 0, quote: 0, inspiration: 0, source: 0, project: 0 };
  posts.forEach((p) => { c[p.kind]++; });
  c.contributors = new Set(posts.map((p) => p.author)).size;
  return c;
}

const VAULT_DEFAULT = {
  posts: VAULT_POSTS,
  contributors: VAULT_CONTRIBUTORS,
  counts: countByKind(VAULT_POSTS),
};

const VAULT_FRESH = {
  posts: [FRESH_POST, ...VAULT_POSTS],
  contributors: VAULT_CONTRIBUTORS,
  counts: countByKind([FRESH_POST, ...VAULT_POSTS]),
};

const VAULT_EMPTY = {
  posts: [],
  contributors: [],
  counts: { total: 0, idea: 0, quote: 0, inspiration: 0, source: 0, project: 0, contributors: 0 },
};

Object.assign(window, { VAULT_DEFAULT, VAULT_FRESH, VAULT_EMPTY });

// ---------- Compose draft ------------------------------------------------
// Mid-flow: someone is writing an Idea. The fields are partly filled so the
// page reads as a real moment in the editor, not a hollow form.
const COMPOSE_DRAFT_IDEA = {
  kind: 'idea',
  author: 'Sara Lindqvist',
  title: 'A weekly "what tripped you up" round',
  body:
    "10 minutes, Friday afternoon, whole crew. One thing that confused you this week — a missing doc, an unclear handoff, a question you asked three people. We log it in the Vault as a Knowledge gap if it deserves a doc. Nothing punitive, just a small audit of the rough edges.",
};

// ---------- Post detail data --------------------------------------------
// Reuse Maya's "sound bible per project" idea (v03) — it already has 7
// comments in the feed count. Now we render those comments.
const POST_DETAIL = VAULT_POSTS.find((p) => p.id === 'v03');

const POST_COMMENTS = [
  {
    author: 'Tomás Reyes',
    role: 'Lead colorist',
    posted: '4 days ago',
    body: "+1. The colour equivalent of this is the LUTbook and it changed everything. A sound bible would have saved us a full week on Aurora ep. 2 alone.",
    votes: 8,
    voted: true,
    replies: [
      {
        author: 'Maya Okafor',
        role: 'Sound designer',
        posted: '4 days ago',
        body: "That's exactly what I was thinking. Could even start as a Notion template — three sections: room tones, ambience, music families. Anyone could fill it in.",
        votes: 4,
      },
    ],
  },
  {
    author: 'Ada Brennan',
    role: 'Director',
    posted: '3 days ago',
    body: "Yes please. I keep asking the same three questions on every project and the answer is different every time, depending on who I ask.",
    votes: 6,
  },
  {
    author: 'Noah Park',
    posted: '3 days ago',
    body: "Editorial would use this too. If the sound bible references the picture cut conventions, we'd save a lot of round-trips.",
    votes: 3,
    replies: [
      {
        author: 'Maya Okafor',
        role: 'Sound designer',
        posted: '3 days ago',
        body: "Good call. I'll draft a v0 this week and post it back here for notes.",
        votes: 2,
      },
    ],
  },
  {
    author: 'Sara Lindqvist',
    posted: '2 days ago',
    body: "As an apprentice — this would have unstuck me twice in the past month. I'd happily help maintain the Aurora one.",
    votes: 5,
    voted: true,
  },
  {
    author: 'Jonas Weiß',
    role: 'Engine programmer',
    posted: '2 days ago',
    body: "Curious if this could extend to game projects too. Vespera has the same problem — no canonical doc on what the world sounds like.",
    votes: 2,
  },
];

Object.assign(window, { COMPOSE_DRAFT_IDEA, POST_DETAIL, POST_COMMENTS });
