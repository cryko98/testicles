import '@fontsource/permanent-marker/400.css';
import '@fontsource/patrick-hand/400.css';
import './style.css';

import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';
import { MotionPathPlugin } from 'gsap/MotionPathPlugin';
import Lenis from 'lenis';

import { mountCharacter, CHARS } from './character.js';
import { World } from './pets.js';
import { initLab } from './lab.js';
import { sound } from './sound.js';

gsap.registerPlugin(ScrollTrigger, SplitText, Draggable, InertiaPlugin, MotionPathPlugin);

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const rand = (a, b) => a + Math.random() * (b - a);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;

/* ------------------------------------------------------------------ */
/* smooth scroll                                                        */
/* ------------------------------------------------------------------ */
if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);
const lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, autoRaf: false });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: id === '#top' ? 0 : -60, duration: 1.4 });
  });
});

/* ------------------------------------------------------------------ */
/* line boil: re-seed the turbulence a few times a second              */
/* ------------------------------------------------------------------ */
if (!reduced) {
  const n1 = $('#boil-noise'), n2 = $('#boil-noise-2');
  let seed = 1;
  setInterval(() => {
    seed = (seed % 3) + 1;
    n1.setAttribute('seed', seed);
    n2.setAttribute('seed', seed + 3);
  }, 130);
}

/* ------------------------------------------------------------------ */
/* toast + sound toggle                                                 */
/* ------------------------------------------------------------------ */
const toastEl = $('.toast');
let toastT;
function toast(msg) {
  toastEl.textContent = msg;
  gsap.killTweensOf(toastEl);
  gsap.fromTo(toastEl, { y: 40, opacity: 0, rotate: -3 }, { y: 0, opacity: 1, rotate: -1, duration: 0.5, ease: 'back.out(2)' });
  clearTimeout(toastT);
  toastT = setTimeout(() => gsap.to(toastEl, { y: 40, opacity: 0, duration: 0.3 }), 2600);
}

const soundBtn = $('.sound-toggle');
soundBtn.addEventListener('click', () => sound.toggle());
sound.onChange((on) => {
  soundBtn.setAttribute('aria-pressed', on);
  soundBtn.classList.toggle('on', on);
  $('.sound-label', soundBtn).textContent = on ? 'sound on' : 'sound off';
});

/* ------------------------------------------------------------------ */
/* static character mounts (logo, loader, polaroid, freezer)            */
/* ------------------------------------------------------------------ */
const logoPair = $('.logo-pair');
mountCharacter(logoPair, 0, { boil: false });
mountCharacter(logoPair, 1, { boil: false });

const loaderPair = $('.loader-pair');
const loaderChars = [mountCharacter(loaderPair, 0), mountCharacter(loaderPair, 1)];

const photoChars = $('.photo-chars');
const polTesti = mountCharacter(photoChars, 0);
const polCles = mountCharacter(photoChars, 1);
polTesti.svg.classList.add('pol-testi');
polCles.svg.classList.add('pol-cles');

// tiny blink helper for static characters
function autoBlink(chr) {
  const loop = () => {
    gsap.to(chr.eyeEls, { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.07, yoyo: true, repeat: 1, onComplete: () => gsap.delayedCall(rand(1.5, 5), loop) });
  };
  gsap.delayedCall(rand(0.5, 3), loop);
}
[...$$('.logo-pair .chr'), polTesti.svg, polCles.svg].forEach((svg) => autoBlink({ eyeEls: $$('.chr-eye', svg) }));

