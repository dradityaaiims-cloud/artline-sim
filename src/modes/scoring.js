// Pure case, question and scoring logic for the modes (testable in Node).
import { PATIENTS, patient } from '../sim/patient.js';
import { dynamics, flushTest, verdictOf, offsetOf, VERDICTS, BAG_OK } from '../sim/line.js';

export const DIAGNOSES = {
  level: 'Transducer not level with the phlebostatic axis',
  zero: 'Zero offset (transducer not zeroed)',
  kink: 'Kinked or clamped tubing',
  airLarge: 'Large air bubble',
  airSmall: 'Small air bubble (low natural frequency)',
  clot: 'Clot at the tip (low pressure bag)',
  extension: 'Long, compliant extension tubing',
  resonant: 'Resonant system (needs a damping device)',
  whip: 'Catheter whip (central line)',
  none: 'No system fault: the trace is the patient',
};

// Game cases, in order of difficulty. setup(sys) breaks the system; answer = the faults present.
export const CASES = [
  { id: 'low', title: 'The night nurse calls: "the pressure jumped up 8 points"', pt: 'normal', answer: ['level'],
    story: 'Post-operative patient, comfortable. The trace looks the same shape as before, just higher.', setup: (s) => { s.txH = s.axisH - 10; } },
  { id: 'drift', title: 'A new monitor module after transfer', pt: 'normal', answer: ['zero'],
    story: 'The patient arrived from theatre and the cable was moved to a new monitor. The transducer is at the axis.', setup: (s) => { s.drift = 15; } },
  { id: 'kink', title: 'Hypotension after repositioning the arm', pt: 'normal', answer: ['kink'],
    story: 'The wrist was re-taped and the SBP now reads in the low 110s. The patient looks well.', setup: (s) => { s.kink = true; } },
  { id: 'ext', title: 'A transfer to CT and back', pt: 'normal', answer: ['extension'],
    story: 'An extra length of tubing was added for the scanner. The SBP now seems higher.', setup: (s) => { s.extension = true; } },
  { id: 'as', title: 'An elderly patient with a soft, slow pulse', pt: 'as', answer: ['none'],
    story: 'The trace is rounded with a slow upstroke and a small pulse pressure. Is the line overdamped?', setup: () => {} },
  { id: 'bed', title: 'The bed was raised for a dressing change', pt: 'normal', answer: ['level'],
    story: 'The transducer is clamped to the IV pole. Since the bed went up, the pressures look lower.', setup: (s) => { s.axisH += 15; } },
  { id: 'clot', title: 'The trace has been fading for an hour', pt: 'normal', answer: ['clot'],
    story: 'The pressure bag has not been checked since the last shift.', setup: (s) => { s.bag = 150; s.clot = true; } },
  { id: 'res', title: 'A brand new, very responsive set-up', pt: 'normal', answer: ['resonant'],
    story: 'Short stiff tubing, no air, no kinks, everything new: and yet the systolic looks too spiky.', setup: (s) => { s.resonant = true; } },
  { id: 'brady', title: 'A slow heart rate and a slurred-looking trace', pt: 'brady', answer: ['none'],
    story: 'Heart rate 45 after beta-blockade. The long diastolic run-off looks slurred. Overdamped?', setup: () => {} },
  { id: 'small', title: 'The flush test "passes" but something is off', pt: 'normal', answer: ['airSmall'],
    story: 'The line was re-primed in a hurry. The notch looks smoothed out.', setup: (s) => { s.airSmall = true; } },
  { id: 'whip', title: 'Femoral arterial catheter in the cath lab (advanced)', pt: 'normal', site: 'aortic', answer: ['whip'],
    story: 'A long catheter sits in the central aorta. Sharp waves appear at the start of every systole.', setup: (s) => { s.whip = true; } },
  { id: 'combo', title: 'Two problems at once', pt: 'paradoxus', answer: ['zero', 'level'],
    story: 'Tamponade is suspected. The transducer was knocked off its holder and nobody has zeroed since the module was swapped.', setup: (s) => { s.drift = -8; s.txH = s.axisH + 10; } },
];

