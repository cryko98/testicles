// THE LORE: a pinned, scroll-scrubbed story told by the characters themselves.
// Everything lives in one SVG (viewBox 1000x600). Transforms are driven through plain
// proxy objects and written as SVG attributes, so scrubbing back and forth is exact.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { CHARS } from './character.js';

const NS = 'http://www.w3.org/2000/svg';
const FLOOR = 540;
const CHART = [[70, 520], [130, 498], [170, 508], [220, 466], [262, 480], [312, 424], [350, 442], [402, 372], [440, 392], [492, 320], [530, 340], [580, 268], [620, 288], [672, 214], [710, 236], [760, 160], [800, 182], [850, 108], [900, 92]];

function charGroup(idx, cls) {
  const c = CHARS[idx];
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', cls);
  g.innerHTML = `<g class="lc-s"><g transform="translate(${-c.w / 2} ${-c.h})">
    <path class="chr-sil" d="${c.silhouette}"/>
    <g filter="url(#boil)"><path class="chr-ring" fill-rule="evenodd" d="${c.ring}"/>${c.eyes.map((e) => `<path class="chr-eye" d="${e.d}"/>`).join('')}</g>
  </g></g>`;
  return g;
}

export function initLore(section) {
  const svg = section.querySelector('.lore-svg');
  const lines = [...section.querySelectorAll('.lore-line')];
  const dots = [...section.querySelectorAll('.lore-dots i')];
  const num = section.querySelector('.lore-num b');

  let grid = '';
  for (let x = 0; x <= 1000; x += 50) grid += `<path d="M${x} 0 V${FLOOR}"/>`;
  for (let y = 0; y <= FLOOR; y += 50) grid += `<path d="M0 ${y} H1000"/>`;
  const d = 'M' + CHART.map((p) => p.join(' ')).join(' L');
  svg.innerHTML = `
    <g class="lore-grid">${grid}</g>
    <path class="lore-floor" d="M0 ${FLOOR + 2} C 250 ${FLOOR - 6}, 600 ${FLOOR + 8}, 1000 ${FLOOR}" filter="url(#boil)"/>
    <g class="lore-chartg">
      <path class="lore-area" d="${d} L900 ${FLOOR} L70 ${FLOOR} Z"/>
      <path class="lore-chart" d="${d}" filter="url(#boil)"/>
      <text class="lore-peak" x="900" y="62">$25.9M</text>
    </g>
    <g class="lore-fx"></g>
  `;
  const chartG = svg.querySelector('.lore-chartg');
  const chart = svg.querySelector('.lore-chart');
  const area = svg.querySelector('.lore-area');
  const peak = svg.querySelector('.lore-peak');
  const fx = svg.querySelector('.lore-fx');

  const cles = charGroup(1, 'lore-char');
  const testi = charGroup(0, 'lore-char');
  svg.append(cles, testi);
  const sEl = document.createElementNS(NS, 'g');
  sEl.innerHTML = '<text class="lore-s" x="0" y="68">S</text>';
  const stamp = document.createElementNS(NS, 'g');
  stamp.setAttribute('class', 'lore-stamp');
  stamp.innerHTML = '<rect x="-120" y="-46" width="240" height="92" rx="10"/><text y="26">TEST</text>';
  const mcap = document.createElementNS(NS, 'g');
  mcap.setAttribute('class', 'lore-mcap');
  mcap.innerHTML = '<path d="M-74 -60 H74 V-16 H12 L0 -2 L-12 -16 H-74 Z"/><text y="-28">$0.0M</text>';
  svg.append(sEl, stamp, mcap);
  const mcapText = mcap.querySelector('text');

  function burst(x, y, n) {
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'lore-burst');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const l = document.createElementNS(NS, 'path');
      l.setAttribute('d', `M${Math.cos(a) * 30} ${Math.sin(a) * 30} L${Math.cos(a) * 72} ${Math.sin(a) * 72}`);
      g.appendChild(l);
    }
    fx.appendChild(g);
    return { el: g, x, y, s: 0.4, o: 0 };
  }

  // ---- proxies ----
  const T = { x: 430, y: FLOOR, r: 0, s: 0, sx: 1, sy: 1 };
  const C = { x: 610, y: FLOOR, r: 0, s: 0, sx: 1, sy: 1 };
  const ST = { x: 430, y: 300, s: 3, r: -14, o: 0 };
  const S = { x: 820, y: -80, r: 0, s: 1, o: 0 };
  const M = { x: 0, y: 0, o: 0 };
  const CH = { draw: 0, area: 0, peak: 0, peakS: 0.5, dim: 1 };
  const B1 = burst(900, 70, 12);
  const B2 = burst(518, 380, 14);

  const len = chart.getTotalLength();
  chart.style.strokeDasharray = len;

  function apply() {
    const ch = (g, p) => {
      g.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.r.toFixed(2)})`);
      g.firstElementChild.setAttribute('transform', `scale(${(p.s * p.sx).toFixed(4)} ${(p.s * p.sy).toFixed(4)})`);
    };
    ch(testi, T); ch(cles, C);
    stamp.setAttribute('transform', `translate(${ST.x} ${ST.y}) rotate(${ST.r.toFixed(2)}) scale(${ST.s.toFixed(3)})`);
    stamp.style.opacity = ST.o;
    sEl.setAttribute('transform', `translate(${S.x.toFixed(1)} ${S.y.toFixed(1)}) rotate(${S.r.toFixed(1)}) scale(${S.s.toFixed(3)})`);
    sEl.style.opacity = S.o;
    mcap.setAttribute('transform', `translate(${M.x.toFixed(1)} ${M.y.toFixed(1)})`);
    mcap.style.opacity = M.o;
    chart.style.strokeDashoffset = len * (1 - CH.draw);
    area.style.opacity = CH.area;
    peak.style.opacity = CH.peak;
    peak.setAttribute('transform', `translate(900 50) scale(${CH.peakS.toFixed(3)}) translate(-900 -50)`);
    chartG.style.opacity = CH.dim;
    for (const b of [B1, B2]) {
      b.el.setAttribute('transform', `translate(${b.x} ${b.y}) scale(${b.s.toFixed(3)})`);
      b.el.style.opacity = b.o;
    }
  }

  // riding the chart
  const ride = { p: 0 };
  function placeOnChart() {
    const pt = chart.getPointAtLength(ride.p * len);
    T.x = pt.x; T.y = pt.y;
    M.x = pt.x; M.y = pt.y - 110;
    CH.draw = ride.p;
    mcapText.textContent = `$${(Math.pow(ride.p, 1.6) * 25.9).toFixed(1)}M`;
  }

  function setChapter(i) {
    dots.forEach((dd, j) => dd.classList.toggle('on', j <= i));
    num.textContent = String(i + 1).padStart(2, '0');
  }
  function showLine(tl, i, at) {
    const prev = lines[i - 1];
    if (prev) tl.to(prev, { autoAlpha: 0, yPercent: -50, rotate: -3, duration: 0.3, ease: 'power2.in' }, at);
    tl.fromTo(lines[i], { autoAlpha: 0, yPercent: 60, rotate: 4 }, { autoAlpha: 1, yPercent: 0, rotate: 0, duration: 0.4, ease: 'back.out(2)' }, at + 0.1);
    tl.call(() => setChapter(i), null, at + 0.1);
    tl.call(() => setChapter(Math.max(0, i - 1)), null, at + 0.09);
  }
  gsap.set(lines, { autoAlpha: 0 });

  const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' }, onUpdate: apply });
  // 01 — it started as a test
  showLine(tl, 0, 0);
  tl.to(T, { s: 1.15, duration: 0.5, ease: 'elastic.out(1, 0.5)' }, 0.1)
    .to(ST, { o: 1, s: 1, y: 330, duration: 0.25, ease: 'power4.in' }, 0.55)
    .to(T, { sx: 1.22, sy: 0.84, duration: 0.1, yoyo: true, repeat: 1 }, 0.8)
    .to({}, { duration: 0.3 }, 1);
  // 02 — it hit $25.9M
  showLine(tl, 1, 1.3);
  tl.to(ST, { o: 0, s: 0.6, r: 20, duration: 0.3 }, 1.3)
    .to(T, { s: 0.6, x: CHART[0][0], y: CHART[0][1], duration: 0.3 }, 1.3)
    .to(CH, { area: 1, duration: 0.6 }, 1.6)
    .to(M, { o: 1, duration: 0.15 }, 1.6)
    .to(ride, { p: 1, duration: 1.6, ease: 'none', onUpdate: placeOnChart }, 1.6)
    .to(CH, { peak: 1, peakS: 1, duration: 0.3, ease: 'back.out(3)' }, 3.1)
    .to(B1, { o: 1, s: 1.3, duration: 0.25 }, 3.15)
    .to(B1, { o: 0, duration: 0.2 }, 3.4)
    .to(M, { o: 0, duration: 0.2 }, 3.45);
  // 03 — the S got loose
  showLine(tl, 2, 3.6);
  tl.to(CH, { dim: 0.18, duration: 0.4 }, 3.6)
    .to(S, { o: 1, duration: 0.05 }, 3.75)
    .to(S, { y: FLOOR - 70, duration: 0.6, ease: 'bounce.out' }, 3.75)
    .to(S, { x: 610, r: -360, duration: 0.7, ease: 'power1.inOut' }, 4.35)
    .to(T, { s: 0.75, duration: 0.3 }, 3.8);
  // 04 — one mascot. then two.
  showLine(tl, 3, 5.15);
  tl.to(T, { x: 720, y: 30, duration: 0.25, ease: 'power2.out' }, 5.2)
    .to(T, { x: 424, duration: 0.6, ease: 'none' }, 5.45)
    .to(T, { y: FLOOR, duration: 0.6, ease: 'bounce.out' }, 5.45)
    .to(S, { s: 1.8, r: -400, o: 0, duration: 0.35, ease: 'power2.in' }, 5.5)
    .to(C, { s: 0.75, duration: 0.7, ease: 'elastic.out(1, 0.45)' }, 5.75)
    .to({}, { duration: 0.2 }, 6.45);
  // 05 — plural now. sorry.
  showLine(tl, 4, 6.7);
  tl.to(B2, { o: 1, s: 1.4, duration: 0.3 }, 6.75)
    .to(B2, { o: 0, duration: 0.3 }, 7.05)
    .to(CH, { dim: 0, duration: 0.3 }, 7.05)
    .to([T, C], { r: 16, duration: 0.25, stagger: 0.08 }, 7.1)
    .to([T, C], { r: 0, duration: 0.35, ease: 'back.out(3)', stagger: 0.08 }, 7.4)
    .to([T, C], { sx: 1.12, sy: 0.9, duration: 0.12, yoyo: true, repeat: 3 }, 7.85)
    .to({}, { duration: 0.4 }, 8.3);
  apply();

  const st = ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => '+=' + Math.round(innerHeight * 4.2),
    pin: section.querySelector('.lore-pin'),
    scrub: 0.7,
    animation: tl,
    anticipatePin: 1,
    invalidateOnRefresh: false,
  });
  return { tl, st };
}