/* ------------------------------------------------------------------ */
/* cursor follower                                                      */
/* ------------------------------------------------------------------ */
const cursor = $('.cursor');
const cursorLabel = $('.cursor-label');
if (finePointer) {
  const dot = $('.cursor-dot'), ring = $('.cursor-ring');
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 }), dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  const rx = gsap.quickTo(ring, 'x', { duration: 0.35, ease: 'power3' }), ry = gsap.quickTo(ring, 'y', { duration: 0.35, ease: 'power3' });
  window.addEventListener('pointermove', (e) => { dx(e.clientX); dy(e.clientY); rx(e.clientX); ry(e.clientY); cursor.classList.add('on'); }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.remove('on'));
  document.addEventListener('pointerover', (e) => {
    const hot = e.target.closest('a, button, .s-sticker, .lab-canvas');
    cursor.classList.toggle('hot', !!hot);
  });
} else cursor.remove();

function setCursorMode(mode) {
  if (!cursorLabel) return;
  cursor.classList.toggle('grab', !!mode);
  cursorLabel.textContent = mode === 'grabbing' ? 'wheee' : mode ? 'grab' : '';
}

/* magnetic buttons */
if (finePointer) {
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - r.left - r.width / 2) * 0.3);
      yTo((e.clientY - r.top - r.height / 2) * 0.4);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

/* ------------------------------------------------------------------ */
/* the pets                                                             */
/* ------------------------------------------------------------------ */
const world = new World($('.pet-layer'), { stage: $('.hero-stage') });
world.onCursor = setCursorMode;
let pokeCount = 0;
world.onPoke = () => {
  pokeCount++;
  if (pokeCount === 1) toast('tip: drag & throw them. they bounce.');
  if (pokeCount === 12) toast('ok you really like poking testicles.');
};
lenis.on('scroll', (e) => world.nudge(e.velocity));

// name tags under the stage follow whether the pet is home
const tags = [$('.nt-1'), $('.nt-2')];
setInterval(() => {
  world.pets.forEach((p, i) => {
    const away = !p.onStage;
    if (tags[i].classList.contains('away') !== away) {
      tags[i].classList.toggle('away', away);
      tags[i].dataset.away = away ? 'out exploring' : '';
    }
  });
}, 400);

/* ------------------------------------------------------------------ */
/* hero                                                                 */
/* ------------------------------------------------------------------ */
const heroTitle = $('.hero-title');
heroTitle.setAttribute('data-perch', '');
const titleSplit = new SplitText('.ht-word', { type: 'chars', charsClass: 'ht-char' });
const titleChars = [...titleSplit.chars, $('.ht-s')];

function charHop(el, power = 1) {
  if (el._hopping) return;
  el._hopping = true;
  gsap.timeline({ onComplete: () => (el._hopping = false) })
    .to(el, { scaleY: 0.82, scaleX: 1.12, transformOrigin: '50% 100%', duration: 0.08, ease: 'power2.out' })
    .to(el, { y: -38 * power, scaleY: 1.12, scaleX: 0.92, rotate: rand(-10, 10), duration: 0.22, ease: 'power2.out' })
    .to(el, { y: 0, scaleY: 1, scaleX: 1, duration: 0.3, ease: 'bounce.out' })
    .to(el, { rotate: 0, duration: 0.3 }, '<');
}
titleChars.forEach((c) => c.addEventListener('pointerenter', () => { charHop(c, 0.7); sound.pop(1.4 + Math.random() * 0.4, 0.25); }));

// underline + found-it scribbles
function drawPath(path) {
  const l = path.getTotalLength();
  gsap.set(path, { strokeDasharray: l, strokeDashoffset: l });
  return l;
}
$$('.scribble-underline path, .found-it path').forEach(drawPath);

