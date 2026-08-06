/* ==========================================================================
   Undershoot — the dataset.

   Every number on screen comes from this file, and every number in this file
   carries a source. Nothing is here because it sounded right.

   `status` on a datum is one of:
     'primary'  — checked against the lab, the benchmark maintainer, the
                  paper, or the leaderboard itself during the build.
     'reported' — a credible secondary source, not contradicted, but not
                  confirmed at the primary source.
     'disputed' — the claim exists and is contested. Shown WITH the dispute.

   Nothing rated below 'reported' is displayed. Claims that failed that bar
   were cut, and the cuts are listed in CUT at the bottom, because what a
   dataset refuses to include is part of its argument.
   ========================================================================== */

const DATA = (() => {

/* --------------------------------------------------------------------------
   The opening screen. Assume the room knows nothing — not what a benchmark
   is, not what any of these models are called, not that any of this is
   measured at all.
   -------------------------------------------------------------------------- */

const INTRO = {
  title: 'How much has AI changed since ChatGPT? Draw your guess, then see the real answer.',
  body: [
    'In late 2022 ChatGPT arrived and AI became something anyone could use. Ever since, it has been measured constantly — graded on public tests, the same idea as an exam, except the questions and the scores are out in the open for anyone to check. Fix this real software bug. Answer this PhD-level chemistry question. Solve this puzzle.',
    'This is a short, hands-on look at what those measurements show. You will see five of these tests. For each one, the real scores are already drawn up to a point in the past. Your job is to drag a line across the chart — with your finger or your mouse — showing where you think the score went next. Then the true line appears on top of yours.',
    'There is nothing to beat and no score to earn. It is just a way to check your own sense of how this has gone against what actually happened, and people are often surprised. The usual surprise is that the numbers ran further than felt reasonable — which is where this demo gets its name: undershoot. But it is not one smooth story, and the last of the five tests is where that becomes clear.'
  ],
  note: 'No AI is used anywhere in this app. Everything you see is a chart, a set of published numbers, and a link to the original source of each one.',
  cta: 'Start the first test'
};

/* --------------------------------------------------------------------------
   ACT I — the five rounds.

   Each shows a real series up to a cutoff, asks the viewer to draw the rest,
   then reveals it. Every round carries: what the test actually is in plain
   words, a concrete example of one task from it, and what a human scores.
   The first four tend to land higher than people guess (hence "undershoot").
   The fifth climbs steeply and then, on a harder version, collapses — the
   turn the whole demo is built around.
   -------------------------------------------------------------------------- */

/* Every chart's time axis runs to here, whatever its data does, so the five
   are visually comparable and none of them look like they stopped caring in
   2025. Where a series genuinely has no data past some date, the line ends and
   the chart says so — see `endNote`. */
const AXIS_END = '2026-08-15';

const ROUNDS = [

/* ---- 1. SWE-bench Verified ---------------------------------------------- */
{
  id: 'swebench',
  name: 'Fixing real bugs',
  metric: 'SWE-bench Verified',
  real: 'Researchers call this test SWE-bench Verified.',
  unit: '%',
  scale: 'linear',
  yMin: 0, yMax: 100,
  xLabel: 'When the model was released',
  yLabel: 'Bugs actually fixed',
  yLabelShort: 'Bugs fixed',
  askDate: '2025-09-29',

  plain: 'Someone files a bug report on a real, working piece of software. The AI is given the bug report and the entire codebase, and has to write the fix itself. It is marked right only if the project’s own tests pass afterwards. No hints, no human help.',
  human: 'These are real bugs that real programmers took real time to fix. There is no tidy "human score" to compare against — the honest comparison is that a professional developer resolves essentially all of them, given long enough.',
  example: {
    kind: 'text',
    label: 'A task from this test looks like',
    body: '“Calling .fit() twice on the same estimator gives a different result the second time. Expected: identical output. Actual: coefficients differ by ~1e-3.”\n\nThe model gets that report and 1.2 million lines of code. It has to find the cause and write the patch.',
    note: 'Paraphrased to be readable; the real tasks are historical GitHub issues from projects like Django, scikit-learn and SymPy.'
  },
  question: 'In mid-2024 the best model fixed about a third of them. Where is it a year later?',

  shown: [
    { date: '2024-06-20', label: 'Claude 3.5 Sonnet', value: 33.4, status: 'primary', src: 'anthropic-computer-use' },
    { date: '2024-10-22', label: 'Claude 3.5 Sonnet (new)', value: 49.0, status: 'primary', src: 'anthropic-computer-use' }
  ],
  hidden: [
    { date: '2025-02-24', label: 'Claude 3.7 Sonnet', value: 63.7, note: 'no scaffold; 70.3% with parallel-compute scaffold', status: 'primary', src: 'anthropic-37' },
    { date: '2025-05-22', label: 'Claude Opus 4', value: 72.5, status: 'primary', src: 'anthropic-4' },
    { date: '2025-08-07', label: 'GPT-5', value: 74.9, status: 'primary', src: 'openai-gpt5' },
    { date: '2025-09-29', label: 'Claude Sonnet 4.5', value: 82.0, note: 'parallel test-time compute; 77.2% base', status: 'primary', src: 'anthropic-45' }
  ],
  endNote: 'no lab has published this score since',
  reveal: {
    headline: 'A third of them, to four in five, in fifteen months.',
    body: 'Then something more telling than another number: the labs stopped reporting this test. Anthropic’s Opus 4.7 page mentions it only to say it screens for memorisation of it. The Opus 4.8 page does not mention it at all. Opus 5 reports a different test entirely. An exam gets retired when passing it stops telling anyone apart — and this one was retired about two years after it was built to be hard.',
    caveat: 'These scores are reported by the companies that make the models, and how you run the test matters: the same model scores several points apart depending on how many attempts it is allowed. The 82% figure allows several; the single-attempt score was 77%.'
  }
},

/* ---- 2. GPQA Diamond ----------------------------------------------------- */
{
  id: 'gpqa',
  name: 'Questions that beat PhDs',
  metric: 'GPQA Diamond',
  real: 'Researchers call this test GPQA Diamond.',
  unit: '%',
  scale: 'linear',
  yMin: 0, yMax: 100,
  xLabel: 'When the model was released',
  yLabel: 'Questions answered correctly',
  yLabelShort: 'Answered right',
  askDate: '2026-06-01',

  plain: 'This test is a set of a few hundred multiple-choice questions in physics, chemistry and biology, written by PhDs to be hard for other PhDs. The questions were built to resist a web search: the writers gave them to clever people with unlimited internet access and thirty minutes, and kept only the ones those people still got wrong.',
  human: 'Someone holding a PhD, answering questions in their own narrow subfield, scores 69.7%. A clever non-expert with Google and half an hour scores 34%. Both are measured numbers from the test’s own paper, and they are the two dashed lines on the chart.',
  example: {
    kind: 'text',
    label: 'A question from this test looks like',
    body: 'One question names three specific chemical reagents, asks which product forms and why the competing reaction is disfavoured, and offers four plausible answers — three of which are exactly what you would get by making one reasonable mistake.',
    note: 'Described rather than quoted: the real questions are deliberately kept out of easy reach so that models cannot be trained on them.'
  },
  question: 'GPT-4 scored 39% in 2023. Draw what happened — and whether the PhD line gets crossed.',

  markers: [
    { value: 69.7, label: 'A PhD, in their own subfield', status: 'primary', src: 'gpqa-epoch' },
    { value: 34.0, label: 'Clever non-expert, Google, 30 min', status: 'primary', src: 'gpqa-paper' }
  ],
  shown: [
    { date: '2023-03-14', label: 'GPT-4', value: 39.0, status: 'reported', src: 'aa-gpqa' }
  ],
  hidden: [
    { date: '2024-09-12', label: 'o1', value: 77.3, note: 'first model past the PhD line', status: 'primary', src: 'openai-o1' },
    { date: '2025-11-18', label: 'Gemini 3 Pro', value: 91.9, status: 'primary', src: 'gemini3' },
    { date: '2026-06-01', label: 'GPT-5.6 Sol / Gemini 3.1 Pro', value: 94.1, note: 'tied', status: 'primary', src: 'aa-gpqa' }
  ],
  reveal: {
    headline: 'The PhD line was crossed in September 2024, and nobody threw a party.',
    body: 'Eighteen months after GPT-4 scored 39%, a model went past the score of a PhD working in their own subject. The interesting part is not the crossing. It is that the crossing was a Thursday — no threshold, no ceremony — and that the number kept climbing afterwards as though nothing in particular had happened.',
    caveat: 'A test of multiple-choice science questions is not a scientist. Beating the expert score here means the model answers questions like an expert. It does not mean it can do an expert’s job, which mostly consists of deciding which questions are worth asking.'
  }
},

/* ---- 3. METR time horizon ------------------------------------------------ */
{
  id: 'metr',
  name: 'How long it can work alone',
  metric: 'METR time horizon',
  real: 'This is METR’s “time horizon” measure.',
  unit: 'min',
  scale: 'log',
  yMin: 1, yMax: 4000,
  xLabel: 'When the model was released',
  yLabel: 'How long that job takes a person',
  yLabelShort: 'Job length, in human time',
  askDate: '2026-06-26',

  plain: 'Instead of scoring answers, this measures how big a job the AI can finish on its own. Take a pile of real tasks and label each one by how long it takes a skilled human. Then find the length at which the AI succeeds about half the time. Short jobs it nearly always finishes. Long ones it nearly always fails. This is where the line crosses.',
  human: 'Read the scale carefully: it is how long the task would take a person to do, not how long the machine runs. A model with a "four-hour" score is finishing jobs that would occupy a professional for four hours — and doing so about half the times it tries.',
  example: {
    kind: 'ladder',
    label: 'Jobs of different sizes',
    items: [
      { t: '2 min',  s: 'Rename a variable everywhere it appears' },
      { t: '15 min', s: 'Write a small script to reformat a data file' },
      { t: '1 hour', s: 'Track down why one test fails only on Tuesdays' },
      { t: '4 hours', s: 'Add a feature across several files, with tests' },
      { t: '1 day+', s: 'Port a component to a different framework' }
    ]
  },
  question: 'In March 2023 it was about three minutes. Where is it now?',
  scaleNote: 'The vertical scale multiplies rather than adds — each gridline is several times the one below it, not a fixed step. A straight line drawn on this chart is already explosive growth.',

  shown: [
    { date: '2023-03-14', label: 'GPT-4', value: 3.5, lo: 1.6, hi: 6.9, status: 'primary', src: 'metr-th11' },
    { date: '2024-05-13', label: 'GPT-4o', value: 6.0, lo: 2.8, hi: 12.4, status: 'primary', src: 'metr-th11' },
    { date: '2025-02-24', label: 'Claude 3.7 Sonnet', value: 60, lo: 32, hi: 106, status: 'primary', src: 'metr-th11' }
  ],
  hidden: [
    { date: '2025-04-16', label: 'o3', value: 121, lo: 74, hi: 201, status: 'primary', src: 'metr-th11' },
    { date: '2025-05-22', label: 'Claude Opus 4', value: 101, lo: 58, hi: 170, status: 'primary', src: 'metr-th11' },
    { date: '2025-08-07', label: 'GPT-5', value: 214, lo: 117, hi: 480, status: 'primary', src: 'metr-th11' },
    { date: '2025-11-24', label: 'Claude Opus 4.5', value: 320, lo: 170, hi: 729, status: 'primary', src: 'metr-th11' },
    { date: '2026-06-26', label: 'GPT-5.6 Sol', value: 678, lo: 300, hi: 2400, status: 'primary', src: 'metr-sol' }
  ],
  reveal: {
    headline: 'Three minutes, to eleven hours.',
    body: 'METR’s own fit: across the whole period the number doubles every 196 days. Restrict it to models released since 2024 and it doubles every 89 days. The line is not just going up. It is bending upwards.',
    caveat: 'The shaded band is the uncertainty, and it is enormous — the eleven-hour figure has a range from five hours to forty. The tasks are almost all software and research engineering, models do measurably worse on messy jobs where success is not clearly defined, and METR says measurements above sixteen hours are unreliable with its current task set. Its own lead author, on how this chart travels: “the hype machine will basically, whatever we do, just strip out all the caveats.”'
  }
},

/* ---- 4. Price of capability ---------------------------------------------- */
{
  id: 'price',
  name: 'What it costs',
  metric: 'Price for GPT-4-level ability',
  real: 'This is Epoch AI’s price-of-capability tracker.',
  unit: '$',
  scale: 'log',
  yMin: 0.05, yMax: 60,
  xLabel: 'Date',
  yLabel: 'Dollars per million words in',
  yLabelShort: 'Dollars per million',
  askDate: '2025-02-05',

  plain: 'This one measures money, not ability — and it is the only chart here that goes down. Pick one fixed level of ability and hold it there: whatever GPT-4 could do when it launched in 2023. Then ask, at each later date, what the cheapest model that still reaches that level charges to run. Models get better and they get cheaper at the same time, and holding the ability still is the only way to see the price on its own.',
  human: 'Prices are quoted per million “tokens” — the small chunks of text models read and write, which come to roughly 750,000 words, or about eight novels. At the 2023 price, running those eight novels through a GPT-4-grade model cost $37.50.',
  example: {
    kind: 'text',
    label: 'Why hold the ability fixed',
    body: 'If you just track “what does the newest model cost”, you learn nothing, because the newest model keeps being more capable. Holding capability constant and watching the price fall is what tells you whether something that was expensive last year is cheap this year.',
    note: 'This is Epoch AI’s method, not ours.'
  },
  question: 'It launched at $37.50 per million. Where does it land?',
  scaleNote: 'The vertical scale multiplies here too, so each gridline down is several times cheaper than the one above — a straight line drawn on this chart is a steep collapse in price.',

  shown: [
    { date: '2023-03-14', label: 'GPT-4', value: 37.50, status: 'primary', src: 'epoch-price' },
    { date: '2023-11-06', label: 'GPT-4 Turbo', value: 15.00, status: 'primary', src: 'epoch-price' },
    { date: '2024-05-13', label: 'GPT-4o', value: 7.50, status: 'primary', src: 'epoch-price' }
  ],
  hidden: [
    { date: '2024-05-23', label: 'Gemini 1.5 Pro', value: 2.19, status: 'primary', src: 'epoch-price' },
    { date: '2025-02-05', label: 'Gemini 2.0 Flash', value: 0.18, status: 'primary', src: 'epoch-price' }
  ],
  endNote: 'Epoch stopped publishing here',
  reveal: {
    headline: '208 times cheaper, in 23 months.',
    body: 'Epoch measured this decline across several ability levels and found it running between 9× and 900× per year depending which level you pick. For GPT-4-grade performance on PhD science questions: 40× per year. Every sentence that begins “it is too expensive to…” has a shelf life, and the shelf life is months.',
    caveat: 'This line stops in February 2025 because that is where Epoch stopped publishing. Continuing it to today would be a guess drawn in the same ink as a measurement, so the demo does not do it.'
  }
},

/* ---- 5. ARC-AGI — the turn ----------------------------------------------- */
{
  id: 'arc',
  turn: true,
  name: 'The one that turns',
  metric: 'ARC-AGI-1',
  real: 'This is the ARC-AGI benchmark, created by François Chollet.',
  unit: '%',
  scale: 'linear',
  yMin: 0, yMax: 100,
  xLabel: 'Date',
  yLabel: 'Puzzles solved',
  yLabelShort: 'Puzzles solved',
  askDate: '2024-12-20',

  plain: 'This test is made of small coloured grids. You are shown two or three examples of some rule being applied, and then a fresh grid to apply the same rule to. Nobody tells you what the rule is — working it out from those few examples is the whole test.',
  human: 'Try the example below. Most people get it in a couple of seconds, and children do fine on these. For five years, AI systems scored close to zero.',
  example: {
    kind: 'arc',
    label: 'One puzzle from this test',
    pairs: [
      { in: [[0,2,0,0],[0,0,0,3],[0,0,0,0],[0,0,0,0]], out: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,2,0,3]] },
      { in: [[1,0,4,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]], out: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,0,4,0]] }
    ],
    test: [[0,0,0,5],[6,0,0,0],[0,0,7,0],[0,0,0,0]],
    answer: [[0,0,0,0],[0,0,0,0],[0,0,0,0],[6,0,7,5]],
    note: 'An ARC-style task in the real format. The actual test set is hundreds of these, and they get much harder.'
  },
  question: 'For five years models scored near zero on this. In December 2024, OpenAI ran a new model called o3 against it. Draw what happened.',

  shown: [
    { date: '2020-06-11', label: 'GPT-3', value: 0, status: 'primary', src: 'arc-o3' },
    { date: '2024-05-13', label: 'GPT-4o', value: 5, status: 'primary', src: 'arc-o3' }
  ],
  hidden: [
    { date: '2024-12-20', label: 'o3, cheap setting', value: 75.7, note: '~$26 per puzzle', status: 'primary', src: 'arc-o3' },
    { date: '2024-12-20', label: 'o3, expensive setting', value: 87.5, note: '~$4,560 per puzzle — 172× the compute for 12 points', status: 'primary', src: 'arc-o3' }
  ],
  reveal: {
    headline: 'Five years near zero, then 87.5% in a single announcement.',
    body: 'By this fifth test, most people have learned to draw these lines steeply — and here that instinct is right. Which is exactly the moment to turn the test over.',
    caveat: 'The high score cost about $4,560 per puzzle — 172 times the computing power of the cheaper run, to gain twelve points. ARC Prize also disclosed that the model they tested had been trained on 75% of the public practice set. François Chollet, who built the test, in the same announcement: “Passing ARC-AGI does not equate to achieving AGI, and, as a matter of fact, I don’t think o3 is AGI yet. o3 still fails on some very easy tasks, indicating fundamental differences with human intelligence.”'
  },

  twist: {
    metric: 'ARC-AGI-2, then ARC-AGI-3',
    question: 'Three months later the same author published a second version — same idea, harder puzzles, built specifically to resist what o3 had done. Watch what the very same model scores.',
    series: [
      { date: '2025-03-24', label: 'o3 on version 2', value: 4, note: 'the same model that scored 87.5%', status: 'reported', src: 'arc-agi2' },
      { date: '2025-07-09', label: 'Grok 4', value: 15.9, status: 'primary', src: 'grok4' },
      { date: '2025-11-18', label: 'Gemini 3 Pro', value: 31.1, status: 'primary', src: 'arc-2025' },
      { date: '2025-12-05', label: 'Best system of 2025', value: 54, note: 'a scaffold around Gemini 3 Pro, ~$31/puzzle — not a model on its own', status: 'primary', src: 'arc-2025' }
    ],
    humanBaseline: 100,
    finale: {
      headline: 'And then version three, March 2026.',
      what: 'ARC-AGI-3 is 135 small interactive games. The agent sees a grid of coloured squares, can press a few keys, and gets a new picture back. It is told nothing: not the rules, not the goal, not how it will be scored. It has to poke at the thing, work out what winning even means, and carry that into the next level. A person just plays it. 486 people were tested in person to set the baseline.',
      body: 'Two numbers get quoted for how AI does on this, and they are three months and one design decision apart.',
      bars: [
        { label: 'An average person', value: 48, kind: 'human',
          note: 'average human tester, public games' },
        { label: 'GPT-5.6 Sol, allowed to remember', value: 38.3, kind: 'good',
          note: 'same model, same games, July 2026' },
        { label: 'GPT-5.6 Sol, standard wiring', value: 13.3, kind: 'mid',
          note: 'reasoning discarded between turns' },
        { label: 'Best model on ARC Prize’s own run', value: 0.51, kind: 'bad',
          note: 'March 2026 — different game set, no agent harness' }
      ],
      punch: 'The middle two are the same model, on the same games, in the same week. The only difference is whether it was allowed to keep its own reasoning from one turn to the next, and how its memory was compacted. Two settings. Three times the score.',
      caveat: 'These four bars are not four measurements of one thing, and it matters. The top three are OpenAI’s own runs on the 25 public games. The bottom one is ARC Prize’s run of bare models on a private set of 55, through a standard harness with no agent scaffolding around it. Anyone quoting a single number for “how AI does on ARC-AGI-3” — including this demo, in an earlier draft — is quoting a harness as much as a model.',
      status: 'primary', src: 'arc-3',
      close: 'So the lesson is not “AI is hopeless at this”, and it is not “AI has nearly caught up”. It is that in the same month, the same systems were beating PhDs on science questions, scoring 4% on a puzzle set they had aced a version earlier, and swinging from 13% to 38% on a third one because of two configuration flags. Capability here is not one number that rises. The edge is jagged, the notches are not where intuition puts them, and a startling share of the headline figure is decided by how somebody wired the thing up.'
    }
  }
}
];

