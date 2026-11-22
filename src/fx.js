// Global eye-candy: hero doodle universe (parallax), marker-ink cursor trail,
// click doodle bursts and the "type b-o-u-n-c-e" testicle rain.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHARS, charPaths, CHAR_YELLOW } from './character.js';
import { sound } from './sound.js';

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

/* ------------------------------------------------------------------ */
/* hero doodle universe                                                 */
/* ------------------------------------------------------------------ */
const DOODLES = {
  star: '<path d="M50 6 C 54 38, 62 46, 94 50 C 62 54, 54 62, 50 94 C 46 62, 38 54, 6 50 C 38 46, 46 38, 50 6 Z" class="df"/>',
  spark: '<path d="M50 10 V90 M10 50 H90 M22 22 L78 78 M78 22 L22 78" class="ds"/>',
  spiral: '<path d="M50 50 m0 -4 a4 4 0 1 1 -4 4 a10 10 0 1 1 10 10 a18 18 0 1 1 -18 -18 a28 28 0 1 1 28 28 a38 38 0 1 1 -38 -38" class="ds"/>',
  squiggle: '<path d="M6 60 C 18 30, 30 30, 38 56 S 58 84, 66 52 S 84 24, 94 46" class="ds"/>',
  heart: '<path d="M50 86 C 18 64, 6 44, 16 26 C 26 10, 44 14, 50 30 C 56 14, 74 10, 84 26 C 94 44, 82 64, 50 86 Z" class="ds"/>',
  dollar: '<text x="50" y="74" class="dt">$</text>',
  ess: '<text x="50" y="76" class="dt">S</text>',
  circle: '<path d="M50 12 C 82 10, 92 40, 86 62 C 78 90, 30 94, 16 70 C 4 48, 18 16, 54 14" class="ds"/>',
  arrow: '<path d="M10 70 C 30 40, 60 30, 86 34 M70 20 L88 34 L72 50" class="ds"/>',
  plus: '<path d="M50 20 V80 M20 50 H80" class="ds"/>',
};

function miniChar(idx) {
  const c = CHARS[idx];
  return `<svg viewBox="0 0 ${c.w} ${c.h}" overflow="visible"><path fill="#181613" d="${c.silhouette}"/><path fill="${CHAR_YELLOW}" fill-rule="evenodd" d="${c.ring}"/>${c.eyes.map((e) => `<path fill="${CHAR_YELLOW}" d="${e.d}"/>`).join('')}</svg>`;
}