function heroIntro() {
  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
  tl.from(titleSplit.chars, { yPercent: -160, rotate: () => rand(-40, 40), opacity: 0, duration: 0.9, ease: 'bounce.out', stagger: { each: 0.055, from: 'random' } })
    .from('.ht-s', { yPercent: -260, rotate: 70, opacity: 0, duration: 1.1, ease: 'bounce.out' }, '-=0.3')
    .add(() => { charHop($('.ht-s'), 0.5); sound.boing(0.9); }, '-=0.25')
    .from('.found-it', { opacity: 0, scale: 0.4, rotate: 20, duration: 0.4, ease: 'back.out(3)' }, '-=0.1')
    .to('.found-it path', { strokeDashoffset: 0, duration: 0.5 }, '<0.1')
    .from('.hero-tag', { y: 30, opacity: 0, duration: 0.6 }, '-=0.6')
    .to('.scribble-underline path', { strokeDashoffset: 0, duration: 0.8, stagger: 0.2, ease: 'power2.inOut' }, '-=0.3')
    .from('.hero-sub, .hero-actions, .hero-hint, .scroll-cue', { y: 24, opacity: 0, duration: 0.6, stagger: 0.08 }, '-=0.8')
    .from('.stage-doodles path', { scaleX: 0, transformOrigin: '50% 50%', duration: 0.6, stagger: 0.08 }, 0.2)
    .from('.spark', { scale: 0, rotate: -90, duration: 0.6, stagger: 0.1, ease: 'back.out(3)' }, 0.6)
    .from('.name-tag', { y: 10, opacity: 0, duration: 0.5, stagger: 0.1 }, 1.4);
  return tl;
}

// make it bounce
const btnBounce = $('.btn-bounce');
btnBounce.addEventListener('click', () => {
  world.bounceAll();
  titleChars.forEach((c, i) => gsap.delayedCall(i * 0.04, () => charHop(c, 1.2)));
  if (!reduced) gsap.fromTo('main', { y: 0 }, { y: 6, duration: 0.05, repeat: 5, yoyo: true, ease: 'none', clearProps: 'transform' });
  gsap.fromTo(btnBounce, { scaleY: 0.8, scaleX: 1.1 }, { scaleY: 1, scaleX: 1, duration: 0.7, ease: 'elastic.out(1, 0.3)' });
});

// CA pills
$$('.ca-pill').forEach((b) => b.addEventListener('click', () => {
  toast('CA drops at launch. anything before that is fake.');
  gsap.fromTo(b, { rotate: -4 }, { rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.3)' });
  const p = world.pets[Math.random() < 0.5 ? 0 : 1];
  if (!p.dragging && !p.frozen) p.say(Math.random() < 0.5 ? 'not yet.' : 'soon™', 1600);
}));

/* ------------------------------------------------------------------ */
/* marquee: loops forever, velocity reacts to scrolling                 */
/* ------------------------------------------------------------------ */
const track = $('.marquee-track');
track.innerHTML += track.innerHTML;
const marqueeTL = gsap.to(track, { xPercent: -50, duration: 28, ease: 'none', repeat: -1 });
let mqDir = 1;
ScrollTrigger.create({
  trigger: '.marquee',
  start: 'top bottom',
  end: 'bottom top',
  onUpdate(self) {
    const v = self.getVelocity();
    mqDir = self.direction;
    gsap.to(marqueeTL, { timeScale: mqDir * (1 + Math.min(6, Math.abs(v) / 400)), duration: 0.2, overwrite: true });
    gsap.to(track, { skewX: gsap.utils.clamp(-12, 12, -v / 220), duration: 0.3, overwrite: 'auto' });
  },
});
ScrollTrigger.addEventListener('scrollEnd', () => {
  gsap.to(marqueeTL, { timeScale: mqDir, duration: 0.8 });
  gsap.to(track, { skewX: 0, duration: 0.6 });
});

/* ------------------------------------------------------------------ */
/* generic reveals                                                      */
/* ------------------------------------------------------------------ */
$$('.display').forEach((h) => {
  const split = new SplitText(h, { type: 'lines,words', mask: 'lines' });
  gsap.from(split.words, {
    yPercent: 110, rotate: 6, duration: 0.9, ease: 'power4.out', stagger: 0.05,
    scrollTrigger: { trigger: h, start: 'top 85%' },
  });
});
$$('.eyebrow, .lead, .stat, .link-scribble, .steps li, .freezer-actions').forEach((el) => {
  gsap.from(el, { y: 26, opacity: 0, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } });
});

