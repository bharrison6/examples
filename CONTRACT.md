# Demo contract

Every demo in this repo meets this contract. It is an **open list** — items get added
as the collection matures; when one is added, backfill every `demo.json` compliance
block with the new key so the gap is visible, not silent.

## Naming & placement

- One folder per demo, named with the demo's **kebab-case title slug** (`bridge-works`,
  `fuel-golf`). The folder name is the demo's public URL on the hosted copy
  (`bharrison6.github.io/examples/<slug>/`) — **never rename a shipped demo**.
- The descriptive layer lives in `demo.json` (topic, discipline, tagline), not the
  folder name.

## Required files

| File | Purpose |
|------|---------|
| `index.html` | The runnable demo. Self-contained at runtime; if built, the committed file is the built output. |
| `README.md` | What it is, how to run/present it, how to modify it. |
| `demo.json` | Manifest: identity, metadata, `built_with` provenance, compliance state. |
| Printable guide (`*.html` + `*.pdf`) | Teacher/presenter guide, declared in `demo.json` → `guide`. |

Demos with a build step keep `src/`, `build.js`, `tools/` in the folder; the build must
be reproducible from the committed sources.

## Required UX (every demo)

- **How-to popup** — a "how to play / how to use" overlay shown on load, dismissible,
  reopenable anytime from a visible control.
- **Settings menu** — a settings button; at minimum it offers **presentation mode**,
  which includes openable **presenter's notes**.
- **Theme** — Murray State demos use the Murray State theme (MSU Blue `#002144`,
  MSU Gold `#ECAC00`, Lite Blue `#00A4E3`; alert Red Orange `#FF4500` reserved for
  genuine failure states).
- **Attribution** — Bryant Harrison visible on every demo; plus Murray State
  University when built for Murray State.
- **Mobile capable** — phone-first or fully responsive; touch works.
- **Offline / no runtime inference** — the page must load and run with **zero network
  requests**: no external scripts, stylesheets, fonts, images or data, and no AI service
  at runtime. Embed everything; `data:` URIs only. The demo must work with the network off.
  - **Outbound hyperlinks are allowed.** An `<a href>` the reader may choose to follow is
    not a network call by the page. This was revisited deliberately on 2026-09-08 when a
    reading-and-watching demo needed real links to books and videos; it replaces an earlier
    blanket "no external href" reading. The test is still *loads and runs offline*, not
    *contains no URLs* — a demo that fetches, embeds or phones home still fails.

## Manifest (`demo.json`)

Copy a neighbor's and edit. Field notes:

- `built_with` — the harnesses/tools that built the demo (`cowork`, `claude-code`,
  `codex`, `gpt`, ...). Empty array = not yet recorded, listed by the build script
  until filled. Record honestly — provenance is part of what this repo demonstrates.
- `compliance` — one key per contract item above; values `true`, `false`, or
  `"unverified"` (evidence suggests yes but nobody has confirmed in-browser).
  Update when retrofitting; never delete a key to hide a gap.

## Hub generation

`README.md`'s demo table and the launcher card bodies in `index.html` are generated:

```bash
node tools/build-hub.js
```

Edit `demo.json` / `tours/*.json`, then regenerate. Section narrative in `index.html`
stays hand-authored. `--check` verifies without writing (for CI or pre-commit).

## Adding a demo

1. Folder with title slug; meet the contract above.
2. `demo.json` (+ record `built_with`).
3. Add to a tour in `tours/` and drop a stub card
   `<a class="card" href="<slug>/index.html"></a>` where it belongs in `index.html`.
4. `node tools/build-hub.js`.
