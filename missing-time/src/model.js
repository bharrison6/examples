/* Missing Time's dependency-free authored rock-record model. Bundled verbatim into index.html. */
const MissingTimeModel = (() => {
  'use strict';

  const MYR = 'Myr';
  const METRES = 'm';
  const SPECIES = Object.freeze({
    asters: Object.freeze({ label: 'Asteria', lifetime: Object.freeze([0.2, 3.4]) }),
    shells: Object.freeze({ label: 'Nerita', lifetime: Object.freeze([2.8, 5.6]) }),
    fronds: Object.freeze({ label: 'Caldera frond', lifetime: Object.freeze([5.1, 7.5]) })
  });

  const CASES = Object.freeze([
    Object.freeze({
      id: 'continuous-record', title: 'Section A: Continuous Record',
      prompt: 'Asteria is observed in lower rock and a different fossil is observed above. Does a local disappearance establish extinction?',
      sections: Object.freeze([
        Object.freeze({ id: 'a', label: 'Section A', chronology: Object.freeze([
          { layerId: 'a-base', position: 'base', modelMyr: 0 }, { layerId: 'a-base', position: 'top', modelMyr: 2 },
          { layerId: 'a-middle', position: 'base', modelMyr: 2 }, { layerId: 'a-middle', position: 'top', modelMyr: 4 },
          { layerId: 'a-top', position: 'base', modelMyr: 4 }, { layerId: 'a-top', position: 'top', modelMyr: 6 }
        ]), events: Object.freeze([
          { type: 'deposit', id: 'a-base', label: 'Blue mudstone', durationMyr: 2, rateMPerMyr: 10, fossils: [{ species: 'asters', atMyr: 0.8 }] },
          { type: 'deposit', id: 'a-middle', label: 'Green mudstone', durationMyr: 2, rateMPerMyr: 7, fossils: [{ species: 'asters', atMyr: 0.9 }] },
          { type: 'deposit', id: 'a-top', label: 'Gold sandstone', durationMyr: 2, rateMPerMyr: 8, fossils: [{ species: 'shells', atMyr: 1.1 }] }
        ]) })
      ]),
      warranted: 'Asteria has a local last observation in a continuous sampled sequence. The observations do not establish global extinction.',
      reveal: 'In this authored history Asteria’s synthetic lifetime ends at 3.40 Myr since start, inside Green mudstone. The model truth is not proof from a local sample: sampling and global distribution are deliberately inadequate here.'
    }),
    Object.freeze({
      id: 'cut-bank', title: 'Section B: Cut Bank',
      prompt: 'A missing interval is exposed beneath younger rock. Is the blank necessarily an organism’s last moment?',
      sections: Object.freeze([
        Object.freeze({ id: 'b', label: 'Section B', chronology: Object.freeze([
          { layerId: 'b-base', position: 'base', modelMyr: 0 }, { layerId: 'b-base', position: 'top', modelMyr: 2 },
          { layerId: 'b-middle', position: 'base', modelMyr: 2 }, { layerId: 'b-middle', position: 'top', modelMyr: 2 + 8 / 12 },
          { layerId: 'b-top', position: 'base', modelMyr: 5.4 }, { layerId: 'b-top', position: 'top', modelMyr: 7.2 }
        ]), events: Object.freeze([
          { type: 'deposit', id: 'b-base', label: 'Gray shale', durationMyr: 2, rateMPerMyr: 10, fossils: [{ species: 'asters', atMyr: 1.0 }] },
          { type: 'deposit', id: 'b-middle', label: 'Red siltstone', durationMyr: 1.5, rateMPerMyr: 12, fossils: [{ species: 'asters', atMyr: 0.4 }, { species: 'shells', atMyr: 1.2 }] },
          { type: 'deposit', id: 'b-cap', label: 'Pale limestone', durationMyr: 1.5, rateMPerMyr: 10, fossils: [{ species: 'shells', atMyr: 0.5 }] },
          { type: 'erode', id: 'b-erosion', label: 'Surface erosion', durationMyr: 0.4, amountM: 25 },
          { type: 'deposit', id: 'b-top', label: 'Cross-bedded sand', durationMyr: 1.8, rateMPerMyr: 10, fossils: [{ species: 'fronds', atMyr: 0.7 }] }
        ]) })
      ]),
      warranted: 'The visible local gap and samples above/below it do not identify the cause of missing rock or establish an extinction boundary.',
      reveal: 'The erosion event removed all 15.00 m of Pale limestone and 10.00 m from the top of Red siltstone. Its removed fossils are absent from the surviving rock.'
    }),
    Object.freeze({
      id: 'paired-sections', title: 'Sections C and D: Compare',
      prompt: 'Section C has a blank interval. Sample the matching interval in Section D before deciding what the blank means.',
      sections: Object.freeze([
        Object.freeze({ id: 'c', label: 'Section C', chronology: Object.freeze([
          { layerId: 'c-base', position: 'base', modelMyr: 0 }, { layerId: 'c-base', position: 'top', modelMyr: 2 },
          { layerId: 'c-top', position: 'base', modelMyr: 4 }, { layerId: 'c-top', position: 'top', modelMyr: 6 }
        ]), events: Object.freeze([
          { type: 'deposit', id: 'c-base', label: 'Dark shale', durationMyr: 2, rateMPerMyr: 10, fossils: [{ species: 'asters', atMyr: 0.9 }] },
          { type: 'pause', id: 'c-pause', label: 'No deposition at C', durationMyr: 2 },
          { type: 'deposit', id: 'c-top', label: 'Tan sandstone', durationMyr: 2, rateMPerMyr: 9, fossils: [{ species: 'shells', atMyr: 0.8 }] }
        ]) }),
        Object.freeze({ id: 'd', label: 'Section D', chronology: Object.freeze([
          { layerId: 'd-base', position: 'base', modelMyr: 0 }, { layerId: 'd-base', position: 'top', modelMyr: 2 },
          { layerId: 'd-middle', position: 'base', modelMyr: 2 }, { layerId: 'd-middle', position: 'top', modelMyr: 4 },
          { layerId: 'd-top', position: 'base', modelMyr: 4 }, { layerId: 'd-top', position: 'top', modelMyr: 6 }
        ]), events: Object.freeze([
          { type: 'deposit', id: 'd-base', label: 'Dark shale', durationMyr: 2, rateMPerMyr: 10, fossils: [{ species: 'asters', atMyr: 0.9 }] },
          { type: 'deposit', id: 'd-middle', label: 'Green mudstone', durationMyr: 2, rateMPerMyr: 7, fossils: [{ species: 'asters', atMyr: 0.8 }, { species: 'shells', atMyr: 1.2 }] },
          { type: 'deposit', id: 'd-top', label: 'Tan sandstone', durationMyr: 2, rateMPerMyr: 9, fossils: [{ species: 'shells', atMyr: 0.8 }] }
        ]) })
      ]),
      warranted: 'Section D preserves material from the interval missing at C. A blank at one local section is not a global fossil absence.',
      reveal: 'This authored pair gives C a 2.00 Myr pause while D continues to accumulate Green mudstone. The fossil observed at D was never moved into C’s hiatus.'
    })
  ]);

  function positive(value, name) {
    if (!(Number.isFinite(value) && value > 0)) throw new RangeError(`${name} must be positive`);
  }

  function eventDuration(event) {
    positive(event.durationMyr, 'durationMyr');
    return event.durationMyr;
  }

  function compileSection(definition) {
    let time = 0;
    let totalThickness = 0;
    const layers = [];
    const ledger = [];
    definition.events.forEach(event => {
      const startMyr = time;
      const durationMyr = eventDuration(event);
      time += durationMyr;
      if (event.type === 'deposit') {
        positive(event.rateMPerMyr, 'rateMPerMyr');
        const originalThicknessM = event.durationMyr * event.rateMPerMyr;
        const authoredFossils = (event.fossils || []).map((fossil, index) => {
          if (!SPECIES[fossil.species]) throw new RangeError(`unknown species ${fossil.species}`);
          if (!(fossil.atMyr >= 0 && fossil.atMyr <= event.durationMyr)) throw new RangeError('fossil must be within its deposited layer');
          const timeMyr = startMyr + fossil.atMyr;
          const life = SPECIES[fossil.species].lifetime;
          if (!(timeMyr >= life[0] && timeMyr <= life[1])) throw new RangeError('fossil must be within its authored species lifetime');
          return { id: `${event.id}-f${index + 1}`, species: fossil.species, depthFromBaseM: fossil.atMyr * event.rateMPerMyr, timeMyr };
        });
        const layer = {
          id: event.id, label: event.label, baseM: totalThickness, originalThicknessM, survivingThicknessM: originalThicknessM,
          startMyr, endMyr: time, rateMPerMyr: event.rateMPerMyr,
          authoredFossils, fossils: authoredFossils.slice()
        };
        layers.push(layer); totalThickness += originalThicknessM;
        ledger.push({ ...event, startMyr, endMyr: time, originalThicknessM });
      } else if (event.type === 'pause') {
        ledger.push({ ...event, startMyr, endMyr: time, originalThicknessM: 0 });
      } else if (event.type === 'erode') {
        positive(event.amountM, 'amountM');
        let remaining = event.amountM;
        const removed = [];
        for (let index = layers.length - 1; index >= 0 && remaining > 0; index -= 1) {
          const layer = layers[index];
          const take = Math.min(layer.survivingThicknessM, remaining);
          const oldThickness = layer.survivingThicknessM;
          layer.survivingThicknessM -= take;
          remaining -= take;
          const fossilsRemoved = layer.fossils.filter(fossil => fossil.depthFromBaseM > layer.survivingThicknessM);
          layer.fossils = layer.fossils.filter(fossil => fossil.depthFromBaseM <= layer.survivingThicknessM);
          removed.push({ layerId: layer.id, thicknessM: take, fossilsRemoved: fossilsRemoved.map(fossil => fossil.id) });
          if (oldThickness > 0 && layer.survivingThicknessM === 0) continue;
        }
        if (remaining > 1e-9) throw new RangeError('erosion exceeds accumulated rock thickness');
        totalThickness -= event.amountM;
        ledger.push({ ...event, startMyr, endMyr: time, removed });
      } else throw new RangeError(`unknown event type ${event.type}`);
    });
    const survivingLayers = layers.filter(layer => layer.survivingThicknessM > 1e-9).map(layer => ({ ...layer }));
    let baseM = 0;
    survivingLayers.forEach(layer => { layer.baseM = baseM; baseM += layer.survivingThicknessM; });
    const gaps = [];
    for (let index = 0; index < survivingLayers.length - 1; index += 1) {
      const lower = survivingLayers[index], upper = survivingLayers[index + 1];
      const lowerTopMyr = lower.startMyr + lower.survivingThicknessM / lower.rateMPerMyr;
      const durationMyr = upper.startMyr - lowerTopMyr;
      if (durationMyr > 1e-9) {
        const causes = ledger.filter(item => item.endMyr > lowerTopMyr && item.startMyr < upper.startMyr)
          .map(item => ({ id: item.id, type: item.type, label: item.label }));
        gaps.push({ id: `${lower.id}-to-${upper.id}`, lowerLayerId: lower.id, upperLayerId: upper.id, fromMyr: lowerTopMyr, toMyr: upper.startMyr, durationMyr, depthM: lower.baseM + lower.survivingThicknessM, causes });
      }
    }
    const chronology = (definition.chronology || []).map(anchor => {
      const layer = survivingLayers.find(item => item.id === anchor.layerId);
      if (!layer || !['base', 'top'].includes(anchor.position)) throw new RangeError('chronology anchor must name a surviving layer edge');
      const derivedMyr = anchor.position === 'base' ? layer.startMyr : layer.startMyr + layer.survivingThicknessM / layer.rateMPerMyr;
      if (Math.abs(derivedMyr - anchor.modelMyr) > 1e-9) throw new RangeError('chronology anchor must agree with preserved rock mapping');
      return { ...anchor, label: `${layer.label} ${anchor.position}`, derivedMyr };
    });
    return { id: definition.id, label: definition.label, elapsedMyr: time, thicknessM: baseM, layers: survivingLayers, gaps, chronology, ledger };
  }

  function getCase(caseId) {
    const found = CASES.find(item => item.id === caseId);
    if (!found) throw new RangeError(`unknown case ${caseId}`);
    return found;
  }

  function compiledCase(caseId) {
    const item = getCase(caseId);
    return { ...item, sections: item.sections.map(compileSection) };
  }

  function sampleLayer(caseId, sectionId, layerId) {
    const section = compiledCase(caseId).sections.find(item => item.id === sectionId);
    if (!section) throw new RangeError(`unknown section ${sectionId}`);
    const layer = section.layers.find(item => item.id === layerId);
    if (!layer) throw new RangeError(`unknown surviving layer ${layerId}`);
    return {
      sectionId, layerId, label: layer.label,
      specimens: layer.fossils.filter(fossil => fossil.depthFromBaseM <= layer.survivingThicknessM)
        .map(fossil => ({ id: fossil.id, species: SPECIES[fossil.species].label, depthM: layer.baseM + fossil.depthFromBaseM, timeMyr: fossil.timeMyr }))
    };
  }

  function evidenceStatus(caseId, actions) {
    const actionSet = new Set(actions || []);
    const caseData = compiledCase(caseId);
    const validGaps = new Set(caseData.sections.flatMap(section => section.gaps.map(gap => `gap:${gap.id}`)));
    const validSamples = new Set(caseData.sections.flatMap(section => section.layers.map(layer => `sample:${section.id}:${layer.id}`)));
    const validChronology = new Set(caseData.sections.map(section => `chronology:${section.id}`));
    const gapsShown = [...actionSet].some(action => validGaps.has(action));
    const chronologyShown = [...actionSet].filter(action => validChronology.has(action));
    const samples = [...actionSet].filter(action => validSamples.has(action));
    if (!samples.length) return { kind: 'incomplete', text: 'Sample surviving rock before choosing a conclusion.' };
    if (caseId === 'continuous-record' && !(actionSet.has('sample:a:a-middle') && actionSet.has('sample:a:a-top') && chronologyShown.includes('chronology:a'))) return { kind: 'incomplete', text: 'Sample middle and top rock, then show Section A’s supplied age evidence before calling the record continuous.' };
    if (caseId === 'cut-bank' && !(gapsShown && chronologyShown.includes('chronology:b') && actionSet.has('sample:b:b-middle') && actionSet.has('sample:b:b-top'))) return { kind: 'incomplete', text: 'Show the supplied age evidence and sample surviving rock below and above the missing interval.' };
    if (caseId === 'paired-sections' && !(gapsShown && chronologyShown.includes('chronology:c') && chronologyShown.includes('chronology:d') && actionSet.has('sample:c:c-base') && actionSet.has('sample:d:d-middle'))) return { kind: 'incomplete', text: 'Show supplied age evidence for both sections, then sample below C’s gap and Green mudstone in D.' };
    return { kind: 'ready', text: getCase(caseId).warranted, caseData };
  }

  return { MYR, METRES, SPECIES, CASES, eventDuration, compileSection, getCase, compiledCase, sampleLayer, evidenceStatus };
})();

if (typeof module !== 'undefined') module.exports = MissingTimeModel;
