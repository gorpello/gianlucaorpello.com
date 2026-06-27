/* ═══════════════════════════════════════
   THEME TOGGLE
   FOUC prevention lives in <head> inline
   script. This handles button click logic.
═══════════════════════════════════════ */
(function(){
  const root = document.documentElement;

  function getEffectiveTheme() {
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  applyTheme(getEffectiveTheme());

  const themeBtn = document.getElementById('themeToggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      applyTheme(root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }
})();

/* ═══════════════════════════════════════
   CURSOR — exact kuntz.io port
   Single element. Frame-interpolated with
   easeInOutCubic. Morphs onto .cursor-hover
   elements with outset padding + magnetic pull.
═══════════════════════════════════════ */
var hp = 0.0;
var hpEase = 0.0;
var hovering = false;

var startX = -20, startY = -20, startW = 40, startH = 40, startBR = 20;
var curX   = -20, curY   = -20, curW   = 40, curH   = 40, curBR   = 20;
var tgtX   = -20, tgtY   = -20, tgtW   = 40, tgtH   = 40, tgtBR   = 20;

var elStartX = 0, elStartY = 0;
var elCurX   = 0, elCurY   = 0;
var elTgtX   = 0, elTgtY   = 0;

var prevHovered = null;
var mouseX = 0, mouseY = 0;
const TICK_COUNT = 18;

function easeInOutCubic(x) {
  return x < 0.5 ? 4*x*x*x : 1 - Math.pow(-2*x+2,3)/2;
}

const isTouch = !window.matchMedia('(pointer:fine)').matches;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!isTouch && !prefersReducedMotion) {
  const cursor = document.querySelector('.custom-cursor');
  if (cursor) {
    cursor.classList.add('cursor-hide');

    if (/Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor)) {
      document.body.classList.add('chrome');
    }

    function updateCursor() {
      const now = performance.now();
      const dt = (now - (window._lastFrame || now)) / 1000;
      window._lastFrame = now;
      const tick = dt * 60;

      hp = Math.min(1.0, hp + tick / TICK_COUNT);
      hpEase = easeInOutCubic(hp);

      curX  = startX  + (tgtX  - startX)  * hpEase;
      curY  = startY  + (tgtY  - startY)  * hpEase;
      curW  = startW  + (tgtW  - startW)  * hpEase;
      curH  = startH  + (tgtH  - startH)  * hpEase;
      curBR = startBR + (tgtBR - startBR) * hpEase;

      cursor.style.transform    = `translate(${curX}px, ${curY}px)`;
      cursor.style.width        = `${curW}px`;
      cursor.style.height       = `${curH}px`;
      cursor.style.borderRadius = `${curBR}px`;

      elCurX = elStartX + (elTgtX - elStartX) * hpEase;
      elCurY = elStartY + (elTgtY - elStartY) * hpEase;
      if (prevHovered && prevHovered instanceof Element) {
        prevHovered.style.transform = `translate(${elCurX}px, ${elCurY}px)`;
      }

      requestAnimationFrame(updateCursor);
    }
    requestAnimationFrame(updateCursor);

    document.addEventListener('mousemove', e => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursor.style.left = mouseX + 'px';
      cursor.style.top  = mouseY + 'px';

      let el = document.elementFromPoint(mouseX, mouseY);
      while (el && !el.classList.contains('cursor-hover')) {
        el = el.parentElement;
      }

      if (el && el.classList.contains('cursor-hover')) {
        if (!hovering) {
          hovering = true;
          hp = 0;
          startX = curX; startY = curY;
          startW = curW; startH = curH; startBR = curBR;
          elStartX = elCurX; elStartY = elCurY;
        }

        const r = el.getBoundingClientRect();
        const isTlItem = el.parentElement && el.parentElement.classList.contains('tl');
        const outset = {
          left:   r.left   - 7,
          top:    r.top    - 5,
          right:  r.right  + 7,
          bottom: r.bottom + (isTlItem ? 5 : 10),
          get width(){ return this.right - this.left; },
          get height(){ return this.bottom - this.top; }
        };

        tgtX  = (outset.left  - mouseX) * 0.9 + (-0.5 * outset.width  * 0.1);
        tgtY  = (outset.top   - mouseY) * 0.9 + (-0.5 * outset.height * 0.1);
        tgtW  = outset.width;
        tgtH  = outset.height;
        tgtBR = 8;

        const cx = outset.left + outset.width  / 2;
        const cy = outset.top  + outset.height / 2;
        elTgtX = (mouseX - cx) * 0.1;
        elTgtY = (mouseY - cy) * 0.1;

        prevHovered = el;
        cursor.classList.add('cursor-small');
      } else {
        if (hovering) {
          hovering = false;
          hp = 0;
          startX = curX; startY = curY;
          startW = curW; startH = curH; startBR = curBR;
          elStartX = elCurX; elStartY = elCurY;

          if (prevHovered && prevHovered instanceof Element) {
            prevHovered.style.transform = '';
          }
        }
        tgtX = -20; tgtY = -20;
        tgtW = 40;  tgtH = 40; tgtBR = 20;
        elTgtX = 0; elTgtY = 0;
        cursor.classList.remove('cursor-small');
      }
    });

    document.documentElement.addEventListener('mouseout', e => {
      if (!e.relatedTarget) cursor.classList.add('cursor-hide');
    });
    document.documentElement.addEventListener('mouseover', e => {
      if (!e.relatedTarget) cursor.classList.remove('cursor-hide');
    });
  }
}

