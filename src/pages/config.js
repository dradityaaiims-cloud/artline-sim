// Site settings for the About page. Nothing here is secret.
export const CONFIG = {
  version: '1.0.2',
  year: 2026,
  doi: '10.5281/zenodo.23750835',
  title: "Dr. Singh's Art Line Simulator: an open educational arterial line and pressure transducer simulator",
  // Contact email split so it is not plain text in the page source (reduces scraping).
  emailUser: 'draditya.aiims',
  emailDomain: 'gmail.com',
  // Optional: a public feedback form (e.g. a Google Form link). Empty = the Feedback button falls back to email.
  feedbackUrl: '',
};
export const mailto = (subject = '') => `mailto:${CONFIG.emailUser}@${CONFIG.emailDomain}${subject ? '?subject=' + encodeURIComponent(subject) : ''}`;
