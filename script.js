'use strict';

const CONTACT_EMAIL = 'daniel.stanneveld@gmail.com';

const menuButton = document.querySelector('.menu-button');
const nav = document.querySelector('.site-nav');
const joinModal = document.querySelector('#join-modal');
const infoModal = document.querySelector('#info-modal');
const infoTitle = document.querySelector('#info-title');
const infoBody = document.querySelector('#info-body');

menuButton?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
});

document.querySelectorAll('.site-nav a').forEach(link => {
  link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
  });
});

document.querySelectorAll('.join-trigger').forEach(button => {
  button.addEventListener('click', () => joinModal.showModal());
});

document.querySelectorAll('.modal-close').forEach(button => {
  button.addEventListener('click', () => button.closest('dialog')?.close());
});

document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    const outside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
    if (outside) dialog.close();
  });
});

document.querySelector('#join-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const subject = encodeURIComponent(`Ik wil meedoen met DE GROND — ${form.get('name')}`);
  const body = encodeURIComponent([
    'Hallo DE GROND,',
    '',
    `Mijn naam: ${form.get('name')}`,
    `Mijn e-mailadres: ${form.get('email')}`,
    `Ik wil bijdragen als: ${form.get('role')}`,
    '',
    'Mijn bericht:',
    String(form.get('message') || 'Geen aanvullend bericht.'),
    '',
    'Ik stuur dit bericht uit eigen beweging via mijn eigen e-mailprogramma.'
  ].join('\n'));

  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
});

const privacyText = `
  <p><strong>Deze gratis website plaatst geen trackingcookies en bewaart geen persoonsgegevens.</strong></p>
  <p>Het interesseformulier opent alleen een bericht in je eigen e-mailprogramma. Er wordt niets via deze website verstuurd of opgeslagen.</p>
  <p>Let op: zodra DE GROND officiële leden registreert, gaat het om gevoelige persoonsgegevens. Gebruik daarvoor een beveiligd ledensysteem, een duidelijke privacyverklaring en passende organisatorische maatregelen.</p>
`;

const cookieText = `
  <p>Deze versie gebruikt geen advertentiecookies, analysecookies of externe trackers.</p>
  <p>Alle JavaScript en vormgeving staan lokaal in de websitebestanden. Daardoor wordt de site snel, rustig en privacyvriendelijk geladen.</p>
`;

document.querySelector('#privacy-open')?.addEventListener('click', () => {
  infoTitle.textContent = 'Privacy';
  infoBody.innerHTML = privacyText;
  infoModal.showModal();
});

document.querySelector('#cookies-open')?.addEventListener('click', () => {
  infoTitle.textContent = 'Cookies';
  infoBody.innerHTML = cookieText;
  infoModal.showModal();
});

document.querySelector('#year').textContent = new Date().getFullYear();

const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal').forEach(element => observer.observe(element));


/* ========================================
   SCROLL-ANIMATIES
======================================== */

const revealElements = document.querySelectorAll(".reveal");

const revealObserver = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return;
      }

      entry.target.classList.add("is-visible");

      // Animatie gebeurt maar één keer
      observer.unobserve(entry.target);
    });
  },
  {
    threshold: 0.15,
    rootMargin: "0px 0px -40px 0px",
  }
);

revealElements.forEach((element) => {
  revealObserver.observe(element);
});