/* ═══════════════════════════════════════
   HAMBURGER
═══════════════════════════════════════ */
const burger = document.getElementById('burger');
const mob    = document.getElementById('mob');
const navEl  = document.getElementById('nav');
let menuOpen = false;

if (burger && mob && navEl) {
  function setMenu(open) {
    menuOpen = open;
    navEl.classList.toggle('open', open);
    mob.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  }
  burger.addEventListener('click', () => setMenu(!menuOpen));
  document.querySelectorAll('.mob-link').forEach(a =>
    a.addEventListener('click', () => setTimeout(() => setMenu(false), 120))
  );
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && menuOpen) setMenu(false); });
}

/* ═══════════════════════════════════════
   NAV SCROLL
═══════════════════════════════════════ */
if (navEl) {
  window.addEventListener('scroll', () => {
    navEl.classList.toggle('scrolled', scrollY > 40);
  }, { passive: true });
}

/* ═══════════════════════════════════════
   SCROLL REVEAL
═══════════════════════════════════════ */
const obs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) setTimeout(() => e.target.classList.add('in'), i * 55);
  });
}, { threshold: .08 });
document.querySelectorAll('.fi').forEach(el => obs.observe(el));

/* ═══════════════════════════════════════
   PARALLAX ORBS (desktop)
═══════════════════════════════════════ */
if (!isTouch && !prefersReducedMotion) {
  const orb1 = document.querySelector('.orb-1');
  const orb2 = document.querySelector('.orb-2');
  if (orb1 && orb2) {
    document.addEventListener('mousemove', e => {
      const x = (e.clientX / window.innerWidth  - .5) * 28;
      const y = (e.clientY / window.innerHeight - .5) * 18;
      orb1.style.transform = `translateX(${x*.5}px) translateY(${y*.45}px)`;
      orb2.style.transform = `translateX(${-x*.7}px) translateY(${y*.6}px)`;
    });
  }
}

