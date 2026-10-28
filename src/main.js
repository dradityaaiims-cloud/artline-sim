// App bootstrap: wires the rig (patient + measurement system), monitor, 3D bedside, input and modes.
import { patient, labelsIn, SITES } from './sim/patient.js';
import { FIXES, dynamics, flushTest, analyseRinging, VERDICTS, offsetOf } from './sim/line.js';
import { Rig, numerics, AXIS_CM } from './sim/rig.js';
import { Monitor } from './render/monitor.js';
import { Bedside } from './render/bedside.js';
import { el, store } from './ui/dom.js';
import { ExploreMode } from './modes/explore.js';
import { QuizMode } from './modes/quiz.js';
import { SetupMode } from './modes/setup.js';
import { GameMode } from './modes/game.js';
import { isFixed } from './modes/scoring.js';
import { initLearn } from './learn/learn.js';
import { initBoba } from './ui/boba.js';
import { startTour } from './ui/tour.js';
import { renderAbout } from './pages/about.js';
import { MODEL_HTML } from './pages/model.js';
import { CONFIG } from './pages/config.js';
import { Session, clock } from './report/session.js';
import { buildReport } from './report/report.js';

const $ = (id) => document.getElementById(id);
const rig = new Rig();
const monitor = new Monitor($('monitor'));
const bed = new Bedside($('bedMount'));
const session = new Session();

const flags = { flushed: false, zeroed: false, moved: false, turned: false, usedTruth: false, usedCaliper: false, usedFreeze: false, openedLearn: false, changedPatient: false, fixed: false, toured: store.get('artline.toured', false) };
let noticeTimer = null, frozen = false, labelsOn = true, mode = null, lastFlush = null, roAt = 0, last = performance.now(), lastNoticeText = null, lastNoticeAt = 0;

const app = {
  rig, monitor, flags, store, panel: $('modePanel'),
  setPatient(id, { quiet = false } = {}) { rig.pt = patient(id); monitor.clear(); if (!quiet) this.newCase(); },
  setSite(site) { rig.site = site; if (site === 'radial') { rig.sys.whip = false; rig.sys.endHole = false; } $('chipMon').textContent = `MONITOR · ${SITES[site].short === 'AO' ? 'CENTRAL AORTA' : 'RADIAL'}`; renderFixes(); },
  resetSystem() { const pt = rig.pt, site = rig.site; rig.reset(pt); rig.site = site; lastFlush = null; renderFlush(); monitor.clear(); this.newCase(); },
  newCase() { session.reset(); session.event(rig.t, 'case', `Case started: ${mode?.id === 'game' ? 'troubleshooting case' : rig.pt.name}`); },
  log(kind, text) { session.event(rig.t, kind, text); },
  truth(on) { monitor.truthOn = on; $('btnTruth').classList.toggle('on', on); },
  refresh() { mode?.refresh?.(); syncHeight(); renderFixes(); },
  notice(msg) { const n = $('notice'); n.textContent = msg; n.hidden = false; lastNoticeText = msg; lastNoticeAt = Date.now(); clearTimeout(noticeTimer); noticeTimer = setTimeout(() => { n.hidden = true; }, 5000); },
  saveBest(key, score) { const k = `artline.best.${key}`; if (score > store.get(k, -1)) store.set(k, score); },
};