/* ------------------------------------------------------------------ */
/* archive: counter, polaroid & the missing S                           */
/* ------------------------------------------------------------------ */
const countEl = $('.count');
const counter = { v: 0 };
gsap.to(counter, {
  v: 25.9, duration: 2.2, ease: 'power3.out',
  onUpdate: () => (countEl.textContent = counter.v.toFixed(1)),
  scrollTrigger: { trigger: '.stat', start: 'top 85%' },
});
gsap.from('.polaroid', {
  y: 120, rotate: -14, opacity: 0, duration: 1.2, ease: 'elastic.out(1, 0.6)',
  scrollTrigger: { trigger: '.archive-visual', start: 'top 80%' },
});
gsap.from('.s-sticker', {
  scale: 0, rotate: -120, duration: 0.9, ease: 'back.out(2.5)', delay: 0.3,
  scrollTrigger: { trigger: '.archive-visual', start: 'top 75%' },
});
gsap.set(polCles.svg, { scale: 0, opacity: 0, transformOrigin: '50% 100%' });

let sApplied = false;
const caption = $('.caption');
const sticker = $('.s-sticker');
function applyS() {
  if (sApplied) return;
  sApplied = true;
  const slot = $('.caption-s-slot');
  slot.textContent = 'S';
  const r = sticker.getBoundingClientRect();
  gsap.to(sticker, { scale: 0, rotate: 200, opacity: 0, duration: 0.35, ease: 'back.in(2)' });
  $('.s-hint').textContent = 'see? plural.';
  gsap.fromTo(slot, { scale: 3, rotate: -30, color: '#fac332' }, { scale: 1, rotate: 0, color: '#b8452d', duration: 0.6, ease: 'back.out(3)' });
  sound.chime();
  // camera flash + the second one pops in
  const tl = gsap.timeline();
  tl.fromTo('.flash', { opacity: 0.95 }, { opacity: 0, duration: 0.9, ease: 'power2.out' })
    .to(polTesti.svg, { xPercent: -42, duration: 0.6, ease: 'power3.inOut' }, 0)
    .to(polCles.svg, { scale: 1, opacity: 1, duration: 0.9, ease: 'elastic.out(1, 0.45)' }, 0.25)
    .to('.polaroid', { rotate: -3, duration: 0.8, ease: 'elastic.out(1, 0.4)' }, 0);
  const pr = $('.photo').getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    world.fx(['✶', '✳', '✦', 'S'][i % 4], pr.left + pr.width / 2, pr.top + pr.height / 2, { size: rand(16, 34), vx: rand(-420, 420), vy: rand(-700, -200), gravity: true, dur: 1.4 });
  }
  world.burst(r.left + r.width / 2, r.top + r.height / 2, 10);
  world.pets.forEach((p, i) => setTimeout(() => {
    if (p.dragging || p.frozen) return;
    p.lookAtPoint(pr.left + pr.width / 2, pr.top + pr.height / 2, 2500);
    p.say(i ? 'that one is me!' : "that's us!", 2000);
  }, 400 + i * 600));
  toast('S applied. the test is now plural.');
}
Draggable.create(sticker, {
  type: 'x,y',
  inertia: true,
  onPress() { gsap.to(sticker, { scale: 1.15, rotate: -8, duration: 0.2 }); sound.squeak(); },
  onDrag() { caption.classList.toggle('target', this.hitTest(caption, '30%')); },
  onRelease() {
    caption.classList.remove('target');
    if (this.hitTest(caption, '30%')) applyS();
    else gsap.to(sticker, { x: 0, y: 0, scale: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1, 0.45)' });
  },
  onClick() { applyS(); },
});
sticker.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); applyS(); } });

