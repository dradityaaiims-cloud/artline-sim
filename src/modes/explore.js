// Free explore: choose the patient and the site, break the system on purpose, watch what the monitor does.
import { el } from '../ui/dom.js';
import { PATIENTS, SITES } from '../sim/patient.js';
import { FAULTS } from '../sim/line.js';

const INJECT = { ...Object.fromEntries(Object.entries(FAULTS).map(([k, f]) => [k, f.name])), damper: 'Sealed-bubble damping device fitted', whip: 'Catheter whip (central line only)', endHole: 'End-pressure artefact: flow into an end hole (central line only)' };

export class ExploreMode {
  constructor(app) { this.app = app; this.id = 'explore'; }
  enter() {
    const { app } = this, rig = app.rig;
    const sel = (label, opts, value, on) => { const s = el('select', { 'aria-label': label, onchange: (e) => { on(e.target.value); e.target.blur(); } }, opts.map(([v, t]) => el('option', { value: v }, t))); s.value = value; return el('label', { class: 'pick' }, `${label} `, s); };
    this.sum = el('p', {});
    const checks = Object.entries(INJECT).map(([k, t]) => {
      const c = el('input', { type: 'checkbox', onchange: (e) => { rig.sys[k] = e.target.checked; app.log('fault', `${e.target.checked ? 'Injected' : 'Removed'}: ${t}`); app.refresh(); e.target.blur(); } });
      c.checked = !!rig.sys[k]; this.boxes[k] = c; return el('label', { class: 'chk' }, c, ` ${t}`);
    });
    const bed = el('input', { type: 'range', min: -20, max: 20, step: 1, value: rig.sys.axisH - 100, 'aria-label': 'Bed height (cm)', oninput: (e) => { rig.sys.axisH = 100 + Number(e.target.value); }, onchange: (e) => { app.log('fault', `Bed moved to ${e.target.value} cm`); e.target.blur(); } });
    app.panel.replaceChildren(
      el('div', { class: 'grow' }, el('h3', {}, 'Free explore'), this.sum),
      sel('Patient', PATIENTS.map((p) => [p.id, p.name]), rig.pt.id, (v) => { app.setPatient(v); app.flags.changedPatient = true; this.afterPatient(); }),
      sel('Heart rate', [['', 'Patient default'], ['50', '50/min'], ['75', '75/min'], ['110', '110/min'], ['140', '140/min']], rig.hr ?? '', (v) => { rig.hr = v ? Number(v) : null; app.log('note', `Heart rate ${v || 'default'}`); }),
      sel('Catheter', Object.entries(SITES).map(([k, s]) => [k, s.name]), rig.site, (v) => app.setSite(v)),
      sel('Scale', [['160', '0–160'], ['200', '0–200'], ['300', '0–300 (whole flush)']], String(app.monitor.scale), (v) => { app.monitor.scale = Number(v); }),
      el('label', { class: 'pick' }, 'Bed height ', bed),
      el('label', { class: 'pick' }, 'Pressure bag ', el('select', { 'aria-label': 'Pressure bag', onchange: (e) => { rig.sys.bag = Number(e.target.value); app.log('fault', `Pressure bag ${e.target.value} mmHg`); e.target.blur(); } },
        ['300', '150', '0'].map((v) => el('option', { value: v, selected: Number(v) === rig.sys.bag }, `${v} mmHg${v === '300' ? '' : ' (a clot forms in ~25 s)'}`)))),
      el('button', { onclick: () => { rig.sys.drift = 12; rig.sys.zeroCorr = 0; app.log('fault', 'Zero drift +12 mmHg'); } }, 'Add zero drift +12'),
      el('details', { class: 'faults' }, el('summary', {}, 'Break the system'), el('div', { class: 'checks' }, checks)));
    this.afterPatient();
  }
  boxes = {};
  refresh() { for (const [k, c] of Object.entries(this.boxes)) c.checked = !!this.app.rig.sys[k]; }
  afterPatient() { this.sum.textContent = this.app.rig.pt.summary; }
  exit() {}
  update() {}
}