/** Every fault removed, the bag at pressure, level and zeroed, open to the patient. */
export function isFixed(sys) {
  const faulty = ['kink', 'airSmall', 'airLarge', 'clot', 'extension', 'whip', 'endHole'].some((k) => sys[k]) || (sys.resonant && !sys.damper);
  return !faulty && sys.bag >= 250 && Math.abs(offsetOf(sys)) < 1.5 && sys.stopcock === 'patient';
}

/** run = {answer: [ids], picked: [ids], fixed, flushes, confirmFlush, unneeded, secs} → {total, parts, notes} */
export function scoreCase(c, run) {
  const want = new Set(c.answer), got = new Set(run.picked), both = [...want].filter((x) => got.has(x)).length;
  const union = new Set([...want, ...got]).size, j = union ? both / union : 0;
  const parts = {
    diagnosis: Math.round(30 * j),
    fixed: run.fixed ? 30 : 0,
    tested: run.flushes > 0 ? 10 : 0,
    confirmed: run.confirmFlush ? 10 : 0,
    economy: Math.max(0, 10 - 5 * run.unneeded),
    time: run.secs <= 120 ? 10 : run.secs <= 240 ? 5 : 0,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0), notes = [];
  if (j < 1) notes.push(`The fault${want.size > 1 ? 's were' : ' was'}: ${[...want].map((k) => DIAGNOSES[k]).join(' + ')}.`);
  if (!run.fixed) notes.push(want.has('none') ? 'This trace was the patient, and the system was left in a state that no longer reads true: the trace you hand over must reflect the patient.' : 'The system was not fully fixed: the displayed pressure still differs from the true pressure.');
  if (!run.flushes) notes.push('Start with a fast-flush test: it separates a damping problem (shape changes) from an offset problem (whole trace shifted, flush test normal).');
  else if (!run.confirmFlush && !want.has('none')) notes.push('Repeat the flush test after your fix to confirm the damping is now adequate.');
  if (run.unneeded) notes.push(`${run.unneeded} intervention${run.unneeded > 1 ? 's' : ''} changed nothing. Troubleshoot systematically: read the trace and the flush test before acting.`);
  if (want.has('level')) notes.push('Levelling and zeroing shift SBP, DBP and MAP alike, so "trust the MAP" does not protect you here.');
  if (want.has('none')) notes.push('A normal flush test with an abnormal shape points to the patient (here, the arterial waveform itself), not the system.');
  if (want.has('airSmall')) notes.push('The flush count can look adequate while the natural frequency is low: read the interval between ringing peaks too.');
  if (!notes.length) notes.push('Clean troubleshooting: flush test, correct diagnosis, the right fix and a confirming test.');
  return { total, parts, notes };
}

