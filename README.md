# Dr. Singh's Art Line Sim

An open, browser-based **arterial line and pressure transducer simulator** for students, nurses, residents and fellows.
The patient's true arterial pressure and the pressure the monitor displays are computed as two separate signals:
break the measurement chain (catheter → tubing → transducer → monitor), watch the trace stop telling the truth,
and fix it with a fast-flush test, the stopcock, zeroing and levelling.

> Educational use only. Not a medical device. Not for clinical decisions, procedure planning, assessment or exams. All cases are simulated. Never enter patient information.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # node --test tests/*.test.js
npm run build    # static site in dist/ (relative base, works on GitHub Pages)
```

## Controls

X (hold) fast flush, O stopcock (patient / open to air), Z zero, W / S transducer up / down (or drag it in 3D),
T true pressure overlay, B inspiration shading, K caliper (double-click pins a second line: interval and Hz),
F freeze, P PDF report, L labels, R reset, M cycle mode, H help, Enter record / finish, 1–4 quiz answers.

## Modes

- **Free explore**: seven patients (normal radial, pulsus parvus et tardus, bisferiens, spike-and-dome, alternans,
  paradoxus, bradycardia with a wide pulse pressure), radial or central aortic catheter, any heart rate, and every
  fault: kink, small or large air bubble, clot (or a soft bag that clots), long extension tubing, a resonant system,
  a damping device, zero drift, bed height, and (central line) catheter whip and end-pressure artefact.
- **Read the trace**: name the damping from a flush test, name the pulse, predict what a fault does to SBP/DBP/MAP.
- **Set up the line**: bag, prime, level, zero, flush test, record. Scored.
- **Troubleshoot the line**: twelve cases, including traps where the trace is the patient. Scored out of 100
  (diagnosis, fixed, flush test and confirmation, economy, time) with generated feedback.

Also: a Learn tab, a guided tour, Boba (the rule-based assistant), Model & limits and About pages, and a PDF report.

## How it works

`src/sim/patient.js` builds each beat from keypoints on an ECG timeline (radial foot 160 ms after the R wave).
`src/sim/line.js` is the measurement system: a second-order model x″ = ωn²(u − x) − 2ζωn·x′ (semi-implicit Euler,
0.1 ms sub-steps), 0.75 mmHg/cm hydrostatic error, zero offset, tip artefacts and a reproducible flush-test counter.
`src/sim/rig.js` runs it in real time; `src/modes/scoring.js` holds cases, questions and scores. Rendering
(`src/render`) only draws. Tests reproduce the research specification's numerical checks. See the Model & limits page.

## Limitations

Synthetic waveforms with illustrative seed values; an ideal linear measurement model whose fault effects are
directional teaching values; a schematic bedside. Not validated for clinical use; educational effect not evaluated.

## Licence and citation

MIT (see `LICENSE`). Cite via `CITATION.cff` (a DOI will be added with the first Zenodo release).
