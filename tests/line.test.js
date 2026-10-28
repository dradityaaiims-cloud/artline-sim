import test from 'node:test';
import assert from 'node:assert/strict';
import { patient, PATIENTS, trueStats, pressureAt, beatPressures, ecgAt, timing } from '../src/sim/patient.js';
import { Line, flushTest, verdictOf, analyseRinging, dynamics, freshSystem, measureDisplayed, FAULTS, zero, displayed, hydrostatic } from '../src/sim/line.js';

const still = (id) => ({ ...patient(id), resp: 0 });
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a.toFixed(2)} vs ${b} ±${tol}`);
const run = (pt, fn, z) => { const l = new Line(fn, z), ps = []; for (let t = 0; t < 10; t += 5e-4) { const y = l.step(pressureAt(pt, t), 5e-4); if (t > 3) ps.push(y); } return { sbp: Math.max(...ps), dbp: Math.min(...ps), map: ps.reduce((a, b) => a + b) / ps.length }; };

test('normal radial seed: 120/80, MAP ~95', () => {
  const s = trueStats(still('normal'));
  near(s.sbp, 120, 0.5, 'SBP'); near(s.dbp, 80, 0.5, 'DBP'); near(s.map, 95, 1.5, 'MAP');
});

test('pulse variants match the spec seeds', () => {
  const as = trueStats(still('as')), ar = trueStats(still('ar'));
  near(as.sbp - as.dbp, 20, 1, 'AS pulse pressure'); near(ar.sbp - ar.dbp, 65, 1, 'AR pulse pressure');
  const alt = still('alternans');
  near(beatPressures(alt, 0).s, 130, 0.1, 'alternans strong'); near(beatPressures(alt, 1).s, 113, 0.1, 'alternans weak');
  // paradoxus: SBP falls by 12 from end-expiration to peak inspiration
  const px = patient('paradoxus'), RR = 60 / px.hr, sbps = Array.from({ length: 40 }, (_, n) => beatPressures(px, n).s);
  near(Math.max(...sbps) - Math.min(...sbps), 12, 0.6, 'paradoxus fall'); near(Math.max(...sbps), 108, 0.6, 'expiratory SBP');
  assert.ok(RR > 0);
});

test('radial SBP exceeds aortic by ~11 with MAP within ~1.3', () => {
  const r = trueStats(still('normal')), a = trueStats(still('normal'), { site: 'aortic' });
  near(r.sbp - a.sbp, 11, 0.5, 'amplification'); near(r.map, a.map, 1.3, 'MAP');
});

test('radial upstroke 160 ms after the R wave', () => {
  const pt = still('normal'), T = timing(pt.hr);
  const ecgMaxT = [...Array(800).keys()].map((i) => i / 1000).reduce((b, t) => (ecgAt(pt, t) > ecgAt(pt, b) ? t : b), 0);
  near(ecgMaxT, T.tR, 0.002, 'R wave time');
  near(pressureAt(pt, T.tR + 0.16), 80, 0.3, 'foot at DBP');
});

test('spec check 1: damping errors have the cited direction and rough size', () => {
  const pt = still('normal');
  const under = run(pt, 10, 0.15), opt = run(pt, 15, 0.64), over = run(pt, 8, 1.5);
  assert.ok(under.sbp - 120 > 8, `underdamped SBP overestimated (${under.sbp})`); assert.ok(under.dbp <= 80.1, 'underdamped DBP not higher');
  near(opt.sbp, 120, 1.5, 'optimal SBP');
  assert.ok(over.sbp < 116, `overdamped SBP underestimated (${over.sbp})`); assert.ok(over.dbp >= 80, 'overdamped DBP slightly higher');
  for (const r of [under, opt, over]) near(r.map, 95, 1.5, 'MAP spared by damping');
});

test('spec check 2: flush-test counts 5 / 1 / 0 and the 1–2 convention', () => {
  assert.equal(flushTest(10, 0.15).count, 5); assert.equal(flushTest(15, 0.64).count, 1); assert.equal(flushTest(8, 1.5).count, 0);
  assert.equal(verdictOf(5), 'under'); assert.equal(verdictOf(2), 'adequate'); assert.equal(verdictOf(1), 'adequate'); assert.equal(verdictOf(0), 'over');
  const { fn, zeta } = dynamics(freshSystem()); assert.equal(flushTest(fn, zeta).verdict, 'adequate', 'a fresh system passes');
});

test('reading the ringing recovers fd, ζ and fn', () => {
  const r = analyseRinging(flushTest(10, 0.15).peaks);
  near(r.fd, 10 * Math.sqrt(1 - 0.15 ** 2), 0.15, 'fd'); near(r.zeta, 0.15, 0.01, 'ζ'); near(r.fn, 10, 0.2, 'fn');
});

test('every fault gives the flush verdict its kind implies', () => {
  for (const [k, f] of Object.entries(FAULTS)) {
    const { fn, zeta } = dynamics({ ...freshSystem(), [k]: true }), v = flushTest(fn, zeta).verdict;
    if (f.kind === 'over') assert.equal(v, 'over', k);
    if (f.kind === 'under') assert.equal(v, 'under', k);
    if (f.kind === 'lowfn') { assert.equal(v, 'adequate', `${k}: count passes`); assert.ok(fn < 15, `${k}: but fn is low`); }
  }
  const d = dynamics({ ...freshSystem(), resonant: true, damper: true });
  assert.equal(flushTest(d.fn, d.zeta).verdict, 'adequate', 'damper fixes resonance'); assert.equal(d.fn, dynamics(freshSystem()).fn, 'damper keeps fn');
});

test('spec check 3: 10 cm low adds +7.5 to SBP, DBP and MAP alike', () => {
  const pt = still('normal'), base = measureDisplayed(pt, freshSystem()).shown, low = measureDisplayed(pt, { ...freshSystem(), txH: -10 }).shown;
  for (const k of ['sbp', 'dbp', 'map']) near(low[k] - base[k], 7.5, 0.01, k);
  assert.ok(hydrostatic({ txH: 5, axisH: 0 }) < 0, 'above the axis reads low');
});

test('artefacts: whip and end-pressure raise SBP on the central line only', () => {
  const pt = still('normal'), ao = { site: 'aortic' }, base = measureDisplayed(pt, freshSystem(), ao).shown;
  const whip = measureDisplayed(pt, { ...freshSystem(), whip: true }, ao).shown, eh = measureDisplayed(pt, { ...freshSystem(), endHole: true }, ao).shown;
  assert.ok(whip.sbp - base.sbp > 6, `whip ${whip.sbp}`); near(eh.sbp - base.sbp, 3, 0.8, 'end-pressure SBP'); near(eh.map - base.map, 0.6, 0.3, 'end-pressure MAP');
  near(measureDisplayed(pt, { ...freshSystem(), whip: true }).shown.sbp, measureDisplayed(pt, freshSystem()).shown.sbp, 0.01, 'no whip on radial');
});

test('zeroing: refused open to the patient; removes drift but not a levelling error', () => {
  const s = { ...freshSystem(), drift: 12, txH: -10 };
  assert.equal(zero(s, 95).ok, false); assert.equal(s.zeroCorr, 0);
  s.stopcock = 'air'; assert.equal(zero(s, 0).ok, true); near(displayed(s, 0), 0, 1e-9, 'reads 0 open to air');
  s.stopcock = 'patient'; near(displayed(s, 95) - 95, 7.5, 1e-9, 'levelling error remains after zeroing');
});

test('every patient has a summary and a valid shape', () => {
  for (const p of PATIENTS) { assert.ok(p.summary.length > 40, p.id); const s = trueStats({ ...p, resp: 0 }); assert.ok(s.sbp > s.dbp, p.id); }
});
