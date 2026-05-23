// Spotlight fixtures.

const SPOTLIGHT_CURRENT = {
  people: ['Maya Okafor'],
  period: 'May 2026',
  reason:
    'Quietly held the entire post stage of Aurora together. Two finals, one cross-project rescue, and she still found time to teach Sara the Foley basics from scratch.',
  nominatedBy: 'Ada Brennan',
  confirmedBy: 'Marko Pavlović',
};

const SPOTLIGHT_TEAM = {
  people: ['Maya Okafor', 'Tomás Reyes'],
  period: 'May 2026',
  reason:
    'For pulling Aurora episode 2 across the line three days before delivery. Two finals, zero panic, and the cleanest handoffs we\'ve had this year.',
  nominatedBy: 'Ada Brennan',
  confirmedBy: 'Marko Pavlović',
};

const NOMINATE_DRAFT = {
  people: ['Sara Lindqvist'],
  period: 'Jun 2026',
  reason:
    'Day 6 and already running the Aurora shot log without anyone asking. She found three continuity errors in ep. 3 we would have caught in finishing — saved us a week.',
  confirmer: 'Marko Pavlović',
};

const PENDING = [
  {
    people: ['Sara Lindqvist'],
    period: 'Jun 2026',
    reason:
      'Day 6 and already running the Aurora shot log without anyone asking. She found three continuity errors in ep. 3 we would have caught in finishing — saved us a week.',
    nominatedBy: 'Ada Brennan',
    submitted: '2 days ago',
  },
  {
    people: ['Jonas Weiß', 'Priya Sundaram'],
    period: 'Jun 2026',
    reason:
      'Vespera build went from "barely runs" to a publishable vertical slice in three sprints. They stayed late, they paired well, and they kept the team laughing.',
    nominatedBy: 'Hugo Lange',
    submitted: '4 days ago',
  },
];

const SPOTLIGHT_HISTORY = [
  {
    period: 'May 2026',
    people: ['Maya Okafor'],
    reason:
      'Quietly held the entire post stage of Aurora together. Two finals, one cross-project rescue, and she still found time to teach Sara the Foley basics from scratch.',
    nominatedBy: 'Ada Brennan',
    confirmedBy: 'Marko Pavlović',
  },
  {
    period: 'Apr 2026',
    people: ['Tomás Reyes'],
    reason:
      'Color pipeline doc that finally killed our three-LUT chaos. Every project since has been calmer because of it.',
    nominatedBy: 'Ada Brennan',
    confirmedBy: 'Marko Pavlović',
  },
  {
    period: 'Mar 2026',
    people: ['Iris Salomon', 'Noah Park'],
    reason:
      'Lighthouse short — shipped on time, on note, with a first cut Ada called the best apprentice work in two years.',
    nominatedBy: 'Hugo Lange',
    confirmedBy: 'Marko Pavlović',
  },
  {
    period: 'Feb 2026',
    people: ['Ada Brennan'],
    reason:
      'For walking every new apprentice through their first week of January in person, even with three projects in finishing.',
    nominatedBy: 'Marko Pavlović',
    confirmedBy: 'Hugo Lange',
  },
  {
    period: 'Jan 2026',
    people: ['Maya Okafor'],
    reason:
      'The sound design pass on the Vespera reveal trailer. Half a million views the first weekend; the music team gets the credit but Maya built the floor.',
    nominatedBy: 'Hugo Lange',
    confirmedBy: 'Marko Pavlović',
  },
];

Object.assign(window, {
  SPOTLIGHT_CURRENT,
  SPOTLIGHT_TEAM,
  NOMINATE_DRAFT,
  PENDING,
  SPOTLIGHT_HISTORY,
});
