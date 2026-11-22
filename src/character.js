// The two characters, vectorised 1:1 from the original artwork (potrace of the source PNG).
import data from './chars.json';

export const CHAR_YELLOW = '#EBBA24';
export const CHAR_W = data[0].w;
export const CHAR_H = data[0].h;
export const CHARS = data;
export const NAMES = ['TESTI', 'CLES'];

/**
 * Build an SVG for character idx (0 = left one, 1 = right one).
 * Structure: svg > g.chr-body > path.chr-sil + g.chr-line(ring + eyes)
 */
export function characterSVG(idx, { boil = true, cls = '' } = {}) {
  const c = data[idx];
  const eyes = c.eyes
    .map((e, i) => `<path class="chr-eye chr-eye-${i}" d="${e.d}" />`)
    .join('');
  return `<svg class="chr ${cls}" viewBox="0 0 ${c.w} ${c.h}" overflow="visible" aria-hidden="true">
    <g class="chr-body">
      <path class="chr-sil" d="${c.silhouette}" />
      <g class="chr-line"${boil ? ' filter="url(#boil)"' : ''}>
        <path class="chr-ring" d="${c.ring}" fill-rule="evenodd" />
        <g class="chr-eyes">${eyes}</g>
      </g>
    </g>
  </svg>`;
}

export function mountCharacter(container, idx, opts) {
  container.insertAdjacentHTML('beforeend', characterSVG(idx, opts));
  const svg = container.lastElementChild;
  return {
    svg,
    eyes: svg.querySelector('.chr-eyes'),
    eyeEls: [...svg.querySelectorAll('.chr-eye')],
  };
}

// Path2D versions for canvas rendering (bounce lab)
export function charPaths(idx) {
  const c = data[idx];
  return {
    sil: new Path2D(c.silhouette),
    ring: new Path2D(c.ring),
    eyes: c.eyes.map((e) => ({ p: new Path2D(e.d), cx: e.cx, cy: e.cy })),
    w: c.w,
    h: c.h,
  };
}

// Sample the outer silhouette into points (for physics hulls)
export function silhouettePoints(idx, n = 48) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden';
  const p = document.createElementNS(ns, 'path');
  // first subpath only = outer contour
  const d = data[idx].silhouette;
  const second = d.indexOf('M', 1);
  p.setAttribute('d', second > 0 ? d.slice(0, second) : d);
  svg.appendChild(p);
  document.body.appendChild(svg);
  const len = p.getTotalLength();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const q = p.getPointAtLength((i / n) * len);
    pts.push({ x: q.x, y: q.y });
  }
  svg.remove();
  return pts;
}

// Andrew monotone chain convex hull
export function convexHull(points) {
  const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}
