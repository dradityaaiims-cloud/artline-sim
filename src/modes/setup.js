// "Set up the line": the navigate mode. Start from an unprepared system and work through the set-up.
import { el } from '../ui/dom.js';
import { SETUP_STEPS, setupDone, scoreSetup, isFixed } from './scoring.js';

export class SetupMode {
  constructor(app) { this.app = app; this.id = 'setup'; }
  enter() {
    const { app } = this; app.resetSystem(); app.setPatient('normal', { quiet: true }); app.setSite('radial');
    Object.assign(app.rig.sys, { bag: 0, airLarge: true, txH: app.rig.sys.axisH - 12, drift: 9 });
    this.flags = { refused: 0 }; this.t0 = Date.now(); this.done = false; app.truth(false); app.refresh();
    this.list = el('div', { class: 'checks' });
    this.say = el('p', {}, 'A new arterial line has just been connected. Prepare the monitoring system: work through the checklist in any sensible order, then record a reading (Enter).');
    app.panel.replaceChildren(el('div', { class: 'grow' }, el('h3', {}, 'Set up the line'), this.say), this.list, el('button', { class: 'primary', onclick: () => this.record() }, 'Record reading (Enter)'));
    this.render();
  }
  onAction(kind, data) {
    const f = this.flags;
    if (kind === 'stopcock' && data === 'air') f.openedAir = true;
    if (kind === 'zero') { if (data.ok) f.zeroed = true; else f.refused++; }
    if (kind === 'flush') f.flushOK = data.verdict === 'adequate' && data.stopcock === 'patient';
    if (kind === 'fix' && ['deair', 'straighten', 'shorten', 'declot'].includes(data.id)) f.flushOK = false;
    this.render();
  }
  record() {
    if (this.done) return;
    const ok = isFixed(this.app.rig.sys) && this.flags.zeroed;
    this.app.log('record', `Reading recorded${ok ? '' : ' (system not correct yet)'}`);
    if (!ok) { this.app.notice('The system is not ready: check the list. The reading would not reflect the patient.'); return; }
    this.flags.recordedOK = true; this.done = true;
    const r = scoreSetup(setupDone(this.app.rig.sys, this.flags), { refused: this.flags.refused, secs: (Date.now() - this.t0) / 1000 });
    this.app.saveBest('setup', r.total);
    this.render();
    this.app.panel.append(el('div', { class: 'grow' }, el('div', { class: 'big' }, `${r.total}`, el('span', {}, ' / 100')), el('ul', {}, r.notes.map((n) => el('li', {}, n)))), el('button', { onclick: () => this.enter() }, 'Again'));
  }
  render() {
    const d = setupDone(this.app.rig.sys, this.flags);
    this.list.replaceChildren(...SETUP_STEPS.map(([k, t]) => el('div', { class: d[k] ? 'step ok' : 'step' }, `${d[k] ? '✓' : '○'} ${t}`)));
  }
  onKey(k) { if (k === 'Enter') { this.record(); return true; } return false; }
  update() { if (this.list && !this.done && Math.random() < 0.1) this.render(); }
  exit() {}
}