/* --------------------------------------------------------------------------
   ACT II — the release cadence.

   "Open weights" means the file is downloadable and you can run it yourself.
   It is NOT the same as open source: several of these carry licences with
   commercial restrictions, and the field conflates the two constantly.
   -------------------------------------------------------------------------- */

const LABS = {
  openai:    { name: 'OpenAI',            region: 'US',     hue: 174 },
  anthropic: { name: 'Anthropic',         region: 'US',     hue: 22  },
  google:    { name: 'Google DeepMind',   region: 'US',     hue: 210 },
  meta:      { name: 'Meta',              region: 'US',     hue: 262 },
  microsoft: { name: 'Microsoft',         region: 'US',     hue: 196 },
  xai:       { name: 'xAI',               region: 'US',     hue: 320 },
  nvidia:    { name: 'NVIDIA',            region: 'US',     hue: 88  },
  ai2:       { name: 'Allen Institute',   region: 'US',     hue: 45  },
  ibm:       { name: 'IBM',               region: 'US',     hue: 232 },
  usother:   { name: 'Other US',          region: 'US',     hue: 300 },
  mistral:   { name: 'Mistral',           region: 'Europe', hue: 34  },
  euother:   { name: 'Other European',    region: 'Europe', hue: 12  },
  deepseek:  { name: 'DeepSeek',          region: 'China',  hue: 145 },
  alibaba:   { name: 'Alibaba (Qwen)',    region: 'China',  hue: 120 },
  moonshot:  { name: 'Moonshot (Kimi)',   region: 'China',  hue: 100 },
  zhipu:     { name: 'Zhipu / Z.ai (GLM)',region: 'China',  hue: 162 },
  cnother:   { name: 'Other Chinese',     region: 'China',  hue: 132 },
  tii:       { name: 'TII (UAE)',         region: 'Other',  hue: 60  },
  other:     { name: 'Others',            region: 'Other',  hue: 250 }
};

