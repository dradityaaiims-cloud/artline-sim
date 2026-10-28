// "Read the trace": flush-test reading, naming the pulse, and predicting what a fault does to the numbers.
import { el } from '../ui/dom.js';
import { patient } from '../sim/patient.js';
import { quizQuestion, EFFECTS } from './scoring.js';

const WHY = {
  under: 'More than 2 oscillations after release: the system rings (resonance), so the systolic overshoots and reads too high.',
  over: 'A slow, slurred return with no oscillation: the system is overdamped, so the systolic reads low and the notch is lost.',
  adequate: '1–2 oscillations then back to the trace: adequate damping (REBEL EM, StatPearls). Still check the shape and the ringing interval.',
};

export class QuizMode {
  constructor(app) { this.app = app; this.id = 'quiz'; this.score = { right: 0, n: 0 }; }
  locked() { return true; } // fixes, stopcock and height are disabled; the flush valve still works
  enter() { this.next(); }
  exit() { this.app.monitor.hideNumbers = false; }
  next() {
    const { app } = this, q = this.q = { ...quizQuestion(), answered: false, flushed: false };
    this.t0 = Date.now();
    app.resetSystem(); app.setSite('radial');
    app.setPatient(q.type === 'morph' ? q.patient : 'normal', { quiet: true });
    if (q.type === 'flush') Object.assign(app.rig.sys, q.faults);
    app.truth(false); app.monitor.hideNumbers = q.type === 'morph';
    const ask = q.type === 'flush' ? 'Do a fast-flush test (hold and release X or the Fast flush button), count the oscillations after release, then name the damping.'
      : q.type === 'morph' ? 'Name this pulse from its shape. The numbers are hidden; the system is set up correctly.'
        : `The trace now is correct. ${q.text} What happens to the displayed numbers?`;
    this.say = el('p', {}, ask);
    this.btns = q.options.map((o, i) => el('button', { disabled: q.type === 'flush', onclick: () => this.answer(o) }, `${i + 1}  ${q.label(o)}`));
    app.panel.replaceChildren(el('div', { class: 'grow' }, el('h3', {}, 'Read the trace'), this.say), el('div', { class: 'opts' }, this.btns), el('div', { class: 'stats' }, `Score ${this.score.right} / ${this.score.n}`));
  }
  onAction(kind) { if (kind === 'flush' && this.q?.type === 'flush' && !this.q.answered) { this.q.flushed = true; this.btns.forEach((b) => { b.disabled = false; }); } }
  answer(o) {
    const q = this.q; if (q.answered || (q.type === 'flush' && !q.flushed)) return; q.answered = true;
    const ok = o === q.answer; this.score.n++; if (ok) this.score.right++;
    q.options.forEach((x, i) => this.btns[i].classList.add(x === q.answer ? 'right' : x === o ? 'wrong' : 'x'));
    const why = q.type === 'flush' ? `${q.count} oscillation${q.count === 1 ? '' : 's'} after release. ${WHY[q.answer]}`
      : q.type === 'morph' ? patient(q.answer).summary
        : `${EFFECTS[q.answer]}. ${/up|down/.test(q.answer) ? 'Levelling and zeroing errors shift the whole trace, MAP included: no number can be trusted until the system is fixed.' : 'Damping distorts the shape; MAP is less affected than SBP and DBP.'} The fault is now applied: compare the trace (T shows the true pressure).`;
    if (q.type === 'predict') { q.faults(this.app.rig.sys); this.app.refresh(); }
    this.app.truth(true); this.app.monitor.hideNumbers = false;
    this.say.replaceChildren(el('b', { class: ok ? 'good' : 'bad' }, ok ? 'Correct. ' : `It was: ${q.label(q.answer)}. `), why);
    this.app.panel.append(el('button', { class: 'primary', onclick: () => this.next() }, 'Next (Enter)'));
  }
  onKey(k) {
    if (!this.q) return false;
    if (!this.q.answered && '1234'.includes(k) && this.q.options[Number(k) - 1]) { this.answer(this.q.options[Number(k) - 1]); return true; }
    if (this.q.answered && k === 'Enter') { this.next(); return true; }
    return false;
  }
  update() {}
}
