// The patient: true arterial pressure and ECG. Pure functions, no rendering (testable in Node).
// Each beat is a set of keypoints [time, fraction of the pulse pressure] timed off the ECG and joined by a
// periodic monotone cubic (no overshoot, so the systolic peak is exactly the scenario's SBP).
// Seed values follow ADI's arterial line research specification (2026); illustrative, not measurements.

// Shapes: systolic keys are [u, q] with u = time from the foot / ejection time and q = fraction of the pulse
// pressure; diastole is an exponential run-off from the last key (k sets how fast) down to the next foot.
export const SHAPES = {
  radial: { sys: [[0, 0], [0.3, 1], [0.58, 0.8], [1, 0.5, 'notch'], [1.13, 0.56]], k: 2.2 },
  aortic: { sys: [[0, 0], [0.36, 1], [0.7, 0.96], [1, 0.74, 'notch'], [1.04, 0.79]], k: 1.1 },
  tardus: { sys: [[0, 0], [0.3, 0.5], [0.62, 0.92], [0.82, 1], [1.05, 0.86]], k: 1.4 },
  bisferiens: { sys: [[0, 0], [0.16, 1, 'P1'], [0.32, 0.8], [0.5, 0.97, 'P2'], [0.86, 0.5], [1, 0.32, 'notch'], [1.06, 0.34]], k: 3.2 },
  spikedome: { sys: [[0, 0], [0.13, 1, 'spike'], [0.33, 0.58], [0.62, 0.8, 'dome'], [1, 0.46, 'notch'], [1.08, 0.5]], k: 2.2 },
};

export const PATIENTS = [
  { id: 'normal', name: 'Normal radial', hr: 75, s: 120, d: 80, shape: 'radial', resp: 2,
    summary: 'Rapid upstroke, sharp systolic peak, a dicrotic notch on the downstroke and a smooth diastolic run-off. About 120/80, MAP about 95.' },
  { id: 'as', name: 'Pulsus parvus et tardus (severe aortic stenosis)', hr: 72, s: 98, d: 78, shape: 'tardus', resp: 2,
    summary: 'Slow upstroke, a late, rounded, low peak and a sustained systole: pulse pressure about 20. It looks like an overdamped line, but the flush test is normal: this is the patient, not the system. Its absence does not exclude severe AS in elderly, stiff arteries.' },
  { id: 'ar', name: 'Pulsus bisferiens (aortic regurgitation)', hr: 78, s: 120, d: 55, shape: 'bisferiens', resp: 2,
    summary: 'Two systolic peaks with a mid-systolic dip, then a rapid collapse to a low diastolic: wide pulse pressure (about 120/55). Seen in AR and combined AS with AR; a variant occurs in HOCM.' },
  { id: 'hocm', name: 'Spike-and-dome (hypertrophic obstructive cardiomyopathy)', hr: 75, s: 125, d: 75, shape: 'spikedome', resp: 2,
    summary: 'A sharp early spike, a fall as the outflow tract obstructs in mid-systole, then a secondary dome.' },
  { id: 'alternans', name: 'Pulsus alternans (severe LV dysfunction)', hr: 90, s: [130, 113], d: 80, shape: 'radial', resp: 0,
    summary: 'Strictly regular RR intervals, with the systolic pressure alternating strong and weak beat to beat (about 130 and 113). Regular timing tells it apart from bigeminy. Best seen in distal arteries; a sign of severe LV systolic dysfunction.' },
  { id: 'paradoxus', name: 'Pulsus paradoxus (cardiac tamponade)', hr: 110, s: 108, d: 72, shape: 'radial', paradox: 12, resp: 0,
    summary: 'A fall in systolic pressure of more than 10 mmHg with spontaneous inspiration: here about 108 at end-expiration and 96 at peak inspiration (a 12 mmHg fall). Watch whole breathing cycles (the shaded bands mark inspiration). Tamponade; also severe asthma, COPD and SVC obstruction.' },
  { id: 'brady', name: 'Bradycardia with a wide pulse pressure', hr: 45, s: 145, d: 60, shape: 'radial', resp: 2,
    summary: 'A slow rate and a long diastolic run-off with a wide pulse pressure. The long, sloping diastole can look slurred, mimicking an overdamped line: check with a flush test.' },
];
export const patient = (id) => PATIENTS.find((p) => p.id === id) || PATIENTS[0];