/* ------------------------------------------------------------------ */
/* bounce lab                                                           */
/* ------------------------------------------------------------------ */
const labBox = $('.lab-box');
const labCount = $('.lab-count b');
const lab = initLab(labBox, { onCount: (n) => (labCount.textContent = n) });
let labSeeded = false;
ScrollTrigger.create({
  trigger: labBox,
  start: 'top bottom',
  end: 'bottom top',
  onToggle(self) {
    if (self.isActive) {
      lab.play();
      if (!labSeeded) { labSeeded = true; setTimeout(() => lab.rain(7), 400); }
    } else lab.pause();
  },
});
$$('[data-lab]').forEach((b) => b.addEventListener('click', () => {
  const a = b.dataset.lab;
  if (a === 'one') lab.spawn();
  if (a === 'ten') lab.rain(10);
  if (a === 'flip') b.classList.toggle('on', lab.flip());
  if (a === 'shake') { lab.shake(); gsap.fromTo(labBox, { x: -8 }, { x: 0, duration: 0.5, ease: 'elastic.out(1, 0.2)' }); }
  if (a === 'clear') lab.clear();
}));

/* ------------------------------------------------------------------ */
/* the freezer                                                          */
/* ------------------------------------------------------------------ */
const svgNS = 'http://www.w3.org/2000/svg';
const fz = $('.freezer-svg');
// mini character inside the trade scene (same traced paths)
const mini = $('.fz-mini', fz);
mini.innerHTML = `<path class="chr-sil" d="${CHARS[0].silhouette}"/><path class="chr-ring" fill-rule="evenodd" d="${CHARS[0].ring}"/>${CHARS[0].eyes.map((e) => `<path class="chr-eye" d="${e.d}"/>`).join('')}`;
gsap.set(mini, { x: 40, y: 58, scale: 0.34, transformOrigin: '0 0' });
gsap.set('.fz-snow-token', { x: 210, y: 100 });
gsap.set('.fz-swap', { x: 30, y: 0 });

// snowballs that drop into the chamber (visible through the window)
const balls = $('.fz-balls', fz);
balls.innerHTML = '<rect class="fz-inside" x="168" y="314" width="270" height="118" rx="6"/>';
const ballSpots = [];
for (let row = 0; row < 3; row++) {
  for (let i = 0; i < 6 - row; i++) {
    ballSpots.push({ x: 200 + i * 42 + row * 21 + rand(-4, 4), y: 404 - row * 34 });
  }
}
ballSpots.forEach((s) => {
  const g = document.createElementNS(svgNS, 'g');
  g.setAttribute('class', 'fz-ball');
  g.innerHTML = `<circle r="${rand(17, 21).toFixed(1)}"/><path d="M-8 -7 C -4 -11, 3 -11, 7 -6"/>`;
  balls.appendChild(g);
  gsap.set(g, { x: s.x, y: 120, opacity: 0 });
  g._to = s;
});
// frost crystals over the window
const frost = $('.fz-frost', fz);
frost.innerHTML = `<rect class="fz-frost-glass" x="170" y="318" width="266" height="110" rx="8"/>` +
  Array.from({ length: 9 }, (_, i) => {
    const x = 186 + i * 30 + rand(-6, 6), y = 330 + rand(0, 80), s = rand(8, 15);
    return `<path class="fz-crystal" d="M${x - s} ${y} L${x + s} ${y} M${x} ${y - s} L${x} ${y + s} M${x - s * 0.7} ${y - s * 0.7} L${x + s * 0.7} ${y + s * 0.7} M${x - s * 0.7} ${y + s * 0.7} L${x + s * 0.7} ${y - s * 0.7}"/>`;
  }).join('');
const route = $('.fz-route', fz);
route.setAttribute('d', 'M245 96 C 330 40, 420 110, 330 214');
drawPath(route);

