---
id: fellow-build-verification
artifact_kind: reference
schema_version: 2
title: AI Fellow demo build evidence and shared-repo handoff
created: 2026-09-08T20:04:00Z
updated: 2026-09-08T20:04:00Z
author: codex
model: gpt-6-astra
model_basis: confirmed
status: active
source: Production files, test output, Chrome extension observations, and subagent reviews in this session
scope: examples
source_basis: authored
sensitivity: normal
tags: [ai-fellows, verification, coordination]
---

# First two standalone demos

Wavelet Lab and Ion Flight were built by native subagents with runtime-confirmed
gpt-5.6-terra/high, then independently reviewed in a gpt-6-astra/high context.
Reviewer acceptance is bounded to the declared mathematical models, not a guarantee
of learning gains or absence of all misconceptions. Parent verified files and
ran the production-model checks, browser interactions and printable-guide review.

## Evidence observed

- Wavelet: 12 model checks passed, including explicit 4x4 subbands, constant-image
  DC behavior, independent 8x8 matrix, orthogonality, round trips, omitted energy,
  best-k enumeration and consistent numeric formatting. Bundled module matches
  tested source; inline scripts parse and build reproduces the committed HTML.
- Ion Flight: 15 model assertions passed, including SI flight-time fixtures,
  length/voltage/mass/charge scaling, density area and correct mass resolving-power
  factor. Absolute timing spread is bounded relative to fastest arrival to keep
  substantive density at positive times; Gaussian tails are still an approximation.
- Chrome through the extension: first-load help, controls, settings, presentation
  mode and notes operated. Wavelet coarse-only default reconstructs all values to
  3.875; squared error and omitted energy both display 52.875. Full image budget
  displays RMSE 0.00. Prediction feedback explains squared values rather than signs.
  Ion Flight wrong answers permit retry; correct answers reach 3/3 mastery, equal
  m/z overlaps, timing convention changes and completed animation preserves time.
- Responsive inspection at 390px: no document horizontal overflow; Wavelet scenes
  render. Ion cutaway and trace-axis caption overlap were fixed and re-inspected.
- Both one-page letter PDFs were rendered with installed Chrome, checked using
  pdfinfo and visually inspected as raster previews: readable, no clipping.
- Runtime static audit finds embedded scripts/styles/canvas and only local guide
  hyperlinks. Browser interactions ran through localhost. Browser policy rejected
  direct file URL navigation, so no direct-file or disconnected-network browser
  claim is made; offline_no_inference remains unverified in both manifests.

## Material review corrections

The first 2-D Haar implementation passed roundtrip/energy tests but incorrectly
nested a multilevel 1-D transform at each scale. It was replaced with one-level
row/column steps per scale and pinned by independent subband and DC fixtures.
The TOF resolving-power display initially omitted the factor 2 in R≈t/(2FWHM).
That was repaired and tested. The transfer exercises now avoid a universal
perceptual-quality claim and an unlimited-length resolution claim respectively.

## Ownership and next build

HarnessBroker workspace examples: Codex session 01a08159-d0e4-7013-a510-bffe0b53d74f
is actively registered for wavelet-lab, ion-flight, inhibitor-investigation and
their task memory. Claude/Opus session 53af9ff3-b420-4ade-9e04-50c2bc8fae47 owns
root index/README/tours/CONTRACT and pre-existing demos. Opus agreed to integrate
these demos in the hub after the scoped completion handoff. No root edits by this
Codex lane after that agreement; no push authorized by this task.

The user conditionally authorized a third build after one completed. Wavelet's
standalone completion triggered [[fellow-enzyme-build]]: a finite, exact synthetic
inhibition investigation. Native builder session 01a0829c-e061-7ba0-8db8-593ac1a37117
was verified as gpt-5.6-terra/high. Its manifest is delayed until required files
exist to keep concurrent hub generation usable. Account-level budget checked
before dispatch; no subscription percentage-to-token conversion is asserted.

## Relations

- verifies [[fellow-wavelet-build]]
- verifies [[fellow-tof-build]]
- relates_to [[fellow-enzyme-build]]
