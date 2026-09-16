# Adopting the lesson shell

Read this before you retrofit a demo. `index.js`'s head comment is the
five-minute version — the file list, the markers, the build wiring. This is the
part that head comment cannot fit, and it is the part that costs time if nobody
tells you:

> **Adopting the kit is not a reskin.** You are not dropping a stylesheet on top
> of a demo that already works. You are **deleting** the demo's own dialog,
> overlay, act-navigation and reset machinery, and **rewiring** its activity to
> react to two events the shell dispatches. The visual change is the small half.

That sentence exists because the `two-winters` lane had to infer it by reading
`ion-flight/src/app.js` line by line and noticing what it does *not* contain.
It sized the job "S" from the CSS and found an "M" underneath. Nobody should
have to discover that twice.

---

## 1. The boundary, in one sentence

**If the kit named the class, the shell owns it. Everything else is yours.**

Every disagreement below resolves to that sentence.

### The shell owns

| Thing | Where it lives |
|---|---|
| Header, brand kicker, `?`/Settings/Notes buttons, footer, credit pill | `partials.html` A0 |
| The stage tablist: click, Arrow/Home/End, roving tabindex, `#stage-N` hash, the gate clamp | `behaviourScript()` |
| Showing and hiding `section.stage` panels | `selectStage()` |
| The four dialogs — Guide, Settings, Details, Presenter Notes — with swap-not-stack, Escape, backdrop click and focus return | `behaviourScript()` |
| The Guide opening on load | `behaviourScript()` |
| Presentation mode (`body.presenter`) and the header Notes button | `setPresentation()` |
| A6 check cards: `aria-pressed`, per-option feedback, no score | `behaviourScript()` |
| **Reset** — in place, no reload | `resetLesson()`, §4 |
| All of the above's CSS | `tokens.css` + `shell.css` |

### The demo owns

Everything inside `.workbench` and anything else your `app.js` generates: your
engine, your data, your canvases, your controls, your per-item popovers, your
self-test. Plus your activity-only CSS in `src/styles.css`, which is injected
**after** the shell's so you can override any shell rule without `!important`.

---

## 2. Converting a demo that predates the kit — what to DELETE

This is the checklist. Every line is something `ion-flight` and `two-winters`
both had before the retrofit and neither has now.

- [ ] **Your overlay/dialog system.** `open()`, `close()`, `modalStack`,
      `lockScroll`, the `.overlay`/`.sheet` divs, the Escape handler, the
      focus-return logic, the backdrop click. All of it. The shell's dialogs
      are native `<dialog>` elements and do every one of those things.
- [ ] **Your act/stage navigation.** The click handlers, the keyboard handling,
      the `aria-selected` bookkeeping, the show/hide of stage panels, any hash
      routing. `selectStage()` is the only thing that may move a stage.
- [ ] **Your `resetDemo()`.** Replaced by a `lessonreset` listener — §4.
- [ ] **Your presentation/projector toggle** and any checkbox that drove it.
      Listen for `presentationchange` instead.
- [ ] **Every CSS rule for chrome the shell now draws** — header, act nav,
      stage intro, lesson strip, eyebrow, overlay/sheet/dialog, generic button
      and focus resets. Leaving them in means two rules fighting, and the one
      that wins is the one that happens to be later.
- [ ] **Duplicate palette tokens.** If you had `--sky` and the kit has `--lite`
      at the identical value, rename your references to the kit's name. Check
      the hex is genuinely identical first; if it is not, that is a design
      decision, not a rename.
- [ ] **Your own `#details` id**, if you had one, and any other id the kit
      reserves — the list is at the top of `partials.html`. A duplicate id does
      not throw; it silently gives one of the two elements to the other. See §5.

### What to KEEP, and not get talked out of

Your activity's mechanism. The retrofit is a format pass: the physics, the
fixtures, the scoring, the drawing code should come out byte-identical unless a
defect was found in them. If a stage's node suite changes, be able to say why.

Your per-item drill-downs, if you have them. They are part of the activity, not
a duplicate of the shell's Details drawer. Give yours a distinct id and say so
in a comment — `two-winters/src/app.js` is the worked example.