const steps = $$('.steps li');
const fsText = $('.fs-text');
const fsDot = $('.fs-dot');
function setStep(i) {
  steps.forEach((s, j) => s.classList.toggle('active', j === i));
  steps.forEach((s, j) => s.classList.toggle('done', j < i));
}

const coins = $$('.fz-coin', fz);
gsap.set(coins, { opacity: 0 });
gsap.set('.fz-years', { opacity: 0, scale: 2.4, transformOrigin: '300px 190px' });
gsap.set('.fz-frost', { opacity: 0 });

const fzTL = gsap.timeline({ paused: true, defaults: { ease: 'power2.inOut' } });
fzTL.addLabel('s1')
  .call(() => setStep(0))
  .from('.fz-trade', { opacity: 0, y: 20, duration: 0.4 })
  .to(mini, { x: 196, y: 70, duration: 0.8 }, '+=0.1')
  .to('.fz-snow-token', { x: 72, y: 100, duration: 0.8 }, '<')
  .to(mini, { x: 40, y: 58, duration: 0.8 }, '+=0.2')
  .to('.fz-snow-token', { x: 210, y: 100, duration: 0.8 }, '<')
  .addLabel('s2')
  .call(() => setStep(1))
  .to(route, { strokeDashoffset: 0, duration: 0.6 })
  .to(coins, { opacity: 1, duration: 0.1, stagger: 0.25 }, '<0.2')
  .to(coins, { motionPath: { path: route, align: route, alignOrigin: [0.5, 0.5] }, duration: 1.1, stagger: 0.25, ease: 'power1.in' }, '<')
  .to(coins, { scale: 0, opacity: 0, duration: 0.2, stagger: 0.25 }, '-=0.6')
  .addLabel('s3')
  .call(() => setStep(2))
  .to('.fz-lid-g', { rotation: -26, svgOrigin: '120 252', duration: 0.6, ease: 'back.out(2)' })
  .to('.fz-ball', { opacity: 1, duration: 0.05, stagger: 0.07 }, '<0.2')
  .to('.fz-ball', { y: (i, el) => el._to.y, duration: 0.7, ease: 'bounce.out', stagger: 0.07 }, '<')
  .addLabel('s4')
  .call(() => setStep(3))
  .to('.fz-lid-g', { rotation: 0, svgOrigin: '120 252', duration: 0.4, ease: 'power3.in' })
  .to('.fz-shackle', { y: 8, duration: 0.25, ease: 'back.in(3)' })
  .to('.fz-needle', { rotation: -120, svgOrigin: '410 450', duration: 0.6, ease: 'elastic.out(1, 0.4)' }, '<')
  .to('.fz-frost', { opacity: 1, duration: 0.6 }, '<')
  .to('.fz-years', { opacity: 1, scale: 1, rotation: -4, duration: 0.5, ease: 'back.out(2.5)' }, '-=0.2')
  .addLabel('end');

let lastLocked = null;
function updateStatus() {
  const locked = fzTL.time() >= fzTL.labels.s4 + 0.3;
  if (locked !== lastLocked) {
    lastLocked = locked;
    fsText.textContent = locked ? 'LOCKED · 100 YEARS' : 'CHAMBER OPEN';
    fsDot.classList.toggle('locked', locked);
  }
}
fzTL.eventCallback('onUpdate', updateStatus);

const mm = gsap.matchMedia();
mm.add('(min-width: 900px)', () => {
  const st = ScrollTrigger.create({
    trigger: '.freezer-pin',
    start: 'top top+=40',
    end: '+=2000',
    pin: true,
    scrub: 0.8,
    animation: fzTL,
  });
  return () => st.kill();
});
mm.add('(max-width: 899px)', () => {
  const st = ScrollTrigger.create({
    trigger: '.freezer-visual',
    start: 'top 70%',
    onEnter: () => fzTL.play(),
  });
  return () => st.kill();
});