export const SITES = {
  radial: { name: 'Radial artery', short: 'RAD' },
  aortic: { name: 'Central aorta (femoral catheter, advanced)', short: 'AO' },
};

/** ECG-referenced times (s from P-wave onset). Ejection time from Weissler's regression (413 − 1.7·HR ms). */
export function timing(hr) {
  const RR = 60 / hr, tR = 0.18, QT = 0.4 * Math.sqrt(RR);
  return { RR, tP: 0.06, tR, QT, et: 0.413 - 0.0017 * hr };
}
// aortic upstroke 60 ms after the R wave (pre-ejection); radial foot 160 ms after it (spec: ~160–180 ms)
export const FOOT = { aortic: 0.06, radial: 0.16 };

// periodic monotone cubic Hermite (Fritsch-Butland slopes) through [t, p] keys in [0, RR) (from the RHC sim)
function makeSpline(keys, RR) {
  const k = keys.map(([t, p]) => [((t % RR) + RR) % RR, p]).sort((a, b) => a[0] - b[0]);
  const ts = [k.at(-1)[0] - RR, ...k.map((x) => x[0]), k[0][0] + RR, k[1][0] + RR];
  const ps = [k.at(-1)[1], ...k.map((x) => x[1]), k[0][1], k[1][1]];
  const n = ts.length, d = [], m = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i++) d.push((ps[i + 1] - ps[i]) / (ts[i + 1] - ts[i]));
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) continue;
    const h0 = ts[i] - ts[i - 1], h1 = ts[i + 1] - ts[i];
    m[i] = 3 * (h0 + h1) / ((2 * h1 + h0) / d[i - 1] + (h1 + 2 * h0) / d[i]);
  }
  return (t) => {
    t = ((t % RR) + RR) % RR;
    let i = 1; while (i < n - 2 && t >= ts[i + 1]) i++;
    if (t < ts[i]) i = 0;
    const h = ts[i + 1] - ts[i], u = (t - ts[i]) / h, u2 = u * u, u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ps[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ps[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

const cache = new Map();
/** One beat's normalised curve q(τ), τ = time from the foot, for a shape and heart rate. */
export function beatCurve(shapeId, hr) {
  const id = `${shapeId}:${hr}`;
  if (cache.has(id)) return cache.get(id);
  const S = SHAPES[shapeId], T = timing(hr), keys = S.sys.map(([u, q, l]) => [u * T.et, q, l]);
  const [t1, q1] = keys.at(-1), span = T.RR - t1;
  for (const x of [0.12, 0.3, 0.55, 0.8]) keys.push([t1 + x * span, (q1 * (Math.exp(-S.k * x) - Math.exp(-S.k))) / (1 - Math.exp(-S.k))]);
  const f = makeSpline(keys, T.RR);
  let mean = 0; for (let i = 0; i < 500; i++) mean += f((i / 500) * T.RR) / 500;
  const c = { f, keys, mean, T };
  cache.set(id, c);
  return c;
}

/** 0 at end-expiration, 1 at peak spontaneous inspiration (breath period 4.5 s, as in the RHC sim). */
export const BREATH = 4.5;
export const inspiration = (t) => 0.5 - 0.5 * Math.cos((2 * Math.PI * t) / BREATH);

const shapeAt = (pt, site) => (site === 'aortic' && pt.shape === 'radial' ? 'aortic' : pt.shape);
/** Central-to-peripheral systolic amplification (mmHg): ~11 at a normal pulse pressure, smaller when it is narrow. */
export const amplification = (pt) => Math.min(11, Math.round(0.27 * (sysOf(pt, 0) - pt.d)));
const sysOf = (pt, n) => (Array.isArray(pt.s) ? pt.s[((n % 2) + 2) % 2] : pt.s);

/** SBP and DBP of beat n at a site (before respiration is applied to the pulse in paradoxus). */
export function beatPressures(pt, n, site = 'radial', hr = pt.hr) {
  const RR = 60 / hr, foot = n * RR + timing(hr).tR + FOOT[site];
  let s = sysOf(pt, n);
  if (pt.paradox) s -= pt.paradox * inspiration(foot + 0.1);
  if (site === 'aortic') s -= amplification(pt);
  return { s, d: pt.d };
}

/** True intra-arterial pressure (mmHg) at time t (s). Regular rhythm in every scenario. */
export function pressureAt(pt, t, { site = 'radial', hr = pt.hr } = {}) {
  const T = timing(hr), RR = T.RR, off = T.tR + FOOT[site];
  const n = Math.floor((t - off) / RR), tau = t - off - n * RR;
  const c = beatCurve(shapeAt(pt, site), hr), q = c.f(tau);
  // the diastolic run-off before this beat's foot belongs to beat n (q falls to 0 at the next foot)
  const { s, d } = beatPressures(pt, n, site, hr);
  let p = d + q * (s - d);
  if (pt.resp) p -= pt.resp * inspiration(t); // small spontaneous respiratory swing
  return p;
}

/** Seconds since the foot of the current beat's upstroke; ejection ends at timing(hr).et. Drives whip and end-pressure. */
export function systoleAge(pt, t, { site = 'radial', hr = pt.hr } = {}) {
  const T = timing(hr), off = T.tR + FOOT[site];
  return ((t - off) % T.RR + T.RR) % T.RR;
}

/** Wave labels (notch, P1, P2, spike, dome) whose time falls in (t0, t1]. */
export function labelsIn(pt, t0, t1, { site = 'radial', hr = pt.hr } = {}) {
  const T = timing(hr), off = T.tR + FOOT[site], c = beatCurve(shapeAt(pt, site), hr), out = [];
  for (const [kt, , label] of c.keys) {
    if (!label) continue;
    for (let n = Math.floor((t0 - off) / T.RR) - 1; n <= Math.floor((t1 - off) / T.RR) + 1; n++) {
      const t = off + kt + n * T.RR;
      if (t > t0 && t <= t1) out.push({ t, label });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

const g = (t, mu, s) => Math.exp(-0.5 * ((t - mu) / s) ** 2);
/** Lead II-like ECG (mV): Gaussian P, Q, R, S, T waves (from the RHC sim, sinus only). */
export function ecgAt(pt, t, { hr = pt.hr } = {}) {
  const T = timing(hr), RR = T.RR, ph = ((t % RR) + RR) % RR;
  const beat = (x) => 0.15 * g(x, T.tP, 0.022) - 0.1 * g(x, T.tR - 0.022, 0.007) + 1.1 * g(x, T.tR, 0.009)
    - 0.25 * g(x, T.tR + 0.024, 0.009) + 0.3 * g(x, T.tR + T.QT - 0.1, 0.045);
  return beat(ph) + beat(ph + RR) + beat(ph - RR);
}

/** SBP / DBP / MAP of a trace: max, min and time-average over whole beats. */
export function stats(ps) {
  let s = -Infinity, d = Infinity, m = 0;
  for (const p of ps) { if (p > s) s = p; if (p < d) d = p; m += p; }
  return { sbp: s, dbp: d, map: m / ps.length };
}

/** True values over `beats` whole beats from t0, sampled at fs (Hz). */
export function trueStats(pt, { site = 'radial', hr = pt.hr, t0 = 0, beats = 2, fs = 1000 } = {}) {
  const ps = [], RR = 60 / hr;
  for (let t = t0; t < t0 + beats * RR; t += 1 / fs) ps.push(pressureAt(pt, t, { site, hr }));
  return stats(ps);
}