/* `tier` positions a dot vertically. It is a coarse generation band and the
   interface says so — it is NOT a benchmark score. No single number ranks a
   hundred models across four years and twenty labs, and asserting one would
   be the exact error this demo argues against. */
const MODELS = [
  /* 2022 */
  { d:'2022-11-30', lab:'openai',   name:'ChatGPT (GPT-3.5)', open:false, tier:1, note:'The starting gun. A million users in five days.' },

  /* 2023 */
  { d:'2023-02-24', lab:'meta',     name:'LLaMA 1',        open:true,  lic:'Research only', tier:1, note:'Leaked within a week. The open-weight ecosystem starts here.' },
  { d:'2023-03-14', lab:'openai',   name:'GPT-4',          open:false, tier:2, note:'The bar-exam claim came from this launch. It did not survive peer review.' },
  { d:'2023-03-14', lab:'anthropic',name:'Claude 1',       open:false, tier:2, note:'Shipped the same day as GPT-4 and was buried by it.' },
  { d:'2023-05-04', lab:'usother',  name:'StarCoder (BigCode)', open:true, lic:'OpenRAIL-M', tier:1, note:'Hugging Face and ServiceNow: an openly-trained code model.' },
  { d:'2023-05-25', lab:'tii',      name:'Falcon 40B',     open:true,  lic:'Apache 2.0', tier:2, note:'First Gulf-funded model to top the open leaderboard.', approx:true },
  { d:'2023-06-20', lab:'microsoft',name:'Phi-1',          open:true,  lic:'MIT', tier:1, note:'1.3B parameters beating far larger models — the small-model thesis.' },
  { d:'2023-07-18', lab:'meta',     name:'Llama 2',        open:true,  lic:'Llama Community', tier:2, note:'First openly downloadable model licensed for commercial use.' },
  { d:'2023-08-03', lab:'alibaba',  name:'Qwen-7B',        open:true,  lic:'Tongyi Qianwen', tier:2, note:'Alibaba opens what becomes the most-forked family in the world.' },
  { d:'2023-09-06', lab:'tii',      name:'Falcon 180B',    open:true,  lic:'Falcon licence', tier:2, note:'Largest openly downloadable model at the time.', approx:true },
  { d:'2023-09-27', lab:'mistral',  name:'Mistral 7B',     open:true,  lic:'Apache 2.0', tier:2, note:'Beat models twice its size, fully permissive. Europe arrives.' },
  { d:'2023-11-02', lab:'cnother',  name:'Yi-34B (01.AI)', open:true,  lic:'Apache 2.0', tier:2, note:'Kai-Fu Lee’s lab enters the open-weight race.' },
  { d:'2023-11-06', lab:'openai',   name:'GPT-4 Turbo',    open:false, tier:2, note:'128K context and a price cut.' },
  { d:'2023-11-29', lab:'deepseek', name:'DeepSeek LLM 67B', open:true, lic:'DeepSeek licence', tier:2, note:'The first release from a lab nobody had heard of yet.' },
  { d:'2023-12-06', lab:'google',   name:'Gemini 1.0',     open:false, tier:2, note:'Natively multimodal — and a launch demo Google admitted was edited.' },
  { d:'2023-12-11', lab:'mistral',  name:'Mixtral 8x7B',   open:true,  lic:'Apache 2.0', tier:2, note:'Put mixture-of-experts in everyone’s hands.' },
  { d:'2023-12-12', lab:'microsoft',name:'Phi-2',          open:true,  lic:'MIT', tier:1, note:'2.7B beating 13B peers.', approx:true },

  /* 2024 */
  { d:'2024-02-01', lab:'ai2',      name:'OLMo',           open:true,  lic:'Apache 2.0 · data + code too', tier:2, note:'Not just open weights — the training data and code as well. Genuinely reproducible.', approx:true },
  { d:'2024-02-15', lab:'google',   name:'Gemini 1.5 Pro', open:false, tier:3, note:'A million tokens of context. An hour of video in one prompt.' },
  { d:'2024-02-21', lab:'google',   name:'Gemma 1',        open:true,  lic:'Gemma licence', tier:2, note:'Google’s first open weights, built from the Gemini research.' },
  { d:'2024-03-04', lab:'anthropic',name:'Claude 3 family', open:false, tier:3, note:'First non-OpenAI model to take the top of the public leaderboard.' },
  { d:'2024-03-07', lab:'euother',  name:'Occiglot (EU5)', open:true,  lic:'Apache 2.0', tier:1, note:'A European research collective: five EU languages, openly.' },
  { d:'2024-03-17', lab:'xai',      name:'Grok-1 (weights opened)', open:true, lic:'Apache 2.0', tier:2, note:'The only Grok generation ever open-weighted.' },
  { d:'2024-03-27', lab:'usother',  name:'DBRX (Databricks)', open:true, lic:'Databricks Open Model', tier:2, note:'132B mixture-of-experts from an enterprise data company.' },
  { d:'2024-03-28', lab:'other',    name:'Jamba (AI21, Israel)', open:true, lic:'Apache 2.0', tier:2, note:'First production-scale hybrid Mamba/Transformer.' },
  { d:'2024-04-02', lab:'euother',  name:'Poro 34B (Finland)', open:true, lic:'Apache 2.0', tier:2, note:'Nordic open model trained on the LUMI supercomputer.' },
  { d:'2024-04-09', lab:'google',   name:'CodeGemma',      open:true,  lic:'Gemma licence', tier:2, note:'The first specialist Gemma.', approx:true },
  { d:'2024-04-18', lab:'meta',     name:'Llama 3',        open:true,  lic:'Llama Community', tier:3, note:'Became the most fine-tuned open model of the year.' },
  { d:'2024-04-22', lab:'usother',  name:'OpenELM (Apple)', open:true, lic:'Apple ASCL', tier:1, note:'Apple releases open weights, aimed at devices.' },
  { d:'2024-04-23', lab:'microsoft',name:'Phi-3 family',   open:true,  lic:'MIT', tier:2, note:'A phone-runnable model rivalling much larger ones.' },
  { d:'2024-04-24', lab:'usother',  name:'Arctic (Snowflake)', open:true, lic:'Apache 2.0', tier:2, note:'Enterprise-focused open mixture-of-experts.' },
  { d:'2024-05-06', lab:'deepseek', name:'DeepSeek-V2',    open:true,  lic:'DeepSeek licence', tier:3, note:'Started China’s API price war.' },
  { d:'2024-05-13', lab:'openai',   name:'GPT-4o',         open:false, tier:3, note:'One model for text, vision and audio. 232ms voice latency.' },
  { d:'2024-05-29', lab:'mistral',  name:'Codestral',      open:true,  lic:'Research only', tier:2, note:'Mistral’s first code model.' },
  { d:'2024-06-06', lab:'alibaba',  name:'Qwen2',          open:true,  lic:'Apache 2.0 (most)', tier:3 },
  { d:'2024-06-14', lab:'nvidia',   name:'Nemotron-4 340B', open:true, lic:'NVIDIA Open Model', tier:3, note:'A chip company releasing a huge model — to generate training data for everyone else.' },
  { d:'2024-06-20', lab:'anthropic',name:'Claude 3.5 Sonnet', open:false, tier:3, note:'33.4% on the bug-fixing test — round one’s first point.' },
  { d:'2024-06-27', lab:'google',   name:'Gemma 2',        open:true,  lic:'Gemma licence', tier:3 },
  { d:'2024-06-27', lab:'cnother',  name:'InternLM2.5 (Shanghai AI Lab)', open:true, lic:'Free for commercial use', tier:2 },
  { d:'2024-07-09', lab:'google',   name:'PaliGemma',      open:true,  lic:'Gemma licence', tier:2, note:'Gemma that can see.' },
  { d:'2024-07-16', lab:'mistral',  name:'Codestral Mamba / Mathstral', open:true, lic:'Apache 2.0', tier:2, note:'A code model that is not a Transformer, and a maths specialist.' },
  { d:'2024-07-23', lab:'meta',     name:'Llama 3.1 405B', open:true,  lic:'Llama Community', tier:3, note:'First open-weight model credibly compared to the closed frontier.' },
  { d:'2024-08-20', lab:'other',    name:'Jamba 1.5 (AI21)', open:true, lic:'Jamba Open Model', tier:3 },
  { d:'2024-09-12', lab:'openai',   name:'o1-preview',     open:false, tier:4, note:'Thinking before answering becomes a product. A second way to buy capability opens up.' },
  { d:'2024-09-19', lab:'alibaba',  name:'Qwen2.5',        open:true,  lic:'Apache 2.0 (most)', tier:3, note:'Became the default base model for everyone else’s fine-tunes.' },
  { d:'2024-09-25', lab:'meta',     name:'Llama 3.2',      open:true,  lic:'Llama Community', tier:3, note:'First Llama that can see, and first small enough for a phone.' },
  { d:'2024-09-25', lab:'ai2',      name:'Molmo',          open:true,  lic:'Apache 2.0 · fully open', tier:3, note:'A fully open multimodal model competitive with closed ones.' },
  { d:'2024-10-02', lab:'nvidia',   name:'Llama-3.1-Nemotron-70B', open:true, lic:'NVIDIA Open Model', tier:3, approx:true },
  { d:'2024-10-21', lab:'ibm',      name:'Granite 3.0',    open:true,  lic:'Apache 2.0', tier:2, note:'IBM commits to fully permissive enterprise models.' },
  { d:'2024-10-22', lab:'anthropic',name:'Claude 3.5 Sonnet (new)', open:false, tier:4, note:'Computer use: it looks at a screen and moves the cursor. 49% on the bug test.' },
  { d:'2024-11-20', lab:'alibaba',  name:'QwQ-32B-Preview', open:true, lic:'Apache 2.0', tier:3, note:'An open thinking model, two months after o1.' },
  { d:'2024-11-22', lab:'ai2',      name:'Tülu 3',         open:true,  lic:'Llama Community', tier:3, note:'The whole post-training recipe published, not just the result.' },
  { d:'2024-12-02', lab:'euother',  name:'EuroLLM-9B',     open:true,  lic:'Open', tier:2, note:'EU-funded, every official EU language.' },
  { d:'2024-12-12', lab:'microsoft',name:'Phi-4',          open:true,  lic:'MIT', tier:3, note:'Strong reasoning from synthetic data, fully permissive.' },
  { d:'2024-12-17', lab:'tii',      name:'Falcon 3',       open:true,  lic:'Falcon licence', tier:2, approx:true },
  { d:'2024-12-20', lab:'openai',   name:'o3 (announced)', open:false, tier:5, note:'87.5% on the grid puzzles at ~$4,560 a task. See round five.' },
  { d:'2024-12-26', lab:'deepseek', name:'DeepSeek-V3',    open:true,  lic:'MIT', tier:4, note:'$5.6M for the final training run — a figure that excluded the cluster it ran on.' },
  { d:'2024-12-31', lab:'ai2',      name:'OLMo 2',         open:true,  lic:'Apache 2.0 · fully open', tier:3 },

  /* 2025 */
  { d:'2025-01-14', lab:'cnother',  name:'MiniMax-01',     open:true,  lic:'Custom', tier:3, note:'456B mixture-of-experts built for extremely long context.' },
  { d:'2025-01-20', lab:'deepseek', name:'DeepSeek-R1',    open:true,  lic:'MIT', tier:4, note:'Open weights, o1-class reasoning. Nvidia lost $589B of market value the following Monday.' },
  { d:'2025-01-20', lab:'moonshot', name:'Kimi k1.5',      open:false, tier:4, note:'Matched o1 on maths and code the same week as R1.' },
  { d:'2025-02-04', lab:'usother',  name:'SmolLM2 (Hugging Face)', open:true, lic:'Apache 2.0', tier:1, note:'Tiny, fully open, runs on almost anything.' },
  { d:'2025-02-24', lab:'anthropic',name:'Claude 3.7 Sonnet', open:false, tier:4, note:'One model with a dial between answering fast and thinking hard. 63.7% on the bug test.' },
  { d:'2025-03-07', lab:'cnother',  name:'Ling (Ant Group)', open:true, lic:'MIT', tier:3 },
  { d:'2025-03-12', lab:'google',   name:'Gemma 3',        open:true,  lic:'Gemma licence', tier:3, note:'Multimodal, 140+ languages, 128K context — openly downloadable.' },
  { d:'2025-03-13', lab:'ai2',      name:'OLMo 2 32B',     open:true,  lic:'Apache 2.0 · fully open', tier:3, note:'AI2 claims the first fully-open model past GPT-3.5 class.' },
  { d:'2025-03-16', lab:'cnother',  name:'Ernie 4.5 / X1 (Baidu)', open:true, lic:'Apache 2.0 (opened later)', tier:4, note:'Baidu reverses course and open-sources its flagship.' },
  { d:'2025-03-18', lab:'google',   name:'TxGemma',        open:true,  lic:'Health AI Dev Foundations', tier:2, note:'A Gemma tuned for drug discovery.' },
  { d:'2025-03-25', lab:'google',   name:'Gemini 2.5 Pro', open:false, tier:5, note:'Took the top of every public leaderboard on release.' },
  { d:'2025-04-01', lab:'other',    name:'Command A (Cohere, Canada)', open:true, lic:'CC-BY-NC', tier:3 },
  { d:'2025-04-05', lab:'meta',     name:'Llama 4',        open:true,  lic:'Llama Community', tier:4, note:'The leaderboard submission was a tuned variant that was not the released model.' },
  { d:'2025-04-16', lab:'openai',   name:'o3 / o4-mini',   open:false, tier:5, note:'Tools used inside the chain of thought.' },
  { d:'2025-04-28', lab:'alibaba',  name:'Qwen3',          open:true,  lic:'Apache 2.0', tier:4 },
  { d:'2025-04-30', lab:'microsoft',name:'Phi-4-reasoning', open:true, lic:'MIT', tier:3 },
  { d:'2025-05-12', lab:'cnother',  name:'MiMo-7B (Xiaomi)', open:true, lic:'MIT', tier:2, note:'A phone company ships an open reasoning model.' },
  { d:'2025-05-15', lab:'usother',  name:'SWE-1 (Windsurf)', open:false, tier:3, note:'A coding tool trains its own model — the first of several.' },
  { d:'2025-05-20', lab:'google',   name:'MedGemma',       open:true,  lic:'Health AI Dev Foundations', tier:3, note:'An open medical model. Google is explicit that it is not clinical grade.' },
  { d:'2025-05-20', lab:'google',   name:'Gemma 3n',       open:true,  lic:'Gemma licence', tier:3, note:'Built to run on a phone, multimodal.' },
  { d:'2025-05-21', lab:'mistral',  name:'Devstral',       open:true,  lic:'Apache 2.0', tier:3, note:'Open agentic coding model.' },
  { d:'2025-05-21', lab:'tii',      name:'Falcon-H1',      open:true,  lic:'Falcon licence', tier:3 },
  { d:'2025-05-22', lab:'anthropic',name:'Claude Opus 4 / Sonnet 4', open:false, tier:5, note:'72.5% on the bug test.' },
  { d:'2025-06-06', lab:'cnother',  name:'dots.llm1 (RedNote)', open:true, lic:'MIT', tier:3 },
  { d:'2025-06-16', lab:'cnother',  name:'MiniMax-M1',     open:true,  lic:'Apache 2.0', tier:4 },
  { d:'2025-06-27', lab:'cnother',  name:'Hunyuan-A13B (Tencent)', open:true, lic:'Tencent licence', tier:3 },
  { d:'2025-07-09', lab:'xai',      name:'Grok 4',         open:false, tier:5, note:'15.9% on the harder grid puzzles — roughly double the field.' },
  { d:'2025-07-11', lab:'moonshot', name:'Kimi K2',        open:true,  lic:'Modified MIT', tier:4, note:'A trillion parameters, openly downloadable.' },
  { d:'2025-07-22', lab:'alibaba',  name:'Qwen3-Coder 480B', open:true, lic:'Apache 2.0', tier:4, note:'An open model aimed squarely at the paid coding agents.' },
  { d:'2025-07-25', lab:'cnother',  name:'Step3 (StepFun)', open:true, lic:'Apache 2.0', tier:3 },
  { d:'2025-08-05', lab:'openai',   name:'gpt-oss 120b / 20b', open:true, lic:'Apache 2.0', tier:4, note:'OpenAI’s first open weights since 2019.' },
  { d:'2025-08-07', lab:'openai',   name:'GPT-5',          open:false, tier:5, note:'Routes between a fast model and a thinking one. 74.9% on the bug test.' },
  { d:'2025-08-08', lab:'zhipu',    name:'GLM-4.5',        open:true,  lic:'MIT', tier:4 },
  { d:'2025-08-18', lab:'nvidia',   name:'Nemotron Nano 2', open:true, lic:'NVIDIA Open Model', tier:3 },
  { d:'2025-08-20', lab:'cnother',  name:'Seed-OSS-36B (ByteDance)', open:true, lic:'Apache 2.0', tier:3 },
  { d:'2025-08-21', lab:'deepseek', name:'DeepSeek-V3.1',  open:true,  lic:'MIT', tier:4 },
  { d:'2025-09-01', lab:'cnother',  name:'LongCat-Flash (Meituan)', open:true, lic:'MIT', tier:3, note:'A food-delivery company ships a 560B open model.' },
  { d:'2025-09-29', lab:'anthropic',name:'Claude Sonnet 4.5', open:false, tier:5, note:'82% on the bug test. Anthropic reported 30+ hours of unbroken autonomous work.' },
  { d:'2025-09-29', lab:'deepseek', name:'DeepSeek-V3.2-Exp', open:true, lic:'MIT', tier:4 },
  { d:'2025-10-02', lab:'ibm',      name:'Granite 4.0',    open:true,  lic:'Apache 2.0', tier:3 },
  { d:'2025-10-29', lab:'usother',  name:'Composer (Cursor)', open:false, tier:4, note:'The coding tool everyone uses ships its own frontier model.' },
  { d:'2025-11-18', lab:'google',   name:'Gemini 3 Pro',   open:false, tier:6, note:'91.9% on the PhD questions, 31.1% on the harder grid puzzles.' },
  { d:'2025-11-20', lab:'ai2',      name:'OLMo 3',         open:true,  lic:'Apache 2.0 · fully open', tier:4, note:'Weights, data, code and the training traces.' },
  { d:'2025-11-24', lab:'anthropic',name:'Claude Opus 4.5', open:false, tier:6 },
  { d:'2025-12-01', lab:'deepseek', name:'DeepSeek-V3.2',  open:true,  lic:'MIT', tier:5 },
  { d:'2025-12-02', lab:'mistral',  name:'Mistral Large 3', open:true, lic:'Open weights', tier:4, note:'Europe returns to a large open flagship.' },
  { d:'2025-12-11', lab:'openai',   name:'GPT-5.2',        open:false, tier:6, note:'Three weeks after Gemini 3, amid reports of an internal “Code Red”.' },

  /* 2026 */
  { d:'2026-01-05', lab:'tii',      name:'Falcon-H1R / Arabic', open:true, lic:'Falcon licence', tier:4 },
  { d:'2026-02-05', lab:'anthropic',name:'Claude Opus 4.6', open:false, tier:6 },
  { d:'2026-02-11', lab:'zhipu',    name:'GLM-5',          open:true,  lic:'Open weights', tier:5, note:'744B parameters, openly downloadable. Led every open model on the independent index.' },
  { d:'2026-02-16', lab:'alibaba',  name:'Qwen3.5',        open:true,  lic:'Apache 2.0', tier:5, approx:true },
  { d:'2026-02-19', lab:'google',   name:'Gemini 3.1 Pro', open:false, tier:7, note:'94.1% on the PhD questions. Still top of the hardest exam leaderboard in August 2026.' },
  { d:'2026-03-05', lab:'openai',   name:'GPT-5.4',        open:false, tier:7 },
  { d:'2026-04-08', lab:'meta',     name:'Muse Spark',     open:false, tier:6, note:'Meta’s first model from its new lab — and closed. The Llama era ends.' },
  { d:'2026-04-15', lab:'alibaba',  name:'Qwen3.6',        open:true,  lic:'Apache 2.0', tier:5, approx:true },
  { d:'2026-04-16', lab:'anthropic',name:'Claude Opus 4.7', open:false, tier:7 },
  { d:'2026-04-24', lab:'deepseek', name:'DeepSeek V4',    open:true,  lic:'MIT', tier:6, note:'1.6T parameters, a million tokens of context by default.', approx:true },
  { d:'2026-04-28', lab:'nvidia',   name:'Nemotron 3',     open:true,  lic:'NVIDIA Open Model', tier:5, approx:true },
  { d:'2026-05-28', lab:'anthropic',name:'Claude Opus 4.8', open:false, tier:7 },
  { d:'2026-06-09', lab:'anthropic',name:'Claude Fable 5 / Mythos 5', open:false, tier:7, note:'A new tier above the Opus line.' },
  { d:'2026-06-30', lab:'anthropic',name:'Claude Sonnet 5', open:false, tier:7 },
  { d:'2026-07-09', lab:'openai',   name:'GPT-5.6 (Sol / Terra / Luna)', open:false, tier:8, note:'METR measured Sol finishing eleven-hour jobs, half the time.' },
  { d:'2026-07-09', lab:'xai',      name:'Grok 4.5',       open:false, tier:7 },
  { d:'2026-07-17', lab:'moonshot', name:'Kimi K3',        open:true,  lic:'Kimi K3 licence', tier:7, note:'2.8T parameters. The largest openly released model so far — from a startup, in Beijing.' },
  { d:'2026-07-24', lab:'anthropic',name:'Claude Opus 5',  open:false, tier:8 }
];

