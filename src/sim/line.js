// The measurement system: catheter → tubing → transducer → monitor. Pure logic, no rendering.
// The patient's true pressure and the displayed pressure are separate signals; every fault is a
// transformation between them (spec: "model the measurement chain, not just the patient").
//  - Dynamic response: a second-order system x'' = ωn²(u − x) − 2ζωn x', integrated with semi-implicit
//    Euler in 0.1 ms sub-steps (forward Euler would be unstable for small ζ at coarse steps).
//  - Hydrostatic error: 0.75 mmHg per cm the transducer sits below the phlebostatic axis (10 cm = 7.5 mmHg).
//  - Zero offset: transducer drift until it is zeroed to atmosphere (stopcock off to the patient, open to air).
//  - Advanced (central catheter only): catheter whip and end-pressure artefact, added at the tip.
import { pressureAt, systoleAge, timing } from './patient.js';

export const MMHG_PER_CM = 0.75;
export const BAG_OK = 300;
// A well set-up adult radial line: 20 G catheter, ≤ 122 cm stiff tubing. Clinical systems measure
// fn 12–25 Hz and ζ 0.12–0.33; this one is at the good end and passes the flush test (2 oscillations).
export const BASE = { fn: 24, zeta: 0.32 };

// Each fault's effect on (fn, ζ) is a teaching approximation that follows the cited directions, not a fluid model.
export const FAULTS = {
  kink: { name: 'Kinked or clamped tubing', kind: 'over', fix: 'straighten',
    clue: 'Slurred upstroke, lost dicrotic notch, narrow pulse pressure; the flush test returns slowly with no oscillation.' },
  airLarge: { name: 'Large air bubble in the line', kind: 'over', fix: 'deair',
    clue: 'Overdamped: blunted peaks and no notch. A bubble also lowers the natural frequency.' },
  airSmall: { name: 'Small air bubble in the line', kind: 'lowfn', fix: 'deair',
    clue: 'The bubble adds damping but lowers the natural frequency: the flush test may still show 1–2 oscillations, but the ringing is slow (long interval between peaks) and the trace is distorted. Count and frequency must be read together.' },
  clot: { name: 'Clot at the catheter tip', kind: 'over', fix: 'declot',
    clue: 'Overdamped trace that worsens over time; often after a low or empty pressure bag.' },
  extension: { name: 'Long, compliant extension tubing added', kind: 'under', fix: 'shorten',
    clue: 'Underdamped: systolic overshoot with a narrow peak and more than 2 oscillations on the flush test, at a low frequency.' },
  resonant: { name: 'Resonant (underdamped) but intact system', kind: 'under', fix: 'damper',
    clue: 'Ringing and systolic overshoot with no kink, air, clot or extra tubing. A sealed-bubble damping device adds damping without lowering the natural frequency.' },
};

export const FIXES = {
  straighten: 'Straighten the tubing / open the clamp',
  deair: 'Remove air: aspirate through the stopcock and flush',
  declot: 'Aspirate the clot and flush, per protocol',
  shorten: 'Remove the extra extension tubing',
  damper: 'Add a sealed-bubble damping device',
  bag: 'Re-inflate the pressure bag to 300 mmHg',
  level: 'Level the transducer to the phlebostatic axis',
  zero: 'Zero to atmosphere',
  reposition: 'Reposition the catheter 1–2 cm (central line)',
};

/** A fresh, correct system. txH and axisH are heights (cm) above the floor reference; drift is mmHg. */
export const freshSystem = () => ({
  kink: false, airSmall: false, airLarge: false, clot: false, extension: false, resonant: false, damper: false,
  bag: BAG_OK, txH: 0, axisH: 0, drift: 0, zeroCorr: 0, stopcock: 'patient', whip: false, endHole: false,
});

/** Natural frequency (Hz) and damping ratio of the current system. */
export function dynamics(sys) {
  let fn = BASE.fn, z = BASE.zeta;
  if (sys.resonant) z = 0.12;
  if (sys.extension) { fn *= 0.5; z *= 0.6; }
  if (sys.airSmall) { fn *= 0.45; z += 0.15; }
  if (sys.damper) z += 0.3; // sealed-bubble stub: more damping, natural frequency kept
  if (sys.airLarge) { fn *= 0.35; z = Math.max(z, 1.4); }
  if (sys.clot) { fn *= 0.6; z = Math.max(z, 1.5); }
  if (sys.kink) { fn *= 0.7; z = Math.max(z, 2); }
  return { fn, zeta: z };
}

/** mmHg added to every displayed value by the transducer height: positive when it is below the axis. */
export const hydrostatic = (sys) => MMHG_PER_CM * (sys.axisH - sys.txH);
/** Constant offset (mmHg) on the display when open to the patient: hydrostatic + uncorrected drift. */
export const offsetOf = (sys) => hydrostatic(sys) + sys.drift + sys.zeroCorr;

