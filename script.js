const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.nav-links');
menuButton?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
document.querySelectorAll('.nav-links a').forEach((link) => {
  link.addEventListener('click', () => {
    navigation.classList.remove('open');
    menuButton?.setAttribute('aria-expanded', 'false');
    menuButton?.setAttribute('aria-label', 'Open navigation');
  });
});
document.querySelector('#year').textContent = new Date().getFullYear();

/* Premium entrance and count-up motion */
const revealTargets = document.querySelectorAll('.service-card,.values-strip>div,.project,.contact-panel');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    });
  }, {threshold: 0.12});
  revealTargets.forEach(el => { el.classList.add('reveal'); revealObserver.observe(el); });
}
const counters = document.querySelectorAll('[data-count]');
if ('IntersectionObserver' in window && counters.length) {
  const counterObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting || entry.target.dataset.done) return;
    const el = entry.target; el.dataset.done = '1';
    const target = Number(el.dataset.count); const start = performance.now(); const duration = 1000;
    const tick = now => { const p = Math.min((now-start)/duration,1); el.textContent = String(Math.round(target*(1-Math.pow(1-p,3)))) + '+'; if(p<1) requestAnimationFrame(tick); };
    requestAnimationFrame(tick); counterObserver.unobserve(el);
  }), {threshold:.5});
  counters.forEach(el => counterObserver.observe(el));
}
/* Replace sample inspiration cards with real projects published from the admin dashboard. */
fetch('/api/projects').then(r => r.ok ? r.json() : []).then(projects => {
  if (!Array.isArray(projects) || !projects.length) return;
  const gallery = document.querySelector('#projectGallery');
  if (!gallery) return;
  gallery.innerHTML = projects.map((p,i) => `
    <article class="project ${i===0?'project-large':''}">
      <img src="${p.image}" alt="${escapeHtml(p.title)}" loading="lazy">
      <div class="project-overlay"><span>${escapeHtml(p.category)}</span><h3>${escapeHtml(p.title)}</h3><p>${escapeHtml(p.location || 'Samsen project')}</p></div>
    </article>`).join('');
  document.querySelector('#galleryNote').textContent = 'Selected project photographs published by Samsen Engineering Contractor.';
}).catch(() => {});
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