/* --------------------------------------------------------------------------
   ACT II (b) — capability unlocks, fired by the scrubber.
   Where a claim was later walked back, the walk-back travels with it.
   -------------------------------------------------------------------------- */

const UNLOCKS = [
  { d:'2022-11-30', title:'Anyone can use it',
    body:'Not a new technique — the underlying method was a year old — but the moment it stopped requiring an API key and a knack for phrasing.',
    status:'primary', src:'chatgpt' },
  { d:'2023-03-14', title:'It passes the exams (with an asterisk)',
    body:'GPT-4 launched claiming the 90th percentile on the bar exam. A peer-reviewed re-analysis in 2024 found the comparison group was people re-sitting the exam after failing. Against first-time takers it lands near the 62nd percentile; against those who passed, the 48th, and the 15th on the essays.',
    status:'primary', src:'bar-exam', flag:'walked back' },
  { d:'2023-09-25', title:'It can see',
    body:'Image input arrives in ChatGPT. Show it a photo, a screenshot, a diagram, a whiteboard.',
    status:'primary', src:'gpt4v' },
  { d:'2023-12-14', title:'It found new mathematics',
    body:'FunSearch, in Nature: a language model paired with a search loop improves the best-known construction for a real open problem. The first documented case of one of these systems producing genuinely new mathematics.',
    status:'primary', src:'funsearch' },
  { d:'2024-02-15', title:'A million tokens of context',
    body:'An hour of video, or an entire codebase, in a single prompt. Later research found that what a model can reliably use is far shorter than the amount it will accept.',
    status:'primary', src:'gemini15', flag:'caveat' },
  { d:'2024-07-25', title:'Silver at the Mathematical Olympiad',
    body:'A DeepMind system scored 28/42 at the 2024 IMO — silver-medal standard. Humans had to translate the problems into formal logic first, and it took up to three days per problem against a student’s 4.5 hours. Graded by Timothy Gowers and Joseph Myers.',
    status:'primary', src:'imo2024' },
  { d:'2024-09-12', title:'It thinks before it answers',
    body:'o1. Spending longer on a hard question now buys accuracy — a second lever, separate from making the model bigger.',
    status:'primary', src:'openai-o1' },
  { d:'2024-10-09', title:'A Nobel Prize',
    body:'The 2024 Chemistry Nobel goes to David Baker “for computational protein design”, and to Demis Hassabis and John Jumper “for protein structure prediction”.',
    status:'primary', src:'nobel' },
  { d:'2024-10-22', title:'It can drive a computer',
    body:'Claude is given a screen, a cursor and a keyboard. On a benchmark of real desktop tasks, success went from the teens to the low seventies in about a year.',
    status:'primary', src:'anthropic-computer-use' },
  { d:'2025-01-20', title:'The frontier gets open weights',
    body:'DeepSeek-R1: downloadable by anyone, MIT licence, reasoning on par with the best closed model. Nvidia lost $589 billion of market value the following Monday — the largest one-day loss for any company to that point.',
    status:'primary', src:'r1' },
  { d:'2025-05-14', title:'It improves the algorithms',
    body:'AlphaEvolve finds a way to multiply two 4×4 matrices in 48 multiplications instead of 49 — the first improvement in that case in 56 years — and a better sphere-packing arrangement in 11 dimensions.',
    status:'primary', src:'alphaevolve' },
  { d:'2025-07-10', title:'And it can make you slower',
    body:'METR ran a randomised trial: sixteen experienced open-source developers, real tasks in codebases they knew well. With AI tools they took 19% longer. They had predicted a 24% speed-up beforehand, and still believed they had been 20% faster afterwards.',
    status:'primary', src:'metr-rct', flag:'counterweight' },
  { d:'2025-07-21', title:'Gold at the Olympiad, in plain English',
    body:'Gemini Deep Think scored 35/42 at the 2025 IMO — gold — reading the problems in ordinary language, inside the students’ own 4.5-hour sessions, graded by the competition’s own coordinators. OpenAI announced the same score two days earlier, graded by former medallists it hired itself, ahead of the closing ceremony organisers had asked labs to wait for.',
    status:'primary', src:'imo2025', flag:'contested' },
  { d:'2026-03-25', title:'A test where the wiring matters more than the model',
    body:'ARC-AGI-3: small interactive games with no instructions and no stated goal. Bare frontier models run through the standard harness scored 0.51%. Four months later, the same generation of model — allowed to keep its own reasoning between turns — scored 38.3% on the public games, against an average human tester’s 48%. Two configuration settings, three times the score.',
    status:'primary', src:'arc-3-openai', flag:'caveat' }
];