const modes = { explore: new ExploreMode(app), quiz: new QuizMode(app), setup: new SetupMode(app), game: new GameMode(app) };
function setMode(id) {
  mode?.exit();
  mode = modes[id];
  document.querySelectorAll('#modeTabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === id));
  if (id === 'explore') { app.resetSystem(); app.truth(false); }
  mode.enter();
  renderFixes(); syncHeight();
}
const act = (kind, data) => mode.onAction?.(kind, data);

// ── system actions (buttons, keys, the 3D view) ──────────────────────────
function syncHeight() {
  const off = Math.round(rig.sys.txH - rig.sys.axisH);
  $('txHv').textContent = off ? `${Math.abs(off)} cm ${off > 0 ? 'above' : 'below'}` : 'level';
  $('btnCock').textContent = ''; $('btnCock').append(`Stopcock: ${rig.sys.stopcock === 'air' ? 'open to air' : 'to patient'} `, el('kbd', {}, 'O'));
  $('btnCock').classList.toggle('warn', rig.sys.stopcock === 'air');
}
function moveTx(cm, absolute = false) {
  if (mode.locked?.()) return;
  const h = Math.min(150, Math.max(60, absolute ? cm : rig.sys.txH + cm));
  if (h === rig.sys.txH) return;
  rig.sys.txH = h; flags.moved = true; syncHeight(); act('height', h);
  clearTimeout(moveTx.t); moveTx.t = setTimeout(() => app.log('monitor', `Transducer ${$('txHv').textContent}${/level/.test($('txHv').textContent) ? ' with the phlebostatic axis' : ' the phlebostatic axis'}`), 600);
}
function turnStopcock() {
  if (mode.locked?.()) return;
  const s = rig.sys.stopcock === 'air' ? 'patient' : 'air'; rig.setStopcock(s); flags.turned = true;
  app.log('monitor', s === 'air' ? 'Stopcock off to the patient, open to air' : 'Stopcock open to the patient');
  app.notice(s === 'air' ? 'Off to the patient, open to air: the monitor now reads the transducer\'s own offset. Press Zero.' : 'Open to the patient again.');
  syncHeight(); act('stopcock', s);
}
function doZero() {
  if (mode.locked?.()) return;
  const r = rig.zero(); flags.zeroed ||= r.ok;
  app.log('monitor', r.ok ? 'Zeroed to atmosphere' : 'Zero refused (open to the patient)');
  app.notice(r.ok ? 'Zeroed: the monitor reads 0 mmHg open to air. Turn the stopcock back to the patient.' : r.reason);
  act('zero', r);
}
function doFix(id) {
  if (mode.locked?.()) return;
  const changed = rig.fix(id); flags.fixed ||= changed;
  app.log('fix', `${FIXES[id]}${changed ? '' : ' (no change)'}`);
  app.notice(changed ? `${FIXES[id]}: done.` : `${FIXES[id]}: nothing to fix there.`);
  act('fix', { id, changed }); app.refresh();
}
function flush(on) {
  if (on && rig.flushing) return;
  const r = rig.flush(on);
  if (on) { app.log('flush', 'Fast-flush valve opened'); return; }
  if (!r) return;
  flags.flushed = true; lastFlush = r;
  app.log('flush', `Flush test released: ${r.count} oscillation${r.count === 1 ? '' : 's'}`);
  if (rig.sys.stopcock === 'air') app.notice('The stopcock is open to air: the flush went out of the stopcock, not through the transducer to the patient.');
  renderFlush(); act('flush', r);
}
function renderFlush() {
  const box = $('flushBox'), r = lastFlush, show = r && mode?.id === 'explore';
  box.hidden = !show; if (!show) return;
  const a = analyseRinging(r.peaks);
  box.innerHTML = `<div class="cap">FLUSH TEST</div><b>${r.count}</b> oscillation${r.count === 1 ? '' : 's'} after release: ${VERDICTS[r.verdict]}`
    + (a ? `<br>Ringing interval ${a.intervalMs.toFixed(0)} ms → f<sub>d</sub> ${a.fd.toFixed(1)} Hz; peak ratio → ζ ≈ ${a.zeta.toFixed(2)}; f<sub>n</sub> ≈ ${a.fn.toFixed(1)} Hz` : '')
    + `<br><span class="muted">Model: f<sub>n</sub> ${r.fn.toFixed(1)} Hz, ζ ${r.zeta.toFixed(2)}${r.fn < 15 ? ' · <span class="warn">low natural frequency</span>' : ''}</span>`;
}
function renderFixes() {
  const ids = ['straighten', 'deair', 'declot', 'shorten', 'damper', 'bag', ...(rig.site === 'aortic' ? ['reposition'] : [])];
  $('fixRow').replaceChildren(...ids.map((id) => el('button', { class: 'fix', disabled: !!mode?.locked?.(), title: FIXES[id], onclick: (e) => { doFix(id); e.currentTarget.blur(); } }, FIXES[id])));
  for (const id of ['btnCock', 'btnZero', 'btnUp', 'btnDown']) $(id).disabled = !!mode?.locked?.();
}
bed.onDrag = (h) => moveTx(h, true);
bed.onStopcock = turnStopcock;

// ── learn tab, pages, tour, Boba ─────────────────────────────────────────
const t0 = Date.now(), learnTab = $('navLearn');
const setActiveTab = (btn) => document.querySelectorAll('#modeTabs button').forEach((b) => b.classList.toggle('active', b === btn));
function openLearn(section) { document.body.classList.add('learning'); document.body.classList.remove('paging'); setActiveTab(learnTab); flags.openedLearn = true; if (section) learn.open(section); }
function openPage(id) {
  const page = $('page'); document.body.classList.add('learning', 'paging');
  if (id === 'about') renderAbout(page); else page.innerHTML = MODEL_HTML;
  page.scrollTop = 0; setActiveTab($(id === 'about' ? 'navAbout' : 'navModel'));
}
function closeLearn() {
  if (!document.body.classList.contains('learning')) return;
  document.body.classList.remove('learning', 'paging');
  document.querySelectorAll('#modeTabs button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode.id));
}
const learn = initLearn({
  root: $('learn'),
  onTour: () => { closeLearn(); runTour(); },
  onGoto(id) { closeLearn(); setMode('explore'); app.setPatient(id); modes.explore.enter(); },
});

function runTour() {
  closeLearn();
  startTour([
    { title: 'Welcome', text: 'This two-minute tour walks through the screen, then lets you test the line yourself. Use Next or the ← → keys; Esc skips. Educational use only: this is not for clinical use.', enter: () => setMode('explore') },
    { title: 'The monitor', target: '#monitorPane', text: 'Green is the ECG; red is the arterial pressure as the transducer displays it, with the numbers on the right (SBP/DBP and the MAP in brackets). The radial upstroke arrives about 160 ms after the R wave.' },
    { title: 'True versus displayed', target: '#btnTruth', text: 'The patient\'s true pressure and the displayed pressure are separate signals. T overlays the true pressure as a dashed white line, so you can see what each fault does. In the quizzes and cases it is hidden.', tryText: 'press T', done: () => monitor.truthOn },
    { title: 'The bedside', target: '#bedPane', text: 'The catheter in the radial artery, the tubing, the transducer on the IV pole and the pressure bag. The green dashed line is the phlebostatic axis (4th intercostal space, mid-axillary line); the orange line shows the transducer height when it is off-level. Drag to rotate, scroll to zoom.' },
    { title: 'Fast-flush test', target: '#btnFlush', text: 'Hold X (or the button) to open the flush valve: the trace jumps up to the bag pressure. Release it and watch the ringing as it comes back. 1–2 oscillations is adequate damping.', tryText: 'hold and release X', done: () => flags.flushed },
    { title: 'Level the transducer', target: '#dock .height', text: 'W and S (or drag the transducer in the 3D view) move it up and down. Every centimetre below the axis adds 0.75 mmHg to every number; above, it subtracts.', tryText: 'move the transducer', enter: () => { rig.sys.txH = rig.sys.axisH - 8; syncHeight(); }, done: () => rig.sys.txH === rig.sys.axisH },
    { title: 'Zero to air', target: '#btnZero', text: 'Zeroing removes the transducer\'s own offset. Turn the stopcock off to the patient and open to air (O, or click the blue stopcock in 3D), press Zero (Z), then turn it back to the patient.', tryText: 'stopcock to air, zero, back to the patient', done: () => flags.zeroed && rig.sys.stopcock === 'patient' },
    { title: 'Fix buttons', target: '#fixRow', text: 'Straighten a kink, remove air, aspirate a clot, remove extra tubing, add a damping device, re-inflate the bag. In the cases, a fix that changes nothing costs points: diagnose first.' },
    { title: 'Tools', target: '.tools', text: 'B shades inspiration (for pulsus paradoxus). K is a caliper: drag it, and double-click to pin a second line to read the ringing interval in ms and Hz. F freezes, P downloads a PDF report, R resets the system.' },
    { title: 'Modes', target: '#modeTabs', text: 'Free explore: any patient, any fault. Read the trace: flush tests, pulse shapes and predicting errors. Set up the line: prepare a new line step by step. Troubleshoot the line: twelve cases with a score and feedback. M cycles modes.' },
    { title: 'Learn tab', target: '#navLearn', text: 'The measurement chain, zeroing versus levelling, waveform anatomy, the dynamic response and the flush test, what damping does to the numbers, artefacts and each pulse variant, with sources.' },
    { title: 'Boba', target: '.boba-dog', text: 'Boba is your assistant. Click for a tip, double-click for zoomies, or press Hush. Boba notices what you are doing and chimes in. Remember this is a teaching tool, not for clinical use.' },
  ], { onEnd() { flags.toured = true; store.set('artline.toured', true); setMode('explore'); } });
}

initBoba({
  onTour: runTour, onLearn: () => openLearn(),
  getCtx: () => {
    const d = dynamics(rig.sys);
    return { t: (Date.now() - t0) / 1000, mode: mode.id, flags, sys: rig.sys, pt: rig.pt.id, site: rig.site, offset: offsetOf(rig.sys), fn: d.fn, zeta: d.zeta,
      verdict: flushTest(d.fn, d.zeta).verdict, lastFlush, fixed: isFixed(rig.sys), notice: Date.now() - lastNoticeAt < 10e3 ? lastNoticeText : null };
  },
});

// ── input ────────────────────────────────────────────────────────────────
const help = $('help');
const toggleHelp = (v = help.hidden) => { help.hidden = !v; };
const toggleTruth = () => { if (mode.id === 'game' || (mode.id === 'quiz' && !mode.q?.answered)) { app.notice('The true pressure is hidden until you answer or finish the case.'); return; } flags.usedTruth = true; app.truth(!monitor.truthOn); };
const toggleBreath = () => { monitor.breathOn = !monitor.breathOn; $('btnBreath').classList.toggle('on', monitor.breathOn); };
const toggleLabels = () => { labelsOn = !labelsOn; monitor.labelsOn = labelsOn; bed.setLabels(labelsOn); $('btnLabels').classList.toggle('on', labelsOn); };
const toggleFreeze = () => { flags.usedFreeze = true; frozen = !frozen; $('frozen').hidden = !frozen; $('btnFreeze').classList.toggle('on', frozen); };
const toggleCaliper = () => { flags.usedCaliper = true; monitor.caliper = monitor.caliper === null ? 0.5 : null; monitor.pin = null; $('btnCaliper').classList.toggle('on', monitor.caliper !== null); };
const reset = () => { if (mode.id === 'explore') { app.resetSystem(); modes.explore.refresh(); app.refresh(); app.notice('System reset to a correct set-up.'); } };

window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (['SELECT', 'INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && e.key !== 'Escape') return;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (document.body.classList.contains('learning')) { if (k === 'Escape') closeLearn(); return; }
  if (!help.hidden) { toggleHelp(false); return; }
  if (k === 'x') { e.preventDefault(); flush(true); return; }
  if (mode.onKey?.(k)) { e.preventDefault(); return; }
  if (k === 'w' || k === 'ArrowUp') { e.preventDefault(); moveTx(e.shiftKey ? 0.5 : 1); return; }
  if (k === 's' || k === 'ArrowDown') { e.preventDefault(); moveTx(e.shiftKey ? -0.5 : -1); return; }
  if (e.repeat) return;
  const keys = { h: () => toggleHelp(true), t: toggleTruth, b: toggleBreath, l: toggleLabels, f: toggleFreeze, k: toggleCaliper, p: downloadReport, r: reset, o: turnStopcock, z: doZero,
    m: () => { const ids = Object.keys(modes); setMode(ids[(ids.indexOf(mode.id) + 1) % ids.length]); } };
  keys[k]?.();
});
window.addEventListener('keyup', (e) => { if (e.key.toLowerCase() === 'x') flush(false); });
window.addEventListener('blur', () => flush(false));

const fb = $('btnFlush');
fb.addEventListener('pointerdown', (e) => { e.preventDefault(); fb.setPointerCapture(e.pointerId); flush(true); });
for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) fb.addEventListener(ev, () => flush(false));
const click = (id, fn) => $(id).addEventListener('click', (e) => { fn(); e.currentTarget.blur(); });
click('btnCock', turnStopcock); click('btnZero', doZero); click('btnUp', () => moveTx(1)); click('btnDown', () => moveTx(-1));
click('btnTruth', toggleTruth); click('btnBreath', toggleBreath); click('btnLabels', toggleLabels); click('btnFreeze', toggleFreeze);
click('btnCaliper', toggleCaliper); click('btnReport', downloadReport); click('btnReset', reset); click('btnTour', runTour);
click('btnHelp', () => toggleHelp(true)); click('btnView', () => bed.resetView());
help.addEventListener('click', () => toggleHelp(false));
document.querySelectorAll('#modeTabs button').forEach((b) => b.addEventListener('click', () => {
  if (b === learnTab) openLearn(); else if (b.id === 'navModel') openPage('model'); else if (b.id === 'navAbout') openPage('about');
  else { closeLearn(); setMode(b.dataset.mode); }
  b.blur();
}));

async function downloadReport() {
  const s = rig.sys, n = numerics(monitor.samples, rig.t), d = dynamics(s), hidden = mode.id === 'game' && !mode.done;
  const tr = monitor.samples.slice(-2000), tv = tr.length ? { sbp: Math.round(Math.max(...tr.map((x) => x.truth))), dbp: Math.round(Math.min(...tr.map((x) => x.truth))), map: Math.round(tr.reduce((a, x) => a + x.truth, 0) / tr.length) } : null;
  const info = {
    title: 'Arterial line: simulated monitoring report',
    lines: [
      `Dr. Singh's Art Line Sim v${CONFIG.version}${CONFIG.doi ? ` (doi:${CONFIG.doi})` : ''}.  Generated ${new Date().toLocaleString()}.`,
      `Case started ${session.startedAt.toLocaleTimeString()}, duration ${clock(session.duration)}.  Mode: ${document.querySelector(`#modeTabs [data-mode=${mode.id}]`).textContent}.`,
      `Patient: ${hidden ? 'hidden until the case is finished' : rig.pt.name}.  Catheter: ${SITES[rig.site].name}.  Heart rate ${rig.opts.hr}/min.`,
    ],
    readings: [
      ['Displayed SBP/DBP (MAP)', n ? `${n.sbp}/${n.dbp} (${n.map}) mmHg` : 'not available (flush in progress)'],
      ...(hidden || !tv ? [] : [['True SBP/DBP (MAP)', `${tv.sbp}/${tv.dbp} (${tv.map}) mmHg`]]),
    ],
    derived: [
      ['Transducer', `${Math.abs(Math.round(s.txH - s.axisH)) ? `${Math.abs(Math.round(s.txH - s.axisH))} cm ${s.txH > s.axisH ? 'above' : 'below'}` : 'level with'} the phlebostatic axis; stopcock ${s.stopcock === 'air' ? 'OPEN TO AIR' : 'to the patient'}; offset ${offsetOf(s).toFixed(1)} mmHg`],
      ['Pressure bag', `${s.bag} mmHg`],
      ...(lastFlush ? [['Last flush test', `${lastFlush.count} oscillations: ${VERDICTS[lastFlush.verdict]}`]] : []),
      ...(hidden ? [] : [['System dynamics (model)', `natural frequency ${d.fn.toFixed(1)} Hz, damping ratio ${d.zeta.toFixed(2)}`]]),
    ],
  };
  app.notice('Building the PDF report…');
  const blob = await buildReport(info, session, monitor.scale);
  const a = document.createElement('a'), stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
  a.href = URL.createObjectURL(blob); a.download = `artline-report-${stamp}.pdf`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  app.notice('Report downloaded.');
}

// ── loop ─────────────────────────────────────────────────────────────────
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!document.body.classList.contains('learning')) step(dt);
  requestAnimationFrame(frame);
}
function step(dt) {
  if (!frozen) {
    const t0s = rig.t, smp = rig.step(dt), labels = labelsIn(rig.pt, t0s, rig.t, rig.opts);
    for (const s of smp) { monitor.push(s, labels.filter((l) => l.t > s.t - 1 / 500 && l.t <= s.t)); session.push(s); }
    if (rig.events.length) for (const e of rig.events.splice(0)) { app.log('note', e.text); if (mode.id === 'explore') app.notice(e.text); mode.refresh?.(); }
    mode.update(dt);
  }
  if (performance.now() - roAt > 500) { roAt = performance.now(); const n = numerics(monitor.samples, rig.t); monitor.numerics = n ? { ...n, hr: rig.opts.hr, flag: rig.sys.stopcock === 'air' ? 'OPEN TO AIR' : null } : { hr: rig.opts.hr, flag: rig.flushing ? 'FLUSH' : null }; }
  monitor.draw(rig.t);
  bed.update(rig.sys, rig.site, rig.flushing, rig.t);
}

if (import.meta.env.DEV) window.__art = { app, rig, monitor, bed, session, setMode, modes, flags, step, openPage, runTour, downloadReport, AXIS_CM };
setMode('explore');
requestAnimationFrame(frame);
if (!flags.toured) setTimeout(runTour, 500);