// ── quiz questions ───────────────────────────────────────────────────────
const pick = (a, rand) => a[Math.floor(rand() * a.length)];
const shuffle = (a, rand) => a.map((x) => [rand(), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);
export const FLUSH_SYSTEMS = { fresh: {}, extension: { extension: true }, resonant: { resonant: true }, kink: { kink: true }, airLarge: { airLarge: true }, clot: { clot: true }, damped: { resonant: true, damper: true } };

/** Flush test: the learner flushes and names the damping. */
export function flushQuestion(rand = Math.random) {
  const key = pick(Object.keys(FLUSH_SYSTEMS), rand), faults = FLUSH_SYSTEMS[key];
  const d = dynamics({ ...faults }), ft = flushTest(d.fn, d.zeta);
  return { type: 'flush', key, faults, answer: verdictOf(ft.count), count: ft.count, options: Object.keys(VERDICTS), label: (k) => VERDICTS[k] };
}

/** Name the pulse: a patient's morphology, four options. */
export function morphQuestion(rand = Math.random) {
  const p = pick(PATIENTS.filter((x) => x.id !== 'brady'), rand);
  const others = shuffle(PATIENTS.filter((x) => x.id !== p.id && x.id !== 'brady'), rand).slice(0, 3);
  return { type: 'morph', patient: p.id, answer: p.id, options: shuffle([p, ...others], rand).map((x) => x.id), label: (k) => patient(k).name };
}

export const EFFECTS = {
  up: 'SBP, DBP and MAP all about 7.5 mmHg higher',
  down: 'SBP, DBP and MAP all about 7.5 mmHg lower',
  under: 'SBP higher, DBP the same or lower, MAP about the same',
  over: 'SBP lower, DBP the same or slightly higher, MAP about the same',
};
export const PREDICT = [
  { text: 'The transducer slips 10 cm below the phlebostatic axis.', answer: 'up', faults: (s) => { s.txH = s.axisH - 10; } },
  { text: 'The bed is lowered 10 cm; the transducer stays clamped to the pole.', answer: 'down', faults: (s) => { s.axisH -= 10; } },
  { text: 'The transducer drifts +7.5 mmHg because it was never zeroed.', answer: 'up', faults: (s) => { s.drift = 7.5; } },
  { text: 'An extra 1.5 m of compliant extension tubing is added.', answer: 'under', faults: (s) => { s.extension = true; } },
  { text: 'A large air bubble collects in the transducer dome.', answer: 'over', faults: (s) => { s.airLarge = true; } },
  { text: 'The tubing is kinked under the patient\'s arm.', answer: 'over', faults: (s) => { s.kink = true; } },
  { text: 'The transducer is mounted 10 cm above the axis.', answer: 'down', faults: (s) => { s.txH = s.axisH + 10; } },
];
/** Predict the error: what a fault does to the displayed numbers. */
export function predictQuestion(rand = Math.random) {
  const q = pick(PREDICT, rand);
  return { type: 'predict', text: q.text, faults: q.faults, answer: q.answer, options: Object.keys(EFFECTS), label: (k) => EFFECTS[k] };
}
export function quizQuestion(rand = Math.random) {
  const r = rand();
  return r < 0.4 ? flushQuestion(rand) : r < 0.7 ? morphQuestion(rand) : predictQuestion(rand);
}

// ── "Set up the line" checklist ──────────────────────────────────────────
export const SETUP_STEPS = [
  ['bag', 'Pressure bag inflated to 300 mmHg'],
  ['prime', 'Line primed: no air in the tubing or transducer'],
  ['level', 'Transducer levelled to the phlebostatic axis (4th ICS, mid-axillary)'],
  ['air', 'Stopcock turned off to the patient, open to air'],
  ['zero', 'Zeroed to atmosphere'],
  ['patient', 'Stopcock back to the patient'],
  ['flush', 'Fast-flush test shows adequate damping'],
  ['record', 'Reading recorded (Enter) with the system correct'],
];
/** Which steps are done, from the rig state and what the learner did (flags: openedAir, zeroed, flushOK, recordedOK). */
export function setupDone(sys, flags) {
  return {
    bag: sys.bag >= BAG_OK, prime: !sys.airSmall && !sys.airLarge, level: Math.abs(sys.txH - sys.axisH) < 1,
    air: !!flags.openedAir, zero: !!flags.zeroed, patient: !!flags.zeroed && sys.stopcock === 'patient',
    flush: !!flags.flushOK, record: !!flags.recordedOK,
  };
}
/** 10 per step (80), 10 for no refused zero attempts or harm, 10 for time. */
export function scoreSetup(done, { refused = 0, secs = 0 } = {}) {
  const n = Object.values(done).filter(Boolean).length;
  const parts = { steps: n * 10, care: Math.max(0, 10 - 5 * refused), time: secs <= 150 ? 10 : secs <= 300 ? 5 : 0 };
  const notes = SETUP_STEPS.filter(([k]) => !done[k]).map(([, t]) => `Missed: ${t}.`);
  if (refused) notes.push('The monitor refused to zero while the transducer was open to the patient: zeroing needs the stopcock off to the patient and open to air.');
  if (!notes.length) notes.push('A complete, correct set-up: bag, prime, level, zero, flush test and a true reading.');
  return { total: parts.steps + parts.care + parts.time, parts, notes };
}