/* --------------------------------------------------------------------------
   ACT III — what it can actually do.

   Mathematics is one domain among several, and it is here because it is where
   the potential showed up earliest and is checkable most rigorously — a proof
   is either right or it is not. Every entry separates what the machine did
   from what the humans did, because that is where the overclaiming lives.
   -------------------------------------------------------------------------- */

const DOMAINS = [
{
  id: 'bio',
  name: 'Proteins and biology',
  lede: 'This is the most settled case of the six. A problem that had stayed open for fifty years is now routine infrastructure that biologists use every day, and it has a Nobel Prize attached.',
  items: [
    { verdict:'verified', date:'2024-10-09', title:'A Nobel Prize for protein structure',
      what:'Predicting how a protein folds from its sequence alone — a fifty-year-old grand challenge in biology.',
      machine:'AlphaFold2 predicted structures at close to experimental accuracy, turning a job that took years of laboratory work into minutes, across essentially all 200 million known proteins.',
      human:'The 2024 Nobel Prize in Chemistry went one half to David Baker “for computational protein design”, and the other half jointly to Demis Hassabis and John Jumper “for protein structure prediction”.',
      status:'primary', src:'nobel' },
    { verdict:'verified', date:'2024-05-08', title:'AlphaFold 3, and a fight about the code',
      what:'Extending structure prediction from proteins alone to proteins together with DNA, RNA, drug molecules and ions.',
      machine:'On an independent test set of structures published after its training cut-off, it beat the standard classical docking tool by a statistically decisive margin.',
      human:'Nature published an editorial about the backlash when the paper shipped with pseudocode rather than working code. Under pressure DeepMind released it; the model weights still require individual application and clinical use is contractually prohibited.',
      caveat:'A broader study of this class of tool found that no deep-learning docking method yet beats classical tools once you check whether the predicted poses are physically plausible, rather than scoring on distance alone.',
      status:'primary', src:'alphafold3' },
    { verdict:'verified', date:'2025-02-21', title:'A fluorescent protein that evolution never made',
      what:'Designing a working protein far outside anything in nature.',
      machine:'A protein language model generated esmGFP, a fluorescent protein 96 mutations away from the nearest known natural one — around 58% sequence identity.',
      human:'The protein was then built in a laboratory and its glow measured, and the work was published in Science.',
      caveat:'The company’s framing — that this equals 500 million years of evolution — is its own interpretation, not a measured quantity. The first candidate was about 50× dimmer than natural versions, and esmGFP took a week to reach comparable brightness against under a day for the natural ones.',
      status:'primary', src:'esm3' },
    { verdict:'verified', date:'2024-10-02', title:'A whole brain, wired',
      what:'The complete connectome of an adult fruit fly: every neuron, every connection.',
      machine:'Automated segmentation and synapse detection produced the initial reconstruction of 139,255 neurons and about 54.5 million synapses.',
      human:'Roughly 33 person-years of manual proofreading by research groups and citizen scientists. This was AI-assisted and human-verified, not an autonomous result.',
      caveat:'Postsynapse detection was only 44.7% complete against 93.7% for presynapses, electrical synapses were not captured, and it is one individual fly.',
      status:'primary', src:'flywire' }
  ]
},
{
  id: 'med',
  name: 'Medicine',
  lede: 'This is where the gap between a test score and a real clinical result is widest. The wins here involve real trials and real patients — and so do the failures.',
  items: [
    { verdict:'verified', date:'2025-06-01', title:'An AI-discovered drug reaches human trials',
      what:'Idiopathic pulmonary fibrosis, a lung disease with few good options.',
      machine:'One system identified the biological target and another designed the molecule. Both steps ran on Insilico Medicine’s own pipeline, and that division of labour is their account of it.',
      human:'A randomised Phase 2a trial of 71 patients over 12 weeks, published in Nature Medicine. At the highest dose, lung capacity improved by 98.4 mL against a 20.3 mL decline on placebo.',
      caveat:'The authors’ own stated limits: “small cohort size of each arm, the geographical and demographic homogeneity of the participants… and a short period of follow-up.” No AI-discovered drug has completed Phase 3 or been approved as of August 2026.',
      status:'primary', src:'rentosertib' },
    { verdict:'verified', date:'2020-01-01', title:'Catching cancers that radiologists missed',
      what:'Breast cancer screening from mammograms.',
      machine:'An AI system read the same scans as six independent radiologists.',
      human:'In a peer-reviewed retrospective study in Nature, it reduced false negatives by 9.4% on the US dataset and 2.7% on the UK dataset relative to the radiologists’ original readings.',
      caveat:'Retrospective, not a live deployment. The datasets differ between countries, and restricted training data limits reproducibility. The authors framed it as groundwork for clinical trials, not a finished clinical claim.',
      status:'primary', src:'mammo' },
    { verdict:'overclaimed', date:'2024-07-04', title:'And on real patient records, it is worse than the doctors',
      what:'Diagnosis from actual emergency-department records rather than exam questions.',
      machine:'Open models were tested on 2,400 real cases across four abdominal conditions.',
      human:'Published in Nature Medicine: the models performed significantly worse than clinicians, with a 16–25 percentage-point gap, and were sensitive to both the quantity and the order of the information they were given.',
      caveat:'Set this against every headline about models passing medical licensing exams. The exam is not the job. Google’s own open medical model ships with an explicit warning that its output is “not intended to directly inform clinical diagnosis, patient management decisions, treatment recommendations.”',
      status:'primary', src:'mimic-cdm' }
  ]
},
{
  id: 'weather',
  name: 'Weather',
  lede: 'This is the quietest success of the six, and probably the one that touches the most people day to day. It is already running in production at Europe’s main forecasting centre.',
  items: [
    { verdict:'verified', date:'2024-12-04', title:'Better forecasts, in eight minutes',
      what:'Ten-to-fifteen day global weather prediction.',
      machine:'GenCast beat the European Centre’s own ensemble forecast on 97.2% of 1,320 targets tested, with the biggest gains three to five days out, and produced a fifteen-day forecast in eight minutes on a single chip. Its predecessor GraphCast beat the deterministic forecast on over 90% of targets.',
      human:'Both were published in Nature and Science respectively, evaluated against the operational system rather than a strawman.',
      caveat:'The authors are explicit that this does not replace physics: the AI is trained on, and initialised from, data that conventional weather models produce. It is a layer on top, not a substitute. ECMWF has since put an AI forecasting system into operational use alongside the physical one.',
      status:'primary', src:'gencast' }
  ]
},
{
  id: 'materials',
  name: 'Materials',
  lede: 'This is the cautionary field. The claimed output is enormous, but a pattern keeps repeating: a result announced as “new” turns out to mean only “new to this particular database”.',
  items: [
    { verdict:'verified', date:'2023-11-29', title:'2.2 million candidate crystals',
      what:'Searching for stable inorganic materials that nobody has made.',
      machine:'GNoME predicted 2.2 million structures, of which 381,000 were assessed as newly stable — against roughly 48,000 previously known.',
      human:'The work was published in Nature, and 736 of the predicted structures were independently matched against an existing materials database.',
      caveat:'The authors themselves flag that stability on paper is not the same as being makeable. A peer-reviewed critique in Chemistry of Materials disputes how much of this is genuinely new. And the companion robotic-synthesis paper claims 41 new compounds in its abstract while its own main text confirms only 36 of 57 targets.',
      status:'primary', src:'gnome' },
    { verdict:'overclaimed', date:'2026-01-01', title:'The flagship new material was reported in 1972',
      what:'Microsoft’s MatterGen generated a compound to hit a specific mechanical target, and it was synthesised and measured.',
      machine:'It produced TaCr₂O₆, which was made and measured at 158–169 GPa against a 200 GPa design target.',
      human:'A peer-reviewed paper in Materials Horizons found the compound is essentially identical to one already reported in 1972 — and present in MatterGen’s own training data.',
      caveat:'This is the clearest documented case in the whole demo of a generative model retrieving rather than inventing, published in a refereed journal. No AI-designed material has been confirmed in industrial production.',
      status:'primary', src:'mattergen-critique' }
  ]
},
{
  id: 'math',
  name: 'Mathematics',
  lede: 'This is where the potential showed up earliest, because a proof can be checked exactly in a way a drug candidate cannot. It holds two genuine results from 2026 — and the field’s loudest false alarm.',
  items: [
    { verdict:'verified', date:'2026-05-01', title:'Erdős Problem #1196',
      what:'A 1966 conjecture about primitive sets — sets of integers where no member divides another.',
      machine:'GPT-5.4 Pro, queried autonomously, produced the key idea: bounding the sums using Markov chains with von Mangoldt weights. The paper’s abstract says the method was “suggested from output of GPT-5.4 Pro”.',
      human:'Eight mathematicians, Terence Tao among them, verified it, generalised it and wrote it up. Two of the six main theorems are machine-checked in Lean; the other four rest on human review.',
      quote:'proof generation, proof verification, and proof digestion. In this particular case, the first two steps were extremely rapid due to modern AI tools; however, properly digesting the AI-generated proofs into a coherent exposition that places the arguments in context with both past literature and future directions remains a slower process that requires expert human attention.',
      quoteBy:'Terence Tao, 3 May 2026',
      status:'primary', src:'erdos1196' },
    { verdict:'verified', date:'2026-05-21', title:'An eighty-year-old conjecture, disproved',
      what:'Erdős conjectured in 1946 how many pairs of points in a plane can sit exactly one unit apart. It stood for eighty years.',
      machine:'An OpenAI model produced the counterexample construction autonomously, using algebraic number theory — an approach nobody had brought to the problem.',
      human:'Nine mathematicians, including Noga Alon, Timothy Gowers and Jacob Tsimerman, wrote up and analysed the disproof. Will Sawin then improved the bound further.',
      caveat:'The conjecture is disproved; the problem is not solved. The true growth rate remains unknown.',
      status:'primary', src:'unitdistance' },
    { verdict:'verified', date:'2025-11-05', title:'AlphaEvolve, and what testing it honestly looks like',
      what:'A system that writes candidate programs and evolves them against a checker.',
      machine:'Beat a 1969 record for multiplying 4×4 matrices — 48 multiplications instead of 49. Improved a sphere-packing arrangement in 11 dimensions. Across 50+ open problems it matched the state of the art on about 75% and improved it on about 20%.',
      human:'Terence Tao and three colleagues then ran it across 67 problems and published everything, including what did not work.',
      quote:'AlphaEvolve was extremely good at locating ‘exploits’ in the verification code we provided, for instance using degenerate solutions or overly forgiving scoring.',
      quoteBy:'Terence Tao et al., 5 November 2025',
      caveat:'On problems well-known enough to be in its training data it returned optimal answers almost instantly, and the authors had to disguise problems to tell recall from search. It disproved no major open conjecture. Substantial human effort goes into designing a checker it cannot cheat.',
      status:'primary', src:'alphaevolve-tao' },
    { verdict:'overclaimed', date:'2025-10-19', title:'The ten problems that were never open',
      what:'The field’s loudest false alarm, and worth telling carefully.',
      machine:'GPT-5 searched the mathematical literature and found published papers solving problems listed as open on a well-known database.',
      human:'An OpenAI vice-president posted that “GPT-5 found solutions to 10 (!) previously unsolved Erdős problems and made progress on 11 others”. Thomas Bloom, who maintains the database, called it “a dramatic misrepresentation” and explained that “open” on his site means only “I personally am unaware of a paper which solves it”. Demis Hassabis: “This is embarrassing.” The post was deleted.',
      caveat:'Be fair to everyone in this: the researcher who ran the search described it accurately as a literature-search result. An executive inflated it. The correction took about a day and came from the person best placed to make it. The system worked — but only because somebody checked.',
      status:'primary', src:'erdosgate' }
  ]
},
{
  id: 'software',
  name: 'Software',
  lede: 'This is the field where these systems are used the most and measured the most — and it is where the best-controlled study of them found the opposite of what almost everyone expected.',
  items: [
    { verdict:'verified', date:'2025-09-29', title:'Thirty hours without supervision',
      what:'How long an AI can be left running on a programming job.',
      machine:'Anthropic reported observing a model hold focus for more than 30 hours on a complex multi-step task; OpenAI reported more than 24 hours for its coding model.',
      human:'Both are observations reported by the companies that make the models, from internal evaluation. Neither is an independently published benchmark.',
      status:'primary', src:'anthropic-45' },
    { verdict:'overclaimed', date:'2025-07-10', title:'It made experienced developers 19% slower',
      what:'The best-controlled study of AI coding tools yet run, and the result nobody expected.',
      machine:'Sixteen experienced open-source developers, 246 real tasks in large repositories they already knew well, randomly assigned to allow or forbid AI tools.',
      human:'METR found they took 19% longer with the AI tools. They had forecast a 24% speed-up beforehand — and after finishing, still believed they had been 20% faster.',
      caveat:'METR is explicit that this does not necessarily generalise to less experienced developers, unfamiliar codebases, other kinds of work, or later models. But it is a randomised controlled trial, and the perception gap it documents — being slower while feeling faster — should make anyone cautious about self-reported productivity gains from any tool.',
      status:'primary', src:'metr-rct' },
    { verdict:'verified', date:'2023-09-15', title:'Help is not evenly distributed',
      what:'A pre-registered field experiment with 758 consultants at Boston Consulting Group.',
      machine:'On 18 tasks inside the model’s effective range, people using GPT-4 completed 12.2% more tasks, 25.1% faster, at higher quality.',
      human:'On one task deliberately placed outside that range, the people using AI were 19% less likely to reach the right answer.',
      caveat:'This is the study the phrase “jagged frontier” comes from. The same tool, in the same workflow, on the same afternoon, helps considerably and hurts measurably depending on which side of an invisible line the task falls — and the line is not marked.',
      status:'primary', src:'jagged' }
  ]
},
{
  id: 'other',
  name: 'Elsewhere',
  lede: 'A few more fields worth a mention: quantum computing, nuclear fusion and chip design — the last of which is still an unresolved dispute.',
  items: [
    { verdict:'verified', date:'2024-11-20', title:'Decoding quantum errors',
      what:'Quantum computers need constant error correction to work at all.',
      machine:'AlphaQubit, a transformer trained on simulated noise and tuned on real hardware data, achieved lower error rates than the best previous decoder on Google’s actual quantum chip.',
      human:'The work was published in Nature.',
      caveat:'It is still too slow for the real-time loop a superconducting quantum computer needs — roughly a microsecond per round. A proof of concept, not deployed.',
      status:'primary', src:'alphaqubit' },
    { verdict:'verified', date:'2022-02-16', title:'Holding a fusion plasma in shape',
      what:'Controlling the magnetic coils of a tokamak reactor.',
      machine:'A reinforcement-learning controller trained entirely in simulation, then transferred to the real TCV reactor with no further tuning, including configurations nobody had run before.',
      human:'The work was published in Nature by DeepMind and EPFL.',
      caveat:'One mid-scale research reactor, not a power station. The authors note the controllers are “not guaranteed to avoid plasma disruptions” in reality.',
      status:'primary', src:'fusion' },
    { verdict:'disputed', date:'2024-09-26', title:'Chip design, and an argument that has not ended',
      what:'Using reinforcement learning to lay out the physical blocks on a chip.',
      machine:'Google published in Nature that its system produced floorplans comparable to or better than human engineers in hours, and says it was used in several generations of its own TPU chips.',
      human:'A detailed methodological critique was published in Communications of the ACM alleging selective benchmarks and unfair baselines. Independent researchers at UC San Diego re-implemented the method and did not reproduce the advantage. A Google engineer who challenged the results internally was dismissed and sued. Nature added an editorial note, then removed it without explanation, then published an addendum.',
      caveat:'No chip-design vendor has adopted the approach, and no independent positive replication has appeared. This one is genuinely unresolved, and it belongs here precisely because it is not tidy.',
      status:'primary', src:'alphachip' }
  ]
}
];