---

## 3. The two events

The shell talks to the demo through exactly two events on `document`. There is
no other coupling and no configuration object.

### `stagechange` — a tab was selected

```js
document.addEventListener('stagechange', e => {
  const i = e.detail.index;          // 0-based
  // build or refresh whatever stage i shows; cancel anything in flight
});
```

Fires on click, on keyboard navigation, on a `#stage-N` hash at load, on your
own `window.lessonShell.selectStage(n)`, and once during a reset. It fires even
when the index did not change, so handle the no-op case.

Your `app.js` does **not** show or hide the panel — the shell already did. Your
handler exists to do the work the shell cannot: lazily build a canvas, re-run a
layout measurement, cancel an animation that belongs to the stage being left.

### `lessonreset` — put your activity back

Required. §4.

---

## 4. The reset contract

**Reset is in place. No page reload.** (Operator ruling, 2026-09-16. Kit v1
reloaded the page; v2 does not.)

A reload was trivially correct — it threw the document away, so every variable
came back at its initial value for free. In-place buys a demo that does not
blank-flash on a projector mid-session and does not re-run every boot path, and
the price is that correctness is now something you have to actually do.

### What the shell guarantees

In this order, when `#reset-btn` is pressed:

1. **`onReset()` is consulted.** Returning `false` **cancels the entire reset** —
   nothing below runs. This is the veto path.
2. **Every open `<dialog>` closes** — not only the shell's four. Yours too.
3. **Every stage tab returns to its first-load chrome** from a snapshot taken
   before your `app.js` ran: `disabled` (so a gate re-locks), class (so
   `complete` marks clear), `title`, and the `.stage-mark` glyph.
   **Author your gate in the template markup** (`disabled` on the tab), not
   only in `app.js` — the snapshot is taken before your script runs, so a
   gate applied solely at runtime would come back *unlocked* after Reset.
4. **Every A6 check card** drops its `aria-pressed` answer and clears its
   feedback line.
5. **Every A2 `.echo` and A4 `.obs-cue`** returns to its snapshotted first-load
   content.
6. **The A5 Details drawer** goes back to stage 1, subtitle restored.
7. **`selectStage(0)`** — stage 1. This also fires `stagechange`.
8. **The page scrolls to the top.**
9. **`lessonreset` is dispatched.**

### What the shell deliberately does not touch

- **Presentation mode.** A presenter resets between rooms; re-shrinking the
  projector each time would be hostile. CONTRACT.md says the same.
- **The Guide.** It does not reopen. A reset is not a fresh arrival — the person
  who pressed it has already read the Guide.
- **Your activity.** The shell cannot know what it holds. Step 9 is for that.

### What you must implement

```js
document.addEventListener('lessonreset', () => {
  // 1. every variable your module closes over, back to its initial value
  // 2. every node your app.js generated, back to its first-load content
  //    (including any `dataset.built` guard you use to build a stage once)
  // 3. re-render stage 1
});
```

It fires **last**, after the shell has finished, so you have the final word over
any node you both touch. It is **not cancelable** — the veto lives in
`onReset()`, so there is exactly one place to refuse a reset.

### How to get this right, rather than approximately right

Write the enumeration down before you write the handler. A reload was correct by
construction; in-place is correct only if the list is complete, and the failure
mode is quiet — a stale answer, a `<details>` still open, a counter that did not
go back — which no build check and no node suite can see.

Enumerate, in this order:

1. **Every property of your state object.** Not "reset the state object" — walk
   the properties. One of them is usually a cached sub-object (a timeline, a
   chart) that must be *rewound* rather than *dropped*, because dropping it and
   rebuilding would double-bind its event listeners.
2. **Every `hidden` you toggle**, every class you add, every `style.width` you
   set, every `dataset.*` flag you use as a build-once guard.
3. **Every node you filled with `innerHTML`** that starts empty in the template.
4. **Every form control** — a slider keeps its value; the template's `value="…"`
   attribute does not reassert itself.
