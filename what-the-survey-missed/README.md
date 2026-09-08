# What the Survey Missed

An offline, self-contained occupancy investigation for the AI Fellows collection. Students first run a fixed survey of 24 sites per habitat, interpret what a detection difference can and cannot mean, then decide whether to add up to two more fixed rounds before comparing their evidence with hidden synthetic truth.

Open [index.html](index.html) in a modern browser. Help opens on load and `?` reopens it. `⚙` includes presentation mode, openable presenter notes, reset responses, practice replay of the current seed, and a new seeded scenario. The printable guide is [HTML](teacher-guide.html) or [PDF](teacher-guide.pdf).

## What it teaches

- Occupancy means whether a site is used in the synthetic model. It is distinct from abundance, the number of animals.
- Every round visits every one of the same 48 sites: 24 in Habitat A and 24 in Habitat B. Site clicks inspect a fixed record; they do not create adaptive sampling.
- The first action is a fixed survey round. After students interpret the observed detection difference, they can add later fixed rounds, open transfer and likelihood tools, or reveal the synthetic model.
- The synthetic generating values are held until the evidence explanation: Habitat A has ψ = 0.8 and p = 0.25; Habitat B has ψ = 0.5 and p = 0.8. Reveal recolors the same arrays as detected, occupied-but-missed, or unoccupied; later rounds are labelled exploration.
- For (K) visits, the expected fraction ever detected is `ψ × (1 − (1 − p)^K)`. At one visit, A/B are 0.20/0.40; at three, 0.4625/0.496. A finite realization can differ from both expectations.
- The optional likelihood grid uses only observed histories. It labels relative likelihood as a bounded comparison, never as a posterior probability or calibrated confidence interval. One visit cannot identify ψ and p separately.

The activity intentionally does not treat a raw detection ranking as a success condition. In the declared model, Habitat B has a higher expected fraction detected after each of the three available visit counts despite Habitat A having the greater occupancy probability. More fixed visits improve the available evidence but do not guarantee that a finite observed ranking matches either realized occupancy or generating ψ.

## Model boundary

Sites are fixed as occupied or unoccupied across visits (closure). Given occupancy, visits have conditionally independent detections, no false positives, and a constant detection probability within each habitat. These are named teaching assumptions, not claims about a local wildlife population. The data are synthetic and the lesson makes no conservation recommendation.

## Develop and verify

`model.js` is the production model. `build.js` inserts it verbatim into the standalone page.

```text
node test-model.js
node build.js
node build.js --check
node test-build.js
```

The model tests cover the specified one- and three-visit expected fractions, every three-visit binary history summing to one, no false positives, closure, seeded replay, individual reference-history probabilities, a separate likelihood fixture and grid maximum, one-visit ambiguity, and all-zero/boundary histories. Bundle tests check the verbatim model, inline JavaScript parsing, fixed-effort and inference language, no external runtime assets, and reproducibility.

The page has no external scripts, fonts, images, stylesheets, data calls, or runtime AI inference. Browser-only direct-file/disconnected-network compliance is still unverified in the manifest.

Rebuild the printable PDF from canonical HTML with the local renderer:

```text
python tools/render_guide.py
```

## Sources

- D. I. MacKenzie et al., “Estimating Site Occupancy Rates When Detection Probabilities Are Less Than One,” *Ecology* 83(8), 2002, pp. 2248–2255, [USGS publication record](https://www.usgs.gov/publications/estimating-site-occupancy-rates-when-detection-probabilities-are-less-one). This is the source context for separating occupancy probability and detection probability and for the history likelihood structure.
- U.S. Geological Survey, [RPresence occupancy workshop, 2023 online](https://www.mbr-pwrc.usgs.gov/workshops/occupancy2023online.html), for occupancy/detection teaching context and detection-history workflows.

Neither source establishes a current Murray State assignment or endorsement.
