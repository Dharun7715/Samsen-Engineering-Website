const menuButton = document.querySelector('.menu-toggle');
const navigation = document.querySelector('.nav-links');
menuButton?.addEventListener('click', () => {
  const isOpen = navigation.classList.toggle('open');
  document.body.classList.toggle('menu-open', isOpen);
  menuButton.setAttribute('aria-expanded', String(isOpen));
  menuButton.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
});
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape' || !navigation?.classList.contains('open')) return;
  navigation.classList.remove('open');
  document.body.classList.remove('menu-open');
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Open navigation');
  menuButton?.focus();
});
document.querySelectorAll('.nav-links a').forEach(link => link.addEventListener('click', () => {
  navigation.classList.remove('open');
  document.body.classList.remove('menu-open');
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


/* Mobile-aware hero loading: load the first image immediately, then the next slide only.
   Remaining slides are fetched when the visitor advances, avoiding five simultaneous downloads. */
(() => {
  const heroSlides = [...document.querySelectorAll('.hero-slider .slide')];
  if (!heroSlides.length) return;
  const getUrl = slide => {
    const value = getComputedStyle(slide).getPropertyValue('--slide-image').trim();
    const match = value.match(/^url\(["']?(.*?)["']?\)$/);
    return match ? match[1] : '';
  };
  const loaded = new Set();
  const loadSlide = index => {
    const slide = heroSlides[(index + heroSlides.length) % heroSlides.length];
    const url = getUrl(slide);
    if (!url || loaded.has(url)) return;
    loaded.add(url);
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
  };
  loadSlide(0);
  if (heroSlides.length > 1) loadSlide(1);
  heroSlides.forEach((slide, index) => {
    const activate = () => {
      loadSlide(index);
      loadSlide(index + 1);
    };
    slide.addEventListener('transitionstart', activate, {once:true});
  });
  document.querySelectorAll('.slider-dot,.slider-prev,.slider-next').forEach(control => {
    control.addEventListener('click', () => {
      const active = heroSlides.findIndex(slide => slide.classList.contains('active'));
      loadSlide(active);
      loadSlide(active + 1);
    }, {passive:true});
  });
})();


/* Cinematic Why Choose Us sequence */
(() => {
 const section=document.querySelector('.why-cinematic');
 if(!section)return;
 if(!('IntersectionObserver'in window)){section.classList.add('is-inview');return}
 const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
   if(entry.isIntersecting){section.classList.add('is-inview');observer.disconnect()}
  });
 },{threshold:.18});
 observer.observe(section);
})();


/* Accessible portfolio filters and image lightbox */
(() => {
 const cards=[...document.querySelectorAll('.portfolio-image-card')];
 const filters=[...document.querySelectorAll('.gallery-filter')];
 const lightbox=document.querySelector('#portfolio-lightbox');
 if(filters.length&&cards.length){
  filters.forEach(button=>button.addEventListener('click',()=>{
   const category=button.dataset.filter||'all';
   filters.forEach(item=>{const active=item===button;item.classList.toggle('active',active);item.setAttribute('aria-pressed',String(active))});
   cards.forEach(card=>{card.hidden=category!=='all'&&card.dataset.category!==category});
  }));
 }
 if(!lightbox||!cards.length)return;
 const image=lightbox.querySelector('img'),caption=lightbox.querySelector('figcaption');
 const close=lightbox.querySelector('.lightbox-close'),prev=lightbox.querySelector('.lightbox-prev'),next=lightbox.querySelector('.lightbox-next');
 let visible=[],index=0,lastFocus=null;
 const refresh=()=>visible=cards.filter(card=>!card.hidden);
 const show=()=>{
  const card=visible[index];if(!card)return;
  const img=card.querySelector('img'),title=card.querySelector('figcaption strong');
  image.src=img.src;image.alt=img.alt;caption.textContent=title?.textContent||img.alt;
 };
 const open=card=>{
  refresh();index=Math.max(0,visible.indexOf(card));lastFocus=document.activeElement;
  show();lightbox.classList.add('open');lightbox.setAttribute('aria-hidden','false');document.body.style.overflow='hidden';close.focus();
 };
 const hide=()=>{
  lightbox.classList.remove('open');lightbox.setAttribute('aria-hidden','true');document.body.style.overflow='';image.removeAttribute('src');lastFocus?.focus();
 };
 const move=step=>{refresh();if(!visible.length)return;index=(index+step+visible.length)%visible.length;show()};
 cards.forEach(card=>{
  card.addEventListener('click',()=>open(card));
  card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();open(card)}});
 });
 close.addEventListener('click',hide);prev.addEventListener('click',()=>move(-1));next.addEventListener('click',()=>move(1));
 lightbox.addEventListener('click',event=>{if(event.target===lightbox)hide()});
 document.addEventListener('keydown',event=>{
  if(!lightbox.classList.contains('open'))return;
  if(event.key==='Escape')hide();if(event.key==='ArrowLeft')move(-1);if(event.key==='ArrowRight')move(1);
 });
})();


/* Accessible reveal motion for project and contact content */
(() => {
 const targets=[...document.querySelectorAll('[data-reveal]')];
 if(!targets.length)return;
 if(!('IntersectionObserver'in window)||matchMedia('(prefers-reduced-motion: reduce)').matches){targets.forEach(el=>el.classList.add('is-visible'));return;}
 const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}});
 },{threshold:.12,rootMargin:'0px 0px -35px 0px'});
 targets.forEach((el,index)=>{el.style.transitionDelay=Math.min(index%4,3)*85+'ms';observer.observe(el);});
})();

/* Enquiry form prepares an email; no personal details are stored on this site. */
(() => {
 const form=document.querySelector('#samsenEnquiryForm');
 if(!form)return;
 form.addEventListener('submit',event=>{
  event.preventDefault();
  if(!form.reportValidity())return;
  const data=new FormData(form);
  const name=String(data.get('name')||'').trim();
  const phone=String(data.get('phone')||'').trim();
  const service=String(data.get('service')||'').trim();
  const message=String(data.get('message')||'').trim();
  const subject=encodeURIComponent('Project enquiry — '+service);
  const body=encodeURIComponent('Name: '+name+'\nPhone: '+phone+'\nService: '+service+'\n\nProject details:\n'+(message||'Not provided'));
  window.location.href='mailto:samsenengg@gmail.com?subject='+subject+'&body='+body;
 });
})();
