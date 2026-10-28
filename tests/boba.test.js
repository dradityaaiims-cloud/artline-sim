import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, nextRule } from '../src/ui/bobaRules.js';
import { freshSystem } from '../src/sim/line.js';

const ctx = (o = {}) => ({ t: 0, mode: 'explore', flags: { toured: true, flushed: true, usedTruth: true, usedCaliper: true, openedLearn: true }, sys: freshSystem(), pt: 'normal', site: 'radial', lastFlush: null, ...o });

test('rules have unique ids and never throw', () => {
  assert.equal(new Set(RULES.map((r) => r.id)).size, RULES.length);
  for (const r of RULES) assert.doesNotThrow(() => r.when(ctx()));
});
test('a transducer 10 cm low gets a levelling tip with the right sign', () => {
  const r = nextRule(ctx({ sys: { ...freshSystem(), txH: -10 } }), new Map(), 0);
  assert.equal(r.id, 'level'); assert.match(r.text(ctx({ sys: { ...freshSystem(), txH: -10 } })), /below.*too high/);
});
test('no giveaways in the graded cases', () => {
  assert.equal(nextRule(ctx({ mode: 'game', sys: { ...freshSystem(), txH: -10, bag: 100 } }), new Map(), 0), null);
});
test('cooldowns hold', () => {
  const c = ctx({ sys: { ...freshSystem(), stopcock: 'air' } }), f = new Map(), r = nextRule(c, f, 0);
  f.set(r.id, 0); assert.notEqual(nextRule(c, f, 1000)?.id, r.id);
});
