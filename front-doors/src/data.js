/* ==========================================================================
   Front Doors — the dataset.

   Every sentence on screen comes from this file, and every product claim in
   this file carries a `conf` label and, where the label is `verified`, one or
   more `src` ids that resolve to a real page in SOURCES.

   `conf` is one of:

     'verified'    — a page belonging to the company that makes the product
                     was loaded during the build, on the CHECKED_ON date
                     below, and says this. The wording on the page is usually
                     quoted in `quote`.
     'reasoned'    — follows from facts that ARE verified, but no page states
                     it in these words. Every ordering judgement on this page
                     is reasoned, and says so.
     'unconfirmed' — we looked and could not confirm it. These ship, visibly
                     labelled, because a blank cell is a claim too. What we
                     could not confirm at all is in CUT.

   Two standing rules this file obeys.

     1. NO PRICES. Not one dollar figure reaches the screen. Prices on all
        four of these surfaces changed more than once in the last year and a
        wrong number in front of faculty is worse than no number. The screen
        says only what KIND of thing it is: free tier / paid personal plan /
        institutional licence. Figures that a source did state are in
        README.md with the date they were read.

     2. NO RANKING. No vendor is recommended and no door is called better.
        The `check` row exists precisely because going inward is not an
        upgrade.
   ========================================================================== */

