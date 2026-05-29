/* main.js - φορμα επικοινωνιας + autoresponder
   χωρις τα keys του emailjs τρεχει σε demo mode (απλα δειχνει
   thank-you modal). αν τα γεμισω τοτε στελνει 2 πραγματικα emails. */


// τα keys του emailjs. οσο μενουν "YOUR_..." ειμαστε σε demo mode.
// για να δουλεψει αληθινα: signup στο emailjs.com, φτιαξε service
// + 2 templates και βαλε τα ids εδω.
const EMAILJS_CONFIG = {
  publicKey:         'YOUR_PUBLIC_KEY',
  serviceId:         'YOUR_SERVICE_ID',
  templateAdmin:     'YOUR_ADMIN_TEMPLATE_ID',
  templateAutoreply: 'YOUR_AUTOREPLY_TEMPLATE_ID',
  ownerEmail:        'info@tsipourolarissas.gr'
};


// περιμενω το dom να φορτωσει, αλλιως querySelector γυρναει null
document.addEventListener('DOMContentLoaded', () => {

  const form = document.querySelector('.contact-form');
  if (!form) return;  // δεν ειμαστε σε contact/request-visit page

  // ειμαστε σε live mode αν: εχει φορτωσει το emailjs sdk +
  // εχω βαλει αληθινο public key
  const liveMode = !!(window.emailjs) &&
    !EMAILJS_CONFIG.publicKey.startsWith('YOUR_');

  if (liveMode) {
    emailjs.init({ publicKey: EMAILJS_CONFIG.publicKey });
  }


  form.addEventListener('submit', async (e) => {
    e.preventDefault();  // χωρις αυτο θα κανει reload η σελιδα

    // βρες ποιο submit button ειναι ορατο.
    // εχω δυο (send msg / request visit), και το ενα κρυβεται
    // μεσω css :has(). δεν μπορω να ψαξω style attribute γιατι
    // δε χρησιμοποιω inline styles - πρεπει να δω computed style.
    const allSubmitBtns = form.querySelectorAll('button[type="submit"]');
    let submitBtn = null;
    for (const btn of allSubmitBtns) {
      if (getComputedStyle(btn).display !== 'none') {
        submitBtn = btn;
        break;
      }
    }
    if (!submitBtn) submitBtn = allSubmitBtns[0] || null;

    // αλλαζω σε "Sending..." οσο γινεται η αποστολη
    const originalLabel = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending…';
    }

    // μαζευω ολα τα data της φορμας. FormData + Object.fromEntries
    // = ωραιο object με surname, forename, email κλπ
    const data = Object.fromEntries(new FormData(form).entries());
    const isVisit = data.intent === 'visit';

    // διαφορετικο αυτοματο μηνυμα ανα mode
    const autoreplyBody = isVisit
      ? `Hello ${data.forename || ''},

Thank you for requesting a visit to Tsipouro Larissas.

We have received your request and will confirm availability within 24 hours.

  • Distillery: Nikaia, Larissa
  • Open: Monday — Friday, 10:00 — 17:00 (by appointment)
  • Duration: approximately 90 minutes
  • Cost: €25 per person — includes tour, tasting, meze plate and a 200ml take-home bottle

Warm regards,
The Tsipouro Larissas Family`
      : `Hello ${data.forename || ''},

Thank you for reaching out to Tsipouro Larissas.

We have received your message and a member of our family will get back to you within 24 hours.

In the meantime, feel free to learn more about our story and our craft at our website.

Warm regards,
The Tsipouro Larissas Family`;


    // try/catch γιατι η αποστολη μπορει να σκασει (network, λαθος keys κλπ)
    try {
      if (liveMode) {
        // 1ο email: στον ιδιοκτητη
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          EMAILJS_CONFIG.templateAdmin,
          {
            ...data,
            to_email:  EMAILJS_CONFIG.ownerEmail,
            from_name: `${data.forename || ''} ${data.surname || ''}`.trim(),
            intent_label: isVisit ? 'Visit request' : 'General message'
          }
        );

        // 2ο email: autoreply στον επισκεπτη
        await emailjs.send(
          EMAILJS_CONFIG.serviceId,
          EMAILJS_CONFIG.templateAutoreply,
          {
            to_email: data.email,
            to_name:  data.forename || '',
            message:  autoreplyBody
          }
        );
      } else {
        // demo mode: τιποτα πραγματικο, μονο log + ψευτικο delay
        console.info('demo mode - no real emails sent');
        console.info('form data:', data);
        console.info('autoreply for', data.email, ':\n', autoreplyBody);
        await new Promise(r => setTimeout(r, 500));
      }

      showThankYou(data.email, isVisit);
      form.reset();

    } catch (err) {
      console.error('send failed:', err);
      alert(
        'Sorry, your message could not be sent right now.\n\n' +
        'Please email us directly at ' + EMAILJS_CONFIG.ownerEmail + '.'
      );
    } finally {
      // οτι κι αν εγινε, επαναφορα του κουμπιου
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalLabel;
      }
    }
  });
});


// φτιαχνει το modal δυναμικα και το προσθετει στο body.
// 3 τροποι να κλεισει: κουμπι, click στο backdrop, esc.
function showThankYou(email, isVisit) {
  const safeEmail = escapeHtml(email || '');
  const heading   = isVisit ? 'Visit request received' : 'Thank you!';
  const lead      = isVisit
    ? "We've received your visit request."
    : 'Your message has been received.';

  const overlay = document.createElement('div');
  overlay.className = 'thanks-overlay';
  overlay.innerHTML = `
    <div class="thanks-modal" role="dialog" aria-modal="true" aria-labelledby="thanks-heading">
      <h2 id="thanks-heading">${heading}</h2>
      <p>${lead}</p>
      <p>A confirmation email has been sent to <strong>${safeEmail}</strong>.</p>
      <p>A member of our family will be in touch within 24 hours.</p>
      <button type="button" class="age-btn" id="thanks-close">Close</button>
    </div>
  `;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();

  overlay.querySelector('#thanks-close').addEventListener('click', close);

  // click στο σκουρο backdrop (αλλα οχι μεσα στο modal)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // esc key. βγαζω τον listener μετα για να μη μενει για παντα
  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
}


// μικρη helper για να μην μπει κακο html μεσα στο modal
// (π.χ. αν καποιος βαλει <script> στο email του)
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