/* ═══════════════════════════════════════
   GLASS TILT (desktop)
   Shimmer color adapts to current theme.
═══════════════════════════════════════ */
function isDarkMode() {
  const t = document.documentElement.getAttribute('data-theme');
  if (t === 'dark') return true;
  if (t === 'light') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

if (!isTouch && !prefersReducedMotion) {
  document.querySelectorAll('.glass').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const rX = ((y - r.height/2) / r.height/2) * 5;
      const rY = -((x - r.width/2) / r.width/2) * 5;
      const dark = isDarkMode();
      card.style.transform  = `perspective(640px) rotateX(${rX}deg) rotateY(${rY}deg) translateY(-4px) scale(1.01)`;
      card.style.background = dark
        ? `radial-gradient(circle at ${x/r.width*100}% ${y/r.height*100}%, rgba(255,255,255,0.09) 0%, rgba(255,255,255,0.025) 55%, rgba(255,255,255,0.01) 100%)`
        : `radial-gradient(circle at ${x/r.width*100}% ${y/r.height*100}%, rgba(0,0,0,0.04) 0%, rgba(0,0,0,0.01) 55%, transparent 100%)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transition = 'transform .5s cubic-bezier(.23,1,.32,1), background .4s';
      card.style.transform  = '';
      card.style.background = '';
      setTimeout(() => card.style.transition = '', 500);
    });
  });
}

/* ═══════════════════════════════════════
   RIPPLE
═══════════════════════════════════════ */
document.querySelectorAll('.ripple-host').forEach(el => {
  el.addEventListener('pointerdown', e => {
    const r    = el.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 1.8;
    const rEl  = document.createElement('span');
    rEl.className = 'ripple-el';
    Object.assign(rEl.style, {
      width: size+'px', height: size+'px',
      left: (e.clientX - r.left - size/2)+'px',
      top:  (e.clientY - r.top  - size/2)+'px',
    });
    el.appendChild(rEl);
    setTimeout(() => rEl.remove(), 600);
  });
});

/* ═══════════════════════════════════════
   READING PROGRESS (blog posts)
═══════════════════════════════════════ */
const progressBar = document.querySelector('.reading-progress');
if (progressBar) {
  window.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const scrolled = doc.scrollTop || document.body.scrollTop;
    const total = doc.scrollHeight - doc.clientHeight;
    progressBar.style.width = (scrolled / total * 100) + '%';
  }, { passive: true });
}

/* ═══════════════════════════════════════
   SKILLS EXPAND / COLLAPSE
═══════════════════════════════════════ */
(function () {
  const toggle = document.getElementById('skillsToggle');
  const block  = document.querySelector('.skills-block');
  if (!toggle || !block) return;
  block.classList.add('collapsed');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.addEventListener('click', function () {
    const isCollapsed = block.classList.toggle('collapsed');
    toggle.textContent = isCollapsed ? '+16 more skills' : 'Show fewer skills';
    toggle.setAttribute('aria-expanded', String(!isCollapsed));
  });
})();

/* ═══════════════════════════════════════
   STICKY SCROLL SHOWCASE (#projects)
   Sticky 100vh panel,
   iPhone centered, watermark parallax,
   app screen crossfades on scroll step.
═══════════════════════════════════════ */
(function () {
  const wrap    = document.querySelector('.proj-sticky-wrap');
  const watermark = wrap && wrap.querySelector('.proj-scroll-text');
  if (!wrap) return;

  const screens = Array.from(wrap.querySelectorAll('.proj-app-screen'));
  const labels  = Array.from(wrap.querySelectorAll('.proj-app-label'));
  const dots    = Array.from(wrap.querySelectorAll('.proj-dot'));
  const n = screens.length;
  let activeIdx = 0;

  function activate(idx) {
    if (idx === activeIdx && screens[idx].classList.contains('active')) return;
    activeIdx = idx;
    screens.forEach((s, i) => s.classList.toggle('active', i === idx));
    labels.forEach((l, i)  => l.classList.toggle('active', i === idx));
    dots.forEach((d, i)    => d.classList.toggle('active', i === idx));
  }

  function tick() {
    const r  = wrap.getBoundingClientRect();
    const vh = window.innerHeight;
    // 0 = wrap enters viewport top, 1 = wrap exits viewport top
    const scrollable = r.height - vh;
    const progress = scrollable > 0 ? Math.max(0, Math.min(1, -r.top / scrollable)) : 0;

    // Watermark slides right → left
    if (watermark) {
      const tx = 5 - progress * 30;
      watermark.style.transform = `translateX(${tx}%) translateY(-50%)`;
    }

    // Switch app screen
    if (n > 0) activate(Math.min(n - 1, Math.floor(progress * n)));
  }

  window.addEventListener('scroll', tick, { passive: true });
  tick();
})();