// snow inside the freezer card
const flakes = $('.freezer-flakes');
for (let i = 0; i < 16; i++) {
  const f = document.createElement('span');
  f.textContent = ['❄', '✶', '✦', '·'][i % 4];
  f.style.left = rand(0, 100) + '%';
  f.style.animationDelay = rand(-10, 0) + 's';
  f.style.animationDuration = rand(6, 12) + 's';
  f.style.fontSize = rand(10, 20) + 'px';
  flakes.appendChild(f);
}

$('.btn-freeze').addEventListener('click', (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  const p = world.freezeNearest(r.left + r.width / 2, r.top);
  gsap.fromTo('.freezer-svg', { rotate: -2 }, { rotate: 0, duration: 0.6, ease: 'elastic.out(1, 0.25)' });
  toast(p ? `${p.name} has been frozen for science.` : 'nobody to freeze. they are hiding.');
});

/* ------------------------------------------------------------------ */
/* finale                                                               */
/* ------------------------------------------------------------------ */
const finaleSplit = new SplitText('.finale-title span', { type: 'chars', charsClass: 'fin-char' });
gsap.from(finaleSplit.chars, {
  yPercent: 120, rotate: () => rand(-30, 30), opacity: 0, duration: 1, ease: 'elastic.out(1, 0.5)', stagger: 0.03,
  scrollTrigger: { trigger: '.finale-title', start: 'top 80%' },
});
finaleSplit.chars.forEach((c) => c.addEventListener('pointerenter', () => { charHop(c, 0.8); sound.pop(1.2 + Math.random() * 0.5, 0.2); }));
ScrollTrigger.create({
  trigger: '.finale',
  start: 'top 60%',
  onEnter: () => {
    const wave = () => {
      if (!ScrollTrigger.isInViewport($('.finale-title'))) return gsap.delayedCall(3, wave);
      finaleSplit.chars.forEach((c, i) => gsap.delayedCall(i * 0.035, () => charHop(c, 0.6)));
      gsap.delayedCall(rand(4, 7), wave);
    };
    gsap.delayedCall(1.5, wave);
  },
  once: true,
});

/* sparkles twinkle */
$$('.spark').forEach((s) => {
  gsap.to(s, { rotate: 180, scale: 0.6, duration: rand(1.2, 2.2), repeat: -1, yoyo: true, ease: 'sine.inOut', delay: rand(0, 2) });
});

/* ------------------------------------------------------------------ */
/* loader -> intro                                                      */
/* ------------------------------------------------------------------ */
function runLoader() {
  const tl = gsap.timeline();
  const [a, b] = loaderChars.map((c) => c.svg);
  tl.from([a, b], { scale: 0, rotate: -40, y: 60, duration: 0.7, ease: 'elastic.out(1, 0.5)', stagger: 0.18, transformOrigin: '50% 100%' })
    .from('.loader-text', { opacity: 0, y: 10, duration: 0.3 }, 0.2)
    .to(loaderChars.flatMap((c) => c.eyeEls), { scaleY: 0.1, transformOrigin: '50% 50%', duration: 0.07, yoyo: true, repeat: 1 }, '+=0.15')
    .add(() => { $('.loader-text').innerHTML = 'two. <span>found it.</span>'; })
    .to([a, b], { y: -30, duration: 0.18, ease: 'power2.out', stagger: 0.08 }, '+=0.1')
    .to([a, b], { y: 0, duration: 0.3, ease: 'bounce.out', stagger: 0.08 })
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 0.8, ease: 'power4.inOut' }, '+=0.15')
    .add(() => {
      $('.loader').remove();
      lenis.start();
      heroIntro();
      world.refreshPerches();
      world.intro();
    }, '-=0.45');
}

if (document.fonts?.ready) document.fonts.ready.then(runLoader);
else window.addEventListener('load', runLoader);

window.addEventListener('load', () => { ScrollTrigger.refresh(); world.refreshPerches(); });

if (import.meta.env.DEV) window.__dbg = { world, lenis, lab };
