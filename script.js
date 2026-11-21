const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.nav-links');
menuButton?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
}));
const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

/* Accessible automatic hero carousel */
(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const dots = [...document.querySelectorAll('.slider-dot')];
  const progress = document.querySelector('.slider-progress span');
  const previous = document.querySelector('.slider-prev');
  const next = document.querySelector('.slider-next');
  const hero = document.querySelector('.hero-slider');
  if (!slides.length || !dots.length || !hero) return;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = 6500;
  let current = 0;
  let timer = null;
  let paused = false;

  function setSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === current;
      slide.classList.toggle('active', active);
      slide.setAttribute('aria-hidden', String(!active));
    });
    dots.forEach((dot, i) => {
      const active = i === current;
      dot.classList.toggle('active', active);
      dot.setAttribute('aria-pressed', String(active));
    });
    if (progress) {
      progress.classList.remove('run');
      void progress.offsetWidth;
      if (!paused && !reducedMotion) progress.classList.add('run');
    }
  }
  function stop() {
    if (timer) window.clearInterval(timer);
    timer = null;
    progress?.classList.remove('run');
  }
  function start() {
    stop();
    if (paused || reducedMotion || document.hidden) return;
    setSlide(current);
    timer = window.setInterval(() => setSlide(current + 1), duration);
  }
  function go(index) { setSlide(index); start(); }
  previous?.addEventListener('click', () => go(current - 1));
  next?.addEventListener('click', () => go(current + 1));
  dots.forEach((dot, index) => dot.addEventListener('click', () => go(index)));
  hero.addEventListener('mouseenter', () => { paused = true; stop(); });
  hero.addEventListener('mouseleave', () => { paused = false; start(); });
  hero.addEventListener('focusin', () => { paused = true; stop(); });
  hero.addEventListener('focusout', event => {
    if (!hero.contains(event.relatedTarget)) { paused = false; start(); }
  });
  document.addEventListener('visibilitychange', () => document.hidden ? stop() : start());
  hero.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft') go(current - 1);
    if (event.key === 'ArrowRight') go(current + 1);
  });
  setSlide(0);
  start();
})();

/* Reveal content as it enters the viewport */
const revealTargets = document.querySelectorAll('.service-card,.values-strip>div,.project,.contact-panel,.proof-card');
if ('IntersectionObserver' in window) {
  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, {threshold: 0.12});
  revealTargets.forEach(el => { el.classList.add('reveal'); revealObserver.observe(el); });
}

/* Small count-up details */
const counters = document.querySelectorAll('[data-count]');
if ('IntersectionObserver' in window && counters.length) {
  const counterObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting || entry.target.dataset.done) return;
    const el = entry.target;
    el.dataset.done = '1';
    const target = Number(el.dataset.count);
    const start = performance.now();
    const duration = 1000;
    const tick = now => {
      const p = Math.min((now - start) / duration, 1);
      el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3)))) + (el.dataset.suffix || '');
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    counterObserver.unobserve(el);
  }), {threshold: 0.5});
  counters.forEach(el => counterObserver.observe(el));
}

/* Replace inspiration cards with approved company projects from the admin API. */
fetch('/api/projects')
  .then(response => response.ok ? response.json() : [])
  .then(projects => {
    if (!Array.isArray(projects) || !projects.length) return;
    const gallery = document.querySelector('#projectGallery');
    if (!gallery) return;
    gallery.innerHTML = projects.map((project, index) => {
      const imagePath = String(project.image || '');
      const safeImage = imagePath.startsWith('/uploads/') ? imagePath : '';
      return `
        <article class="project ${index === 0 ? 'project-large' : ''}">
          <img src="${escapeHtml(safeImage)}" alt="${escapeHtml(project.title)}" loading="lazy">
          <div class="project-overlay"><span>${escapeHtml(project.category)}</span><h3>${escapeHtml(project.title)}</h3><p>${escapeHtml(project.location || 'Samsen project')}</p></div>
        </article>`;
    }).join('');
    const note = document.querySelector('#galleryNote');
    if (note) note.textContent = 'Selected project photographs published by Samsen Engineering Contractor.';
  })
  .catch(() => {});

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

/* Portfolio category filters */
(() => {
  const filters = [...document.querySelectorAll('.gallery-filter')];
  const gallery = document.querySelector('#projectGallery');
  if (!filters.length || !gallery) return;
  filters.forEach(button => button.addEventListener('click', () => {
    const category = button.dataset.filter || 'all';
    filters.forEach(item => {
      const active = item === button;
      item.classList.toggle('active', active);
      item.setAttribute('aria-pressed', String(active));
    });
    gallery.querySelectorAll('.project').forEach(card => {
      const matches = category === 'all' || card.dataset.category === category;
      card.hidden = !matches;
    });
  }));
})();

/* Keep section navigation clean: scroll without adding #anchors to the address bar. */
(() => {
  const cleanAddress = () => {
    if (window.location.hash) {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };
  cleanAddress();
  window.addEventListener('hashchange', cleanAddress);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = document.getElementById(id);
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
    history.replaceState(null, '', window.location.pathname + window.location.search);
  });
})();


/* Preload hero backgrounds before starting the carousel to avoid black flashes */
(() => {
  const heroSlides = [...document.querySelectorAll('.hero-slider .slide')];
  if (!heroSlides.length) return;
  const imageUrls = heroSlides.map(slide => {
    const value = getComputedStyle(slide).getPropertyValue('--slide-image').trim();
    const match = value.match(/^url\(["']?(.*?)["']?\)$/);
    return match ? match[1] : '';
  }).filter(Boolean);
  imageUrls.forEach(url => {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  });
})();


/* Interactive 3D building controls — pointer, touch and keyboard accessible */
(() => {
  const stage=document.querySelector('.model-stage');
  const model=document.querySelector('.building-model');
  const reset=document.querySelector('.model-reset');
  if(!stage||!model)return;
  let rotationX=-13,rotationY=-32,startX=0,startY=0,baseX=rotationX,baseY=rotationY,dragging=false;
  const render=()=>{model.style.transform='rotateX('+rotationX+'deg) rotateY('+rotationY+'deg)'};
  const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
  stage.addEventListener('pointerdown',event=>{
    if(event.target.closest('button'))return;
    dragging=true;startX=event.clientX;startY=event.clientY;baseX=rotationX;baseY=rotationY;
    stage.classList.add('is-dragging');stage.setPointerCapture?.(event.pointerId);
  });
  stage.addEventListener('pointermove',event=>{
    if(!dragging)return;
    rotationY=baseY+(event.clientX-startX)*.55;
    rotationX=clamp(baseX-(event.clientY-startY)*.35,-38,18);
    render();
  });
  const stop=()=>{dragging=false;stage.classList.remove('is-dragging')};
  stage.addEventListener('pointerup',stop);stage.addEventListener('pointercancel',stop);stage.addEventListener('lostpointercapture',stop);
  stage.addEventListener('keydown',event=>{
    const step=event.shiftKey?15:7;
    if(event.key==='ArrowLeft')rotationY-=step;
    else if(event.key==='ArrowRight')rotationY+=step;
    else if(event.key==='ArrowUp')rotationX=clamp(rotationX-step,-38,18);
    else if(event.key==='ArrowDown')rotationX=clamp(rotationX+step,-38,18);
    else return;
    event.preventDefault();render();
  });
  reset?.addEventListener('click',()=>{rotationX=-13;rotationY=-32;render()});
  render();
})();