5. **Every `<details>` element you generated.** Open ones stay open.
6. **Anything you appended to the DOM in a place the shell does not manage**,
   including an element you *moved* between hosts.

Then verify it in a browser, with a control: change state, press Reset, and
assert both that the state is back *and* that no navigation happened — a
sentinel on `window` set before Reset must still be there afterwards. If the
sentinel is gone, something reloaded and you have proved nothing about your
handler.

### If in-place is wrong for your demo

It is a legitimate finding, not a failure. If your activity holds state that
genuinely cannot be restored without a reload — a third-party widget with no
teardown, a WebGL context you cannot re-initialise — **say so and escalate**
rather than shipping a handler that half-works. A reset that silently leaves
one thing behind is worse than a reload, because nobody can see it.

### Taking the whole reset over

If you need to, veto and do it yourself:

```js
window.lessonShell.onReset = () => { myOwnRewind(); return false; };
```

`check-shell.js` accepts that as implementing the contract. It does **not**
accept `window.lessonShell.onReset = null`, which is what a demo that has not
implemented the contract leaves behind.

---

## 5. Two things that will bite you

### `#details` is the kit's, not yours

The shell's per-stage Details drawer is `#details`. That is also the most
natural id for a demo's own per-item drill-down, and both are called "Details"
on screen. They are different mechanisms:

| | Kit's `#details` (A5) | Your per-item popover (A3) |
|---|---|---|
| Scope | the whole stage | one event, cell or row |
| Content | fixed five sections: what is live, how it works, assumptions, sources, boundary | whatever that item says |
| Opened by | `.details-trigger` in the stage intro | a control inside your activity |
| Owned by | the shell | you |

Do not fold them together. Name yours something else — `#item-details` — and
give its trigger an `aria-label` that names the item. `check-shell.js` fails a
built file that defines any id twice, so a collision fails the build, but the
design decision is yours to get right before it gets there. The reserved list is
at the top of `partials.html`.

### `assertNoExternalRefs`'s allow-list is narrower than it looks

Only `script`, `link`, `img`, `iframe`, `source`, `video`, `audio`, `embed` and
`object` are scanned. **`<a>` is not**, and never has been. Your Details
drawer's Sources list — a screenful of `<a href="https://…">` — is invisible to
this check and needs no entry in `allow`. The allow-list is for a *same-folder
file referenced by one of the scanned tags*, which in practice means the single
entry `'demo-guide.html'`. If you are adding a URL to it, stop and re-read what
you are doing.

---

## 6. Before you call it done

```
node build.js && node tools/pdf.mjs && node build.js --check
node <your node suites>
node ../tools/lesson-shell/check-shell.js <slug>
node ../tools/lesson-shell/check-shell.js --self-test
node ../tools/build-hub.js --check
```

And the browser pass, which is **not waivable** and is the only thing here that
can see a runtime DOM failure. Both defects the kit has shipped so far — a
`HierarchyRequestError` that killed every render, and stage panels pinned shut
by a `hidden` attribute `selectStage` did not clear — passed every command in
that list.

The browser pass must, at minimum:

- serve over a **local static server**. `file://` does not permit interaction in
  this environment;
- prove the console reader is live on a bait page **first**, then show the demo's
  console clean on a fresh tab;
- **visit every stage and assert each panel actually renders** —
  `getComputedStyle(panel).display !== 'none'` **and** a live `offsetParent`.
  Tab state is not panel state: a tab can report `aria-selected="true"` over a
  panel that is not on the screen, which is exactly how the `hidden` defect
  shipped. If a stage is gated, drive the real interaction to open the gate;
- exercise **Reset with its control**, per §4.

## 7. Rebuilding after a kit change

The stamp carries the kit version **and** a hash of the kit's CSS, and
`check-shell.js` compares both. Change the kit and every demo built against the
old one goes red until it is rebuilt. That is the back-propagation guarantee
working, not a bug — but it means a kit change during a batch invalidates every
demo in that batch, which is why the kit freezes before the batches start.

A behaviour-only change (like v1 → v2) leaves the CSS hash identical. That is
precisely why `VERSION` exists alongside the hash: bump it, or the change is
invisible to every check.
