/* ==========================================================================
   Two Winters — the dataset.

   Every claim on screen comes from this file and every claim in this file
   carries a `src` that resolves to an entry in SOURCES. Nothing is here
   because it sounded right, and nothing is here because another demo in this
   repository already said it.

   `status` on any claim is one of:
     'primary'  — checked this build against the document itself: the paper,
                  the report's own text, the lab's own page, the official
                  results table.
     'reported' — a specific, retrievable secondary source that names its own
                  underlying scholarship. Used where the primary is a printed
                  book, a paywall, or a scanned page that could not be read.

   Nothing below 'reported' ships. What failed that bar is in CUT, at the
   bottom, because what a dataset refuses to include is part of its argument.

   Two standing cautions, both surfaced in the app rather than buried here:

     1. Winter date ranges are conventional, not crisp. Historians disagree,
        most sharply about when the second one ended. The bands are drawn
        soft-edged for that reason and the app says so out loud.

     2. There is no continuous, sourceable series of AI funding across
        seventy-six years. This demo therefore does not draw one. It shows
        four funding commitments it can actually source, in their original
        currencies, un-adjusted for inflation, and labels them as four points
        rather than a curve.
   ========================================================================== */

const DATA = (() => {

/* --------------------------------------------------------------------------
   The opening screen.
   -------------------------------------------------------------------------- */

const INTRO = {
  title: 'AI has boomed and collapsed twice before. Both times, the same five things happened in the same order.',
  body: [
    'You have just watched capability curves go almost straight up. The fair question from anyone who has been in a technical field for thirty years is: is this another bubble?',
    'That question has an evidence base. Artificial intelligence has had two funding collapses severe enough that the people inside them named the weather — the AI winters. The first ran roughly from the mid-1970s to about 1980. The second began in 1987. In both, the sequence was the same: a confident promise, real money committed against it, a hard technical limit nobody had measured, an authoritative voice that named the gap, and then the money leaving.',
    'This is not a demo about hype being bad. It is about a track record. Confident predictions that AI was nearly here have a poor record — and so do confident predictions that it would never work. You are about to be scored on both.'
  ],
  note: 'No AI is used anywhere in this app. It is a set of dated quotations, a timeline, and a link to the original source of each one. Everything runs from this single file with no network.',
  cta: 'Start — guess the year'
};

/* --------------------------------------------------------------------------
   ACT I — Guess the year.

   Ten real, sourced predictions, shown with the speaker and the date hidden.
   The viewer guesses the year on a slider and picks a verdict. Deliberately
   mixed: four confident over-promises that failed, three confident dismissals
   that failed, one that was right, one that was right about its own moment
   and wrong as a forecast, and one still open.

   `kind` is what the prediction claimed, not whether it was correct:
     'promise'  — AI is nearly here / this will work
     'dismiss'  — this will not work / is not worth funding
     'warning'  — trouble is coming

   `verdict` is what happened:
     'no'    — it did not come true
     'yes'   — it came true
     'late'  — it came true, far outside the stated window
     'open'  — genuinely unresolved as of this build
   -------------------------------------------------------------------------- */

const CARDS = [

{
  id: 'turing-1950',
  quote: 'I believe that in about fifty years’ time it will be possible to programme computers … to make them play the imitation game so well that an average interrogator will not have more than 70 per cent. chance of making the right identification after five minutes of questioning.',
  who: 'Alan Turing',
  role: 'mathematician, University of Manchester',
  where: '“Computing Machinery and Intelligence”, Mind LIX(236)',
  year: 1950,
  kind: 'promise',
  verdict: 'late',
  verdictLine: 'Later than fifty years, and still argued about.',
  what: 'Turing set a deadline of about 2000 and a specific bar: five minutes, and an interrogator no better than 70% at telling machine from human. Nothing convincingly cleared that bar by 2000. Whether it has been cleared since is a live argument, partly because the test as Turing stated it is narrower than the way people quote it.',
  status: 'primary', src: 'turing1950'
},

{
  id: 'nyt-1958',
  quote: 'The Navy revealed the embryo of an electronic computer today that it expects will be able to walk, talk, see, write, reproduce itself and be conscious of its existence.',
  who: 'The New York Times, reporting a US Navy press conference',
  role: 'on Frank Rosenblatt’s perceptron',
  where: '“New Navy Device Learns By Doing”, 8 July 1958',
  year: 1958,
  kind: 'promise',
  verdict: 'no',
  verdictLine: 'No. Not one of the six things on that list.',
  what: 'The machine being described had learned to tell a card marked on the left from one marked on the right, after fifty tries. The perceptron was a real and important idea — it is the direct ancestor of every neural network running today — and the press release around it was not. Both things are true, and the gap between them is the shape of the whole problem.',
  status: 'primary', src: 'cornell-perceptron'
},

{
  id: 'simon-newell-chess',
  quote: 'Within ten years a digital computer will be the world’s chess champion, unless the rules bar it from competition.',
  who: 'Herbert Simon and Allen Newell',
  role: 'Carnegie Institute of Technology; later a Nobel laureate and a Turing Award winner',
  where: 'lecture given 1957, published in Operations Research 6(1)',
  year: 1957,
  kind: 'promise',
  verdict: 'late',
  verdictLine: 'Right idea. Wrong by thirty years.',
  what: 'Deep Blue beat Garry Kasparov 3½–2½ in May 1997 — forty years after the lecture rather than ten, so thirty years past the deadline. This is the single most useful card in the deck: the prediction was not stupid, and it was not wrong about the destination. It was wrong about the distance, by a factor of four. That is the characteristic failure mode, and it is the one to hold in mind about any date you hear this year.',
  status: 'primary', src: 'simon-newell-1958'
},

{
  id: 'simon-1960',
  quote: 'Machines will be capable, within twenty years, of doing any work that a man can do.',
  who: 'Herbert Simon',
  role: 'Carnegie Institute of Technology',
  where: 'The New Science of Management Decision, p. 38',
  year: 1960,
  kind: 'promise',
  verdict: 'no',
  verdictLine: 'No. By 1980 the field was in its first winter.',
  what: 'Twenty years from 1960 lands in 1980, which is roughly the bottom of the first AI winter. This sentence is very widely quoted with the date 1965, from its reprint in The Shape of Automation; it was first published in 1960. If a demo is going to score you on dates, it had better get its own right.',
  status: 'primary', src: 'qi-simon'
},

{
  id: 'alpac-1966',
  quote: 'A US government committee reviews a decade of machine-translation funding and reports that there is no shortage of human translators, that machine output still has to be rewritten by a person, and that useful machine translation is not in near prospect.',
  who: 'The Automatic Language Processing Advisory Committee (ALPAC)',
  role: 'chaired by John R. Pierce, for the National Academy of Sciences',
  where: 'Language and Machines: Computers in Translation and Linguistics',
  year: 1966,
  kind: 'dismiss',
  verdict: 'no',
  verdictLine: 'Fair about 1966. Badly wrong as a forecast.',
  what: 'US federal support for machine translation fell away after this report, and the field lost most of a generation. Machine translation is now used billions of times a day. ALPAC is the cleanest example of the second failure mode: a committee that read its own moment accurately, and then let that reading stand in for the future.',
  note: 'Paraphrased, not quoted. The National Academies’ online copy is page images, so no wording from the report itself is quoted anywhere in this demo.',
  status: 'primary', src: 'alpac'
},

{
  id: 'minsky-1967',
  quote: 'Within a generation, I am convinced, few compartments of intellect will remain outside the machine’s realm — the problems of creating “artificial intelligence” will be substantially solved.',
  who: 'Marvin Minsky',
  role: 'co-founder of the MIT AI Laboratory',
  where: 'Computation: Finite and Infinite Machines, Prentice-Hall, p. 2',
  year: 1967,
  kind: 'promise',
  verdict: 'no',
  verdictLine: 'No — and a generation later the field was in its second winter.',
  what: 'Minsky wrote this in his own textbook, which is why it is used here rather than the more famous “three to eight years” line attributed to him by Life magazine in 1970. That article contains errors, and Minsky denied at least one quotation in it. A book he wrote himself is the stronger evidence, and it says something just as strong.',
  status: 'primary', src: 'qi-minsky'
},

{
  id: 'perceptrons-1969',
  quote: 'A book of mathematical proofs shows what a single-layer perceptron cannot compute. The field reads it as a verdict on neural networks in general, and moves on.',
  who: 'Marvin Minsky and Seymour Papert',
  role: 'MIT — and, more to the point, everyone who read them',
  where: 'Perceptrons: An Introduction to Computational Geometry, MIT Press',
  year: 1969,
  kind: 'dismiss',
  verdict: 'no',
  verdictLine: 'The proofs held. The conclusion the field drew from them did not.',
  what: 'Neural networks came back and now run essentially everything. But the tidy story — “this book killed neural networks for a decade” — is itself disputed, and the authors disputed it: they argued the work waned for its own reasons, not because of them. Both halves matter. A dismissal took hold, and the popular account of why is too neat.',
  note: 'Paraphrased. The claim shown is about how the book was received, which is exactly the part historians argue over.',
  status: 'reported', src: 'perceptrons-wiki'
},

{
  id: 'lighthill-1973',
  quote: 'In no part of the field have the discoveries made so far produced the major impact that was then promised.',
  who: 'Sir James Lighthill',
  role: 'Lucasian Professor of Applied Mathematics, Cambridge, writing for the UK Science Research Council',
  where: 'Artificial Intelligence: A General Survey — written July 1972, published 1973',
  year: 1973,
  kind: 'dismiss',
  verdict: 'no',
  verdictLine: 'True in 1973. Then read as permanent, which it was not.',
  what: 'Lighthill named a real obstacle — combinatorial explosion, the way search spaces blow up once a problem leaves the laboratory. UK government support for AI ended at most British universities. Jim Howe, who was in the Edinburgh department it hit, wrote that the report “provoked a massive loss of confidence in AI by the academic establishment in the UK” and that it “persisted for a decade”.',
  status: 'primary', src: 'lighthill'
},

{
  id: 'aaai-1984',
  quote: 'Two senior researchers tell a room full of the AI industry that enthusiasm has spiralled out of control, and that pessimism, then press pessimism, then a funding cut, then the end of serious work, will follow in that order.',
  who: 'Roger Schank and Marvin Minsky',
  role: 'both of whom had lived through the first winter',
  where: 'a public debate at the annual meeting of AAAI — where the phrase “AI winter” first appears',
  year: 1984,
  kind: 'warning',
  verdict: 'yes',
  verdictLine: 'Right. It arrived three years later.',
  what: 'This is the card that stops the demo from being a story about hype. The two people who called it were insiders, they described the mechanism rather than a mood, and they were correct about both the shape and roughly the timing. Confident predictions are not all worthless. Predictions about mechanism have done better than predictions about dates.',
  note: 'Paraphrased. The underlying account is Daniel Crevier’s 1993 history, AI: The Tumultuous Search for Artificial Intelligence.',
  status: 'reported', src: 'aiwinter-wiki'
},

{
  id: 'amodei-2024',
  quote: 'I think it could come as early as 2026, though there are also ways it could take much longer.',
  who: 'Dario Amodei',
  role: 'CEO, Anthropic — on the arrival of what he calls powerful AI',
  where: '“Machines of Loving Grace”',
  year: 2024,
  kind: 'promise',
  verdict: 'open',
  verdictLine: 'Open. The year named is the year you are standing in.',
  what: 'This one is left unscored on purpose. Note the hedge — “could”, and “ways it could take much longer” — which is more careful than Simon in 1960 or Minsky in 1967, and note also that the hedge is the first thing dropped when a sentence like this is repeated. Whatever you conclude, you are now judging it with a track record in hand instead of a feeling.',
  status: 'primary', src: 'mlg'
}

];

/* --------------------------------------------------------------------------
   ACT II — the timeline.

   Five lanes, one per stage of the mechanism. The point of the lanes is that
   the reader can watch the sequence fire in order, twice, without being told
   that it does.

   stage:
     'promise'    — a confident public claim
     'money'      — funding actually committed
     'limit'      — a hard technical obstacle becoming visible
     'naming'     — an authoritative voice naming the gap
     'withdrawal' — money leaving
   Landmark scientific results carry stage 'result' and sit above the lanes,
   because they are the ground truth the promises were measured against.
   -------------------------------------------------------------------------- */

const STAGES = [
  { id: 'promise',    label: 'A promise',        blurb: 'Someone with standing says the thing is close.' },
  { id: 'money',      label: 'Money against it',  blurb: 'A government or an industry commits real budget.' },
  { id: 'limit',      label: 'A hard limit',      blurb: 'An obstacle nobody had measured turns out to be load-bearing.' },
  { id: 'naming',     label: 'Someone names it',  blurb: 'A report, or a market, states the gap out loud.' },
  { id: 'withdrawal', label: 'The money leaves',  blurb: 'Funding stops. The field calls it a winter.' }
];

const EVENTS = [

/* ---- build-up to the first winter ---- */
{ d: '1950-10-01', p: 'y', stage: 'result', era: 1, label: 'Turing asks the question',
  text: 'Computing Machinery and Intelligence sets out the imitation game and a fifty-year deadline.',
  status: 'primary', src: 'turing1950' },

{ d: '1955-08-31', p: 'd', stage: 'promise', era: 1, label: 'The Dartmouth proposal',
  text: 'McCarthy, Minsky, Rochester and Shannon propose “a 2 month, 10 man study of artificial intelligence” for the summer of 1956, “on the basis of the conjecture that every aspect of learning or any other feature of intelligence can in principle be so precisely described that a machine can be made to simulate it.” The field gets its name here.',
  status: 'primary', src: 'dartmouth' },

{ d: '1957-01-01', p: 'y', stage: 'promise', era: 1, label: 'Ten years to a chess champion',
  text: 'Simon and Newell predict a computer world chess champion within ten years, a computer-discovered mathematical theorem within ten years, and computer music of accepted aesthetic value within ten years.',
  status: 'primary', src: 'simon-newell-1958' },

{ d: '1958-07-08', p: 'd', stage: 'promise', era: 1, label: 'The perceptron, in the press',
  text: 'A Navy press conference and a New York Times story promise a machine that will “walk, talk, see, write, reproduce itself and be conscious of its existence.” The demonstration was an IBM 704 learning left from right in fifty trials.',
  status: 'primary', src: 'cornell-perceptron' },

{ d: '1960-01-01', p: 'y', stage: 'promise', era: 1, label: 'Twenty years to any work a man can do',
  text: 'Simon, in The New Science of Management Decision. Reprinted in 1965, which is the date it is usually given.',
  status: 'primary', src: 'qi-simon' },

{ d: '1966-11-01', p: 'm', stage: 'naming', era: 1, label: 'The ALPAC report',
  text: 'A National Academy of Sciences committee reviews a decade of machine-translation funding and finds no translator shortage, no output usable without a human rewriting it, and no near prospect of useful machine translation.',
  status: 'primary', src: 'alpac' },

{ d: '1966-12-01', p: 'y', stage: 'withdrawal', era: 1, label: 'Machine translation funding falls away',
  text: 'US federal support for machine translation drops sharply after ALPAC. This is the first of the withdrawals and it happens eight years before the winter proper.',
  status: 'reported', src: 'aiwinter-wiki' },

{ d: '1967-01-01', p: 'y', stage: 'promise', era: 1, label: 'Substantially solved within a generation',
  text: 'Minsky, in his own textbook: “few compartments of intellect will remain outside the machine’s realm”.',
  status: 'primary', src: 'qi-minsky' },

{ d: '1969-01-01', p: 'y', stage: 'limit', era: 1, label: 'Perceptrons',
  text: 'Minsky and Papert prove what a single-layer perceptron cannot compute. The proofs are correct. The field generalises them into a verdict on neural networks as a whole — a step the authors later said was not theirs.',
  status: 'reported', src: 'perceptrons-wiki' },

{ d: '1972-07-01', p: 'm', stage: 'limit', era: 1, label: 'Combinatorial explosion, named',
  text: 'Lighthill identifies the obstacle: methods that work on toy problems blow up exponentially when the problem is real. This is the load-bearing technical fact of the first winter.',
  status: 'primary', src: 'lighthill' },

{ d: '1973-04-01', p: 'y', stage: 'naming', era: 1, label: 'The Lighthill report',
  text: '“In no part of the field have the discoveries made so far produced the major impact that was then promised.” Written July 1972 for the UK Science Research Council; published 1973.',
  status: 'primary', src: 'lighthill' },

{ d: '1974-01-01', p: 'y', stage: 'withdrawal', era: 1, label: 'UK support ends at most universities',
  text: 'Jim Howe, from inside the Edinburgh department: the report “provoked a massive loss of confidence in AI by the academic establishment in the UK (and to a lesser extent in the US). It persisted for a decade — the so-called ‘AI Winter’.”',
  status: 'primary', src: 'howe' },

/* ---- the thaw and the second build-up ---- */
{ d: '1980-01-01', p: 'y', stage: 'result', era: 2, label: 'R1/XCON goes into production',
  text: 'A rule-based expert system starts configuring VAX orders at Digital Equipment Corporation. Expert systems work — narrowly, expensively, and only where a human expert has written the rules down. That success is what ends the first winter and starts the second cycle.',
  status: 'primary', src: 'r1' },

{ d: '1982-04-01', p: 'y', stage: 'money', era: 2, label: 'Japan’s Fifth Generation project',
  text: 'MITI launches a ten-year national programme and creates ICOT to run it, aiming at massively parallel machines built on logic programming. Budget: under ¥57 billion, about US$320 million.',
  money: { amount: 57, unit: '¥bn', note: 'under ¥57bn over ten years (≈US$320m)' },
  status: 'reported', src: 'fgcs-wiki' },

{ d: '1983-01-01', p: 'y', stage: 'money', era: 2, label: 'DARPA’s Strategic Computing Initiative',
  text: 'The US answer: about $1 billion, aimed at machines that would “see, hear, speak, and think like a human”.',
  money: { amount: 1000, unit: '$m', note: '≈$1bn over the programme' },
  status: 'reported', src: 'sci-wiki' },

{ d: '1983-06-01', p: 'y', stage: 'money', era: 2, label: 'The UK’s Alvey Programme',
  text: 'Britain’s answer to the Fifth Generation: £350 million over five years — £200m from government and £150m from industry — across VLSI, software engineering, knowledge-based systems and human–computer interaction.',
  money: { amount: 350, unit: '£m', note: '£350m over five years (£200m government + £150m industry)' },
  status: 'primary', src: 'alvey' },

{ d: '1984-08-01', p: 'y', stage: 'naming', era: 2, label: 'The phrase “AI winter” is coined',
  text: 'Schank and Minsky, in a public debate at the AAAI annual meeting, warn that enthusiasm has spiralled out of control and describe the chain reaction that will follow. They are right, three years early.',
  status: 'reported', src: 'aiwinter-wiki' },

{ d: '1986-01-01', p: 'y', stage: 'limit', era: 2, label: 'The limit: rules do not scale',
  text: 'Expert systems only know what somebody typed in. They are brittle at the edges of their rule base, expensive to keep current, and they do not learn. Meanwhile general-purpose workstations are getting fast enough to run the same software without special hardware.',
  status: 'reported', src: 'aiwinter-wiki' },

{ d: '1987-01-01', p: 'y', stage: 'naming', era: 2, label: 'The market names it instead of a report',
  text: 'There is no Lighthill for the second winter. The naming is done by the collapse of the specialised LISP hardware business — an industry that Crevier’s history describes as worth half a billion dollars being replaced within a single year.',
  status: 'reported', src: 'aiwinter-wiki' },

{ d: '1987-06-01', p: 'y', stage: 'withdrawal', era: 2, label: 'DARPA cuts AI',
  text: 'Jack Schwarz takes over DARPA’s Information Processing Techniques Office and, in Pamela McCorduck’s account, cuts AI funding “deeply and brutally” — he did not believe it was the next wave.',
  status: 'reported', src: 'sci-wiki' },

{ d: '1992-06-01', p: 'y', stage: 'withdrawal', era: 2, label: 'The Fifth Generation project runs out',
  text: 'The ten-year plan reaches its end with no commercial success; its parallel logic machines are overtaken by ordinary Sun and Intel hardware. Accounts differ on the exact finish — the ten-year programme ends in 1992 and the same source elsewhere runs it to 1994 — so read this dot as “about here”. The concurrent logic programming work outlives the programme; the programme does not.',
  status: 'reported', src: 'fgcs-wiki' },

/* ---- what happened afterwards ---- */
{ d: '1997-05-01', p: 'm', stage: 'result', era: 3, label: 'Deep Blue beats Kasparov',
  text: 'Deep Blue wins the New York rematch 3½–2½. Simon and Newell’s ten-year prediction lands, forty years late.',
  status: 'primary', src: 'deepblue' },

{ d: '2012-10-01', p: 'y', stage: 'result', era: 3, label: 'AlexNet wins ImageNet',
  text: 'A deep convolutional network takes the ILSVRC-2012 classification task with a 15.3% top-5 error rate. The best entry from any other team is 26.2%. The approach buried in 1969 is now the state of the art.',
  status: 'primary', src: 'ilsvrc2012' },

{ d: '2016-03-01', p: 'm', stage: 'result', era: 3, label: 'AlphaGo beats Lee Sedol',
  text: 'Four games to one, in Seoul, five months after beating Fan Hui 5–0.',
  status: 'primary', src: 'alphago' },

{ d: '2017-06-12', p: 'd', stage: 'result', era: 3, label: 'Attention Is All You Need',
  text: 'The transformer. Every large language model in use today is a descendant of this paper.',
  status: 'primary', src: 'attention' },

{ d: '2020-01-23', p: 'd', stage: 'result', era: 3, label: 'Scaling laws',
  text: 'Kaplan and colleagues report that loss falls as a power law in model size, data and compute, “with some trends spanning more than seven orders of magnitude”. This is the single biggest structural difference from either previous boom: a measured, extrapolable relationship rather than a promise.',
  status: 'primary', src: 'kaplan' },

{ d: '2020-05-28', p: 'd', stage: 'result', era: 3, label: 'GPT-3',
  text: '175 billion parameters, and few-shot behaviour nobody put in by hand.',
  status: 'primary', src: 'gpt3' },

{ d: '2022-11-30', p: 'd', stage: 'result', era: 3, label: 'ChatGPT',
  text: 'Released as a research preview. This is where the room’s own experience of AI starts.',
  status: 'reported', src: 'chatgpt-tc' },

{ d: '2026-02-01', p: 'm', stage: 'limit', era: 3, label: 'A benchmark stops measuring',
  text: 'OpenAI publishes that it will no longer report SWE-bench Verified: frontier models had been exposed to the benchmark during training, and when it audited the problems its models still failed, most of those problems turned out to have broken tests. The scores kept going up. What they measured stopped being capability.',
  status: 'reported', src: 'swebench' },

{ d: '2026-02-27', p: 'd', stage: 'money', era: 3, label: '900 million users, $110 billion raised',
  text: 'OpenAI reports 900 million weekly users and more than 50 million paying subscribers, alongside a $110 billion private round at a $730 billion pre-money valuation. Both halves are the point: usage at a scale neither previous boom had, and capital commitment at a scale neither previous boom came close to.',
  money: { amount: 110000, unit: '$m', note: '$110bn private round at a $730bn pre-money valuation' },
  status: 'reported', src: 'openai-900m' }

];

/* Winter bands. Deliberately carrying their own uncertainty. */
const WINTERS = [
  { id: 'w1', from: '1974-01-01', to: '1980-06-30', soft: 1.5,
    label: 'First winter', range: 'roughly 1974 – 1980',
    note: 'Conventional dates. The withdrawal that started it (machine translation, 1966) predates the band by eight years, and nobody agrees on a month.' },
  { id: 'w2', from: '1987-01-01', to: '1993-12-31', soft: 3.5,
    label: 'Second winter', range: 'roughly 1987 – 1993',
    note: 'The start is firm — the hardware market went in 1987. The end is not: this demo draws 1993, and Wikipedia’s account runs it to 2000. The right-hand edge is drawn soft because the disagreement is real.' }
];

/* --------------------------------------------------------------------------
   ACT III — the anatomy.

   The same five stages, three columns. Column three is the present, and it
   is deliberately incomplete: two of the five cells are empty, and saying
   so is the honest position.
   -------------------------------------------------------------------------- */

const ANATOMY = [
  { stage: 'promise',
    w1: { head: 'Human-level work in twenty years',
          body: 'Simon in 1960, Minsky in 1967, and a Navy press conference in 1958 promising a machine conscious of its own existence.',
          src: ['qi-simon', 'qi-minsky', 'cornell-perceptron'] },
    w2: { head: 'A fifth generation of computers',
          body: 'Japan announces machines built on logic programming that will reason at supercomputer speed. Britain and the US answer within a year.',
          src: ['fgcs-wiki'] },
    now: { head: '“Could come as early as 2026”',
          body: 'The hedges are real and are usually dropped in the retelling. The claims are also being made by people who have shipped the previous four things they promised.',
          src: ['mlg'] } },

  { stage: 'money',
    w1: { head: 'US federal funding, largely uncounted',
          body: 'No sourceable total exists for 1950s–60s US AI spending, so this demo does not invent one. What is sourceable is what happened when it stopped.',
          src: [] },
    w2: { head: '£350m + ~$1bn + ¥57bn',
          body: 'Alvey, DARPA’s Strategic Computing Initiative and Japan’s Fifth Generation, committed within about eighteen months of each other. Three governments, one bet.',
          src: ['alvey', 'sci-wiki', 'fgcs-wiki'] },
    now: { head: '$110bn in a single round',
          body: 'OpenAI’s February 2026 raise, at a $730bn pre-money valuation — two orders of magnitude past the three national programmes of the 1980s combined, and private rather than governmental.',
          src: ['openai-900m'] } },

  { stage: 'limit',
    w1: { head: 'Combinatorial explosion',
          body: 'Search-based methods that solved toy problems blew up exponentially on real ones. Lighthill named it in 1972 and nobody had a good answer.',
          src: ['lighthill'] },
    w2: { head: 'Rules do not scale',
          body: 'Expert systems knew only what was typed into them, broke at the edge of their rule base, cost a fortune to maintain, and did not learn.',
          src: ['aiwinter-wiki'] },
    now: { head: 'Not yet identified',
          pending: 'nobody knows what it is yet',
          body: 'This cell is empty, and that is the honest answer. In both previous cycles the binding limit was obvious afterwards and invisible at the time to the people doing the work. The nearest visible candidate is that measurement is falling behind capability claims — see the next row.',
          src: [] } },

  { stage: 'naming',
    w1: { head: 'Two reports, seven years apart',
          body: 'ALPAC in 1966 for machine translation; Lighthill in 1973 for the field. Both were commissioned by the funders, and both were read as more final than they were.',
          src: ['alpac', 'lighthill'] },
    w2: { head: 'The market, not a report',
          body: 'There is no Lighthill for the second winter. Schank and Minsky called it in 1984; the LISP hardware business made it official in 1987.',
          src: ['aiwinter-wiki'] },
    now: { head: 'Nobody authoritative has',
          body: 'The nearest thing is a benchmark maintainer retiring its own benchmark: in February 2026 OpenAI stopped reporting SWE-bench Verified because contamination and broken tests had made the scores stop meaning anything. That is a measurement problem being named, not the field being named.',
          src: ['swebench'] } },

  { stage: 'withdrawal',
    w1: { head: 'MT funding 1966; UK universities 1974',
          body: 'Support ended at most British universities. The loss of confidence, in Jim Howe’s account, persisted for a decade.',
          src: ['howe'] },
    w2: { head: 'DARPA 1987; Fifth Generation 1992',
          body: 'Schwarz cut AI at DARPA “deeply and brutally”. Japan’s programme ran its full ten years and ended without a commercial product.',
          src: ['sci-wiki', 'fgcs-wiki'] },
    now: { head: 'Has not happened',
          pending: 'this stage has not occurred',
          body: 'Money is still going in, at increasing scale, and usage is still going up. If the pattern holds, this is the cell to watch — and it is the last one to move, not the first. Nothing on this page is evidence that it will move at all.',
          src: ['openai-900m'] } }
];

/* --------------------------------------------------------------------------
   ACT IV — rhymes and differences. Two honest columns.
   -------------------------------------------------------------------------- */

const RHYMES = [
  { head: 'Benchmark claims are outrunning evaluation',
    body: 'In February 2026 OpenAI stopped reporting SWE-bench Verified — the coding benchmark it had itself released — saying frontier models had been exposed to it during training, and that when it audited the hard problems its models still failed, most of those problems had broken tests. Scores were still rising. What they measured had stopped being capability. Both previous winters began with a gap between the claim and the measurement.',
    src: 'swebench' },
  { head: 'Very large money committed against a promise',
    body: '$110 billion in one round at a $730 billion pre-money valuation, February 2026. In 1982–83 three governments committed roughly £350m, $1bn and ¥57bn within eighteen months of each other, and the second winter followed. Scale is not by itself evidence of a bubble — but money moving ahead of demonstrated returns is exactly the second stage of the pattern.',
    src: 'openai-900m' },
  { head: 'Confident dates from people with real standing',
    body: 'Simon had a Nobel Prize coming and Minsky had founded the MIT AI Lab. Standing has never been much protection: their public timelines missed by decades. The current timelines come from people who have actually shipped, which is a real difference — and it was also true of Simon, who had shipped the Logic Theorist.',
    src: 'qi-simon' },
  { head: 'The limit is invisible from inside',
    body: 'Combinatorial explosion and the brittleness of rule bases are obvious in hindsight and were not obvious at the time to the people doing the work. There is no reason to think we are better placed now. Anyone who tells you they know what today’s binding constraint is, is making the same category of claim that failed twice.',
    src: 'lighthill' }
];

const DIFFERENT = [
  { head: 'Hundreds of millions of people actually use it',
    body: '900 million weekly users and more than 50 million paying subscribers, reported February 2026, for one product. Neither previous boom had users; it had customers for specialist hardware and government programme deliverables. A withdrawal of research funding does not remove a product people are already paying for.',
    src: 'openai-900m' },
  { head: 'The scaling behaviour is measured, not asserted',
    body: 'Kaplan and colleagues showed in 2020 that loss falls as a power law in model size, data and compute, “with some trends spanning more than seven orders of magnitude”. Neither previous boom had anything like this: a quantitative relationship that has kept holding as inputs grew by factors of millions. It is not a guarantee that it continues. It is a different kind of evidence from a prediction.',
    src: 'kaplan' },
  { head: 'The systems are general, not hand-built',
    body: 'The 1980s bet on rule bases a human expert had to write out by hand — which is why they were brittle and why they did not transfer. Today’s systems are trained rather than authored, and the same model that writes code also reads radiographs badly and drafts a memo well. Generality is the specific thing the second winter’s technology lacked.',
    src: 'attention' },
  { head: 'The idea that was buried came back and won',
    body: 'Neural networks were written off after 1969 and were the losing side for two decades. In 2012 the same family of methods won ImageNet outright — 15.3% top-5 error against 26.2% for the best of everyone else. This cuts both ways: it is the strongest evidence that dismissals age badly, and a reminder that the gap between “dead end” and “state of the art” was forty-three years.',
    src: 'ilsvrc2012' }
];

const CLOSER = {
  head: 'What to do with this',
  body: [
    'The pattern is not a prediction. It is a checklist. When you hear a claim about AI this year, you can ask which of the five stages it belongs to, and what evidence would move it.',
    'The historical record says two specific things. Confident dates have been wrong by factors of three and four, in the direction of too soon. And confident dismissals have been wrong by decades, in the direction of too final. Those are not the same error and you cannot avoid both by picking a side.',
    'The most reliable predictions in this deck were about mechanism, not timing: Schank and Minsky in 1984 described how a collapse would work, and it worked that way three years later. That is the kind of claim worth making, and the kind worth listening for.'
  ]
};

/* --------------------------------------------------------------------------
   Researched and deliberately excluded. Shown in the app.
   -------------------------------------------------------------------------- */

const CUT = [
  { claim: 'A dollar figure for XCON’s annual savings at Digital',
    why: 'The commonly repeated figures are $25 million and $40 million a year and the sources disagree. Digital’s own account is in Communications of the ACM in 1989, behind a paywall this build could not read. The system’s existence and production use are shown; the number is not.' },
  { claim: 'Any verbatim quotation from the ALPAC report',
    why: 'The National Academies’ online copy of Language and Machines is page images, not text, and an exact-phrase search for the most widely quoted sentence returned no page carrying it. The report is described, and nothing is put in quotation marks.' },
  { claim: '“Half a billion dollars of AI hardware industry vanished in a year”, as a figure',
    why: 'It traces to Daniel Crevier’s 1993 history through tertiary sources and no primary was found. It is shown once, attributed to Crevier by name, and never used as a number on a chart.' },
  { claim: 'Hubert Dreyfus predicting no computer could beat a child at chess, then losing to Mac Hack VI in 1967',
    why: 'A famous story and probably true, but the 1965 wording could not be retrieved and the chess-match detail traces to one book through tertiary sources. It would have been the neatest card in the deck, which is a reason to be more suspicious of it, not less.' },
  { claim: 'Minsky’s “three to eight years” prediction from Life magazine, 1970',
    why: 'The article contains errors and Minsky denied at least one quotation attributed to him in it. His 1967 textbook says something equally strong and he wrote it himself, so that is used instead.' },
  { claim: 'A continuous series of AI funding from 1950 to 2026',
    why: 'It does not exist in any sourceable form, particularly for US spending before 1980. Four discrete commitments are shown instead, in their original currencies and un-adjusted for inflation, and the app says that is what they are.' },
  { claim: 'A dollar figure for DARPA’s Speech Understanding Research programme',
    why: 'The programme ran 1971–1976 and did not meet its goals, which is well attested; the funding number repeated alongside it was not verifiable, so the event is left off the timeline entirely rather than shown with a soft number.' }
];

/* --------------------------------------------------------------------------
   Sources. Every `src` in this file resolves here; the self-test enforces it
   in both directions.
   -------------------------------------------------------------------------- */

const SOURCES = {
  'turing1950':         { t: 'Turing — Computing Machinery and Intelligence, Mind LIX(236):433–460 (1950)', u: 'https://doi.org/10.1093/mind/LIX.236.433' },
  'dartmouth':          { t: 'McCarthy, Minsky, Rochester & Shannon — A Proposal for the Dartmouth Summer Research Project on Artificial Intelligence (31 August 1955)', u: 'http://www-formal.stanford.edu/jmc/history/dartmouth/dartmouth.html' },
  'simon-newell-1958':  { t: 'Simon & Newell — Heuristic Problem Solving: The Next Advance in Operations Research, Operations Research 6(1):1–10', u: 'https://pubsonline.informs.org/doi/10.1287/opre.6.1.1' },
  'cornell-perceptron': { t: 'Cornell Chronicle — Professor’s perceptron paved the way for AI, 60 years too soon (quoting the New York Times, 8 July 1958)', u: 'https://news.cornell.edu/stories/2019/09/professors-perceptron-paved-way-ai-60-years-too-soon' },
  'qi-simon':           { t: 'Quote Investigator — “Machines will be capable, within twenty years, of doing any work that a man can do” (verified against scans; The New Science of Management Decision, 1960, p. 38)', u: 'https://quoteinvestigator.com/2020/11/11/ai-can-do/' },
  'qi-minsky':          { t: 'Quote Investigator — “Within a generation … the problems of creating artificial intelligence will be substantially solved” (verified against scans; Computation: Finite and Infinite Machines, 1967, p. 2)', u: 'https://quoteinvestigator.com/2021/03/04/ai-solved/' },
  'alpac':              { t: 'ALPAC — Language and Machines: Computers in Translation and Linguistics, National Academy of Sciences (1966)', u: 'https://doi.org/10.17226/9547' },
  'perceptrons-wiki':   { t: 'Perceptrons (Minsky & Papert, MIT Press 1969; expanded edition 1988) — including the dispute over its effect on the field', u: 'https://en.wikipedia.org/wiki/Perceptrons_(book)' },
  'lighthill':          { t: 'Lighthill — Artificial Intelligence: A General Survey (July 1972, published 1973), full text', u: 'http://www.chilton-computing.org.uk/inf/literature/reports/lighthill_report/p001.htm' },
  'howe':               { t: 'Jim Howe — Artificial Intelligence at Edinburgh University: a Perspective', u: 'https://www.inf.ed.ac.uk/about/AIhistory.html' },
  'r1':                 { t: 'McDermott — R1: An Expert in the Computer Systems Domain, AAAI-80', u: 'https://cdn.aaai.org/AAAI/1980/AAAI80-076.pdf' },
  'fgcs-wiki':          { t: 'Fifth Generation Computer Systems — budget figure sourced to Odagiri, Nakamura & Shibuya, Research Policy 26(2):191–207 (1997)', u: 'https://en.wikipedia.org/wiki/Fifth_Generation_Computer_Systems' },
  'sci-wiki':           { t: 'DARPA Strategic Computing Initiative — the 1987 cuts sourced to McCorduck, Machines Who Think (2004), pp. 430–431', u: 'https://en.wikipedia.org/wiki/Strategic_Computing_Initiative' },
  'alvey':              { t: 'Chilton Computing archive — The Alvey Programme (£350m: £200m government, £150m industry)', u: 'http://www.chilton-computing.org.uk/inf/alvey/p007.htm' },
  'aiwinter-wiki':      { t: 'AI winter — the 1984 AAAI debate and the 1987 hardware collapse, sourced to Crevier, AI: The Tumultuous Search for Artificial Intelligence (1993)', u: 'https://en.wikipedia.org/wiki/AI_winter' },
  'deepblue':           { t: 'IBM — Deep Blue', u: 'https://www.ibm.com/history/deep-blue' },
  'ilsvrc2012':         { t: 'ImageNet — ILSVRC-2012 official results table', u: 'https://www.image-net.org/challenges/LSVRC/2012/results.html' },
  'alphago':            { t: 'Google DeepMind — AlphaGo', u: 'https://deepmind.google/research/alphago/' },
  'attention':          { t: 'Vaswani et al. — Attention Is All You Need (arXiv:1706.03762)', u: 'https://arxiv.org/abs/1706.03762' },
  'kaplan':             { t: 'Kaplan et al. — Scaling Laws for Neural Language Models (arXiv:2001.08361)', u: 'https://arxiv.org/abs/2001.08361' },
  'gpt3':               { t: 'Brown et al. — Language Models are Few-Shot Learners (arXiv:2005.14165)', u: 'https://arxiv.org/abs/2005.14165' },
  'chatgpt-tc':         { t: 'TechCrunch — ChatGPT launched three years ago today (30 November 2025)', u: 'https://techcrunch.com/2025/11/30/chatgpt-launched-three-years-ago-today/' },
  'swebench':           { t: 'OpenAI — Why SWE-bench Verified no longer measures frontier coding capabilities (February 2026)', u: 'https://openai.com/index/why-we-no-longer-evaluate-swe-bench-verified/' },
  'openai-900m':        { t: 'TechCrunch — ChatGPT reaches 900M weekly active users (27 February 2026)', u: 'https://techcrunch.com/2026/02/27/chatgpt-reaches-900m-weekly-active-users' },
  'mlg':                { t: 'Dario Amodei — Machines of Loving Grace (October 2024)', u: 'https://www.darioamodei.com/essay/machines-of-loving-grace' }
};

/* A note the app shows next to the source list, because two of these need it. */
const SOURCE_NOTE = 'Two sources here are openai.com pages, which refuse automated retrieval. Their titles and substance were confirmed against contemporaneous reporting during the build; they open normally in a browser. Where a claim rests on a printed history rather than a document — Crevier 1993, McCorduck 2004 — the historian is named on the claim itself and the claim is marked “reported” rather than “primary”.';

return { INTRO, CARDS, STAGES, EVENTS, WINTERS, ANATOMY, RHYMES, DIFFERENT, CLOSER, CUT, SOURCES, SOURCE_NOTE };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
