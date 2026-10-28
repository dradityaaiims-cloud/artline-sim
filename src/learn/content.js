// Learn-tab content as data. Block types:
//   {p: 'text'}  {h: 'subheading'}  {ul: [...]}  {note: 'callout'}
//   {table: {head: [...], rows: [[...]], go: colIndex?}}   (go => "Show in sim" button; the cell holds a patient id)
// Facts follow ADI's arterial line research specification (2026) and the sources it cites; numbers are teaching values.

export const SECTIONS = [
  {
    id: 'start', title: 'Start here: using the simulator',
    blocks: [
      { p: 'This simulator teaches the arterial pressure measurement system: a radial catheter, fluid-filled tubing, a transducer and a monitor. The patient\'s true pressure and the pressure the monitor displays are two separate signals, and every fault is a transformation between them. Your job is to recognise when the displayed trace no longer reflects the patient, and to fix it. It is for education only: it is not a medical device and contains no patient data.' },
      { h: 'The screen' },
      { ul: [
        'Left: the monitor. Green is the ECG, red is the displayed arterial pressure, and the numbers on the right are SBP/DBP with the MAP in brackets, measured over the last 4 seconds (as on a bedside monitor, they pause for a moment after a flush).',
        'T overlays the patient\'s true pressure as a dashed white line. B shades spontaneous inspiration. K adds a caliper; double-click to pin a second line and read the interval and frequency.',
        'Right: the bedside in 3D. The green dashed line is the phlebostatic axis; the orange dashed line marks the transducer height when it is off-level. Drag the transducer up and down, click the blue stopcock to turn it, drag elsewhere to rotate.',
        'Below the bedside: the fast-flush button, the stopcock, Zero, the transducer height, and the fix buttons.',
        'Bottom: the mode panel (patients, faults, questions, checklist, cases and scores).',
      ] },
      { h: 'Controls' },
      { table: { head: ['Key', 'What it does', 'At the bedside'], rows: [
        ['X (hold)', 'Fast flush, then release', 'Pull the flush device tab, then let go'],
        ['O', 'Stopcock: to the patient / open to air', 'Turn the transducer stopcock'],
        ['Z', 'Zero', 'Press Zero on the monitor with the stopcock open to air'],
        ['W / S', 'Transducer up / down 1 cm', 'Move the transducer on its pole mount'],
        ['T, B, K, F', 'True pressure, breath shading, caliper, freeze', ''],
        ['P', 'PDF report with waveform strips and the event log', 'The printed record'],
        ['Enter, 1–4', 'Record / finish / next; quiz answers', ''],
      ] } },
      { h: 'Modes' },
      { ul: [
        'Free explore: any patient, central or radial catheter, any heart rate, and every fault, alone or together.',
        'Read the trace: name the damping from a flush test, name the pulse from its shape, and predict what a fault does to SBP, DBP and MAP.',
        'Set up the line: prepare a new line from scratch (bag, prime, level, zero, flush test) and record a true reading.',
        'Troubleshoot the line: twelve cases of rising difficulty, including traps where the trace is the patient, not the system. Scored out of 100 with feedback.',
      ] },
    ],
  },
  {
    id: 'chain', title: 'The measurement chain',
    blocks: [
      { p: 'An arterial pressure measurement is a chain, and every link can fail.' },
      { table: { head: ['Link', 'What it does', 'Failure mode'], rows: [
        ['Catheter (20 G radial commonly recommended)', 'Couples the artery to the fluid column', 'Whip, end-pressure and impact artefacts (central catheters), clot'],
        ['Tubing (wide-bore, stiff, ≤ 122 cm)', 'Transmits the pressure', 'Air bubbles, kinks, long or compliant tubing (change the damping and the natural frequency)'],
        ['Pressure bag and flush (300 mmHg, 1–3 mL/h)', 'Keeps the column patent, prevents backflow', 'Low bag pressure → backflow → clot → overdamping'],
        ['Transducer and stopcock', 'Converts pressure to an electrical signal', 'Levelling error, zero drift'],
        ['Monitor', 'Filters, samples and displays', 'Calibration or channel errors'],
      ] } },
      { h: 'Set-up rules (adult)' },
      { ul: [
        'Pressure bag at 300 mmHg; continuous flush 1–3 mL/h, non-heparinised (heparin is avoided because of the risk of HIT antibodies).',
        'A 20 G radial catheter: less underdamping and fewer complications than 18 G.',
        'Wide-bore, high-pressure tubing, no longer than about 122 cm (48 in).',
        'Level the transducer to the phlebostatic axis: 4th intercostal space, mid-axillary line (the right atrium).',
      ] },
      { note: 'These are cited adult recommendations (the 5-step review in Critical Care 2020, StatPearls, REBEL EM), not universal specifications. Follow local protocol.' },
      { h: 'Before cannulation: the Allen test' },
      { p: 'The modified Allen test has poor diagnostic accuracy and does not reliably predict ischaemic complications after radial cannulation; adding pulse oximetry, plethysmography or Doppler does not substantially improve it. That is a statement about the test\'s properties. Whether and how to assess collateral circulation is a separate decision, made by local practice.' },
    ],
  },
  {
    id: 'zero', title: 'Zeroing versus levelling',
    blocks: [
      { p: 'These are two different acts, and the simulator keeps them separate. Neither fixes the other.' },
      { table: { head: ['', 'Zeroing', 'Levelling'], rows: [
        ['What it fixes', 'The transducer\'s own offset (atmospheric reference, drift)', 'The hydrostatic reference (the weight of the fluid column)'],
        ['How', 'Stopcock off to the patient and open to air; press Zero until 0 displays; turn it back to the patient', 'Put the transducer (its air-fluid interface) at the phlebostatic axis'],
        ['Kind of act', 'Calibration on the monitor', 'Geometry: the stopcock height'],
        ['Error it leaves if skipped', 'Any offset, same on SBP, DBP and MAP', '0.75 mmHg per cm, same on SBP, DBP and MAP'],
      ] } },
      { h: 'Hydrostatic error' },
      { ul: [
        '10 cm of height difference ≈ 7.5 mmHg; 2.5 cm ≈ 1.9 mmHg: about 0.75 mmHg per cm.',
        'Transducer below the axis → reads falsely high. Above the axis → falsely low.',
        'The bed moved after levelling, with the transducer clamped to the pole, is the classic way to get this wrong.',
      ] },
      { note: 'A whole-trace shift with a normal shape and a normal flush test is levelling or zeroing, not damping. Re-zero (open to air) and re-level to tell them apart. "Trust the MAP" does not apply: these faults shift the MAP too.' },
      { h: 'Monitoring cerebral perfusion' },
      { p: 'In some neurosurgical settings the vessel of interest is the circle of Willis, and the transducer is referenced at the base of the brain (about the external auditory meatus), per protocol. That is a cerebral-perfusion choice in specific contexts, not a rule for every seated or neurological patient.' },
    ],
  },
  {
    id: 'wave', title: 'Waveform anatomy',
    blocks: [
      { p: 'The arterial pulse has a rapid systolic upstroke (the anacrotic limb), a systolic peak (SBP), a downslope interrupted by the dicrotic notch (aortic valve closure), a dicrotic wave, and a diastolic run-off down to the diastolic nadir (DBP). On the radial line the upstroke arrives about 160–180 ms after the R wave (one source\'s observation); the caliper (K) measures it.' },
      { p: 'MAP is the area under the pressure curve divided by the beat duration. (SBP + 2·DBP)/3 approximates it at normal heart rates. The monitor in this simulator uses the true time average.' },
      { h: 'Central versus peripheral' },
      { p: 'From the aorta to the radial artery the systolic pressure rises and the upstroke steepens (reflected waves summing in the distal arteries), while the dicrotic notch becomes softer and later. The MAP changes little. Here the radial SBP is about 11 mmHg above the central aortic SBP with the MAP within about 1 mmHg; real amplification varies between patients and states. It is not a fault: recognise it. Switch the catheter to "Central aorta" in Free explore to compare.' },
      { note: 'The classic pulse shapes (next sections) come largely from carotid pulse examination. They are recognisable on radial traces, but the correspondence is approximate.' },
    ],
  },
  {
    id: 'dynamic', title: 'Dynamic response and the flush test',
    blocks: [
      { p: 'The catheter-tubing-transducer system behaves as a second-order system with a natural frequency fn (how fast it wants to oscillate) and a damping coefficient ζ (how quickly the oscillations die). The displayed pressure x follows the input u by x″ = ωn²(u − x) − 2ζωn·x′, with ωn = 2πfn.' },
      { ul: [
        'Damped frequency fd = fn·√(1 − ζ²): the interval between ringing peaks gives fd, which equals fn only when ζ is small. At ζ = 0.64 a 50 ms interval (fd 20 Hz) means fn ≈ 26 Hz.',
        'Gain |H| = 1/√((1 − r²)² + (2ζr)²), r = f/fn. At ζ = 0.64 the gain stays within about 2% up to r = 2/3, so the useful bandwidth is about two thirds of fn.',
        'ζ ≈ 0.64 is described as optimal; ζ = 1 is critically damped (no overshoot).',
        'Real clinical systems measure fn 12–25 Hz and ζ 0.12–0.33: typically underdamped.',
        'How high fn must be is quoted variously: above about 24 Hz to resolve the dicrotic notch (one teaching source), or as a multiple of the highest significant harmonic of the pulse. Treat it as a range.',
      ] },
      { h: 'The fast-flush (square-wave) test' },
      { p: 'Open the flush valve briefly: the trace snaps up to the bag pressure and plateaus. Release it: the trace snaps back, and the ringing after release is the system\'s own natural response.' },
      { table: { head: ['After release', 'Interpretation', 'Next step'], rows: [
        ['1–2 oscillations', 'Adequate damping', 'None, but check the shape and the frequency too'],
        ['More than 2', 'Underdamped (resonance)', 'Find the cause: extra or compliant tubing; consider a damping device'],
        ['Less than 1 (slurred return)', 'Overdamped', 'Find the cause: kink, air, clot, low bag'],
      ] } },
      { note: 'Cutoffs differ slightly between sources: 1–2 oscillations optimal per REBEL EM and StatPearls (the convention used here), 1.5–2 per OpenAnesthesia. The count is a heuristic, not proof of an adequate response: a small bubble can give an "adequate" count at a low natural frequency. Read the ringing interval (caliper) and the trace shape as well.' },
      { h: 'How the simulator counts' },
      { p: 'So that counts are reproducible: positive peaks more than 1 mmHg above the baseline within 0.6 s of release, merging detections under 50 ms apart, after a step of 200 mmHg. With this method an underdamped system (fn 10 Hz, ζ 0.15) gives 5, an optimal one (15 Hz, 0.64) gives 1 and an overdamped one (8 Hz, 1.5) gives 0. In Free explore the flush box also reads fd, ζ (from the ratio of the first two peaks) and fn from the ringing.' },
    ],
  },
  {
    id: 'damping', title: 'What damping does to the numbers',
    blocks: [
      { table: { head: ['Condition', 'SBP', 'DBP', 'MAP', 'Appearance'], rows: [
        ['Underdamped', 'Overestimated (by 28.5 ± 15.9 mmHg in one study; by 2.6 ± 1.9 mmHg even in systems meeting Gardner\'s criteria)', 'Underestimated', 'Less affected', 'Systolic overshoot with a narrow peak, non-physiological diastolic oscillation'],
        ['Overdamped', 'Underestimated', 'Overestimated (most sources); "usually accurate" (StatPearls)', 'Less affected', 'Slurred upstroke, lost dicrotic notch, narrow pulse pressure'],
      ] } },
      { note: 'Sources disagree on the overdamped DBP. In this simulator\'s linear model the DBP rises only a little (under 1 mmHg) when the line is overdamped, and the MAP barely moves at all: that is a property of an ideal model with unity gain, not evidence either way. The clinical claim that MAP is less affected rests on the literature, which says "not impacted", "not significantly affected" or "largely unchanged". The middle reading is used here.' },
      { h: 'Which number to trust' },
      { p: 'With isolated dynamic-response distortion, MAP is generally less affected than SBP and DBP, and one review advises basing decisions on MAP when the trace looks hyper-resonant or overdamped. This does not protect you from levelling or zero errors, which shift MAP too. When any part of the system is suspect, troubleshoot and corroborate (for example with a cuff pressure) rather than trusting any single displayed number.' },
      { h: 'Causes, and system versus input' },
      { ul: [
        'Overdamping: clots, kinks, clamped tubing, air bubbles, narrow, long or compliant tubing.',
        'Underdamping: long or compliant extension tubing, a resonant system (many stiff, short set-ups ring).',
        'Tachycardia changes the input\'s frequency content, not the system\'s damping. Try 140/min in Free explore with extension tubing.',
        'Catheter whip adds a motion artefact; it does not change the damping ratio.',
        'Shorter, wider, stiffer tubing raises the natural frequency: the right direction. Deliberately adding length, compliance or air is not a safe remedy; a small bubble adds damping but lowers fn. A sealed-bubble damping device adds damping without lowering fn.',
      ] },
    ],
  },
  {
    id: 'artefacts', title: 'Artefacts: keep them distinct',
    blocks: [
      { table: { head: ['Artefact', 'Mechanism', 'Trace', 'Numbers', 'Fix'], rows: [
        ['Hydrostatic (levelling) error', 'Transducer above or below the axis', 'Whole trace shifted, shape intact', '~0.75 mmHg/cm; 10 cm low → +7.5 on SBP, DBP and MAP', 'Re-level'],
        ['Zero offset', 'Drift, or zeroed to the wrong reference', 'Whole trace shifted, normal flush test', 'Any size', 'Re-zero to atmosphere'],
        ['Catheter whip (advanced)', 'The catheter tip set in motion (described for PA catheters)', 'A sharp wave at the start of systole, confined to systole', 'Spuriously high SBP (synthetic seed here)', 'Reposition 1–2 cm and/or add damping'],
        ['End-pressure (advanced)', 'Flow stopping against an end hole turns kinetic energy into pressure', 'Higher with flow into the tip, lower facing downstream', '+2–4 mmHg with flow into the tip', 'Rotate or reposition; compare with a side hole'],
        ['Impact (not modelled)', 'The catheter struck by valves or structures', 'Transient spikes', 'Local spikes', 'Reposition'],
        ['Peripheral amplification', 'Reflected waves summing distally', 'Radial SBP > aortic SBP, steeper upstroke', 'Source-dependent', 'Not a fault'],
      ] } },
      { note: 'Whip, end-pressure and impact artefacts come from PA-catheter and cath-lab sources, so here they appear only with the central (femoral-to-aortic) catheter. Their magnitudes are not universal constants for radial lines.' },
      { h: 'Look-alikes' },
      { ul: [
        'Whip versus underdamping: whip is confined to systole and resolves when the catheter is repositioned; underdamping rings throughout and shows on the flush test.',
        'Levelling versus zero offset: both shift the trace uniformly. Re-zeroing fixes only the offset; re-levelling fixes only the height.',
        'Overdamping versus aortic stenosis or bradycardia: the flush test is abnormal only when the system is the problem.',
      ] },
    ],
  },
  {
    id: 'variants', title: 'Pulse variants',
    blocks: [
      { p: 'Each variant is a patient (morphology and seed values), not a fault. The seed values are illustrative. "Show in sim" opens it in Free explore.' },
      { table: { head: ['Pulse', 'Signature', 'Seed values', 'Association', ''], go: 4, rows: [
        ['Normal radial', 'Rapid upstroke, sharp peak, dicrotic notch, smooth decay', '120/80, MAP ~95', '—', 'normal'],
        ['Pulsus parvus et tardus', 'Slow upstroke, late rounded low peak, sustained systole', '~98/78 (pulse pressure ~20)', 'Severe aortic stenosis; absence does not exclude it in elderly stiff arteries', 'as'],
        ['Pulsus bisferiens', 'Two systolic peaks with a mid-systolic dip, rapid collapse', '~120/55', 'Aortic regurgitation, AS + AR; a HOCM variant exists', 'ar'],
        ['Spike-and-dome', 'Sharp early spike, then a secondary dome', 'SBP ~125', 'HOCM', 'hocm'],
        ['Pulsus alternans', 'Regular RR, alternating strong and weak beats', 'SBP 130 / 113', 'Severe LV systolic dysfunction', 'alternans'],
        ['Pulsus paradoxus', 'Inspiratory fall in SBP > 10 mmHg (spontaneous breathing)', '108 expiration, 96 inspiration', 'Tamponade; also asthma, COPD, SVC obstruction', 'paradoxus'],
        ['Bradycardia, wide pulse pressure', 'Long diastolic run-off; can mimic slurring', '145/60 at 45/min', 'Confounder for overdamping', 'brady'],
      ] } },
      { note: 'Alternans keeps the RR strictly regular, which tells it apart from bigeminy. Paradoxus must be read over complete breaths: press B to shade inspiration. (Real alternans is accentuated after a PVC; ectopy is not modelled here.)' },
    ],
  },
  {
    id: 'trouble', title: 'Troubleshooting systematically',
    blocks: [
      { ul: [
        '1. Look at the trace: is the shape distorted, or the whole trace shifted?',
        '2. Fast-flush test: count the oscillations and read the interval.',
        '3. Shape distorted with an abnormal flush test → the system\'s dynamics. Overdamped: unkink the tubing, remove visible air, check the bag is at 300 mmHg, clear a suspected clot per protocol. Underdamped: remove extra tubing; consider a damping device.',
        '4. Trace shifted, normal flush test → zero (open to air) and level (to the axis).',
        '5. Odd shape with a normal flush test → probably the patient. Do not "fix" it.',
        '6. Repeat the flush test to confirm, and corroborate with a cuff pressure if in doubt.',
      ] },
      { note: 'In the Troubleshoot cases a fix that changes nothing costs points. That is deliberate: acting before diagnosing is how lines get worse.' },
    ],
  },
  {
    id: 'sources', title: 'Sources',
    blocks: [
      { ul: [
        'Arterial catheterisation: a 5-step review. Critical Care 2020 (doi:10.1186/s13054-020-02859-w).',
        'StatPearls: Arterial lines / arterial pressure monitoring (NBK499989).',
        'OpenAnesthesia: Arterial blood pressure monitoring.',
        'REBEL EM: Damping and arterial lines.',
        'Deranged Physiology: Arterial line dynamic response testing.',
        'Intraoperative invasive blood pressure pitfalls review (Cureus, PMC8483407).',
        'Central-to-peripheral pressure amplification review (PMC10598655).',
        'Contemporary pulmonary artery catheter use, Part 1 (PMC8894225): catheter whip.',
        'Clinical Methods (3rd ed.): The carotid pulse (NBK312).',
        'emresident: Device series, arterial lines part 2. Thoracic Key and Cleveland Clinic board review: cath-lab artefacts.',
      ] },
      { p: 'Compiled in the author\'s research specification for this simulator. Seed values and synthetic figures are illustrative and unvalidated.' },
    ],
  },
];