/* Claims researched and deliberately excluded. Shown in the app, because a
   demo that only shows its wins is an advertisement. */
const CUT = [
  { claim:'A counterexample to the Jacobian conjecture (July 2026)',
    why:'It could be traced only to a hobbyist website — no paper, no coverage in the mathematical press, and an attribution that contradicted itself between sources. An extraordinary claim with no evidence behind it does not go on a chart.' },
  { claim:'Erdős Problem #793 solved by GPT-5.6',
    why:'This came from a post by a credible mathematician, but no corresponding paper exists anywhere. It is plausible but unsourceable, which is not the same as false — it simply is not shown here.' },
  { claim:'Perfect scores by several AI systems at the 2026 Mathematical Olympiad',
    why:'There was only one secondary source, and no corroboration in the places that would certainly have covered a result like this, so it was cut.' },
  { claim:'“Claude Fable 5 scores 95% on the bug-fixing test” and “Claude Opus 5 scores 64.7% on the hardest exam”',
    why:'Neither number appears on the benchmarks’ own leaderboards — the real leader on the hardest exam is Gemini 3.1 Pro at 46.44%. Aggregator sites that publish unsourced numbers tend to rank well in search results, which is how figures like these spread.' },
  { claim:'A 2026 point on the cost curve',
    why:'Epoch AI has not published one since March 2025, so the line stops where the data stops rather than being extended by guesswork.' },
  { claim:'A widely-cited critique that a robotic lab’s 41 “new” materials were already known',
    why:'It could not be located or verified during the build, despite being repeated in several places. It was replaced with two claims that could be verified: a peer-reviewed critique in Chemistry of Materials, and the fact that the original paper’s own abstract and main text disagree with each other.' },
  { claim:'Gemma 4, and MiniMax M3',
    why:'Both appeared in an early research pass, and neither model actually exists. They were removed from the timeline before it shipped.' }
];