/** Second-order fluid-filled line. step(u, dt) returns the transduced pressure. */
export class Line {
  constructor(fn = BASE.fn, zeta = BASE.zeta) { this.set(fn, zeta); this.x = null; this.v = 0; }
  set(fn, zeta) { this.wn = 2 * Math.PI * fn; this.z = zeta; }
  step(u, dt) {
    if (this.x === null) { this.x = u; this.v = 0; }
    const n = Math.max(1, Math.ceil(dt / 1e-4)), h = dt / n, { wn, z } = this;
    for (let i = 0; i < n; i++) { this.v += (wn * wn * (u - this.x) - 2 * z * wn * this.v) * h; this.x += this.v * h; }
    return this.x;
  }
}

/** Pressure added at the catheter tip by artefacts (central catheter only). */
export function tipArtefact(pt, sys, t, opts) {
  if (opts.site !== 'aortic') return 0;
  const age = systoleAge(pt, t, opts), et = timing(opts.hr ?? pt.hr).et;
  let a = 0;
  // whip: a sharp decaying 12 Hz oscillation on each systolic upstroke (synthetic seed; spec check: whip SBP ~ +11)
  if (sys.whip) a += 22 * Math.sin(2 * Math.PI * 12 * age) * Math.exp(-age / 0.12);
  // end-pressure: kinetic energy of flow into an end hole adds ~3 mmHg at peak flow (half-sine over ejection)
  if (sys.endHole && age < et) a += 3 * Math.sin((Math.PI * age) / et);
  return a;
}

/** The input to the fluid column at time t: the true pressure plus tip artefacts, or the bag when flushing. */
export function inputAt(pt, sys, t, { flushing = false, ...opts } = {}) {
  if (sys.stopcock === 'air') return 0;
  if (flushing) return sys.bag;
  return pressureAt(pt, t, opts) + tipArtefact(pt, sys, t, opts);
}

/** What the monitor shows, given the line's output x: offsets apply only when open to the patient. */
export const displayed = (sys, x) => x + (sys.stopcock === 'air' ? sys.drift + sys.zeroCorr : offsetOf(sys));

/** Zero to atmosphere: only accepted with the stopcock open to air (monitors refuse a pulsatile signal). */
export function zero(sys, x = 0) {
  if (sys.stopcock !== 'air') return { ok: false, reason: 'Zero refused: the transducer still sees the patient\'s pulsatile pressure. Turn the stopcock off to the patient and open it to air first.' };
  sys.zeroCorr = -(sys.drift + x);
  return { ok: true };
}

/**
 * Flush-test oscillation count, by a fixed method so it is reproducible (spec): drive the system from a
 * settled plateau `step` mmHg above baseline back to baseline, then count positive local maxima more than
 * `thr` mmHg above the baseline within `win` s of release, merging detections under 50 ms apart.
 */
export function flushTest(fn, zeta, { step = 200, win = 0.6, thr = 1, dt = 1e-4 } = {}) {
  const line = new Line(fn, zeta); line.x = step; line.v = 0;
  const peaks = [];
  let a = step, b = step;
  for (let t = dt; t <= win; t += dt) {
    const c = line.step(0, dt);
    if (b > a && b >= c && b > thr && !(peaks.length && t - dt - peaks.at(-1).t < 0.05)) peaks.push({ t: t - dt, p: b });
    a = b; b = c;
  }
  const count = peaks.length;
  return { count, peaks, verdict: verdictOf(count) };
}
/** "1–2 oscillations optimal" (REBEL EM, StatPearls); > 2 underdamped; < 1 overdamped. */
export const verdictOf = (count) => (count > 2 ? 'under' : count < 1 ? 'over' : 'adequate');
export const VERDICTS = { adequate: 'Adequate damping (1–2 oscillations)', under: 'Underdamped (more than 2 oscillations)', over: 'Overdamped (less than 1 oscillation)' };

/**
 * Reading the ringing: the peak interval gives the damped frequency fd; the ratio of successive peaks
 * gives ζ (logarithmic decrement); fn = fd / √(1 − ζ²). Needs at least two peaks.
 */
export function analyseRinging(peaks) {
  if (peaks.length < 2) return null;
  const [p1, p2] = peaks, fd = 1 / (p2.t - p1.t), dl = Math.log(p1.p / p2.p);
  const zeta = dl / Math.sqrt(4 * Math.PI * Math.PI + dl * dl);
  return { intervalMs: (p2.t - p1.t) * 1000, fd, zeta, fn: fd / Math.sqrt(1 - zeta * zeta) };
}

/** Displayed SBP/DBP/MAP for a patient and system, from a settled simulation over whole breaths. */
export function measureDisplayed(pt, sys, { site = 'radial', hr = pt.hr, secs = 9, settle = 3, fs = 2000 } = {}) {
  const { fn, zeta } = dynamics(sys), line = new Line(fn, zeta), dt = 1 / fs, ps = [], ts = [];
  for (let t = 0; t < settle + secs; t += dt) {
    const y = displayed(sys, line.step(inputAt(pt, sys, t, { site, hr }), dt));
    if (t >= settle) { ps.push(y); ts.push(pressureAt(pt, t, { site, hr })); }
  }
  const sum = (a) => { let s = -Infinity, d = Infinity, m = 0; for (const p of a) { s = Math.max(s, p); d = Math.min(d, p); m += p; } return { sbp: s, dbp: d, map: m / a.length }; };
  return { shown: sum(ps), truth: sum(ts) };
}