const DATA = (() => {

/* --------------------------------------------------------------------------
   When this was checked. The single most important number on the page.
   -------------------------------------------------------------------------- */

const CHECKED_ON = '8 September 2026';
const CHECKED_ISO = '2026-09-08';

const INTRO = {
  title: 'Every one of these is the same model. What changes is how far it can reach.',
  body: [
    'Most people meet AI through a chat box in a browser tab, and reasonably conclude that a chat box is what AI is. It is one door out of four, and it is the one that can reach the least.',
    'The four doors below are not four levels of intelligence. Much of the time they are literally the same model behind the glass. What differs is what the thing can see, what it is allowed to do, whether it keeps working when you close the laptop — and, the part nobody puts on a slide, how much of its work you now have to check.'
  ],
  note: 'Product names on this page were checked on ' + CHECKED_ON + '. They will go stale. The four doors will not — see “What already changed” in Act III for two names that moved in the last six months, including one that was retired outright while this module was being written.'
};

/* --------------------------------------------------------------------------
   The four axes. Every verdict on the page traces to one of these.

   `bars` names the four rungs of that axis so a bar of length 2 means
   something stated rather than something felt. The names are descriptions of
   the four doors, which is circular if you pretend otherwise — so the page
   says it out loud in AXIS_NOTE.
   -------------------------------------------------------------------------- */

const AXES = [
  { id: 'see', n: 1, q: 'Can it see your work?', short: 'Sees',
    lead: 'What the thing has access to before you start typing.',
    bars: [
      'Only what you put into the conversation, plus apps you connect to it',
      'The one document or workbook you have open, plus what you attach',
      'Folders you point it at, and the apps and browser you connect',
      'A whole project tree, plus anything a command on your machine can read'
    ] },
  { id: 'do', n: 2, q: 'Can it do things?', short: 'Does',
    lead: 'What it is able to change, as opposed to describe.',
    bars: [
      'Writes back into the conversation; you carry the result somewhere',
      'Edits the open document in place, using that app’s own features',
      'Produces finished deliverables, and operates apps and a browser for you',
      'Runs commands on your machine and changes files across a project'
    ] },
  { id: 'keep', n: 3, q: 'Does it keep going when you are not watching?', short: 'Keeps going',
    lead: 'Whether the work stops when your attention does.',
    bars: [
      'One turn. It answers and stops.',
      'A multi-step request, but only while you are sitting there',
      'Keeps working with the laptop shut; runs on a schedule or a trigger',
      'Long autonomous loops, several agents at once, scheduled or event-driven'
    ] },
  { id: 'check', n: 4, q: 'How much must you check?', short: 'You check',
    lead: 'The cost nobody quotes. Read this row on its own — it is the only row that is not a staircase.',
    bars: [
      'Read the answer. If it is wrong you have lost a minute.',
      'Accept or reject a proposed edit, inside a document that has undo and version history',
      'Read a diff you can follow, and take on faith the commands you did not watch run',
      'Judge a finished deliverable that was assembled while you were away, with no diff to read'
    ] }
];

const AXIS_NOTE = 'The bars are a reading of the four rows, not a measurement of anything. Rows 1 to 3 rise neatly because the four doors were CHOSEN as a ladder of reach — a tidy staircase there is an artefact of the selection, not a discovery. Row 4 is the one worth your attention, because it does not follow.';

/* --------------------------------------------------------------------------
   The four doors.
   -------------------------------------------------------------------------- */

const DOORS = [
  {
    id: 'chat', n: 1, name: 'A chat window',
    tag: 'The one everybody means by “using AI”',
    products: 'ChatGPT (Chat) · Claude · the Gemini app',
    where: 'A browser tab, or the phone app.',
    whereSrc: ['gemini-app', 'claude-pricing'],
    cost: 'free',
    costText: 'All three have a free tier; paid personal plans raise the limits.',
    costSrc: ['openai-plus', 'claude-pricing', 'gemini-app'],
    blurb: 'You describe something and it answers. It has no idea what is on your desktop unless you show it.'
  },
  {
    id: 'inapp', n: 2, name: 'Inside the tools you already have',
    tag: 'The door you are most likely to meet first',
    products: 'Word · Excel · PowerPoint (Microsoft) · Docs · Sheets (Google)',
    where: 'A pane inside the app, acting on the file that is already open.',
    whereSrc: ['ms-word-edit', 'gdocs-gemini'],
    confusable: 'Microsoft ships two different things with almost the same name, and it is worth five seconds to tell them apart. The one described here lives inside Word or Excel and edits the document you have open. Separately, there are Word, Excel and PowerPoint “Agents” inside the Copilot app, which generate a NEW file from a description and save it to your OneDrive. Same words, different door — the second is closer to door 1 with a file attached.',
    confusableSrc: ['ms-wxp-agents'],
    cost: 'institutional',
    costText: 'Needs a licence your institution buys or enables — this is the door your IT department controls, not you.',
    costSrc: ['ms-word-edit', 'gdocs-gemini'],
    blurb: 'It edits the thing in front of you, in place, using that application’s own styles and features — and it shows you the edit before it lands.'
  },
  {
    id: 'coworker', n: 3, name: 'A desktop coworker',
    tag: 'You assign an outcome, not a sentence',
    products: 'Claude Cowork (Anthropic) · ChatGPT Work (OpenAI)',
    where: 'Its own app on your computer, plus the web and the phone.',
    whereSrc: ['cowork', 'openai-work-codex'],
    confusable: 'Anthropic’s runs on the web, on desktop — macOS, Windows including arm64, ChromeOS and Linux — and on mobile in beta. OpenAI’s runs on the web and mobile in the cloud, and in the desktop app, where it is the only version that can open a folder on your computer. Which surface you use decides what it can see, which is the whole thesis of this page appearing inside a single product.',
    confusableSrc: ['cowork', 'openai-work-codex'],
    cost: 'paid',
    costText: 'Needs a paid plan. Anthropic’s page says so in as many words; OpenAI’s says eligible paid plans, and on an institutional workspace an administrator decides.',
    costSrc: ['cowork', 'openai-work-codex'],
    blurb: 'You hand it a goal and go away. It works across folders you point it at and apps you connect, and hands back something finished.'
  },
  {
    id: 'coding', n: 4, name: 'A coding agent',
    tag: 'The whole machine, and a very long leash',
    products: 'Codex (OpenAI) · Claude Code (Anthropic) · Antigravity (Google)',
    where: 'A terminal, an IDE, a desktop app, and in two of the three the cloud.',
    whereSrc: ['openai-codex-cli', 'claude-code', 'antigravity'],
    confusable: 'All three arrive as several surfaces rather than as one program. OpenAI’s Codex is a terminal command, an IDE extension and a view inside the ChatGPT desktop app — and notably it is NOT selectable on the web or on a phone, which is the reverse of every other door here. Anthropic’s spans a terminal command, a desktop app, the web, and VS Code and JetBrains extensions. Google’s is an app, a CLI, an SDK, IDE extensions and a remote-control mode. “Which one is it” has no single answer, and that is normal at this door.',
    confusableSrc: ['openai-work-codex', 'openai-codex-cli', 'claude-code', 'antigravity'],
    cost: 'mixed',
    costText: 'Two need a paid plan; Google’s has a free individual tier.',
    costSrc: ['claude-pricing', 'openai-work-codex', 'antigravity-pricing'],
    blurb: 'It reads a whole project, edits many files, and runs commands. It is not only for code — but everything it does, it does by writing and running some.'
  }
];

/* --------------------------------------------------------------------------
   The grid. Sixteen cells: four doors against four axes.

   `bar` indexes into that axis's `bars` array (1-4) and is what the visual
   meter draws. `head` is the phrase the cell shows. `why` is what a tap
   reveals. `quote` is the source's own wording where there is one worth
   reading. `conf` and `src` are the honesty machinery.
   -------------------------------------------------------------------------- */

const CELLS = {

  /* ---------------------------------------------------------- door 1 ----- */
  'chat.see': {
    bar: 1, conf: 'verified', src: ['openai-work-codex', 'claude-pricing', 'gemini-app'],
    head: 'Only what you hand it',
    why: 'A chat window starts blind. It sees what you type, paste or upload, and nothing else on your machine. The exception, and it is a growing one, is connectors: signed in, all three can be given reach into some connected apps — Drive, Gmail, Slack — but that is you granting an app, not the model finding your files.',
    quote: 'Work on web and mobile cannot directly access files on your computer.',
    quoteSrc: 'openai-work-codex'
  },
  'chat.do': {
    bar: 1, conf: 'verified', src: ['openai-work-codex', 'claude-pricing'],
    head: 'Answers, in the conversation',
    why: 'It produces text, and increasingly files and charts, inside its own window. Getting the result into your syllabus is a copy and a paste that you perform. Nothing on your computer changes because you asked it to.',
    quote: 'Chat is for fast, conversational assistance and everyday questions.',
    quoteSrc: 'openai-work-codex'
  },
  'chat.keep': {
    bar: 1, conf: 'verified', src: ['openai-work-codex'],
    head: 'One turn, then it stops',
    why: 'You ask, it answers, it waits. There is no version of this door that is still working on your question tomorrow morning. That is a limit, and it is also why it is the cheapest door to use badly.',
    quote: 'Chat is for fast, conversational assistance and everyday questions.',
    quoteSrc: 'openai-work-codex'
  },
  'chat.check': {
    bar: 1, conf: 'reasoned', src: ['gemini-app'],
    head: 'Read it. That is the whole job.',
    why: 'The answer is right there in front of you and nothing has happened yet. This is the cheapest review in the whole table: if it is wrong, you have lost a minute and nothing else. Every vendor still tells you to do it — Google’s help page puts the instruction in the imperative.',
    quote: 'Gemini Apps can make mistakes. When using Gemini Apps, double-check responses and don’t rely on responses from Gemini Apps for professional advice.',
    quoteSrc: 'gemini-app'
  },

  /* ---------------------------------------------------------- door 2 ----- */
  'inapp.see': {
    bar: 2, conf: 'verified', src: ['ms-word-edit', 'gdocs-gemini'],
    head: 'The document you have open',
    why: 'It reads the file you are working in, which sounds small until you notice that the file is the thing you actually wanted help with. Google’s version goes further: in Docs it can pull material out of your Drive and Gmail into the document you are writing.',
    quote: 'pull stats, evidence, and citations directly from your Google Drive, Gmail, or the web into your document',
    quoteSrc: 'gdocs-gemini'
  },
  'inapp.do': {
    bar: 2, conf: 'verified', src: ['ms-word-edit', 'ms-excel-edit'],
    head: 'Edits it in place, with the app’s own tools',
    why: 'This is the difference that matters. It does not describe the change, it makes it — using Word’s real styles, Excel’s real formulas, the app’s own features — so the result is a document that behaves like one you made, not text pasted into one.',
    quote: 'create, edit, refine, and format content in place',
    quoteSrc: 'ms-word-edit'
  },
  'inapp.keep': {
    bar: 2, conf: 'verified', src: ['ms-excel-edit'],
    head: 'Multi-step, but only while you are there',
    why: 'It will work through several steps on one request and you can watch it happen and stop it mid-way. It does not run tonight while you are asleep, and there is nothing to schedule.',
    quote: 'You can watch Copilot’s reasoning in the pane and see it make changes live in your workbook.',
    quoteSrc: 'ms-excel-edit'
  },
  'inapp.check': {
    bar: 2, conf: 'verified', src: ['ms-word-edit', 'gdocs-gemini'],
    head: 'Accept or reject — you get a diff',
    why: 'The quietly best-designed thing on this page. Both vendors show the change as a proposal you approve, inside an application that already has undo and version history. You are reviewing a difference, in a document you know, with a way back. Nothing further down this row gives you that.',
    quote: 'You must review and confirm these changes before anything is applied.',
    quoteSrc: 'ms-word-edit'
  },

  /* ---------------------------------------------------------- door 3 ----- */
  'coworker.see': {
    bar: 3, conf: 'verified', src: ['cowork', 'openai-work-codex'],
    head: 'Folders you point it at, plus connected apps',
    why: 'You choose the folders and the apps; it works inside that. Anthropic’s page names Microsoft 365, Google Drive and Slack among the connectors and describes a browser built into the app. OpenAI’s desktop version can open a local folder with your permission, and its web and mobile versions deliberately cannot.',
    quote: 'Works directly in folders and tools you choose',
    quoteSrc: 'cowork'
  },
  'coworker.do': {
    bar: 3, conf: 'verified', src: ['openai-work-codex', 'cowork'],
    head: 'Hands back a finished thing',
    why: 'The unit of work stops being a reply and becomes a deliverable. OpenAI lists the shapes explicitly. Anthropic’s version will also drive a browser — open sites, fill forms, finish the task — which is a meaningfully different kind of permission from reading a file.',
    quote: 'Research a topic, analyze information, or create a document, spreadsheet, presentation, report, or Site.',
    quoteSrc: 'openai-work-codex'
  },
  'coworker.keep': {
    bar: 3, conf: 'verified', src: ['cowork', 'openai-work-codex'],
    head: 'Yes — shut the laptop; schedule it; trigger it',
    why: 'This is the line the previous two doors do not cross. Anthropic states it plainly. OpenAI’s equivalent can run once, repeat on a schedule, or start itself when something happens in Gmail, Slack or GitHub. Work now happens at times you are not present for.',
    quote: 'Claude works when you don’t. Close your laptop, it keeps going. Schedule a task for any cadence, and it runs unattended.',
    quoteSrc: 'cowork'
  },
  'coworker.check': {
    bar: 4, conf: 'reasoned', src: ['cowork', 'openai-work-codex'],
    head: 'Hardest of the four — no diff, and you were not there',
    why: 'Both products show you their steps, and both ask before the consequential ones, and that genuinely helps. But the thing you are handed is finished, not proposed: there is no accept-or-reject, no track changes, and it was assembled across several files and apps while you were doing something else. Anthropic’s own sentence is the honest description of the burden — polished work, for your review. Deciding whether a finished report is right is a bigger job than deciding whether one suggested edit is right.',
    quote: 'You come back to polished work for your review.',
    quoteSrc: 'cowork'
  },

  /* ---------------------------------------------------------- door 4 ----- */
  'coding.see': {
    bar: 4, conf: 'verified', src: ['openai-work-codex', 'claude-code', 'antigravity'],
    head: 'A whole project, and the terminal',
    why: 'Not one file and not a folder of documents — a repository, its history, and whatever a command it runs can reach from there. Anthropic’s page claims a whole codebase read in seconds; Google’s describes shell execution outright.',
    quote: 'Codex can work with local folders, repositories, terminals, and developer tools.',
    quoteSrc: 'openai-work-codex'
  },
  'coding.do': {
    bar: 4, conf: 'verified', src: ['openai-codex-cli', 'claude-code', 'antigravity'],
    head: 'Runs commands on your machine',
    why: 'The ceiling of the whole table, and the reason it is last. Anything a command line can do to your computer is inside its reach — not a sandbox, your machine, using the software already installed on it. All three put a permissions control in front of that, and Anthropic’s page describes a prompt before each change. That prompt is the entire safety story, and it only works if you read it.',
    quote: 'Let Codex inspect files, make edits, and run the tools already installed on your machine.',
    quoteSrc: 'openai-codex-cli'
  },
  'coding.keep': {
    bar: 4, conf: 'verified', src: ['claude-code', 'antigravity'],
    head: 'Long loops, many at once, on a schedule',
    why: 'Not merely unattended — plural and unattended. Anthropic describes routines on a schedule or fired by an event and work fanned out across many parallel subagents; Google describes managing multiple local agents at once and scheduled messages. This is the door where “I will check on it later” starts to mean something.',
    quote: 'Configure a routine once, and it can run on a schedule',
    quoteSrc: 'claude-code'
  },
  'coding.check': {
    bar: 3, conf: 'reasoned', src: ['claude-code', 'openai-work-codex'],
    head: 'A diff you can read — if you can read code',
    why: 'Counter-intuitively this is easier to check than the door above it, and the reason is instrumentation. Code comes with a diff, a version history and tests, so the review has a shape: here is every line that changed, here is what still passes. Two costs. You must be able to read the diff, which for most faculty rules the door out. And the commands it ran are not in the diff — a file it deleted, a package it installed, an API it called leave no line for you to review.',
    quote: 'it also asks for permission before making changes to your files or running commands',
    quoteSrc: 'claude-code'
  }
};

/* The claim the `check` row makes, stated once, where the room can argue with it. */
const CHECK_NOTE = {
  head: 'Why row 4 is not a staircase',
  body: [
    'Rows 1 to 3 rise from left to right. Row 4 does not: the hardest work to check is the desktop coworker at door 3, not the coding agent at door 4.',
    'The reason is instrumentation, not intelligence. Doors 2 and 4 hand you a difference — a suggested edit you accept or reject, a diff you can read line by line — inside something that has a history and a way back. Door 3 hands you a finished artefact, made across several files and apps while you were elsewhere, with nothing to compare it against.',
    'This ordering is the one judgement on this page that no vendor states, so it is labelled reasoned rather than verified. It is also the point of the module: what you give up as you go inward is the ability to check the work cheaply. If you disagree with the ordering, the axis is still the right axis.'
  ]
};

/* --------------------------------------------------------------------------
   Act II — pick a job.

   Verdicts are 'yes' (does the whole job), 'partly' (does part; you finish
   it by hand) or 'no' (wrong door). `hand` is what you would have to hand
   over to make it work, and it is the price of the verdict. `axis` is which
   of the four rows decides the answer, so nothing here floats free.

   These verdicts are REASONED. They are inferences from the verified cells
   above, not claims any vendor makes about student reflections. The page
   says so.
   -------------------------------------------------------------------------- */

const JOBS = [
  {
    id: 'questions',
    name: 'Draft ten multiple-choice questions on this week’s reading',
    detail: 'You have the chapter. You want a first pass at a quiz, which you will then rewrite about half of.',
    doors: {
      chat:     { v: 'yes',    axis: 'do',   hand: '', why: 'Everything the job needs fits in the conversation. Paste the chapter, say what you want, edit the result. This is the door, and reaching for a bigger one buys you nothing.' },
      inapp:    { v: 'yes',    axis: 'do',   hand: 'the document open in front of you', why: 'Same job, and it lands formatted in the document instead of on your clipboard.' },
      coworker: { v: 'yes',    axis: 'check', hand: 'folder and app access the job never uses', why: 'It will do it. You have granted a standing coworker access to your files in order to write ten questions.' },
      coding:   { v: 'partly', axis: 'do',   hand: 'a terminal, and command execution', why: 'It can write prose perfectly well. You would be doing it in a terminal, reviewing a diff, for a result the chat window produced in one turn.' }
    }
  },
  {
    id: 'rubric',
    name: 'Turn an assignment sheet into a grading rubric',
    detail: 'One page in, one table out, with criteria and levels you will argue with.',
    doors: {
      chat:     { v: 'yes',    axis: 'do',   hand: '', why: 'One document in, one table out. The classic tier-one job: the whole input fits in the window and the whole output is text.' },
      inapp:    { v: 'yes',    axis: 'do',   hand: 'the document open in front of you', why: 'Better, if the rubric has to live in the assignment document — it builds the table with the document’s real styles rather than pasted text.' },
      coworker: { v: 'yes',    axis: 'check', hand: 'folder access, and a job it cannot show you a diff of', why: 'Worth it only if you are doing this for every assignment in a folder at once. For one sheet, you have taken on the hardest review in the table to save a paste.' },
      coding:   { v: 'no',     axis: 'do',   hand: '', why: 'Nothing here needs a command run or a file tree read. Wrong instrument.' }
    }
  },
  {
    id: 'syllabus',
    name: 'Reformat a syllabus into the department’s template',
    detail: 'The words are fine. The headings, the order and the styles are not.',
    doors: {
      chat:     { v: 'partly', axis: 'do',   hand: 'the text, and then all of the formatting by hand', why: 'It will restructure the words and hand them back as text. It cannot apply your template, because it has never seen your template and cannot touch the file.' },
      inapp:    { v: 'yes',    axis: 'do',   hand: 'the document open in front of you', why: 'Exactly the door. The file is open, the template’s styles are in it, and the agent edits in place using those styles. Formatting is the job it is actually built for.' },
      coworker: { v: 'yes',    axis: 'see',  hand: 'read and write access to a folder of syllabi', why: 'Worth the trade only in the plural — all eleven syllabi in the folder, to one template, while you are at lunch.' },
      coding:   { v: 'partly', axis: 'do',   hand: 'a terminal, command execution, and a diff to read', why: 'It would script something against the file format. Possible, fragile, and the app you already own does it properly.' }
    }
  },
  {
    id: 'reflections',
    name: 'Summarise eighty student reflections and pull out the three themes',
    detail: 'Eighty short pieces of writing. You want the pattern, not eighty summaries.',
    caution: 'Student work is protected record. Before any of these doors touches it, ask your institution what is permitted with which tool — that answer comes from your registrar and IT, not from a vendor page and not from this demo.',
    doors: {
      chat:     { v: 'partly', axis: 'see',  hand: 'all eighty, pasted in by you, inside one conversation’s limit', why: 'It can summarise what it is given. Getting eighty files into one window, and staying inside the length limit, is your afternoon.' },
      inapp:    { v: 'partly', axis: 'see',  hand: 'the reflections already in one file', why: 'The shape of your data decides this one. An LMS export is usually a single spreadsheet, and then the answer is yes. Eighty separate documents are not one open document, and then it is no.' },
      coworker: { v: 'yes',    axis: 'see',  hand: 'read access to a folder of student work', why: 'Point it at the folder and it reads all eighty. This is the smallest door that does the whole job — and it is also the moment the access question above stops being theoretical.' },
      coding:   { v: 'yes',    axis: 'check', hand: 'a folder, command execution, and a script you must now also check', why: 'It will do it, probably by writing a script. You are now reviewing two things: the summary, and the code that produced it.' }
    }
  },
  {
    id: 'contradictions',
    name: 'Find where your lecture notes disagree with the textbook chapter',
    detail: 'Two documents. You want the places they do not match, not a summary of either.',
    caution: 'You need the right to use the textbook text in the tool you choose. That is a licensing question about your copy, and it is not the same answer for every door.',
    doors: {
      chat:     { v: 'partly', axis: 'see',  hand: 'both texts, pasted, within one window', why: 'It compares whatever is in front of it. Both documents have to fit, and you have to be allowed to put them there.' },
      inapp:    { v: 'partly', axis: 'see',  hand: 'both documents reachable from the one you have open', why: 'Uneven between vendors. Google’s Docs agent can pull a second file out of your Drive into the document you are in, which is most of this job. The Microsoft version is aimed at the open file.' },
      coworker: { v: 'yes',    axis: 'see',  hand: 'read access to both documents, wherever they live', why: 'Two files in two places, cross-referenced, reported. Sitting across several files at once is the thing this door is for.' },
      coding:   { v: 'yes',    axis: 'check', hand: 'the files, and command execution', why: 'It will do it, and it will want the documents as plain text first, and it will write something to do the comparing.' }
    }
  },
  {
    id: 'rename',
    name: 'Rename four hundred scanned files from what is inside them',
    detail: 'A folder of scan0001.pdf. You want surname-year-topic, and you are not doing four hundred by hand.',
    doors: {
      chat:     { v: 'no',     axis: 'do',   hand: '', why: 'It cannot touch your file system. This is the clearest floor in the table: no amount of better prompting gets a browser tab to rename a file on your disk. It will happily write you instructions for doing it yourself.' },
      inapp:    { v: 'no',     axis: 'do',   hand: '', why: 'The agent lives inside one document. Renaming files is not something Word does, so it is not something the agent inside Word does.' },
      coworker: { v: 'yes',    axis: 'do',   hand: 'read and write access to the folder', why: 'The smallest door that does this. It opens the files, reads them, renames them. Note what you handed over: write access to four hundred files, and no diff to check afterwards.' },
      coding:   { v: 'yes',    axis: 'do',   hand: 'a folder, and permission to run commands on it', why: 'Four lines of script and it is done, including the four hundredth. Also the door where a mistake renames four hundred files wrongly in one go.' }
    }
  },
  {
    id: 'activity',
    name: 'Build a small interactive activity like the ones in this collection',
    detail: 'A single page a student can open, that does something when they click it.',
    doors: {
      chat:     { v: 'partly', axis: 'do',   hand: 'saving, testing and hosting it yourself', why: 'It will write you the file. You then have to save it somewhere, open it, find what is broken, and describe the breakage back — a loop you run by hand, once per bug.' },
      inapp:    { v: 'no',     axis: 'do',   hand: '', why: 'PowerPoint is not a web page. There is nothing here for a document agent to edit.' },
      coworker: { v: 'yes',    axis: 'do',   hand: 'a working folder, and a deliverable with no diff', why: 'A finished small thing is exactly this door’s unit of work — OpenAI lists a Site among the deliverables it produces.' },
      coding:   { v: 'yes',    axis: 'check', hand: 'a project folder, command execution, and a diff to review', why: 'The door this demo came through, and the reason it can say so: every demo in this collection records which tool built it. It runs the page, sees its own error, and fixes it without asking you — which is the whole advantage and the whole review problem.' }
    }
  }
];

const JOBS_NOTE = 'These seven were chosen to span the four doors, which makes the higher doors look more necessary than your week actually will. Two of the seven are done best by a chat window and one by the agent already inside Word — and that ratio is closer to a real semester than this list is.';

const VERDICT_LABEL = {
  yes:    'Does the whole job',
  partly: 'Does part; you finish it',
  no:     'Wrong door'
};

/* --------------------------------------------------------------------------
   Act III — the receipts.

   What already changed, since the module's whole claim about its own
   staleness needs evidence rather than a hedge.
   -------------------------------------------------------------------------- */

const CHANGED = [
  {
    was: 'Agent Mode',
    now: 'Edit with Copilot',
    what: 'The agent inside Word — door 2',
    body: 'Microsoft’s own support page for the feature is now titled “Edit with Copilot in Word” and disposes of the old name in one line. The capability did not change. The name did, and every slide that said “agent mode” is now wrong.',
    quote: 'In earlier releases, this was referred to as Agent Mode.',
    conf: 'verified', src: ['ms-word-edit']
  },
  {
    was: 'ChatGPT agent',
    now: 'ChatGPT Work',
    what: 'OpenAI’s answer at door 3',
    body: 'Not a rename — a retirement. OpenAI’s help centre article for ChatGPT agent still exists, still describes how to use agent mode further down the page, and opens by telling you the product is gone and naming its replacement. If you are going to teach this landscape, that page is the single best illustration of why you date your slides.',
    quote: 'ChatGPT agent is no longer available. Use ChatGPT Work for longer, multi-step tasks and finished deliverables.',
    conf: 'verified', src: ['openai-agent-retired']
  },
  {
    was: 'GPT Work',
    now: 'ChatGPT Work',
    what: 'This module’s own first draft',
    body: 'The brief this page was built from named the product “GPT Work”, which has never existed. It was caught by loading OpenAI’s page rather than trusting a recollection six weeks old. Nobody in this room is going to be more careful than that by accident, which is the argument for the date at the top of the page.',
    conf: 'verified', src: ['openai-work-codex']
  }
];

const CHANGED_NOTE = 'Three changes, all inside about six months, two of them first-party and dated. This is the evidence for the sentence at the top: the doors will outlast the names on them.';

/* What will rot, and what will not. Stated as a prediction so it can be checked. */
const STALE = {
  head: 'What to expect to be wrong, and when',
  rot: [
    'Product names. Two of the four doors have had one in the last six months.',
    'Which plan includes which feature. This changes without announcement and differs by institution.',
    'Model names inside each product. Fastest-moving thing on the page, which is why none are on it.',
    'Whether a given feature has finished rolling out. Several here were mid-rollout on the check date.'
  ],
  keep: [
    'That the surface determines the reach. It has been true through every rename so far.',
    'That reach and review burden rise together, and that the diff is what makes review cheap.',
    'That the smallest door which does the job is usually the right one.',
    'That an institution’s licence, not the vendor’s pricing page, decides what you can actually use.'
  ]
};

/* --------------------------------------------------------------------------
   The uneven row. Do not invent symmetry.
   -------------------------------------------------------------------------- */

const UNEVEN = {
  head: 'One row is uneven, and it stays uneven',
  body: 'Doors 1, 2 and 4 have a product from each of the three big vendors. Door 3 does not. Anthropic has Cowork and OpenAI has ChatGPT Work; searching Google’s own product and admin documentation on the check date turned up no consumer-plan equivalent — what Google offers instead is Gemini Enterprise, which is purchased separately from Workspace and switched on by an administrator, not by you.',
  quote: 'Gemini Enterprise isn’t included with your Google Workspace subscription.',
  conf: 'unconfirmed', src: ['gemini-enterprise-admin'],
  note: 'Marked unconfirmed rather than verified on purpose. “No such product exists” is a claim about the whole world and a search cannot establish it — all we can honestly report is that we looked at Google’s own pages and did not find one. If your campus has Gemini Enterprise, door 3 is open to you through an administrator.'
};

/* --------------------------------------------------------------------------
   Researched and deliberately left off the screen.
   -------------------------------------------------------------------------- */

const CUT = [
  { claim: 'Every price, on every product',
    why: 'Prices on all four doors moved more than once in the last year and a wrong figure in front of faculty is worse than no figure. The screen says free tier / paid plan / institutional licence and stops. The figures the sources did state are in README.md with the date they were read.' },
  { claim: '“Microsoft 365 Copilot agent mode reached general availability in April 2026”',
    why: 'This was in the brief for this module. Microsoft’s own page for the feature says on the check date that it is “still rolling out worldwide to general availability”, so the GA claim is dropped and the feature is described as rolling out. The brief was also using the retired name.' },
  { claim: 'A named Google product that is a direct peer to Cowork or ChatGPT Work',
    why: 'Searched Google’s product pages and Workspace admin documentation and found only the enterprise, administrator-purchased route. Rather than inventing symmetry, door 3 ships with a visibly uneven row and the reason on it.' },
  { claim: 'The specific model names available in each product',
    why: 'Verifiable — Antigravity’s pricing page lists its models by version, including non-Google ones — and the shortest-lived fact on the page. It is in README.md with a date instead. The screen says only that Google’s free tier includes models that are not Google’s.' },
  { claim: 'Whether any specific door is available to Murray State faculty',
    why: 'Genuinely not knowable from a vendor page. OpenAI’s documentation shows Work being switched on per role by a workspace administrator, and Gemini Enterprise the same. The page tells you to ask your own IT department, which is the only correct answer.' },
  { claim: 'Message caps and usage limits per plan',
    why: 'These are published and were read during the build. They are per-plan, they change silently, and quoting them would date the page faster than anything else on it.' },
  { claim: 'Whether Claude Cowork can be enabled under a university-wide education plan',
    why: 'Anthropic’s pricing page shows both an education plan and Cowork as a paid-plan feature, but no first-party page loaded during the build states that the two combine. Left off rather than guessed.' },
  { claim: 'Screenshots of any of these four surfaces',
    why: 'Two reasons, both fatal. Fetching an image would break the offline rule this collection holds every demo to, and a screenshot of a shipping product interface is the single fastest-rotting artefact available.' },
  { claim: 'Any claim sourced only to a technology news article',
    why: 'This module is about products, so the temptation to fill in plausible detail from coverage was high. Every product claim on the screen resolves to a page belonging to the company that makes the product. Where that was not possible, the cell says unconfirmed.' }
];

/* --------------------------------------------------------------------------
   Sources. All fifteen are first-party: a page belonging to the company that
   makes the product. Every one was loaded during the build on CHECKED_ISO.
   The self-test enforces that every `src` resolves and that no source is
   declared and never used.
   -------------------------------------------------------------------------- */

const SOURCES = {
  'cowork': {
    t: 'Anthropic — Claude Cowork product page',
    u: 'https://claude.com/product/cowork', kind: 'primary' },
  'claude-code': {
    t: 'Anthropic — Claude Code product page',
    u: 'https://claude.com/product/claude-code', kind: 'primary' },
  'claude-pricing': {
    t: 'Anthropic — Claude pricing, including the free plan and which plans include Cowork and Claude Code',
    u: 'https://claude.com/pricing', kind: 'primary' },
  'openai-agent-retired': {
    t: 'OpenAI Help Centre — ChatGPT agent: “no longer available”, with ChatGPT Work named as the replacement',
    u: 'https://help.openai.com/en/articles/11752874-chatgpt-agent', kind: 'primary' },
  'openai-work-codex': {
    t: 'OpenAI Help Centre — ChatGPT Work and Codex: what Chat, Work and Codex each are, where each runs, what each can reach',
    u: 'https://help.openai.com/en/articles/20001275-chatgpt-work-and-codex', kind: 'primary' },
  'openai-plus': {
    t: 'OpenAI Help Centre — What is ChatGPT Plus? (states that a Free plan exists alongside it)',
    u: 'https://help.openai.com/en/articles/6950777-what-is-chatgpt-plus', kind: 'primary' },
  'openai-codex-cli': {
    t: 'OpenAI — Codex CLI: inspecting files, editing, running the tools installed on your machine, and the /permissions command',
    u: 'https://learn.chatgpt.com/docs/codex/cli', kind: 'primary' },
  'ms-word-edit': {
    t: 'Microsoft — Edit with Copilot in Word (“In earlier releases, this was referred to as Agent Mode”)',
    u: 'https://support.microsoft.com/en-us/office/agent-mode-in-word-647d5d14-eaec-4e8a-a574-7cefffa7f8f0', kind: 'primary' },
  'ms-excel-edit': {
    t: 'Microsoft — Edit with Copilot in Excel: watching its reasoning, live changes to the workbook, Plan mode, Stop',
    u: 'https://support.microsoft.com/en-us/office/edit-with-copilot-in-excel-a2fd6fe4-97ac-416b-b89a-22f4d1357c7a', kind: 'primary' },
  'ms-wxp-agents': {
    t: 'Microsoft — Word, Excel and PowerPoint Agents in Microsoft 365 Copilot (the separate, file-producing agents in the Copilot app)',
    u: 'https://support.microsoft.com/en-us/office/365-copilot-app/get-started-with-word-excel-and-powerpoint-agents-in-microsoft-365-copilot', kind: 'primary' },
  'gdocs-gemini': {
    t: 'Google — Collaborate with Gemini in Google Docs: refine in place, Accept all / Reject all, pulling from Drive and Gmail',
    u: 'https://support.google.com/docs/answer/14206696', kind: 'primary' },
  'gemini-app': {
    t: 'Google — Gemini Apps help: where it runs, what an account gives you, and the instruction to double-check responses',
    u: 'https://support.google.com/gemini/answer/13275745', kind: 'primary' },
  'gemini-enterprise-admin': {
    t: 'Google Workspace admin help — Turn Gemini Enterprise on or off for users: administrator-controlled, licensed separately from Workspace',
    u: 'https://knowledge.workspace.google.com/admin/generative-ai/gemini-enterprise/turn-gemini-enterprise-on-or-off-for-users', kind: 'primary' },
  'antigravity': {
    t: 'Google — Antigravity documentation: the app, the CLI, the SDK, IDE extensions, remote control, subagents, browser control and Review Changes',
    u: 'https://antigravity.google/docs/getting-started', kind: 'primary' },
  'antigravity-pricing': {
    t: 'Google — Antigravity pricing: a free individual tier, whose model list includes models that are not Google’s',
    u: 'https://antigravity.google/pricing', kind: 'primary' }
};

const SOURCE_NOTE = 'Every source here is first-party — a page belonging to the company that makes the product — and every one was opened on ' + CHECKED_ON + '. One caution worth passing on: openai.com and its help centre refuse automated retrieval and return 403 to a script. The OpenAI facts on this page were read in an ordinary browser, from help.openai.com and learn.chatgpt.com, which is why they are marked verified; they open normally for you too. Nothing on this page rests on a news article, a blog post, or a recollection.';

const CONF_LABEL = {
  verified:    'A page belonging to the company that makes the product was loaded on ' + CHECKED_ON + ' and says this.',
  reasoned:    'Follows from the verified facts on this page, but no vendor states it in these words. Every ordering judgement here is reasoned.',
  unconfirmed: 'We looked and could not confirm it. Shown anyway, labelled, because a blank cell is a claim too.'
};

return {
  CHECKED_ON, CHECKED_ISO, INTRO, AXES, AXIS_NOTE, DOORS, CELLS, CHECK_NOTE,
  JOBS, JOBS_NOTE, VERDICT_LABEL, CHANGED, CHANGED_NOTE, STALE, UNEVEN,
  CUT, SOURCES, SOURCE_NOTE, CONF_LABEL
};
})();

if (typeof module !== 'undefined' && module.exports) module.exports = DATA;