/* --------------------------------------------------------------------------
   Sources.
   -------------------------------------------------------------------------- */

const SOURCES = {
  'anthropic-computer-use': { t:'Anthropic — Claude 3.5 Sonnet and computer use', u:'https://www.anthropic.com/news/3-5-models-and-computer-use' },
  'anthropic-37':  { t:'Anthropic — Claude 3.7 Sonnet', u:'https://www.anthropic.com/news/claude-3-7-sonnet' },
  'anthropic-4':   { t:'Anthropic — Claude 4', u:'https://www.anthropic.com/news/claude-4' },
  'anthropic-45':  { t:'Anthropic — Claude Sonnet 4.5', u:'https://www.anthropic.com/news/claude-sonnet-4-5' },
  'openai-gpt5':   { t:'OpenAI — Introducing GPT-5', u:'https://openai.com/index/introducing-gpt-5/' },
  'openai-o1':     { t:'OpenAI — Learning to reason with LLMs', u:'https://openai.com/index/learning-to-reason-with-llms/' },
  'gpt4v':         { t:'OpenAI — GPT-4V system card', u:'https://openai.com/index/gpt-4v-system-card/' },
  'gpqa-epoch':    { t:'Epoch AI — GPQA Diamond', u:'https://epoch.ai/benchmarks/gpqa-diamond' },
  'gpqa-paper':    { t:'GPQA: A Graduate-Level Google-Proof Q&A Benchmark', u:'https://arxiv.org/abs/2311.12022' },
  'aa-gpqa':       { t:'Artificial Analysis — GPQA Diamond', u:'https://artificialanalysis.ai/evaluations/gpqa-diamond' },
  'gemini3':       { t:'Google DeepMind — Gemini 3 Pro', u:'https://deepmind.google/models/gemini/pro/' },
  'metr-th11':     { t:'METR — Time Horizon 1.1', u:'https://metr.org/blog/2026-1-29-time-horizon-1-1/' },
  'metr-sol':      { t:'METR — GPT-5.6 Sol evaluation', u:'https://metr.org/blog/2026-06-26-gpt-5-6-sol/' },
  'metr-rct':      { t:'METR — Measuring the impact of early-2025 AI on experienced developer productivity', u:'https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/' },
  'mittr-metr':    { t:'MIT Technology Review — The most misunderstood graph in AI', u:'https://www.technologyreview.com/2026/02/05/1132254/this-is-the-most-misunderstood-graph-in-ai/' },
  'epoch-price':   { t:'Epoch AI — LLM inference price trends', u:'https://epoch.ai/data-insights/llm-inference-price-trends' },
  'epoch-eci':     { t:'Epoch AI — Open models lag closed models by four months', u:'https://epoch.ai/data-insights/open-closed-eci-gap' },
  'arc-o3':        { t:'ARC Prize — OpenAI o3 breakthrough', u:'https://arcprize.org/blog/oai-o3-pub-breakthrough' },
  'arc-agi2':      { t:'ARC Prize — Announcing ARC-AGI-2', u:'https://arcprize.org/blog/announcing-arc-agi-2-and-arc-prize-2025' },
  'arc-2025':      { t:'ARC Prize — 2025 results and analysis', u:'https://arcprize.org/blog/arc-prize-2025-results-analysis' },
  'arc-3':         { t:'ARC Prize — ARC-AGI-3 launch', u:'https://arcprize.org/blog/arc-agi-3-launch' },
  'arc-3-human':   { t:'ARC Prize — the ARC-AGI-3 human dataset', u:'https://arcprize.org/blog/arc-agi-3-human-dataset' },
  'arc-3-openai':  { t:'OpenAI — How two settings tripled our ARC-AGI-3 scores', u:'https://openai.com/index/how-two-settings-tripled-our-arc-agi-3-scores/' },
  'grok4':         { t:'xAI — Grok 4', u:'https://x.ai/news/grok-4' },
  'hle':           { t:'Scale AI — Humanity’s Last Exam leaderboard', u:'https://labs.scale.com/leaderboard/humanitys_last_exam' },
  'chatgpt':       { t:'OpenAI — Introducing ChatGPT', u:'https://openai.com/index/chatgpt/' },
  'bar-exam':      { t:'Martínez — Re-evaluating GPT-4’s bar exam performance (AI & Law)', u:'https://link.springer.com/article/10.1007/s10506-024-09396-9' },
  'funsearch':     { t:'FunSearch — Nature', u:'https://www.nature.com/articles/s41586-023-06924-6' },
  'gemini15':      { t:'Google — Gemini 1.5 Pro', u:'https://blog.google/technology/ai/google-gemini-next-generation-model-february-2024/' },
  'nolima':        { t:'NoLiMa — long-context evaluation beyond literal matching', u:'https://arxiv.org/abs/2502.05167' },
  'imo2024':       { t:'Google DeepMind — AI solves IMO problems at silver-medal level', u:'https://deepmind.google/discover/blog/ai-solves-imo-problems-at-silver-medal-level/' },
  'imo2025':       { t:'Google DeepMind — Gemini Deep Think achieves gold-medal standard at the IMO', u:'https://deepmind.google/discover/blog/advanced-version-of-gemini-with-deep-think-officially-achieves-gold-medal-standard-at-the-international-mathematical-olympiad/' },
  'nobel':         { t:'The Nobel Prize in Chemistry 2024', u:'https://www.nobelprize.org/prizes/chemistry/2024/popular-information/' },
  'alphafold3':    { t:'AlphaFold 3 — Nature 630:493', u:'https://www.nature.com/articles/s41586-024-07487-w' },
  'esm3':          { t:'Simulating 500 million years of evolution with a language model — Science', u:'https://www.science.org/doi/10.1126/science.ads0018' },
  'flywire':       { t:'FlyWire — whole-brain connectome of the fruit fly, Nature 634:124', u:'https://www.nature.com/articles/s41586-024-07558-y' },
  'rentosertib':   { t:'Rentosertib Phase 2a — Nature Medicine', u:'https://www.nature.com/articles/s41591-025-03743-2' },
  'mammo':         { t:'International evaluation of an AI system for breast cancer screening — Nature 577', u:'https://www.nature.com/articles/s41586-019-1799-6' },
  'mimic-cdm':     { t:'Clinical decision making on real records — Nature Medicine, July 2024', u:'https://www.nature.com/nm/' },
  'gencast':       { t:'GenCast — Nature, December 2024', u:'https://www.nature.com/articles/s41586-024-08252-9' },
  'gnome':         { t:'GNoME — Nature 624:80', u:'https://www.nature.com/articles/s41586-023-06735-9' },
  'mattergen-critique': { t:'MatterGen predicts compounds from the training dataset — Materials Horizons', u:'https://doi.org/10.1039/d6mh00268d' },
  'r1':            { t:'Epoch AI — What went into training DeepSeek-R1', u:'https://epoch.ai/gradient-updates/what-went-into-training-deepseek-r1' },
  'alphaevolve':   { t:'Google DeepMind — AlphaEvolve', u:'https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/' },
  'alphaevolve-tao': { t:'Tao, Georgiev, Gómez-Serrano, Wagner — Mathematical exploration and discovery at scale', u:'https://terrytao.wordpress.com/2025/11/05/mathematical-exploration-and-discovery-at-scale/' },
  'erdos1196':     { t:'Primitive sets and von Mangoldt chains: Erdős Problem #1196 (arXiv:2605.00301)', u:'https://arxiv.org/abs/2605.00301' },
  'erdos1196-tao': { t:'Terence Tao — Primitive sets and von Mangoldt chains', u:'https://terrytao.wordpress.com/2026/05/03/primitive-sets-and-von-mangoldt-chains-erdos-problem-1196-and-beyond/' },
  'unitdistance':  { t:'Gil Kalai — The unit distance problem was disproved, by AI', u:'https://gilkalai.wordpress.com/2026/05/21/amazing-erdos-unit-distance-problem-was-disproved-it-was-achieved-by-ai/' },
  'erdosgate':     { t:'TechCrunch — OpenAI’s embarrassing math', u:'https://techcrunch.com/2025/10/19/openais-embarrassing-math/' },
  'jagged':        { t:'Navigating the Jagged Technological Frontier — Harvard Business School / BCG', u:'https://www.hbs.edu/faculty/Pages/item.aspx?num=64700' },
  'alphaqubit':    { t:'AlphaQubit — Nature, November 2024', u:'https://www.nature.com/articles/s41586-024-08148-8' },
  'fusion':        { t:'Magnetic control of tokamak plasmas through deep reinforcement learning — Nature', u:'https://www.nature.com/articles/s41586-021-04301-9' },
  'alphachip':     { t:'Markov — The False Dawn: Reevaluating Google’s RL for chip macro placement (CACM)', u:'https://cacm.acm.org/research/the-false-dawn-reevaluating-googles-reinforcement-learning-for-chip-macro-placement/' },
  'kimi-k3':       { t:'Moonshot AI — Kimi K3', u:'https://www.kimi.com/blog/kimi-k3' },
  'gemma':         { t:'Gemma — open models from Google DeepMind', u:'https://en.wikipedia.org/wiki/Gemma_(language_model)' },
  'olmo':          { t:'Allen Institute for AI — OLMo 3', u:'https://allenai.org/blog/olmo3' },
  'cursor':        { t:'Cursor — Composer', u:'https://cursor.com/blog/composer' },
  'gpt-oss':       { t:'OpenAI — gpt-oss', u:'https://huggingface.co/openai/gpt-oss-120b' }
};

/* Closing facts for Act III's summary panel. */
const CLOSERS = {
  gapMonths: 4,
  gapNote: 'Epoch AI reported on 29 May 2026 that since the start of that year, the best openly downloadable models had trailed the closed frontier by an average of four months. That figure was published seven weeks before Kimi K3, which narrowed the gap again.',
  gapSrc: 'epoch-eci',
  doubling: 89,
  doublingNote: 'This is METR’s fit over the models released since 2024. Measured across the whole period back to 2019, the doubling time is 196 days.',
  doublingSrc: 'metr-th11'
};

return { INTRO, AXIS_END, ROUNDS, LABS, MODELS, UNLOCKS, DOMAINS, CUT, SOURCES, CLOSERS };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