export function initDoodles(hero, { mobile } = {}) {
  const layer = document.createElement('div');
  layer.className = 'doodle-field';
  layer.setAttribute('aria-hidden', 'true');
  hero.prepend(layer);
  const kinds = Object.keys(DOODLES);
  const n = mobile ? 14 : 26;
  const items = [];
  for (let i = 0; i < n; i++) {
    const depth = rand(0.25, 1);
    const outer = document.createElement('div');
    outer.className = 'doodle';
    const inner = document.createElement('div');
    inner.className = 'doodle-in';
    const isChar = Math.random() < 0.18;
    const size = (isChar ? rand(44, 80) : rand(22, 64)) * (0.55 + depth * 0.6);
    inner.innerHTML = isChar ? miniChar(i % 2) : `<svg viewBox="0 0 100 100" overflow="visible">${DOODLES[pick(kinds)]}</svg>`;
    outer.style.left = rand(2, 96) + '%';
    outer.style.top = rand(8, 92) + '%';
    outer.style.width = size + 'px';
    outer.style.height = size + 'px';
    outer.style.opacity = (0.25 + depth * 0.6).toFixed(2);
    outer.style.zIndex = Math.round(depth * 10);
    outer.style.setProperty('--dur', rand(4, 9).toFixed(1) + 's');
    outer.style.setProperty('--rot', rand(-30, 30).toFixed(0) + 'deg');
    inner.style.animationDelay = rand(-8, 0).toFixed(1) + 's';
    outer.appendChild(inner);
    layer.appendChild(outer);
    const it = {
      outer, inner, depth,
      mx: gsap.quickTo(inner, 'x', { duration: 1.2 - depth * 0.6, ease: 'power3' }),
      my: gsap.quickTo(inner, 'y', { duration: 1.2 - depth * 0.6, ease: 'power3' }),
    };
    items.push(it);
    // scroll parallax (deeper = faster)
    gsap.to(outer, {
      y: () => -innerHeight * 0.6 * depth, ease: 'none',
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    });
    // pop on click
    outer.addEventListener('pointerdown', () => {
      sound.pop(1.2 + Math.random() * 0.6, 0.6);
      gsap.timeline()
        .to(inner, { scale: 1.6, rotate: '+=90', duration: 0.12, ease: 'power2.out' })
        .to(inner, { scale: 0, opacity: 0, duration: 0.2, ease: 'power2.in' })
        .set(outer, { left: rand(2, 96) + '%', top: rand(8, 92) + '%' })
        .to(inner, { scale: 1, opacity: 1, rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.4)', delay: 0.8 });
      ink?.burstAt?.(outer.getBoundingClientRect().left + outer.offsetWidth / 2, outer.getBoundingClientRect().top + outer.offsetHeight / 2);
    });
  }
  // intro: doodles pop in
  gsap.from(items.map((i) => i.inner), { scale: 0, rotate: -90, duration: 0.9, ease: 'back.out(2.2)', stagger: { each: 0.035, from: 'random' }, delay: 0.3 });

  // mouse parallax + spotlight
  if (!mobile) {
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5;
      const ny = (e.clientY - r.top) / r.height - 0.5;
      for (const it of items) { it.mx(-nx * 70 * it.depth); it.my(-ny * 50 * it.depth); }
      hero.style.setProperty('--mx', `${e.clientX - r.left}px`);
      hero.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  }
  return layer;
}

/* ------------------------------------------------------------------ */
/* marker ink trail + click bursts + testicle rain (one canvas)        */
/* ------------------------------------------------------------------ */
let ink = null;
export function initInk({ enabled = true } = {}) {
  const cv = document.createElement('canvas');
  cv.className = 'ink-canvas';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, dpr = 1;
  const size = () => {
    dpr = Math.min(2, devicePixelRatio || 1);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
  };
  size();
  addEventListener('resize', size);

  const pts = [];      // trail points {x,y,t,w,c}
  const bursts = [];   // {x,y,t,lines:[{a,l}], c}
  const rain = [];     // falling characters
  const paths = [charPaths(0), charPaths(1)];
  let lastP = null;
  let active = false;

  const colorAt = (el) => (el && el.closest && el.closest('.paper, .marquee') ? '#b8452d' : '#fac332');

  if (enabled) {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      const c = colorAt(e.target);
      if (lastP) {
        const d = Math.hypot(e.clientX - lastP.x, e.clientY - lastP.y);
        if (d < 2) return;
        const sp = d / Math.max(1, now - lastP.t);
        pts.push({ x: e.clientX, y: e.clientY, t: now, w: Math.max(2, 9 - sp * 2.2), c });
      } else pts.push({ x: e.clientX, y: e.clientY, t: now, w: 4, c });
      lastP = { x: e.clientX, y: e.clientY, t: now };
      wake();
    }, { passive: true });

    addEventListener('pointerdown', (e) => {
      if (e.target.closest('a, button, input, canvas, .pet, .s-sticker, .doodle, .fin-char, [data-opt], .lore-svg')) return;
      burstAt(e.clientX, e.clientY, colorAt(e.target));
    });
  }

  function burstAt(x, y, c = '#fac332') {
    const lines = Array.from({ length: 9 }, (_, i) => ({ a: (i / 9) * Math.PI * 2 + rand(-0.2, 0.2), l: rand(24, 44) }));
    bursts.push({ x, y, t: performance.now(), lines, c, r: rand(14, 20) });
    wake();
  }

  function makeItRain(n = 46) {
    for (let i = 0; i < n; i++) {
      const w = rand(40, 90);
      rain.push({
        idx: i % 2, x: rand(0, W), y: rand(-H * 1.2, -60), vx: rand(-80, 80), vy: rand(0, 200),
        r: rand(-0.6, 0.6), vr: rand(-3, 3), w, bounces: 0, life: 7 + rand(0, 2),
      });
    }
    wake();
  }

  function wake() { if (!active) { active = true; requestAnimationFrame(loop); } }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // trail
    while (pts.length && now - pts[0].t > 650) pts.shift();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const age = (now - b.t) / 650;
      ctx.globalAlpha = Math.max(0, 0.85 * (1 - age));
      ctx.strokeStyle = b.c;
      ctx.lineWidth = b.w * (1 - age * 0.6);
      ctx.beginPath();
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x, a.y, mx, my); ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // bursts
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      const p = (now - b.t) / 520;
      if (p >= 1) { bursts.splice(i, 1); continue; }
      const e = 1 - Math.pow(1 - p, 3);
      ctx.strokeStyle = b.c; ctx.lineWidth = 3.5 * (1 - p) + 1;
      ctx.globalAlpha = 1 - p;
      for (const l of b.lines) {
        const r0 = b.r + e * 10, r1 = b.r + e * l.l;
        ctx.beginPath();
        ctx.moveTo(b.x + Math.cos(l.a) * r0, b.y + Math.sin(l.a) * r0);
        ctx.lineTo(b.x + Math.cos(l.a) * r1, b.y + Math.sin(l.a) * r1);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 0.7 * (1 - p * 0.5), -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, p * 2.2));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // testicle rain
    for (let i = rain.length - 1; i >= 0; i--) {
      const r = rain[i];
      r.vy += 2200 * dt; r.x += r.vx * dt; r.y += r.vy * dt; r.r += r.vr * dt; r.life -= dt;
      if (r.y > H - 4 && r.vy > 0) {
        r.y = H - 4; r.vy = -r.vy * (r.bounces < 3 ? 0.62 : 0); r.vx *= 0.8; r.vr *= 0.7;
        if (r.bounces++ < 1 && Math.random() < 0.15) sound.boing(rand(0.8, 1.6), 0.2);
      }
      if (r.x < 0 || r.x > W) r.vx *= -1;
      if (r.life <= 0) { rain.splice(i, 1); continue; }
      const p = paths[r.idx];
      const s = r.w / p.w;
      ctx.save();
      ctx.globalAlpha = Math.min(1, r.life);
      ctx.translate(r.x, r.y); ctx.rotate(r.r); ctx.scale(s, s); ctx.translate(-p.w / 2, -p.h);
      ctx.fillStyle = '#181613'; ctx.fill(p.sil);
      ctx.fillStyle = CHAR_YELLOW; ctx.fill(p.ring, 'evenodd');
      p.eyes.forEach((e) => ctx.fill(e.p));
      ctx.restore();
    }

    if (pts.length || bursts.length || rain.length) requestAnimationFrame(loop);
    else { active = false; ctx.clearRect(0, 0, W, H); }
  }

  ink = { burstAt, makeItRain };
  return ink;
}

/* secret word listener */
export function onSecret(word, fn) {
  let buf = '';
  addEventListener('keydown', (e) => {
    if (e.target.closest && e.target.closest('input, textarea')) return;
    if (e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-word.length);
    if (buf === word) { buf = ''; fn(); }
  });
}
