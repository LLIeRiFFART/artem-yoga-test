/* ==========================================================================
   AMARA FLOW — Yoga House
   Main script (vanilla JS, no dependencies)
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const easeInOut = (t) => 0.5 - Math.cos(Math.PI * t) / 2;
  const isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  const isMobile = () => window.innerWidth <= 820;

  const ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* Central animation loop:
     - "loops" run every frame (smooth lerped motion)
     - "scrollers" run only when the page was scrolled or resized */
  const loops = [];
  const scrollers = [];
  let dirty = true;

  window.addEventListener('scroll', () => { dirty = true; }, { passive: true });
  window.addEventListener('resize', () => { dirty = true; });

  function frame(now) {
    loops.forEach((fn) => fn(now));
    if (dirty) {
      dirty = false;
      scrollers.forEach((fn) => fn());
    }
    requestAnimationFrame(frame);
  }

  /* Toast notification */
  function toast(message) {
    let el = $('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('is-show');
    clearTimeout(el._timer);
    el._timer = setTimeout(() => el.classList.remove('is-show'), 3200);
  }

  /* Modal helpers */
  function openModal(modal) {
    modal.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
  }

  function closeModal(modal) {
    modal.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  }

  function initModals() {
    $$('.modal').forEach((modal) => {
      $$('[data-close], .modal__backdrop, .modal__close', modal).forEach((btn) => {
        btn.addEventListener('click', () => closeModal(modal));
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') $$('.modal.is-open').forEach(closeModal);
    });
  }

  /* ------------------------------------------------------------------------
     1. Preloader
     ------------------------------------------------------------------------ */
  function initPreloader() {
    const pre = $('.preloader');
    const finish = () => {
      document.body.classList.add('is-loaded');
      if (pre) pre.classList.add('is-done');
    };

    if (!pre) { setTimeout(finish, 60); return; }

    const counter = $('.preloader__count', pre);
    const quick = sessionStorage.getItem('amara-visited');
    const duration = quick ? 450 : 1700;
    const start = performance.now();

    (function tick(now) {
      const p = clamp((now - start) / duration, 0, 1);
      if (counter) counter.textContent = String(Math.round(easeInOut(p) * 100)).padStart(3, '0');
      if (p < 1) {
        requestAnimationFrame(tick);
      } else {
        sessionStorage.setItem('amara-visited', '1');
        setTimeout(finish, 120);
      }
    })(start);

    // Safety net, in case requestAnimationFrame is throttled
    setTimeout(finish, 4000);
  }

  /* ------------------------------------------------------------------------
     2. Custom cursor
     ------------------------------------------------------------------------ */
  function initCursor() {
    if (isTouch) return;

    const cursor = document.createElement('div');
    cursor.className = 'cursor';
    cursor.innerHTML = '<div class="cursor__ring"><span class="cursor__label"></span></div><div class="cursor__dot"></div>';
    document.body.appendChild(cursor);

    const ring = $('.cursor__ring', cursor);
    const dot = $('.cursor__dot', cursor);
    const label = $('.cursor__label', cursor);
    let mx = window.innerWidth / 2;
    let my = window.innerHeight / 2;
    let rx = mx;
    let ry = my;

    window.addEventListener('mousemove', (e) => {
      mx = e.clientX;
      my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%, -50%)`;
    });

    loops.push(() => {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%, -50%)`;
    });

    document.addEventListener('mouseover', (e) => {
      const labeled = e.target.closest('[data-cursor]');
      const hover = e.target.closest('a, button, input, select, textarea, label, .day, .slot');
      cursor.classList.toggle('is-label', !!labeled);
      label.textContent = labeled ? labeled.dataset.cursor : '';
      cursor.classList.toggle('is-hover', !labeled && !!hover);
      cursor.classList.toggle('is-dark', !!e.target.closest('.footer'));
    });

    document.addEventListener('mouseleave', () => cursor.classList.add('is-hidden'));
    document.addEventListener('mouseenter', () => cursor.classList.remove('is-hidden'));
  }

  /* ------------------------------------------------------------------------
     3. Header: hide on scroll, dark mode over dark sections, mobile menu
     ------------------------------------------------------------------------ */
  function initHeader() {
    const header = $('.header');
    if (!header) return;

    // Rolling text effect for nav links
    $$('.nav a').forEach((a) => {
      const text = a.textContent.trim();
      a.innerHTML = `<span data-text="${text}">${text}</span>`;
    });

    // Highlight current page
    const page = location.pathname.split('/').pop() || 'index.html';
    $$('.nav a, .menu__links a').forEach((a) => {
      if (a.getAttribute('href') === page) a.classList.add('is-active');
    });

    // The header stays visible at all times, only its colour adapts below.
    const darkSections = $$('[data-theme="dark"]');

    scrollers.push(() => {
      const probe = 50;
      const overDark = darkSections.some((s) => {
        const r = s.getBoundingClientRect();
        return r.top <= probe && r.bottom >= probe;
      });
      header.classList.toggle('is-dark', overDark);
    });

    const burger = $('.burger');
    if (burger) {
      burger.addEventListener('click', () => {
        document.body.classList.toggle('menu-open');
        document.documentElement.style.overflow = document.body.classList.contains('menu-open') ? 'hidden' : '';
      });
    }

    $$('.menu a').forEach((a) => {
      a.addEventListener('click', () => {
        document.body.classList.remove('menu-open');
        document.documentElement.style.overflow = '';
      });
    });
  }

  /* ------------------------------------------------------------------------
     4. Text splitting (words / chars)
     ------------------------------------------------------------------------ */
  function wrapUnit(node, index, free) {
    const outer = document.createElement('span');
    outer.className = free ? 'split-line split-line--free' : 'split-line';
    const inner = document.createElement('span');
    inner.style.setProperty('--i', index);
    inner.appendChild(node);
    outer.appendChild(inner);
    return outer;
  }

  function initSplit() {
    // Word-by-word reveal for headings
    $$('[data-split]').forEach((el) => {
      let i = 0;
      const nodes = Array.from(el.childNodes);
      el.innerHTML = '';
      nodes.forEach((node) => {
        if (node.nodeType === 3) {
          node.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) return;
            if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(part)); return; }
            el.appendChild(wrapUnit(document.createTextNode(part), i++, false));
          });
        } else if (node.nodeName === 'BR') {
          el.appendChild(node);
        } else {
          el.appendChild(wrapUnit(node, i++, true));
        }
      });
    });

    // Char-by-char for big words (hero title, footer wordmark)
    $$('[data-chars]').forEach((el) => {
      const text = el.textContent.trim();
      el.innerHTML = text.split('').map((ch, i) => `<span class="char" style="--i:${i}">${ch}</span>`).join('');
    });
  }

  /* ------------------------------------------------------------------------
     5. Reveal on scroll
     ------------------------------------------------------------------------ */
  function initReveal() {
    $$('[data-stagger]').forEach((parent) => {
      Array.from(parent.children).forEach((child, i) => {
        if (!child.hasAttribute('data-reveal')) child.setAttribute('data-reveal', parent.dataset.stagger || '');
        child.style.setProperty('--d', `${i * 0.09}s`);
      });
    });

    const targets = $$('[data-reveal], [data-split], [data-observe]');
    if (!('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-in');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px -10% 0px' });

    targets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     6. Scroll parallax ([data-speed]) and page-hero media zoom
     ------------------------------------------------------------------------ */
  function initParallax() {
    const items = $$('[data-speed]');
    const heroMedia = $$('[data-hero-media]');

    scrollers.push(() => {
      const vh = window.innerHeight;

      items.forEach((el) => {
        const speed = parseFloat(el.dataset.speed) || 0.1;
        const r = el.parentElement.getBoundingClientRect();
        if (r.bottom < -200 || r.top > vh + 200) return;
        const offset = (r.top + r.height / 2 - vh / 2) * -speed;
        el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      });

      heroMedia.forEach((wrap) => {
        const img = $('img', wrap);
        const r = wrap.getBoundingClientRect();
        const p = clamp(1 - r.bottom / (vh + r.height), 0, 1);
        img.style.setProperty('--ty', `${(-p * 18).toFixed(2)}%`);
        img.style.setProperty('--sc', (1.15 - p * 0.15).toFixed(3));
      });
    });
  }

  /* ------------------------------------------------------------------------
     7. Mouse parallax ([data-mouse] area with [data-depth] layers)
     ------------------------------------------------------------------------ */
  function initMouseParallax() {
    if (isTouch) return;

    $$('[data-mouse]').forEach((area) => {
      const layers = $$('[data-depth]', area);
      let tx = 0, ty = 0, cx = 0, cy = 0;

      area.addEventListener('mousemove', (e) => {
        const r = area.getBoundingClientRect();
        tx = (e.clientX - r.left) / r.width - 0.5;
        ty = (e.clientY - r.top) / r.height - 0.5;
      });
      area.addEventListener('mouseleave', () => { tx = 0; ty = 0; });

      loops.push(() => {
        cx = lerp(cx, tx, 0.07);
        cy = lerp(cy, ty, 0.07);
        if (Math.abs(cx) < 0.0005 && Math.abs(cy) < 0.0005 && tx === 0) return;
        layers.forEach((layer) => {
          const d = parseFloat(layer.dataset.depth) || 20;
          layer.style.translate = `${(cx * d).toFixed(2)}px ${(cy * d).toFixed(2)}px`;
        });
      });
    });
  }

  /* ------------------------------------------------------------------------
     8. Buttons: fill origin + magnetic effect, tilt cards, spotlight cards
     ------------------------------------------------------------------------ */
  function initInteractions() {
    // Liquid fill starts from the cursor entry point
    document.addEventListener('mouseover', (e) => {
      const btn = e.target.closest('.btn');
      if (!btn || btn.contains(e.relatedTarget)) return;
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - r.left}px`);
      btn.style.setProperty('--y', `${e.clientY - r.top}px`);
    });

    if (isTouch) return;

    // Magnetic elements
    $$('[data-magnetic]').forEach((el) => {
      const strength = parseFloat(el.dataset.magnetic) || 0.3;
      let tx = 0, ty = 0, cx = 0, cy = 0;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        tx = (e.clientX - r.left - r.width / 2) * strength;
        ty = (e.clientY - r.top - r.height / 2) * strength;
      });
      el.addEventListener('mouseleave', () => { tx = 0; ty = 0; });
      loops.push(() => {
        cx = lerp(cx, tx, 0.15);
        cy = lerp(cy, ty, 0.15);
        el.style.translate = `${cx.toFixed(2)}px ${cy.toFixed(2)}px`;
      });
    });

    // 3D tilt
    $$('[data-tilt]').forEach((el) => {
      const max = parseFloat(el.dataset.tilt) || 8;
      el.style.transition = 'transform .7s cubic-bezier(.22,1,.36,1), box-shadow .7s cubic-bezier(.22,1,.36,1), background .6s';
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = `perspective(1000px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-6px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });

    // Spotlight that follows the cursor
    $$('.plan, [data-spot]').forEach((el) => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        el.style.setProperty('--mx', `${e.clientX - r.left}px`);
        el.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

  /* ------------------------------------------------------------------------
     9. Marquee reacting to scroll velocity
     ------------------------------------------------------------------------ */
  function initMarquee() {
    const bands = $$('.marquee');
    if (!bands.length) return;

    let lastY = window.scrollY;
    let velocity = 0;
    let direction = 1;

    const items = bands.map((band) => {
      const track = $('.marquee__track', band);
      band.appendChild(track.cloneNode(true));
      band.appendChild(track.cloneNode(true));
      return {
        tracks: $$('.marquee__track', band),
        width: track.offsetWidth,
        x: 0,
        dir: band.classList.contains('marquee--back') ? 1 : -1
      };
    });

    window.addEventListener('resize', () => {
      items.forEach((item) => { item.width = item.tracks[0].offsetWidth; });
    });

    loops.push(() => {
      const y = window.scrollY;
      const delta = y - lastY;
      lastY = y;
      if (delta !== 0) direction = delta > 0 ? 1 : -1;
      velocity = lerp(velocity, Math.min(Math.abs(delta), 60), 0.1);

      items.forEach((item) => {
        const speed = (0.6 + velocity * 0.25) * item.dir * direction;
        item.x += speed;
        if (item.x <= -item.width) item.x += item.width;
        if (item.x >= 0) item.x -= item.width;
        item.tracks.forEach((t) => { t.style.transform = `translate3d(${item.x.toFixed(2)}px, 0, 0)`; });
      });
    });
  }

  /* ------------------------------------------------------------------------
     10. Manifesto: words light up while scrolling
     ------------------------------------------------------------------------ */
  function initManifesto() {
    const el = $('.manifesto__text');
    if (!el) return;

    const units = [];
    const nodes = Array.from(el.childNodes);
    el.innerHTML = '';

    nodes.forEach((node) => {
      if (node.nodeType === 3) {
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { el.appendChild(document.createTextNode(' ')); return; }
          const span = document.createElement('span');
          span.className = 'word';
          span.textContent = part;
          el.appendChild(span);
          units.push(span);
        });
      } else {
        el.appendChild(node);
        units.push(node);
      }
    });

    scrollers.push(() => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const p = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.25), 0, 1);
      const count = Math.round(p * units.length);
      units.forEach((u, i) => u.classList.toggle('is-on', i < count));
    });
  }

  /* ------------------------------------------------------------------------
     11. Film: video frame expands with scroll
     ------------------------------------------------------------------------ */
  function initFilm() {
    const film = $('.film');
    if (!film) return;

    const frameEl = $('.film__frame', film);
    const sticky = $('.film__sticky', film);
    const video = $('video', film);

    if (video && 'IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) video.play().catch(() => {});
        else video.pause();
      }).observe(film);
    }

    scrollers.push(() => {
      const r = film.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = clamp(-r.top / total, 0, 1);
      const e = easeInOut(clamp(p / 0.6, 0, 1));
      const mobile = isMobile();
      frameEl.style.setProperty('--iy', `${lerp(mobile ? 56 : 80, 0, e)}px`);
      frameEl.style.setProperty('--ix', `${lerp(mobile ? 8 : 26, 0, e)}%`);
      frameEl.style.setProperty('--r', `${lerp(40, 0, e)}px`);
      frameEl.style.setProperty('--vs', lerp(1.3, 1, e).toFixed(3));
      sticky.style.setProperty('--co', clamp((p - 0.4) / 0.25, 0, 1).toFixed(3));
    });
  }

  /* ------------------------------------------------------------------------
     12. Classes: pinned horizontal scroll (desktop)
     ------------------------------------------------------------------------ */
  function initClasses() {
    const section = $('.classes');
    if (!section) return;

    const track = $('.classes__track', section);
    const progress = $('.classes__progress', section);
    let distance = 0;

    function measure() {
      if (isMobile()) {
        section.style.height = '';
        track.style.transform = '';
        distance = 0;
        return;
      }
      const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
      distance = Math.max(0, track.scrollWidth - window.innerWidth + pad);
      section.style.height = `${window.innerHeight + distance}px`;
    }

    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('load', measure);

    scrollers.push(() => {
      if (!distance) return;
      const r = section.getBoundingClientRect();
      const p = clamp(-r.top / distance, 0, 1);
      track.style.transform = `translate3d(${(-p * distance).toFixed(1)}px, 0, 0)`;
      if (progress) progress.style.setProperty('--p', p.toFixed(4));
    });
  }

  /* ------------------------------------------------------------------------
     13. Sequence: scroll-driven pose sequence
     ------------------------------------------------------------------------ */
  function initSequence() {
    const section = $('.sequence');
    if (!section) return;

    const images = $$('.seq-img', section);
    const details = $$('.seq-detail', section);
    const bars = $$('.seq-steps li i', section);
    const ring = $('.seq-ring .bar', section);
    const ringText = $('.seq-ring span', section);
    const count = images.length;
    let current = -1;

    scrollers.push(() => {
      const r = section.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = clamp(-r.top / total, 0, 0.9999);
      const index = Math.floor(p * count);
      const local = p * count - index;

      bars.forEach((bar, i) => bar.style.setProperty('--p', i < index ? 1 : i === index ? local.toFixed(3) : 0));
      if (ring) ring.style.strokeDashoffset = (283 * (1 - p)).toFixed(1);
      if (ringText) ringText.textContent = `${Math.round(p * 100)}%`;

      const img = images[index] && $('img', images[index]);
      // Photos marked data-full are shown whole, so they don't get the scroll zoom
      if (img && images[index].dataset.full !== '1') {
        img.style.transform = `scale(${(1 + local * 0.08).toFixed(3)}) translateY(${(-local * 2).toFixed(2)}%)`;
      }

      if (index !== current) {
        current = index;
        images.forEach((el, i) => el.classList.toggle('is-active', i === index));
        details.forEach((el, i) => el.classList.toggle('is-active', i === index));
      }
    });
  }

  /* ------------------------------------------------------------------------
     14. Breath: interactive 3D particle sphere + guided breathing
     ------------------------------------------------------------------------ */
  function initBreath() {
    const stage = $('.breath__stage');
    if (!stage) return;

    const canvas = $('canvas', stage);
    const ctx = canvas.getContext('2d');
    const phaseEl = $('.breath__phase');
    const countEl = $('.breath__count');
    const startBtn = $('[data-breath-start]');
    const startLabel = startBtn ? $('.btn__label', startBtn) : null;

    const PATTERNS = {
      calm: [['Inhale', 4], ['Hold', 4], ['Exhale', 6]],
      box: [['Inhale', 4], ['Hold', 4], ['Exhale', 4], ['Hold', 4]],
      sleep: [['Inhale', 4], ['Hold', 7], ['Exhale', 8]]
    };
    const SMALL = 0.78;
    const BIG = 1.18;

    let pattern = 'calm';
    let running = false;
    let phaseIndex = 0;
    let phaseStart = 0;
    let holdScale = SMALL;
    let cycles = 0;

    // Fibonacci sphere points
    const total = isMobile() ? 650 : 1100;
    const points = [];
    for (let i = 0; i < total; i++) {
      const y = 1 - (i / (total - 1)) * 2;
      const radius = Math.sqrt(1 - y * y);
      const theta = Math.PI * (3 - Math.sqrt(5)) * i;
      points.push({ x: Math.cos(theta) * radius, y, z: Math.sin(theta) * radius, s: Math.random() });
    }

    let W = 0, H = 0;
    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = stage.getBoundingClientRect();
      W = r.width;
      H = r.height;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    // Interaction: drag to rotate, hover to steer
    let rotX = 0.35, rotY = 0, spin = 0.004;
    let dragging = false, lastX = 0, lastY = 0, hoverX = 0, hoverY = 0;
    stage.style.touchAction = 'pan-y';

    stage.addEventListener('pointerdown', (e) => {
      dragging = true;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('pointercancel', () => { dragging = false; });
    stage.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      hoverX = (e.clientX - r.left) / r.width - 0.5;
      hoverY = (e.clientY - r.top) / r.height - 0.5;
      if (!dragging) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      rotY += dx * 0.008;
      rotX += dy * 0.008;
      spin = clamp(dx * 0.0008, -0.04, 0.04) || spin;
      lastX = e.clientX;
      lastY = e.clientY;
    });
    stage.addEventListener('pointerleave', () => { hoverX = 0; hoverY = 0; });

    function setPhaseText(text) {
      phaseEl.style.opacity = 0;
      setTimeout(() => { phaseEl.textContent = text; phaseEl.style.opacity = 1; }, 250);
    }

    function start() {
      running = true;
      phaseIndex = 0;
      cycles = 0;
      phaseStart = performance.now();
      setPhaseText(PATTERNS[pattern][0][0]);
      if (startLabel) startLabel.textContent = 'Stop session';
    }

    function stop() {
      running = false;
      setPhaseText('breathe');
      countEl.textContent = 'tap start';
      if (startLabel) startLabel.textContent = 'Start breathing';
    }

    if (startBtn) startBtn.addEventListener('click', () => (running ? stop() : start()));

    $$('.pattern').forEach((btn) => {
      btn.addEventListener('click', () => {
        $$('.pattern').forEach((b) => b.classList.remove('is-active'));
        btn.classList.add('is-active');
        pattern = btn.dataset.pattern;
        if (running) start();
      });
    });

    // Pause rendering when off-screen
    let visible = true;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(stage);
    }

    let scale = 1;
    const born = performance.now();

    loops.push((now) => {
      if (!visible) return;
      const t = (now - born) / 1000;
      let target;

      if (running) {
        const steps = PATTERNS[pattern];
        const [name, seconds] = steps[phaseIndex];
        const elapsed = (now - phaseStart) / 1000;
        const k = easeInOut(clamp(elapsed / seconds, 0, 1));

        if (name === 'Inhale') target = lerp(SMALL, BIG, k);
        else if (name === 'Exhale') target = lerp(BIG, SMALL, k);
        else target = holdScale + Math.sin(t * 5) * 0.004;

        countEl.textContent = `${Math.max(1, Math.ceil(seconds - elapsed))} · cycle ${cycles + 1}`;

        if (elapsed >= seconds) {
          if (name === 'Inhale') holdScale = BIG;
          if (name === 'Exhale') holdScale = SMALL;
          phaseIndex = (phaseIndex + 1) % steps.length;
          if (phaseIndex === 0) cycles++;
          phaseStart = now;
          setPhaseText(steps[phaseIndex][0]);
        }
      } else {
        target = 0.96 + Math.sin(t * 1.1) * 0.05;
      }

      scale = lerp(scale, target, 0.1);

      if (!dragging) {
        rotY += spin + hoverX * 0.012;
        spin = lerp(spin, 0.004, 0.01);
        rotX = lerp(rotX, 0.35 + hoverY * 0.7, 0.03);
      }

      ctx.clearRect(0, 0, W, H);
      const cx = W / 2;
      const cy = H / 2;
      const R = Math.min(W, H) * 0.33 * scale;

      const glow = ctx.createRadialGradient(cx, cy, R * 0.1, cx, cy, R * 1.7);
      glow.addColorStop(0, 'rgba(242, 191, 208, 0.65)');
      glow.addColorStop(1, 'rgba(242, 191, 208, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);

      const cosY = Math.cos(rotY), sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX), sinX = Math.sin(rotX);
      const unit = W / 520;

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const wobble = 1 + Math.sin(t * 1.6 + p.y * 4 + p.s * 6) * 0.045;
        const x = p.x * wobble, y = p.y * wobble, z = p.z * wobble;
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;
        const y1 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;
        const persp = 2.6 / (2.6 - z2);
        const depth = (z2 + 1) / 2;

        ctx.globalAlpha = 0.15 + depth * 0.85;
        ctx.fillStyle = depth > 0.62 ? '#7d1745' : depth > 0.35 ? '#c2477a' : '#e58bad';
        ctx.beginPath();
        ctx.arc(cx + x1 * R * persp, cy + y1 * R * persp, (0.5 + depth * 1.9) * unit, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
  }

  /* ------------------------------------------------------------------------
     15. Counters
     ------------------------------------------------------------------------ */
  function animateNumber(el, to, opts = {}) {
    const from = parseFloat(el.dataset.current || 0);
    const decimals = opts.decimals || 0;
    const prefix = opts.prefix || '';
    const suffix = opts.suffix || '';
    const duration = opts.duration || 900;
    const start = performance.now();
    el.dataset.current = to;

    (function tick(now) {
      const p = clamp((now - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 4);
      const value = from + (to - from) * eased;
      el.textContent = prefix + value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    })(start);
  }

  function initCounters() {
    const items = $$('[data-count]');
    if (!items.length || !('IntersectionObserver' in window)) return;

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        animateNumber(el, parseFloat(el.dataset.count), {
          decimals: parseInt(el.dataset.decimals || 0, 10),
          suffix: el.dataset.suffix || '',
          prefix: el.dataset.prefix || '',
          duration: 1800
        });
        io.unobserve(el);
      });
    }, { threshold: 0.4 });

    items.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     16. Booking calendar
     ------------------------------------------------------------------------ */
  function initBooking() {
    const root = $('#booking');
    if (!root) return;

    const STORAGE_KEY = 'amara-bookings';
    const DAYS_AHEAD = 60;
    const HOLIDAYS = ['01-01', '07-04', '11-26', '12-25', '12-31'];

    const SCHEDULE = {
      weekday: [
        { time: '07:00', name: 'Sunrise Vinyasa', style: 'Vinyasa', teacher: 'Mia Calder', room: 'Sun Room', dur: 60, cap: 18, price: 28 },
        { time: '09:30', name: 'Slow Hatha', style: 'Hatha', teacher: 'Noah Reyes', room: 'Moon Room', dur: 75, cap: 16, price: 28 },
        { time: '12:15', name: 'Lunch Flow Express', style: 'Vinyasa', teacher: 'Lena Park', room: 'Sun Room', dur: 45, cap: 14, price: 22 },
        { time: '17:30', name: 'Power Vinyasa', style: 'Vinyasa', teacher: 'Mia Calder', room: 'Sun Room', dur: 60, cap: 20, price: 28 },
        { time: '19:00', name: 'Candlelit Yin', style: 'Yin', teacher: 'Ava Moreau', room: 'Moon Room', dur: 75, cap: 16, price: 30 },
        { time: '20:30', name: 'Breathwork & Sound', style: 'Breathwork', teacher: 'Noah Reyes', room: 'Moon Room', dur: 50, cap: 12, price: 32 }
      ],
      weekend: [
        { time: '08:30', name: 'Weekend Slow Flow', style: 'Hatha', teacher: 'Ava Moreau', room: 'Sun Room', dur: 75, cap: 20, price: 28 },
        { time: '10:30', name: 'Prenatal Yoga', style: 'Prenatal', teacher: 'Lena Park', room: 'Moon Room', dur: 60, cap: 10, price: 30 },
        { time: '12:00', name: 'Inversions Lab', style: 'Vinyasa', teacher: 'Mia Calder', room: 'Sun Room', dur: 90, cap: 12, price: 38 },
        { time: '16:00', name: 'Yin & Restore', style: 'Yin', teacher: 'Ava Moreau', room: 'Moon Room', dur: 75, cap: 16, price: 30 },
        { time: '18:00', name: 'Full Moon Sound Bath', style: 'Breathwork', teacher: 'Noah Reyes', room: 'Sun Room', dur: 60, cap: 20, price: 35 }
      ]
    };

    const el = {
      month: $('.cal__month', root),
      grid: $('.cal__grid', root),
      prev: $('[data-cal="prev"]', root),
      next: $('[data-cal="next"]', root),
      date: $('.slots__date', root),
      count: $('.slots__count', root),
      list: $('.slot-list', root),
      chips: $$('.chips .chip', root),
      mine: $('.cal__mine-list', root)
    };

    const modal = $('#book-modal');
    const form = $('#book-form');
    const summary = $('.summary', modal);
    const formView = $('.modal__form-view', modal);
    const successView = $('.modal__success-view', modal);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastDay = new Date(today);
    lastDay.setDate(lastDay.getDate() + DAYS_AHEAD);

    let viewMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    let selected = keyOf(today);
    let filter = 'All';
    let chosen = null;

    function keyOf(d) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function dateOf(key) {
      const [y, m, d] = key.split('-').map(Number);
      return new Date(y, m - 1, d);
    }

    function seeded(str) {
      let h = 2166136261;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return ((h >>> 0) % 10000) / 10000;
    }

    function to12h(time) {
      const [h, m] = time.split(':').map(Number);
      const suffix = h >= 12 ? 'PM' : 'AM';
      return { clock: `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`, suffix };
    }

    function getBookings() {
      try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; } catch (e) { return []; }
    }

    function saveBookings(list) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    function isClosed(date) {
      const md = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      const firstMonday = date.getDay() === 1 && date.getDate() <= 7;
      return HOLIDAYS.includes(md) || firstMonday;
    }

    function getDay(key) {
      const date = dateOf(key);
      const past = date < today;
      const beyond = date > lastDay;
      if (isClosed(date)) return { date, closed: true, classes: [], left: 0, cap: 0, past, beyond };

      const weekend = date.getDay() === 0 || date.getDay() === 6;
      const template = weekend ? SCHEDULE.weekend : SCHEDULE.weekday;
      const daysAhead = Math.round((date - today) / 86400000);
      const busyDay = seeded(key) < 0.1;
      const mine = getBookings();
      const now = new Date();

      const classes = template.map((c, index) => {
        const id = `${key}_${c.time}`;
        let booked;
        if (busyDay) {
          booked = c.cap;
        } else {
          const urgency = clamp(1 - daysAhead / 30, 0, 1) * 0.35;
          booked = Math.floor(c.cap * clamp(0.2 + seeded(id) * 0.7 + urgency, 0, 1));
        }
        const own = mine.filter((b) => b.id === id);
        booked = clamp(booked + own.reduce((sum, b) => sum + b.guests, 0), 0, c.cap);

        const [h, m] = c.time.split(':').map(Number);
        const startsAt = new Date(date);
        startsAt.setHours(h, m, 0, 0);

        return Object.assign({}, c, {
          id,
          index,
          booked,
          left: c.cap - booked,
          started: startsAt < now,
          mine: own.length > 0
        });
      });

      const open = classes.filter((c) => !c.started);
      const left = open.reduce((s, c) => s + c.left, 0);
      const cap = open.reduce((s, c) => s + c.cap, 0) || 1;

      return { date, closed: false, classes, left, cap, past, beyond };
    }

    function dayStatus(info) {
      if (info.closed) return 'closed';
      if (info.left === 0) return 'full';
      if (info.left / info.cap < 0.18) return 'few';
      return 'ok';
    }

    /* Calendar */
    function renderCalendar() {
      const y = viewMonth.getFullYear();
      const m = viewMonth.getMonth();
      el.month.textContent = viewMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

      const offset = (new Date(y, m, 1).getDay() + 6) % 7;
      const daysInMonth = new Date(y, m + 1, 0).getDate();
      let html = '';

      for (let i = 0; i < offset; i++) html += '<span class="day day--empty"></span>';

      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(y, m, d);
        const key = keyOf(date);
        const info = getDay(key);
        const status = dayStatus(info);
        const fill = info.closed ? 0 : Math.round((1 - info.left / info.cap) * 100);
        const classes = ['day', `day--${status}`];
        if (info.past || info.beyond) classes.push('day--past');
        if (key === keyOf(today)) classes.push('is-today');
        if (key === selected) classes.push('is-selected');
        const label = info.closed ? 'Studio closed' : `${info.left} spots left`;

        html += `<button type="button" class="${classes.join(' ')}" data-key="${key}" aria-label="${date.toDateString()} — ${label}" title="${label}">
          <span>${d}</span>
          <span class="day__bar"><i style="--fill:${fill}%"></i></span>
        </button>`;
      }

      el.grid.innerHTML = html;

      const firstOfThis = new Date(today.getFullYear(), today.getMonth(), 1);
      el.prev.disabled = viewMonth <= firstOfThis;
      el.next.disabled = new Date(y, m + 1, 1) > lastDay;
    }

    /* Slots of the selected day */
    function renderSlots() {
      const info = getDay(selected);
      el.date.textContent = info.date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      if (info.closed) {
        el.count.textContent = 'Studio reset day';
        el.list.innerHTML = '<div class="slots__empty">The studio is closed for a deep clean and teacher training. See you tomorrow ✦</div>';
        return;
      }

      const visible = info.classes.filter((c) => filter === 'All' || c.style === filter);
      el.count.textContent = `${info.classes.length} classes · ${info.left} spots left`;

      if (!visible.length) {
        el.list.innerHTML = `<div class="slots__empty">No ${filter} classes on this day. Try another day or style.</div>`;
        return;
      }

      el.list.innerHTML = visible.map((c, i) => {
        const t = to12h(c.time);
        const ratio = c.booked / c.cap;
        const state = c.left === 0 ? 'full' : c.left <= 3 ? 'few' : 'ok';
        const spotsText = c.started ? 'Already started' : c.left === 0 ? 'Fully booked' : `${c.left} of ${c.cap} spots left`;
        let action;

        if (c.mine) {
          action = '<button class="btn btn--sm btn--light" type="button" disabled>You\'re in ✓</button>';
        } else if (c.started) {
          action = '<button class="btn btn--sm btn--ghost" type="button" disabled>Closed</button>';
        } else if (c.left === 0) {
          action = `<button class="btn btn--sm btn--ghost" type="button" data-waitlist="${c.index}">Waitlist<span class="btn__icon">${ARROW}</span></button>`;
        } else {
          action = `<button class="btn btn--sm" type="button" data-book="${c.index}">Reserve<span class="btn__icon">${ARROW}</span></button>`;
        }

        return `<div class="slot slot--${state}${c.mine ? ' slot--mine' : ''}" style="--i:${i}">
          <div class="slot__time"><strong>${t.clock}</strong><span>${t.suffix} · ${c.dur} min</span></div>
          <div>
            <div class="slot__name">${c.name}</div>
            <div class="slot__meta">with ${c.teacher} · ${c.room}</div>
            <div class="slot__spots"><i><b style="--fill:${Math.round(ratio * 100)}%"></b></i>${spotsText}</div>
          </div>
          <div class="slot__action">
            <div class="slot__price">$${c.price}</div>
            ${action}
          </div>
        </div>`;
      }).join('');
    }

    /* Upcoming bookings list */
    function renderMine() {
      const list = getBookings()
        .filter((b) => dateOf(b.date) >= today)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

      if (!list.length) {
        el.mine.innerHTML = '<p class="mine-empty">No reservations yet — pick a day above and save your spot.</p>';
        return;
      }

      el.mine.innerHTML = list.map((b) => {
        const d = dateOf(b.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        const t = to12h(b.time);
        return `<div class="mine-item">
          <span><b>${b.name}</b> · ${d}, ${t.clock} ${t.suffix} · ${b.guests} ${b.guests > 1 ? 'guests' : 'guest'}</span>
          <button type="button" data-cancel="${b.code}">Cancel</button>
        </div>`;
      }).join('');
    }

    function renderAll() {
      renderCalendar();
      renderSlots();
      renderMine();
    }

    /* Checkout modal */
    function updateSummary() {
      if (!chosen) return;
      const guests = parseInt(form.guests.value, 10);
      const pay = form.payment.value;
      let total = chosen.price * guests;
      let note = 'Pay at the front desk';
      if (pay === 'online') { total = Math.round(total * 0.9); note = 'Paid online · 10% off'; }
      if (pay === 'credits') { total = 0; note = `${guests} membership credit${guests > 1 ? 's' : ''}`; }

      const t = to12h(chosen.time);
      const date = dateOf(selected).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

      summary.innerHTML = `
        <div class="summary__row"><span>Class</span><b>${chosen.name}</b></div>
        <div class="summary__row"><span>When</span><b>${date}, ${t.clock} ${t.suffix}</b></div>
        <div class="summary__row"><span>Teacher</span><b>${chosen.teacher} · ${chosen.room}</b></div>
        <div class="summary__row"><span>Payment</span><b>${note}</b></div>
        <div class="summary__row summary__total"><span>Total</span><b>$${total}</b></div>`;
      chosen.total = total;
    }

    function openCheckout(index) {
      const info = getDay(selected);
      chosen = info.classes.find((c) => c.index === index);
      if (!chosen) return;

      formView.hidden = false;
      successView.hidden = true;
      form.reset();

      // Limit guests by spots left
      $$('input[name="guests"]', form).forEach((input) => {
        input.disabled = parseInt(input.value, 10) > chosen.left;
      });

      updateSummary();
      openModal(modal);
    }

    form.addEventListener('change', updateSummary);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let valid = true;
      const name = form.fullname;
      const email = form.email;

      [name, email].forEach((input) => input.classList.remove('is-error'));
      if (name.value.trim().length < 2) { name.classList.add('is-error'); valid = false; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value.trim())) { email.classList.add('is-error'); valid = false; }
      if (!valid) return;

      const code = `AMR-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const list = getBookings();
      list.push({
        id: chosen.id,
        code,
        date: selected,
        time: chosen.time,
        name: chosen.name,
        teacher: chosen.teacher,
        guests: parseInt(form.guests.value, 10),
        total: chosen.total,
        client: name.value.trim()
      });
      saveBookings(list);

      $('.success__code', successView).textContent = code;
      $('.success__text', successView).textContent =
        `${name.value.trim().split(' ')[0]}, your mat is waiting. We sent the details to ${email.value.trim()}.`;
      formView.hidden = true;
      successView.hidden = false;
      renderAll();
    });

    /* Events */
    el.grid.addEventListener('click', (e) => {
      const day = e.target.closest('.day[data-key]');
      if (!day) return;
      selected = day.dataset.key;
      $$('.day.is-selected', el.grid).forEach((d) => d.classList.remove('is-selected'));
      day.classList.add('is-selected');
      renderSlots();
      if (isMobile()) $('.slots', root).scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    el.prev.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1);
      renderCalendar();
    });

    el.next.addEventListener('click', () => {
      viewMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
      renderCalendar();
    });

    el.chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        el.chips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        filter = chip.dataset.style;
        renderSlots();
      });
    });

    el.list.addEventListener('click', (e) => {
      const book = e.target.closest('[data-book]');
      const wait = e.target.closest('[data-waitlist]');
      if (book) openCheckout(parseInt(book.dataset.book, 10));
      if (wait) {
        wait.disabled = true;
        wait.textContent = 'On waitlist ✓';
        toast('You\'re on the waitlist — we\'ll text you if a spot opens up.');
      }
    });

    el.mine.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cancel]');
      if (!btn) return;
      saveBookings(getBookings().filter((b) => b.code !== btn.dataset.cancel));
      renderAll();
      toast('Reservation cancelled. Your spot is free for someone else.');
    });

    // Skip to the first open day if today is closed
    if (getDay(selected).closed) {
      const next = new Date(today);
      next.setDate(next.getDate() + 1);
      selected = keyOf(next);
    }

    renderAll();
  }

  /* ------------------------------------------------------------------------
     17. Price calculator
     ------------------------------------------------------------------------ */
  function initCalculator() {
    const root = $('#calculator');
    if (!root) return;

    const FORMATS = {
      group: { base: 26, drop: 28, cap: 219, unit: 'group class' },
      private: { base: 110, drop: 125, cap: Infinity, unit: 'private session' },
      online: { base: 14, drop: 18, cap: 89, unit: 'live online class' }
    };
    const FREQ = {
      group: [0, 0, 0.08, 0.15, 0.22, 0.25, 0.28, 0.3],
      private: [0, 0, 0.05, 0.1, 0.12, 0.14, 0.15, 0.16],
      online: [0, 0, 0.05, 0.1, 0.15, 0.18, 0.2, 0.22]
    };
    const TERMS = { 1: 0, 3: 0.1, 6: 0.15, 12: 0.22 };
    const ADDONS = {
      mat: { price: 15, perPerson: true },
      sauna: { price: 39, perPerson: true },
      nutrition: { price: 59, perPerson: false },
      intro: { price: 85, once: true }
    };

    const state = { format: 'group', sessions: 3, people: 1, term: 3 };

    const out = {
      price: $('[data-out="price"]', root),
      per: $('[data-out="per"]', root),
      classes: $('[data-out="classes"]', root),
      addons: $('[data-out="addons"]', root),
      discount: $('[data-out="discount"]', root),
      term: $('[data-out="term"]', root),
      save: $('[data-out="save"]', root),
      rec: $('[data-out="rec"]', root),
      sessions: $('[data-out="sessions"]', root),
      people: $('[data-out="people"]', root)
    };

    const range = $('#calc-sessions', root);

    // Segmented controls with sliding pill
    function movePill(seg) {
      const active = $('button.is-active', seg);
      const pill = $('.seg__pill', seg);
      if (!active || !pill) return;
      const padLeft = parseFloat(getComputedStyle(seg).paddingLeft) || 0;
      pill.style.width = `${active.offsetWidth}px`;
      pill.style.transform = `translateX(${active.offsetLeft - padLeft}px)`;
    }

    $$('.seg', root).forEach((seg) => {
      $$('button', seg).forEach((btn) => {
        btn.addEventListener('click', () => {
          $$('button', seg).forEach((b) => b.classList.remove('is-active'));
          btn.classList.add('is-active');
          const key = seg.dataset.group;
          state[key] = key === 'term' ? parseInt(btn.dataset.value, 10) : btn.dataset.value;
          movePill(seg);
          compute();
        });
      });
      movePill(seg);
    });

    window.addEventListener('resize', () => $$('.seg', root).forEach(movePill));
    window.addEventListener('load', () => $$('.seg', root).forEach(movePill));

    function paintRange() {
      const p = ((range.value - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--p', `${p}%`);
    }

    range.addEventListener('input', () => {
      state.sessions = parseInt(range.value, 10);
      paintRange();
      compute();
    });

    $$('[data-step]', root).forEach((btn) => {
      btn.addEventListener('click', () => {
        state.people = clamp(state.people + parseInt(btn.dataset.step, 10), 1, 4);
        compute();
      });
    });

    $$('.addon input', root).forEach((input) => input.addEventListener('change', compute));

    function money(v) {
      return `$${Math.round(v).toLocaleString('en-US')}`;
    }

    function compute() {
      const f = FORMATS[state.format];
      const perMonth = state.sessions * 4.33;
      const freq = FREQ[state.format][state.sessions];

      let perPerson = perMonth * f.base * (1 - freq);
      let capped = false;
      if (perPerson > f.cap) { perPerson = f.cap; capped = true; }

      const peopleFactor = 1 + (state.people - 1) * 0.85;
      const beforeTerm = perPerson * peopleFactor;
      const termDiscount = TERMS[state.term];
      const classesCost = beforeTerm * (1 - termDiscount);

      let addonsMonthly = 0;
      let oneTime = 0;
      $$('.addon input:checked', root).forEach((input) => {
        const a = ADDONS[input.value];
        if (a.once) oneTime += a.price;
        else addonsMonthly += a.perPerson ? a.price * state.people : a.price;
      });

      const monthly = classesCost + addonsMonthly;
      const perClass = classesCost / (perMonth * state.people);
      const dropIn = perMonth * f.drop * state.people;
      const savings = Math.max(0, (dropIn - classesCost) * state.term);
      const termTotal = monthly * state.term + oneTime;

      animateNumber(out.price, Math.round(monthly), { duration: 700 });
      out.per.textContent = `≈ ${money(perClass)} per ${f.unit} · ${Math.round(perMonth * state.people)} visits a month`;
      out.classes.textContent = money(classesCost) + (capped ? ' (unlimited cap)' : '');
      out.addons.textContent = money(addonsMonthly) + (oneTime ? ` + ${money(oneTime)} once` : '');
      out.discount.textContent = termDiscount ? `−${Math.round(termDiscount * 100)}%` : '—';
      out.term.textContent = money(termTotal);
      out.save.textContent = `You save ${money(savings)} vs. drop-in over ${state.term} month${state.term > 1 ? 's' : ''}`;
      out.sessions.textContent = `${state.sessions}× / week`;
      out.people.textContent = state.people;

      let rec;
      if (state.format === 'private') rec = '<strong>Private Path</strong> — a 1:1 plan built around your body, injuries and goals.';
      else if (state.format === 'online') rec = '<strong>Amara Online</strong> — 40+ live classes a week, from any living room.';
      else if (state.sessions >= 4 || capped) rec = '<strong>Unlimited Flow</strong> — at this rhythm, unlimited pays for itself.';
      else if (state.sessions >= 2) rec = '<strong>Flow 8</strong> — eight classes a month, perfect for a steady habit.';
      else rec = '<strong>Class Pack 5</strong> — flexible credits that never expire for 3 months.';
      out.rec.innerHTML = `Our pick for you: ${rec}`;
    }

    paintRange();
    compute();
  }

  /* ------------------------------------------------------------------------
     18. Draggable slider (testimonials)
     ------------------------------------------------------------------------ */
  function initSlider() {
    $$('[data-slider]').forEach((wrap) => {
      const track = $('.voices__track', wrap);
      const prev = $('[data-slide="prev"]', wrap);
      const next = $('[data-slide="next"]', wrap);
      let x = 0, target = 0, max = 0;
      let dragging = false, startX = 0, startTarget = 0, moved = 0;

      function measure() {
        const pad = parseFloat(getComputedStyle(track).paddingLeft) || 0;
        max = Math.max(0, track.scrollWidth - track.clientWidth + pad);
      }

      measure();
      window.addEventListener('resize', measure);
      window.addEventListener('load', measure);
      track.style.touchAction = 'pan-y';

      track.addEventListener('pointerdown', (e) => {
        dragging = true;
        moved = 0;
        startX = e.clientX;
        startTarget = target;
        track.classList.add('is-drag');
      });

      window.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - startX;
        moved = Math.abs(dx);
        target = clamp(startTarget - dx * 1.3, -80, max + 80);
      });

      window.addEventListener('pointerup', () => {
        if (!dragging) return;
        dragging = false;
        track.classList.remove('is-drag');
        target = clamp(target, 0, max);
      });

      track.addEventListener('click', (e) => { if (moved > 6) e.preventDefault(); }, true);

      const stepSize = () => {
        const card = track.children[0];
        return card ? card.offsetWidth + parseFloat(getComputedStyle(track).gap || 0) : 300;
      };

      if (prev) prev.addEventListener('click', () => { target = clamp(target - stepSize(), 0, max); });
      if (next) next.addEventListener('click', () => { target = clamp(target + stepSize(), 0, max); });

      loops.push(() => {
        x = lerp(x, target, 0.09);
        track.style.transform = `translate3d(${(-x).toFixed(2)}px, 0, 0)`;
        if (prev) prev.disabled = target <= 2;
        if (next) next.disabled = target >= max - 2;
      });
    });
  }

  /* ------------------------------------------------------------------------
     19. FAQ accordion
     ------------------------------------------------------------------------ */
  function initFaq() {
    $$('.faq__item').forEach((item) => {
      const q = $('.faq__q', item);
      const a = $('.faq__a', item);
      if (item.classList.contains('is-open')) a.style.height = `${a.scrollHeight}px`;

      q.addEventListener('click', () => {
        const isOpen = item.classList.contains('is-open');
        $$('.faq__item.is-open', item.parentElement).forEach((other) => {
          if (other !== item) {
            other.classList.remove('is-open');
            $('.faq__a', other).style.height = '0px';
          }
        });
        item.classList.toggle('is-open', !isOpen);
        a.style.height = isOpen ? '0px' : `${a.scrollHeight}px`;
      });
    });
  }

  /* ------------------------------------------------------------------------
     20. Blog filter
     ------------------------------------------------------------------------ */
  function initBlogFilter() {
    const chips = $$('[data-filter]');
    const posts = $$('.blog-grid .post-card');
    if (!chips.length || !posts.length) return;

    chips.forEach((chip) => {
      chip.addEventListener('click', () => {
        chips.forEach((c) => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        const cat = chip.dataset.filter;

        posts.forEach((post) => {
          const show = cat === 'all' || post.dataset.cat === cat;
          if (show) {
            post.classList.remove('is-gone');
            requestAnimationFrame(() => requestAnimationFrame(() => post.classList.remove('is-out')));
          } else {
            post.classList.add('is-out');
            setTimeout(() => { if (post.classList.contains('is-out')) post.classList.add('is-gone'); }, 450);
          }
        });
        dirty = true;
      });
    });
  }

  /* ------------------------------------------------------------------------
     21. Forms: contact + newsletter
     ------------------------------------------------------------------------ */
  function initForms() {
    const contact = $('#contact-form');
    if (contact) {
      contact.addEventListener('submit', (e) => {
        e.preventDefault();
        let valid = true;
        $$('[required]', contact).forEach((input) => {
          input.classList.remove('is-error');
          const empty = !input.value.trim();
          const badEmail = input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim());
          if (empty || badEmail) { input.classList.add('is-error'); valid = false; }
        });
        if (!valid) return;

        const name = $('[name="fullname"]', contact).value.trim().split(' ')[0];
        contact.innerHTML = `<div class="success">
          <div class="success__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
          <h3 class="h3">Thank you, ${name}!</h3>
          <p class="muted" style="margin-top:1.6rem">Your message is with our front desk. We usually reply within 2 hours during studio hours.</p>
        </div>`;
      });
    }

    $$('[data-subscribe]').forEach((form) => {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const input = $('input', form);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) {
          input.classList.add('is-error');
          toast('Please enter a valid email address.');
          return;
        }
        input.value = '';
        toast('Welcome to the Amara letter — one calm email every Sunday ✦');
      });
    });
  }

  /* ------------------------------------------------------------------------
     22. Misc: reading progress, timeline, footer letters, year
     ------------------------------------------------------------------------ */
  function initMisc() {
    const progress = $('.read-progress');
    if (progress) {
      scrollers.push(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        progress.style.transform = `scaleX(${clamp(window.scrollY / max, 0, 1)})`;
      });
    }

    const timeline = $('.timeline');
    if (timeline) {
      const line = $('.timeline__line', timeline);
      scrollers.push(() => {
        const r = timeline.getBoundingClientRect();
        const vh = window.innerHeight;
        const p = clamp((vh * 0.8 - r.top) / (r.height + vh * 0.2), 0, 1);
        line.style.setProperty('--p', p.toFixed(3));
      });
    }

    $$('[data-letters]').forEach((el) => {
      el.innerHTML = el.textContent.trim().split('').map((ch) => `<span>${ch}</span>`).join('');
    });

    $$('[data-year]').forEach((el) => { el.textContent = new Date().getFullYear(); });
  }

  /* ------------------------------------------------------------------------
     Init
     ------------------------------------------------------------------------ */
  document.addEventListener('DOMContentLoaded', () => {
    initSplit();
    initPreloader();
    initCursor();
    initHeader();
    initReveal();
    initParallax();
    initMouseParallax();
    initInteractions();
    initMarquee();
    initManifesto();
    initFilm();
    initClasses();
    initSequence();
    initBreath();
    initCounters();
    initModals();
    initBooking();
    initCalculator();
    initSlider();
    initFaq();
    initBlogFilter();
    initForms();
    initMisc();
    requestAnimationFrame(frame);
  });
})();
