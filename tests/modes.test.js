import test from 'node:test';
import assert from 'node:assert/strict';
import { Rig, numerics, FS } from '../src/sim/rig.js';
import { patient } from '../src/sim/patient.js';
import { measureDisplayed, freshSystem } from '../src/sim/line.js';
import { CASES, DIAGNOSES, isFixed, scoreCase, quizQuestion, flushQuestion, PREDICT, EFFECTS, setupDone, scoreSetup, SETUP_STEPS } from '../src/modes/scoring.js';

const seeded = (s) => () => ((s = (s * 16807) % 2147483647) / 2147483647);

test('rig: numerics match the true pressure on a correct system', () => {
  const r = new Rig(); r.reset({ ...patient('normal'), resp: 0 });
  const smp = []; for (let i = 0; i < 300; i++) smp.push(...r.step(1 / 60));
  const n = numerics(smp, r.t);
  assert.ok(Math.abs(n.sbp - 121) <= 1 && n.dbp === 80 && n.map === 95, JSON.stringify(n));
});

test('rig: numerics ignore the flush square wave', () => {
  const r = new Rig(), smp = [];
  for (let i = 0; i < 200; i++) smp.push(...r.step(1 / 60));
  r.flush(true); for (let i = 0; i < 30; i++) smp.push(...r.step(1 / 60));
  const res = r.flush(false); smp.push(...r.step(1 / 60));
  assert.equal(numerics(smp, r.t), null, 'no numerics right after a flush');
  assert.equal(res.verdict, 'adequate');
  for (let i = 0; i < 300; i++) smp.push(...r.step(1 / 60));
  assert.ok(numerics(smp.filter((s) => s.t > r.t - 5), r.t).sbp < 140);
});

test('rig: a low bag clots the line, and fixes repair it', () => {
  const r = new Rig(); r.sys.bag = 150;
  for (let i = 0; i < 60 * 30; i++) r.step(1 / 60);
  assert.ok(r.sys.clot, 'clot formed'); assert.equal(isFixed(r.sys), false);
  assert.equal(r.fix('declot'), true); assert.equal(r.fix('bag'), true); assert.equal(r.fix('bag'), false, 'a second time changes nothing');
  assert.ok(isFixed(r.sys));
});

test('every case is broken at the start (unless it is the patient) and fixable by its answer', () => {
  const FIX = { level: ['level'], zero: ['air', 'zero', 'patient'], kink: ['straighten'], airLarge: ['deair'], airSmall: ['deair'], clot: ['bag', 'declot'], extension: ['shorten'], resonant: ['damper'], whip: ['reposition'], none: [] };
  for (const c of CASES) {
    for (const a of c.answer) assert.ok(DIAGNOSES[a], `${c.id}: ${a}`);
    const r = new Rig(); r.reset(patient(c.pt)); c.setup(r.sys);
    assert.equal(isFixed(r.sys), c.answer.includes('none'), `${c.id} starts broken`);
    for (const a of c.answer) for (const f of FIX[a]) { if (f === 'air') r.setStopcock('air'); else if (f === 'zero') assert.ok(r.zero().ok); else if (f === 'patient') r.setStopcock('patient'); else r.fix(f); }
    assert.ok(isFixed(r.sys), `${c.id} fixed`);
  }
});

test('scoreCase: perfect run is 100; missed diagnosis and no flush cost points with feedback', () => {
  const c = CASES[0];
  assert.equal(scoreCase(c, { picked: ['level'], fixed: true, flushes: 2, confirmFlush: true, unneeded: 0, secs: 60 }).total, 100);
  const bad = scoreCase(c, { picked: ['zero'], fixed: false, flushes: 0, confirmFlush: false, unneeded: 2, secs: 400 });
  assert.equal(bad.total, 0); assert.ok(bad.notes.some((n) => /flush/.test(n))); assert.ok(bad.notes.some((n) => /MAP/.test(n)));
});

test('predict questions: the stated effect matches the model', () => {
  const pt = { ...patient('normal'), resp: 0 }, base = measureDisplayed(pt, freshSystem()).shown;
  for (const q of PREDICT) {
    const s = freshSystem(); q.faults(s); const m = measureDisplayed(pt, s).shown, d = (k) => m[k] - base[k];
    const got = Math.abs(d('map')) > 3 ? (d('map') > 0 ? 'up' : 'down') : d('sbp') > 0 ? 'under' : 'over';
    assert.equal(got, q.answer, q.text); assert.ok(EFFECTS[q.answer]);
  }
});

test('quiz questions are well formed and the flush answer follows the count', () => {
  const rand = seeded(7);
  for (let i = 0; i < 60; i++) { const q = quizQuestion(rand); assert.ok(q.options.includes(q.answer), q.type); assert.ok(q.options.every((o) => q.label(o))); }
  for (let i = 0; i < 20; i++) { const q = flushQuestion(rand); assert.equal(q.answer, q.count > 2 ? 'under' : q.count < 1 ? 'over' : 'adequate'); }
});

test('setup checklist and score', () => {
  const sys = { ...freshSystem(), bag: 0, airLarge: true, txH: -12 };
  assert.equal(Object.values(setupDone(sys, {})).filter(Boolean).length, 0);
  const done = setupDone(freshSystem(), { openedAir: true, zeroed: true, flushOK: true, recordedOK: true });
  assert.equal(Object.keys(done).length, SETUP_STEPS.length);
  assert.equal(scoreSetup(done, { secs: 90 }).total, 100);
  assert.equal(scoreSetup(done, { refused: 1, secs: 90 }).total, 95);
  assert.ok(FS >= 500);
});
