// Boba's tips are plain rules over what the simulator is doing: no AI model, no network.
// Pure functions (testable in Node). Same shape as the bronchoscopy, ventilator and RHC simulators' Boba.
// ctx = { t, mode, flags, sys, pt, site, offset, fn, zeta, verdict, lastFlush, fixed, notice }

const hint = (c) => c.mode === 'explore' || c.mode === 'setup'; // no giveaways in the quiz or the graded cases
export const RULES = [
  { id: 'air-open', cool: 45e3, when: (c) => c.sys.stopcock === 'air' && c.mode !== 'quiz', text: () => 'The stopcock is open to air, so the monitor is not reading the patient. Zero now if you meant to (Z), then turn it back to the patient (O).' },
  { id: 'clot', cool: 60e3, when: (c) => c.sys.bag < 200 && hint(c), text: (c) => `The pressure bag is at ${c.sys.bag} mmHg. Below about 300 the flush cannot keep the line open: blood backs up and clots, and the trace becomes overdamped. Re-inflate it.` },
  { id: 'level', cool: 60e3, when: (c) => Math.abs(c.sys.txH - c.sys.axisH) >= 3 && hint(c), text: (c) => { const d = Math.round(c.sys.txH - c.sys.axisH); return `The transducer is ${Math.abs(d)} cm ${d > 0 ? 'above' : 'below'} the phlebostatic axis, so every number reads about ${Math.abs(0.75 * d).toFixed(0)} mmHg too ${d > 0 ? 'low' : 'high'}: SBP, DBP and MAP alike. Move it with W/S or drag it in 3D.`; } },
  { id: 'drift', cool: 60e3, when: (c) => Math.abs(c.sys.drift + c.sys.zeroCorr) >= 3 && Math.abs(c.sys.txH - c.sys.axisH) < 1 && hint(c), text: () => 'The transducer is level, but the whole trace is still shifted with a normal shape: a zero offset. Stopcock to air (O), Zero (Z), back to the patient (O).' },
  { id: 'lowfn', cool: 90e3, when: (c) => c.lastFlush && c.lastFlush.verdict === 'adequate' && c.lastFlush.fn < 15 && c.mode === 'explore', text: () => 'That flush test counted as adequate, but look at the interval between the ringing peaks: it is long, so the natural frequency is low. A small bubble does this. Count and frequency must be read together.' },
  { id: 'under', cool: 90e3, when: (c) => c.lastFlush?.verdict === 'under' && hint(c), text: () => 'More than 2 oscillations after release: underdamped. The systolic reads too high and the diastolic a little low; the MAP is less affected. Look for extra or compliant tubing, or add a damping device.' },
  { id: 'over', cool: 90e3, when: (c) => c.lastFlush?.verdict === 'over' && hint(c), text: () => 'A slow, slurred return with no oscillation: overdamped. The systolic reads low. Check for a kink, air in the line, a clot and the bag pressure, in that order.' },
  { id: 'as', cool: 1e12, when: (c) => c.pt === 'as' && c.mode === 'explore' && c.flags.flushed, text: () => 'This slow, low, rounded pulse looks overdamped, but the flush test is normal: it is the patient (severe aortic stenosis), not the line. Do not try to "fix" it.' },
  { id: 'paradox', cool: 1e12, when: (c) => c.pt === 'paradoxus' && c.mode === 'explore', text: () => 'Pulsus paradoxus: press B to shade inspiration and watch the systolic fall by about 12 mmHg over each breath.' },
  { id: 'alternans', cool: 1e12, when: (c) => c.pt === 'alternans' && c.mode === 'explore', text: () => 'Strong, weak, strong, weak, with perfectly regular beats on the ECG: pulsus alternans, not bigeminy.' },
  { id: 'central', cool: 1e12, when: (c) => c.site === 'aortic' && c.mode === 'explore', text: () => 'Central aorta: the systolic is about 11 lower than at the radial artery and the notch is crisper, while the MAP is about the same. Whip and end-pressure artefacts can be added from "Break the system".' },
  { id: 'flush', cool: 1e12, when: (c) => c.t > 25 && !c.flags.flushed && c.mode !== 'quiz', text: () => 'Hold X (or Fast flush) for a second, then release, and count the oscillations as the trace comes back: 1–2 is adequate damping.' },
  { id: 'truth', cool: 1e12, when: (c) => c.t > 70 && !c.flags.usedTruth && c.mode === 'explore', text: () => 'Press T to see the patient\'s true pressure as a dashed line under the displayed trace. Then break the system from the panel and watch them separate.' },
  { id: 'caliper', cool: 1e12, when: (c) => c.t > 120 && !c.flags.usedCaliper && c.flags.flushed, text: () => 'Freeze (F) after a flush, then press K: drag the caliper to one ringing peak, double-click to pin it, and drag to the next. The interval gives the damped frequency.' },
  { id: 'learn', cool: 1e12, when: (c) => c.t > 200 && !c.flags.openedLearn, text: () => 'The Learn tab covers zeroing versus levelling, the flush test, what damping does to the numbers, the artefacts and every pulse variant.' },
  { id: 'tour', cool: 1e12, when: (c) => c.t > 40 && !c.flags.toured, text: () => 'New here? The Tour walks through the screen in about two minutes.' },
];

export const GENERAL = [
  'Transducer below the axis reads high; above reads low. About 0.75 mmHg per cm.',
  'Zeroing and levelling are different: zeroing removes the transducer offset, levelling fixes the height.',
  'MAP is less affected by damping than SBP and DBP, but levelling and zero errors shift it just as much.',
  'The fast-flush test: 1–2 oscillations adequate, more than 2 underdamped, less than 1 overdamped.',
  'Keep the bag at 300 mmHg: a soft bag lets blood back up and clot.',
  'Shorter, stiffer tubing raises the natural frequency. Adding air or length is not a fix.',
  'Press H any time for the list of controls.',
  'This is a teaching tool with a schematic model. It is not for clinical use.',
];

// Returns the first rule that applies and is not on cooldown; `fired` maps id -> last time (ms).
export function nextRule(ctx, fired, now) {
  for (const r of RULES) {
    if (now - (fired.get(r.id) ?? -Infinity) < r.cool) continue;
    let ok = false; try { ok = !!r.when(ctx); } catch { ok = false; }
    if (ok) return { ...r, key: r.id };
  }
  return null;
}
