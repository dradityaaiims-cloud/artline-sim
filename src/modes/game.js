// "Troubleshoot the line": the game. Each case hides a fault (or none); find it, fix it, confirm it.
import { el } from '../ui/dom.js';
import { patient } from '../sim/patient.js';
import { CASES, DIAGNOSES, isFixed, scoreCase } from './scoring.js';

export class GameMode {
  constructor(app) { this.app = app; this.id = 'game'; this.i = app.store.get('artline.case', 0) % CASES.length; }
  enter() { this.start(this.i); }
  start(i) {
    const { app } = this, c = this.c = CASES[i]; this.i = i; app.store.set('artline.case', i);
    app.resetSystem(); app.setPatient(c.pt, { quiet: true }); app.setSite(c.site ?? 'radial'); c.setup(app.rig.sys);
    app.truth(false); app.refresh();
    this.run = { picked: [], flushes: 0, confirmFlush: false, unneeded: 0, t0: Date.now(), changedAt: -1 };
    this.done = false;
    const chips = Object.entries(DIAGNOSES).filter(([k]) => k !== 'whip' || c.site === 'aortic').map(([k, t]) => el('button', { class: 'chipbtn', 'aria-pressed': 'false', onclick: (e) => this.toggle(k, e.currentTarget) }, t));
    app.panel.replaceChildren(
      el('div', { class: 'grow' }, el('h3', {}, `Case ${i + 1} / ${CASES.length}: ${c.title}`), el('p', {}, `${c.story} True pressure is hidden. Investigate (flush test, stopcock, zero, height, the fix buttons), then pick what was wrong and finish.`)),
      el('div', { class: 'chips' }, chips),
      el('button', { class: 'primary', onclick: () => this.finish() }, 'Finish case (Enter)'));
  }
  toggle(k, b) { if (this.done) return; const p = this.run.picked, j = p.indexOf(k); if (j < 0) p.push(k); else p.splice(j, 1); b.setAttribute('aria-pressed', String(j < 0)); b.classList.toggle('on', j < 0); }
  onAction(kind, data) {
    if (this.done) return;
    const r = this.run;
    if (kind === 'fix') { if (data.changed) r.changedAt = Date.now(); else r.unneeded++; }
    if (kind === 'zero' && data.ok) r.changedAt = Date.now();
    if (kind === 'height') r.changedAt = Date.now();
    if (kind === 'flush') { r.flushes++; r.confirmFlush = r.changedAt > 0 && data.verdict === 'adequate' && data.stopcock === 'patient'; }
  }
  finish() {
    if (this.done) { this.start((this.i + 1) % CASES.length); return; }
    this.done = true;
    const run = { ...this.run, fixed: isFixed(this.app.rig.sys), secs: (Date.now() - this.run.t0) / 1000 };
    const r = scoreCase(this.c, run);
    this.app.saveBest(`case-${this.c.id}`, r.total); this.app.truth(true);
    this.app.log('record', `Case ${this.i + 1} finished: ${r.total}/100 (${patient(this.c.pt).name})`);
    this.app.panel.append(el('div', { class: 'grow' },
      el('div', { class: 'big' }, `${r.total}`, el('span', {}, ` / 100 · diagnosis ${r.parts.diagnosis}/30 · fixed ${r.parts.fixed}/30 · flush ${r.parts.tested + r.parts.confirmed}/20 · economy ${r.parts.economy}/10 · time ${r.parts.time}/10`)),
      el('ul', {}, r.notes.map((n) => el('li', {}, n)))),
    el('button', { class: 'primary', onclick: () => this.finish() }, 'Next case (Enter)'));
  }
  onKey(k) { if (k === 'Enter') { this.finish(); return true; } return false; }
  update() {}
  exit() {}
}
