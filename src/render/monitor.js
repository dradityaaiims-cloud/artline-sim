// Bedside-style sweep monitor on a canvas: ECG on top, arterial pressure below, numerics on the right.
// Draws whatever samples it is given; all physiology is in src/sim. Adapted from the RHC sim's monitor.
const GAP = 0.18;   // erase bar ahead of the sweep head (s)

/** Time of the last R wave (ECG local maximum above 0.7 mV) at or before t, within 2 s, or null. */
export function rPeakBefore(samples, t) {
  for (let i = samples.length - 2; i > 0; i--) {
    const s = samples[i];
    if (s.t > t) continue;
    if (s.t < t - 2) break;
    if (s.ecg > 0.7 && s.ecg >= samples[i - 1].ecg && s.ecg >= samples[i + 1].ecg) return s.t;
  }
  return null;
}

export class Monitor {
  constructor(canvas) {
    this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.samples = []; this.marks = []; this.scale = 200; this.sweep = 6;
    this.labelsOn = true; this.truthOn = false; this.breathOn = false; this.numerics = null; this.hideNumbers = false;
    this.caliper = null; this.pin = null; // fractions of the plot width, or null
    const at = (e) => { const r = canvas.getBoundingClientRect(), pad = 44; return Math.min(1, Math.max(0, (e.clientX - r.left - pad) / (r.width - pad - this.numW() / this.dpr - 8))); };
    canvas.addEventListener('pointerdown', (e) => { if (this.caliper === null) return; this.caliper = at(e); canvas.setPointerCapture(e.pointerId); this.dragging = true; });
    canvas.addEventListener('pointermove', (e) => { if (this.dragging) this.caliper = at(e); });
    canvas.addEventListener('dblclick', (e) => { if (this.caliper !== null) this.pin = this.pin === null ? at(e) : null; });
    for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, () => { this.dragging = false; });
    new ResizeObserver(() => this.resize()).observe(canvas);
    this.resize();
  }
  resize() {
    const r = this.cv.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
    this.cv.width = Math.max(1, r.width * dpr); this.cv.height = Math.max(1, r.height * dpr);
    this.dpr = dpr;
  }
  numW() { return Math.min(170, this.cv.width / this.dpr * 0.24) * this.dpr; }
  clear() { this.samples = []; this.marks = []; }
  /** sample = {t, ecg, p, truth, flush, insp}; labels = [{t, label}] wave labels */
  push(sample, labels = []) {
    this.samples.push(sample);
    for (const l of labels) this.marks.push(l);
    const cut = sample.t - this.sweep - 1;
    while (this.samples.length && this.samples[0].t < cut - 1) this.samples.shift();
    while (this.marks.length && this.marks[0].t < cut) this.marks.shift();
  }

  draw(now) {
    const { ctx, dpr } = this, W = this.cv.width, H = this.cv.height, NW = this.numW(), PW = W - NW;
    const pad = 44 * dpr, ecgH = H * 0.22, top = ecgH + 14 * dpr, bot = H - 18 * dpr, SW = this.sweep;
    const xOf = (t) => pad + (((t % SW) + SW) % SW) / SW * (PW - pad - 8 * dpr);
    const yP = (p) => bot - (p / this.scale) * (bot - top);
    const yE = (v) => ecgH * 0.62 - v * ecgH * 0.42;
    ctx.fillStyle = '#03080a'; ctx.fillRect(0, 0, W, H);
    const live = this.samples.filter((s) => s.t > now - SW + GAP && s.t <= now);

    // inspiration bands (spontaneous breathing): helps read pulsus paradoxus over whole cycles
    if (this.breathOn) {
      ctx.fillStyle = '#6aa8ff1f';
      let a = null, px = null;
      const band = (x0, x1) => ctx.fillRect(x0, top - 8 * dpr, x1 - x0, bot - top + 8 * dpr);
      for (const s of live) { // one rectangle per inspiratory run (split at the sweep wrap)
        const x = xOf(s.t), on = s.insp > 0.5;
        if (a !== null && (!on || x < px)) { band(a, px); a = null; }
        if (on && a === null) a = x;
        px = x;
      }
      if (a !== null) band(a, px);
    }
    // grid
    const step = this.scale <= 160 ? 20 : this.scale <= 200 ? 40 : 50;
    ctx.font = `${11 * dpr}px ui-monospace, Menlo, monospace`; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let p = 0; p <= this.scale; p += step) {
      ctx.strokeStyle = p === 0 ? '#4a2b30' : '#24151a'; ctx.lineWidth = dpr;
      ctx.beginPath(); ctx.moveTo(pad, yP(p)); ctx.lineTo(PW, yP(p)); ctx.stroke();
      ctx.fillStyle = '#9a6f78'; ctx.fillText(String(p), pad - 6 * dpr, yP(p));
    }
    ctx.save(); ctx.translate(12 * dpr, (top + bot) / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center';
    ctx.fillText('mmHg', 0, 0); ctx.restore();
    ctx.textAlign = 'left'; ctx.fillStyle = '#36e2b4'; ctx.fillText('II', 8 * dpr, ecgH * 0.3);
    ctx.fillStyle = '#ff5a6e'; ctx.fillText('ART', 6 * dpr, top + 6 * dpr);

    const trace = (get, color, width, dash) => {
      ctx.strokeStyle = color; ctx.lineWidth = width * dpr; ctx.lineJoin = 'round'; ctx.setLineDash(dash ? [5 * dpr, 4 * dpr] : []); ctx.beginPath();
      let px = null;
      for (const s of live) { const x = xOf(s.t), y = get(s); if (px === null || x < px) ctx.moveTo(x, y); else ctx.lineTo(x, y); px = x; }
      ctx.stroke(); ctx.setLineDash([]);
    };
    trace((s) => yE(s.ecg), '#36e2b4', 1.6);
    ctx.save(); ctx.beginPath(); ctx.rect(pad, top - 10 * dpr, PW - pad, bot - top + 14 * dpr); ctx.clip(); // off-scale flush clips at the top
    if (this.truthOn) trace((s) => yP(s.truth), '#ffffff88', 1.4, true);
    trace((s) => yP(Math.min(s.p, this.scale * 1.03)), '#ff5a6e', 2.2); // off-scale flush pegs at the top
    ctx.restore();

    if (this.labelsOn) {
      ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillStyle = '#e8eef6'; ctx.font = `600 ${11 * dpr}px Inter, system-ui, sans-serif`;
      let lastX = -Infinity;
      for (const m of this.marks) {
        if (m.t <= now - SW + GAP || m.t > now) continue;
        const s = live.find((q) => q.t >= m.t); if (!s || s.flush) continue;
        if (Math.abs(xOf(m.t) - lastX) < 40 * dpr) continue; // no pile-up at fast rates
        lastX = xOf(m.t);
        ctx.fillText(m.label, xOf(m.t) + (m.label === 'notch' ? 16 * dpr : 0), Math.max(top, yP(s.p) - 6 * dpr));
      }
    }
    ctx.fillStyle = '#03080a'; ctx.fillRect(xOf(now) + 1, 0, (GAP / SW) * (PW - pad), H); // sweep head
    if (this.caliper !== null) this.drawCaliper(live, xOf, yP, pad, PW, H, SW);
    this.drawNumerics(PW, NW, H);
  }

  drawNumerics(x0, w, H) {
    const { ctx, dpr } = this, n = this.numerics;
    ctx.fillStyle = '#070b0e'; ctx.fillRect(x0, 0, w, H);
    ctx.strokeStyle = '#243142'; ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke();
    const cx = x0 + w / 2;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#36e2b4'; ctx.font = `600 ${11 * dpr}px ui-monospace, Menlo, monospace`; ctx.fillText('HR', cx, H * 0.08);
    ctx.font = `700 ${Math.round(w * 0.2)}px ui-monospace, Menlo, monospace`; ctx.fillText(n?.hr ?? '--', cx, H * 0.17);
    ctx.fillStyle = '#ff5a6e'; ctx.font = `600 ${11 * dpr}px ui-monospace, Menlo, monospace`; ctx.fillText('ART  mmHg', cx, H * 0.36);
    const hide = this.hideNumbers || !n?.sbp;
    ctx.font = `700 ${Math.round(w * 0.2)}px ui-monospace, Menlo, monospace`;
    ctx.fillText(hide ? '---/--' : `${n.sbp}/${n.dbp}`, cx, H * 0.47);
    ctx.font = `700 ${Math.round(w * 0.17)}px ui-monospace, Menlo, monospace`;
    ctx.fillText(hide ? '(--)' : `(${n.map})`, cx, H * 0.6);
    if (n?.flag) { ctx.fillStyle = '#ffb02e'; ctx.font = `600 ${10 * dpr}px ui-monospace, Menlo, monospace`; ctx.fillText(n.flag, cx, H * 0.72); }
    ctx.fillStyle = '#8da0b6'; ctx.font = `${10 * dpr}px ui-monospace, Menlo, monospace`; ctx.fillText(`0–${this.scale} · ${this.sweep}s`, cx, H * 0.93);
  }

  /** Dotted line(s): reads time after the R wave and the pressure; with a pinned line (double-click), the interval and its frequency. */
  drawCaliper(live, xOf, yP, pad, PW, H, SW) {
    const { ctx, dpr } = this, X = (f) => pad + f * (PW - pad - 8 * dpr);
    const nearest = (cx) => { let s = null, best = Infinity; for (const q of live) { const d = Math.abs(xOf(q.t) - cx); if (d < best) { best = d; s = q; } } return best <= 6 * dpr ? s : null; };
    const line = (cx, col) => { ctx.strokeStyle = col; ctx.lineWidth = 1.2 * dpr; ctx.setLineDash([3 * dpr, 4 * dpr]); ctx.beginPath(); ctx.moveTo(cx, 0); ctx.lineTo(cx, H); ctx.stroke(); ctx.setLineDash([]); };
    const cx = X(this.caliper); line(cx, '#e8eef6');
    if (this.pin !== null) line(X(this.pin), '#6aa8ff');
    const s = nearest(cx); if (!s) return;
    const r = rPeakBefore(this.samples, s.t);
    let text = `${r !== null ? `R + ${Math.round((s.t - r) * 1000)} ms · ` : ''}${s.p.toFixed(0)} mmHg`;
    const p = this.pin !== null ? nearest(X(this.pin)) : null;
    if (p) { const dt = Math.abs(s.t - p.t); if (dt > 0.004) text += ` · Δ ${Math.round(dt * 1000)} ms = ${(1 / dt).toFixed(1)} Hz`; }
    ctx.font = `600 ${12 * dpr}px ui-monospace, Menlo, monospace`;
    const w = ctx.measureText(text).width + 12 * dpr, bx = Math.min(PW - w - 4 * dpr, Math.max(pad, cx - w / 2));
    ctx.fillStyle = '#0b1119ee'; ctx.fillRect(bx, 4 * dpr, w, 20 * dpr);
    ctx.fillStyle = '#e8eef6'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bx + 6 * dpr, 14 * dpr);
    ctx.fillStyle = '#ff5a6e'; ctx.beginPath(); ctx.arc(cx, yP(s.p), 3.5 * dpr, 0, 2 * Math.PI); ctx.fill();
  }
}
