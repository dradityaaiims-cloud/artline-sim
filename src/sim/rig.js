// The bedside rig in real time: patient + measurement system + flush valve, stepped by the app loop.
// Pure (no DOM), so modes and tests can drive it. Samples are {t, ecg, p (displayed), truth, flush}.
import { patient, pressureAt, ecgAt, inspiration } from './patient.js';
import { Line, dynamics, freshSystem, inputAt, displayed, zero, flushTest, BAG_OK } from './line.js';

export const FS = 500;            // monitor samples per second (shows 20 Hz ringing cleanly)
export const CLOT_SECS = 25;      // a bag under 200 mmHg lets blood back up and clot in about this long
export const AXIS_CM = 100;       // phlebostatic axis height above the floor with the bed at its default height

export class Rig {
  constructor() { this.reset(); }
  reset(pt = patient('normal')) {
    this.pt = pt; this.site = 'radial'; this.hr = null; this.t = 0; this.next = 0;
    this.sys = { ...freshSystem(), txH: AXIS_CM, axisH: AXIS_CM };
    this.line = new Line(); this.flushing = false; this.flushes = []; this.lowBagSecs = 0; this.events = [];
  }
  get opts() { return { site: this.site, hr: this.hr ?? this.pt.hr }; }
  get dyn() { return dynamics(this.sys); }
  /** Advance time by dt, returning the monitor samples produced. */
  step(dt) {
    const out = [], { fn, zeta } = this.dyn;
    this.line.set(fn, zeta);
    this.lowBagSecs = this.sys.bag < 200 ? this.lowBagSecs + dt : 0;
    if (this.lowBagSecs > CLOT_SECS && !this.sys.clot) { this.sys.clot = true; this.note('A clot has formed at the catheter tip (pressure bag too low).'); }
    for (this.t += dt; this.next <= this.t; this.next += 1 / FS) {
      const t = this.next, o = this.opts, x = this.line.step(inputAt(this.pt, this.sys, t, { ...o, flushing: this.flushing }), 1 / FS);
      out.push({ t, ecg: ecgAt(this.pt, t, o), p: displayed(this.sys, x), truth: pressureAt(this.pt, t, o), flush: this.flushing, insp: inspiration(t) });
    }
    return out;
  }
  /** Open (true) or release (false) the fast-flush valve. Releasing records a flush test. */
  flush(on) {
    if (on === this.flushing) return null;
    this.flushing = on;
    if (on) return null;
    const { fn, zeta } = this.dyn, r = { t: this.t, fn, zeta, ...flushTest(fn, zeta), bag: this.sys.bag, stopcock: this.sys.stopcock };
    this.flushes.push(r);
    return r;
  }
  zero() { return zero(this.sys, this.line.x ?? 0); }
  setStopcock(s) { this.sys.stopcock = s; }
  /** Apply a fix; returns true if it changed anything (unneeded fixes cost points in the game). */
  fix(id) {
    const s = this.sys, before = JSON.stringify(s);
    if (id === 'straighten') s.kink = false;
    else if (id === 'deair') { s.airSmall = false; s.airLarge = false; }
    else if (id === 'declot') s.clot = false;
    else if (id === 'shorten') s.extension = false;
    else if (id === 'damper') s.damper = true;
    else if (id === 'bag') { s.bag = BAG_OK; this.lowBagSecs = 0; }
    else if (id === 'level') s.txH = s.axisH;
    else if (id === 'reposition') { s.whip = false; s.endHole = false; }
    return JSON.stringify(s) !== before;
  }
  note(text) { this.events.push({ t: this.t, text }); }
}

/** Monitor numerics over the last `win` s, ignoring the flush and the 1.5 s after it (as a monitor
 *  re-learns after a flush). Returns null when there is not one clean beat to measure. */
export function numerics(samples, now, win = 4) {
  let lastFlush = -Infinity;
  for (const s of samples) if (s.flush) lastFlush = s.t;
  const use = samples.filter((s) => s.t > now - win && s.t > lastFlush + 1.5);
  if (use.length < FS * 1.2) return null;
  let sbp = -Infinity, dbp = Infinity, m = 0;
  for (const s of use) { sbp = Math.max(sbp, s.p); dbp = Math.min(dbp, s.p); m += s.p; }
  return { sbp: Math.round(sbp), dbp: Math.round(dbp), map: Math.round(m / use.length) };
}
