// About page: author, links, feedback, citation, disclosures, privacy (same structure as the bronchoscopy and ventilator simulators').
import { CONFIG, mailto } from './config.js';

const ME = {
  name: 'Aditya Singh, MD',
  photo: 'assets/aditya-singh.jpg',
  bio: [
    'I am an internal medicine resident with an interest in pulmonary and critical care medicine and in medical education. I build free interactive web apps and write about health and medical education.',
    'I made this simulator because the arterial line is the most common invasive monitor, and the number on the screen is easy to trust when it should not be. Breaking and fixing the measurement system, and seeing the true pressure beside the displayed one, lets students, nurses, residents and fellows learn when the trace reflects the patient and when it does not.',
  ],
  links: [
    ['LinkedIn', 'https://www.linkedin.com/in/drsinghaditya03/'],
    ['Linktree (all my links)', 'https://linktr.ee/aditya.md'],
    ['Google Scholar', 'https://scholar.google.com/citations?hl=en&user=-EqF9yEAAAAJ'],
    ['Articles on KevinMD', 'https://kevinmd.com/post-author/aditya-singh'],
    ['Writing on Medium', 'https://medium.com/@draditya.aiims'],
  ],
  apps: [
    ["Dr. Singh's Vent Sim (mechanical ventilator simulator)", 'https://dradityaaiims-cloud.github.io/vent-sim/'],
    ["Dr. Singh's Bronch Sim (bronchoscopy simulator)", 'https://dradityaaiims-cloud.github.io/bronchoscopy-sim/'],
    ["Dr. Singh's RHC Sim (right heart catheterization simulator)", 'https://dradityaaiims-cloud.github.io/rhc-sim/'],
  ],
};

const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const a = (href, text) => `<a href="${href}" target="_blank" rel="noopener noreferrer">${esc(text)}</a>`;

function citations() {
  const ref = CONFIG.doi ? `https://doi.org/${CONFIG.doi}` : 'https://github.com/dradityaaiims-cloud';
  return {
    apaText: `Singh, A. (${CONFIG.year}). ${CONFIG.title} (Version ${CONFIG.version}) [Computer software]. ${ref}`,
    apa: `Singh, A. (${CONFIG.year}). <i>${esc(CONFIG.title)}</i> (Version ${CONFIG.version}) [Computer software]. ${ref}`,
    bib: `@software{singh_artlinesim_${CONFIG.year},\n  author  = {Singh, Aditya},\n  title   = {${CONFIG.title}},\n  year    = {${CONFIG.year}},\n  version = {${CONFIG.version}},\n${CONFIG.doi ? `  doi     = {${CONFIG.doi}},\n` : ''}  url     = {${ref}}\n}`,
  };
}

export function renderAbout(box) {
  const c = citations();
  const photo = `${import.meta.env.BASE_URL}${ME.photo}`;
  box.innerHTML = `<div class="prose">
<h2>About</h2>
<div class="aboutme">
  <img class="headshot" src="${photo}" alt="Portrait of ${esc(ME.name)}" width="180" height="180">
  <div>
    <h3>${esc(ME.name)}</h3>
    ${ME.bio.map((p) => `<p>${esc(p)}</p>`).join('')}
  </div>
</div>

<h3>Find me</h3>
<ul>${ME.links.map(([t, u]) => `<li>${a(u, t)}</li>`).join('')}</ul>
<h3>More apps by me</h3>
<ul>${ME.apps.map(([t, u]) => `<li>${a(u, t)}</li>`).join('')}</ul>

<h3>Contact, feedback and bug reports</h3>
<p>Questions, ideas, corrections and bug reports are welcome. For bugs, please say which mode, scenario, browser and what you pressed.</p>
<div class="btns">
  <a class="btnlink primary" id="fb-link" target="_blank" rel="noopener noreferrer">Give feedback / report a bug</a>
  <a class="btnlink" id="mail-link">Email me</a>
</div>

<h3>Cite this tool</h3>
<p>If you use this simulator in teaching or in a publication, please cite it${CONFIG.doi ? ` (DOI: <a href="https://doi.org/${CONFIG.doi}" target="_blank" rel="noopener noreferrer">${CONFIG.doi}</a>)` : ''}.</p>
<p><b>APA</b></p><pre class="cite">${c.apa}</pre><button data-copy="apa">Copy APA</button>
<p><b>BibTeX</b></p><pre class="cite">${esc(c.bib)}</pre><button data-copy="bib">Copy BibTeX</button>

<h3>Disclosures</h3>
<ul>
<li><b>Purpose.</b> Educational use only. This is not a medical device and must not be used for clinical decisions, procedure planning, assessment or exams. All waveforms, pressures and cases are simulated. Never enter patient information into any part of this site.</li>
<li><b>Manufacturers.</b> Not affiliated with or endorsed by any catheter, transducer, flush device or monitoring manufacturer. The monitor, transducer and damping device are generic.</li>
<li><b>Assistant.</b> Boba, the assistant dog, is rule-based (no AI model, no network) and is shared with the ventilator, bronchoscopy and RHC simulators.</li>
<li><b>3D bedside.</b> The patient, bed, pole, bag and transducer are simple schematic shapes drawn by the simulator; no anatomical data are used.</li>
<li><b>Funding and conflicts of interest.</b> None declared.</li>
<li><b>Software development.</b> The software was developed with AI coding assistance (Claude, by Anthropic), directed by the author, and is covered by automated tests of the waveform, measurement-system and scoring logic.</li>
<li><b>Views.</b> The views here are my own and do not represent my employer or training program.</li>
<li><b>Licence.</b> The software is open source under the MIT licence.</li>
</ul>

<h3>Privacy</h3>
<p>The simulator runs entirely in your browser. Progress, scores and settings are saved only in your browser's local storage. This site does not use analytics or cookies. If you send feedback by email, I receive what you type and your email address. Please do not include anything identifying a patient.</p>
</div>`;
  const fb = box.querySelector('#fb-link');
  fb.href = CONFIG.feedbackUrl || mailto('Art Line Simulator feedback / bug report');
  if (!CONFIG.feedbackUrl) fb.removeAttribute('target');
  box.querySelector('#mail-link').href = mailto('Art Line Simulator');
  box.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    const text = b.dataset.copy === 'apa' ? c.apaText : c.bib;
    try { await navigator.clipboard.writeText(text); b.textContent = 'Copied'; } catch { prompt('Copy this citation', text); }
    setTimeout(() => { b.textContent = b.dataset.copy === 'apa' ? 'Copy APA' : 'Copy BibTeX'; }, 1500);
  }));
}
