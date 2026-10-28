// Static "Model & limits" page (same role as the bronchoscopy, ventilator and RHC simulators').
export const MODEL_HTML = `
<div class="prose">
<h2>How the model works</h2>
<p>The patient, the measurement system and the scoring are plain JavaScript modules (<code>src/sim</code>, <code>src/modes/scoring.js</code>) with no rendering dependency and unit tests. The monitor and the 3D bedside only draw their output. The patient's true pressure and the displayed pressure are computed as two separate signals, and every fault is a transformation between them.</p>

<h3>The patient</h3>
<p>Each beat is timed from a synthetic ECG (Gaussian P, QRS and T waves; PR 0.18 s; QT by Bazett with QTc 0.40 s). The ejection time follows Weissler's regression (413 − 1.7 × heart rate ms). The radial upstroke starts 160 ms after the R wave and the central aortic one 60 ms after it. A beat is a handful of keypoints (foot, peak, shoulder, dicrotic notch, dicrotic wave) on that timeline, scaled between the DBP and the SBP, followed by an exponential diastolic run-off, all joined by a periodic monotone cubic curve so that the peak is exactly the scenario's SBP. MAP is the time average of the curve.</p>
<table><tr><th>Patient</th><th>Seed (illustrative)</th><th>How it is built</th></tr>
<tr><td>Normal radial</td><td>120/80, MAP 95, 75/min</td><td>Early sharp peak, late systolic shoulder, notch at the end of ejection</td></tr>
<tr><td>Parvus et tardus</td><td>98/78</td><td>Peak at 80% of ejection, no notch, sustained systole</td></tr>
<tr><td>Bisferiens</td><td>120/55</td><td>Two peaks with a mid-systolic dip, fast run-off</td></tr>
<tr><td>Spike-and-dome</td><td>SBP 125</td><td>Early spike, dip, secondary dome</td></tr>
<tr><td>Alternans</td><td>SBP 130 / 113</td><td>Alternate beats scaled; RR strictly regular</td></tr>
<tr><td>Paradoxus</td><td>108 → 96</td><td>Each beat's SBP falls by 12 × the inspiratory phase at its foot (breath period 4.5 s)</td></tr>
<tr><td>Bradycardia</td><td>145/60 at 45/min</td><td>Normal shape with a long run-off (a confounder for overdamping)</td></tr></table>
<p>The other patients have a 2 mmHg respiratory swing. The central aortic trace has a later, rounder peak, a crisper notch and an SBP about 11 mmHg lower (0.27 × the pulse pressure, up to 11), with the MAP within about 1 mmHg of the radial MAP.</p>

<h3>The measurement system</h3>
<p>The fluid-filled catheter, tubing and transducer are a second-order system: x″ = ωn²(u − x) − 2ζωn·x′, with ωn = 2π·fn. It is integrated with semi-implicit (symplectic) Euler in 0.1 ms sub-steps, which is stable well beyond the forward-Euler limit Δt &lt; 2ζ/ωn quoted in the specification, and sampled for the monitor at 500 Hz. The input u is the true pressure plus tip artefacts, or the bag pressure while the flush valve is open, or 0 with the stopcock open to air.</p>
<table><tr><th>System state</th><th>fn (Hz)</th><th>ζ</th><th>Flush count</th></tr>
<tr><td>Correct set-up (20 G, ≤ 122 cm stiff tubing)</td><td>24</td><td>0.32</td><td>2 (adequate)</td></tr>
<tr><td>Long, compliant extension</td><td>× 0.5</td><td>× 0.6</td><td>4 (underdamped)</td></tr>
<tr><td>Resonant intact system</td><td>24</td><td>0.12</td><td>3 or more</td></tr>
<tr><td>+ sealed-bubble damping device</td><td>unchanged</td><td>+ 0.3</td><td>back to 1–2</td></tr>
<tr><td>Small air bubble</td><td>× 0.45</td><td>+ 0.15</td><td>1 ("adequate", but fn ~11 Hz)</td></tr>
<tr><td>Large air bubble</td><td>× 0.35</td><td>≥ 1.4</td><td>0 (overdamped)</td></tr>
<tr><td>Clot (forms after ~25 s with the bag under 200 mmHg)</td><td>× 0.6</td><td>≥ 1.5</td><td>0</td></tr>
<tr><td>Kink or clamp</td><td>× 0.7</td><td>≥ 2</td><td>0</td></tr></table>
<p>These effects are teaching approximations that follow the directions in the cited sources, not a fluid-mechanics model of real tubing.</p>
<p><b>Flush test.</b> The count uses a fixed method so it is reproducible: from a settled plateau 200 mmHg above baseline, positive peaks more than 1 mmHg above the baseline within 0.6 s of release, with detections under 50 ms apart merged. 1–2 is adequate, more than 2 underdamped, under 1 overdamped (REBEL EM, StatPearls; OpenAnesthesia uses 1.5–2). The Free explore box also derives fd from the first two peak times, ζ from their ratio (logarithmic decrement) and fn = fd/√(1 − ζ²).</p>
<p><b>Offsets.</b> Hydrostatic error is 0.75 mmHg for every cm the transducer sits below the phlebostatic axis (negative above). Zero drift is a constant offset until the transducer is zeroed; zeroing is accepted only with the stopcock open to air and sets the reading open to air to 0. Zeroing does not change the levelling error, and levelling does not change the zero offset.</p>
<p><b>Central catheter artefacts (advanced).</b> Catheter whip adds a 12 Hz oscillation decaying with a 0.12 s time constant at the start of each systole (a synthetic seed: the sources do not quantify it). The end-pressure artefact adds a half-sine of 3 mmHg over ejection (flow into an end hole; +2–4 mmHg in the source). Neither changes the damping ratio.</p>
<p><b>Monitor numerics.</b> SBP, DBP and MAP are the maximum, minimum and mean of the displayed trace over the last 4 s, paused during and for 1.5 s after a flush.</p>

<h3>What the unit tests check</h3>
<ul>
<li>The specification's numerical checks: underdamped (10 Hz, ζ 0.15) SBP overestimated by more than 8 mmHg (131 here, 132.5 in the specification), optimal (15 Hz, 0.64) within 1.5, overdamped (8 Hz, 1.5) underestimated, MAP within 1.5 in all three; flush counts 5, 1 and 0; 10 cm low adds 7.5 to SBP, DBP and MAP; radial SBP 11 above aortic with MAP within 1.3; end-pressure +3 SBP and about +0.6 MAP.</li>
<li>Every patient's seed values (AS pulse pressure 20, AR 65, alternans 130/113, paradoxus fall 12 from 108).</li>
<li>Every fault gives the flush verdict its type implies, every game case starts broken and is fixed by its own answer, the quiz answers match the model, and the scoring.</li>
</ul>

<h3>Limits</h3>
<p><b>Not validated for clinical use. Educational effect not evaluated.</b></p>
<ul>
<li>The waveforms are synthetic shapes with illustrative seed values, not recordings. Real pulse contours vary widely between patients, sites and states, and the carotid-derived pulse descriptions transfer to radial traces only approximately.</li>
<li>The measurement system is an ideal linear second-order model with unity gain. That is why MAP is almost untouched by damping here: it is a property of the model, not evidence for or against the clinical claim. Real systems are not perfectly linear, and their fn and ζ depend on the actual catheter, tubing, stopcocks and transducer.</li>
<li>The fault effects on fn and ζ are directional teaching values. Real faults combine, evolve and are often partial.</li>
<li>The overdamped DBP direction is a source disagreement (overestimated in most sources, "usually accurate" in StatPearls); the model shows a small rise.</li>
<li>Not modelled: impact artefact, monitor filtering and sampling, transducer non-linearity, catheter position in the vessel, arterial spasm, ectopic beats (alternans after a PVC), positive-pressure ventilation and pulse pressure variation, cuff comparison, complications, cannulation itself and the Allen test.</li>
<li>The 3D bedside is schematic. It teaches the height relationships, not equipment handling. This simulator does not teach manual skill, sterile technique or device use.</li>
</ul>

<h3>Privacy</h3>
<p>Everything runs in your browser. Settings, the tour flag and best scores are kept in local storage only. No analytics, no cookies, no network calls, no patient data.</p>

<h3>Sources</h3>
<p>The author's arterial line research specification (2026), citing: the 5-step arterial catheter review (Critical Care 2020), StatPearls, OpenAnesthesia, REBEL EM, Deranged Physiology, the intraoperative invasive blood pressure pitfalls review (Cureus), the central-to-peripheral amplification review, Contemporary PAC Part 1, Clinical Methods (the carotid pulse), emresident, Thoracic Key and the Cleveland Clinic board review. See the Learn tab, "Sources".</p>
</div>`;
