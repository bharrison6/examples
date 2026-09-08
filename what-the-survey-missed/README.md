# What the Survey Missed

An offline, self-contained occupancy investigation for the AI Fellows collection. Students first run a fixed survey of 24 sites per habitat, interpret what a detection difference can and cannot mean, then decide whether to add up to two more fixed rounds before comparing their evidence with hidden synthetic truth.

Open [index.html](index.html) in a modern browser. Help opens on load and `?` reopens it. `⚙` includes presentation mode and presenter notes. The printable guide is [teacher-guide.html](teacher-guide.html); its PDF is produced by the parent delivery lane from that canonical HTML.

## What it teaches

- Occupancy means whether a site is used in the synthetic model. It is distinct from abundance, the number of animals.
- Every round visits every one of the same 48 sites: 24 in Habitat A and 24 in Habitat B. Site clicks inspect a fixed record; they do not create adaptive sampling.
- The synthetic generating values are held until the evidence explanation: Habitat A has ψ = 0.8 and p = 0.25; Habitat B has ψ = 0.5 and p = 0.8.
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

## Sources

- D. I. MacKenzie et al., “Estimating Site Occupancy Rates When Detection Probabilities Are Less Than One,” *Ecology* 83(8), 2002, pp. 2248–2255, [DOI](https://doi.org/10.1890/0012-9658(2002)083%5B2248:EOSORW%5D2.0.CO;2). This is the source context for separating occupancy probability and detection probability and for the history likelihood structure.
- U.S. Geological Survey, [RPresence workshop materials](https://www.mbr-pwrc.usgs.gov/workshops/), for occupancy/detection teaching context and detection-history workflows.

Neither source establishes a current Murray State assignment or endorsement.
