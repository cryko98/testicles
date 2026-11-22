// PFP maker: dress up the characters and download a 1000x1000 PNG.
// All accessories are drawn by hand on canvas, in the character's own coordinate space
// (254 x 217, eyes at ~(88,111) and ~(169,94), face tilted ~-12deg).
import { charPaths, CHAR_YELLOW } from './character.js';
import { sound } from './sound.js';

const INK = '#181613';
const CREAM = '#fff2d3';
const YELLOW = '#fac332';
const RUST = '#b8452d';
const TILT = -0.21; // face tilt in radians
const EYE_L = { x: 88.5, y: 111.5 };
const EYE_R = { x: 169.4, y: 94.4 };

export const BACKGROUNDS = {
  ink: { fill: '#181613', star: 'rgba(250,195,50,0.5)' },
  yellow: { fill: '#fac332', star: 'rgba(24,22,19,0.35)' },
  cream: { fill: '#f7ecd0', star: 'rgba(184,69,45,0.45)' },
  rust: { fill: '#b8452d', star: 'rgba(255,242,211,0.5)' },
  sky: { fill: '#7fc8f8', star: 'rgba(255,255,255,0.7)' },
  lime: { fill: '#b8e05a', star: 'rgba(24,22,19,0.3)' },
  pink: { fill: '#f5a3c7', star: 'rgba(255,255,255,0.75)' },
};

function line(ctx, w = 7, color = INK) {
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}
function headFrame(ctx, fn) {
  ctx.save(); ctx.translate(150, 8); ctx.rotate(TILT); fn(); ctx.restore();
}
function faceFrame(ctx, fn) {
  const mx = (EYE_L.x + EYE_R.x) / 2, my = (EYE_L.y + EYE_R.y) / 2;
  ctx.save(); ctx.translate(mx, my); ctx.rotate(TILT); fn(); ctx.restore();
}

export const ACCESSORIES = {
  head: {
    none: null,
    crown(ctx) {
      headFrame(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-56, 4); ctx.lineTo(-62, -58); ctx.lineTo(-30, -24); ctx.lineTo(0, -70);
        ctx.lineTo(30, -24); ctx.lineTo(62, -58); ctx.lineTo(56, 4); ctx.closePath();
        ctx.fillStyle = YELLOW; ctx.fill(); line(ctx, 7); ctx.stroke();
        line(ctx, 4); ctx.beginPath(); ctx.moveTo(-52, -10); ctx.quadraticCurveTo(0, -16, 52, -10); ctx.stroke();
        [[-62, -58], [0, -70], [62, -58]].forEach(([x, y]) => { ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fillStyle = RUST; ctx.fill(); line(ctx, 4); ctx.stroke(); });
        ctx.beginPath(); ctx.arc(0, -36, 8, 0, 7); ctx.fillStyle = '#7fc8f8'; ctx.fill(); line(ctx, 4); ctx.stroke();
      });
    },
    party(ctx) {
      headFrame(ctx, () => {
        ctx.save();
        ctx.beginPath(); ctx.moveTo(-40, 6); ctx.lineTo(8, -112); ctx.lineTo(44, 2); ctx.closePath();
        ctx.fillStyle = RUST; ctx.fill();
        ctx.clip();
        line(ctx, 10, CREAM);
        for (let i = -3; i < 5; i++) { ctx.beginPath(); ctx.moveTo(-60, i * 26 - 10); ctx.lineTo(60, i * 26 - 40); ctx.stroke(); }
        ctx.restore();
        ctx.beginPath(); ctx.moveTo(-40, 6); ctx.lineTo(8, -112); ctx.lineTo(44, 2); ctx.closePath();
        line(ctx, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(8, -118, 15, 0, 7); ctx.fillStyle = YELLOW; ctx.fill(); line(ctx, 5); ctx.stroke();
        line(ctx, 3); ctx.beginPath(); ctx.moveTo(-58, 0); ctx.quadraticCurveTo(-30, -6, 0, 6); ctx.quadraticCurveTo(40, 14, 70, -4); ctx.stroke();
      });
    },
    cap(ctx) {
      headFrame(ctx, () => {
        ctx.beginPath(); ctx.moveTo(-66, 10); ctx.bezierCurveTo(-64, -60, 64, -60, 66, 10); ctx.closePath();
        ctx.fillStyle = RUST; ctx.fill(); line(ctx, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(40, 8); ctx.bezierCurveTo(80, -2, 120, 4, 134, 18); ctx.bezierCurveTo(110, 26, 70, 24, 40, 16); ctx.closePath();
        ctx.fillStyle = INK; ctx.fill(); line(ctx, 6); ctx.stroke();
        ctx.font = '40px "Permanent Marker"'; ctx.textAlign = 'center'; ctx.fillStyle = YELLOW; ctx.fillText('S', -4, -6);
        ctx.beginPath(); ctx.arc(0, -44, 7, 0, 7); ctx.fillStyle = INK; ctx.fill();
      });
    },
    tophat(ctx) {
      headFrame(ctx, () => {
        ctx.beginPath(); ctx.moveTo(-40, -4); ctx.lineTo(-44, -112); ctx.quadraticCurveTo(0, -122, 44, -112); ctx.lineTo(40, -4); ctx.closePath();
        ctx.fillStyle = INK; ctx.fill(); line(ctx, 6, CREAM); ctx.stroke();
        ctx.fillStyle = RUST; ctx.fillRect(-41, -34, 82, 18);
        ctx.beginPath(); ctx.ellipse(0, 0, 78, 13, 0, 0, 7); ctx.fillStyle = INK; ctx.fill(); line(ctx, 6, CREAM); ctx.stroke();
      });
    },
    halo(ctx) {
      headFrame(ctx, () => {
        ctx.save();
        ctx.shadowColor = YELLOW; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.ellipse(0, -46, 64, 16, 0, 0, 7); line(ctx, 10, YELLOW); ctx.stroke();
        ctx.restore();
        ctx.beginPath(); ctx.ellipse(0, -46, 64, 16, 0, 0, 7); line(ctx, 3, '#fff6c8'); ctx.stroke();
      });
    },
  },
  face: {
    none: null,
    shades(ctx) {
      faceFrame(ctx, () => {
        const lens = (x) => {
          ctx.beginPath(); ctx.moveTo(x - 32, -16); ctx.lineTo(x + 32, -16); ctx.lineTo(x + 28, 12); ctx.quadraticCurveTo(x, 24, x - 28, 12); ctx.closePath();
          ctx.fillStyle = INK; ctx.fill(); line(ctx, 5, CREAM); ctx.stroke();
          ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(x - 20, -10, 10, 6); ctx.fillRect(x - 6, -10, 6, 6);
        };
        line(ctx, 7, INK); ctx.beginPath(); ctx.moveTo(-82, -14); ctx.lineTo(82, -14); ctx.stroke();
        lens(-41); lens(41);
      });
    },
    laser(ctx, w) {
      const beam = (e) => {
        ctx.save();
        ctx.translate(e.x, e.y); ctx.rotate(TILT + 0.18);
        const len = 900;
        const g = ctx.createLinearGradient(0, 0, len, 0);
        g.addColorStop(0, 'rgba(255,60,40,1)'); g.addColorStop(1, 'rgba(255,60,40,0)');
        ctx.shadowColor = '#ff3b2f'; ctx.shadowBlur = 40;
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(len, -46); ctx.lineTo(len, 46); ctx.lineTo(0, 12); ctx.closePath(); ctx.fill();
        ctx.shadowBlur = 0;
        const g2 = ctx.createLinearGradient(0, 0, len * 0.8, 0);
        g2.addColorStop(0, '#fff'); g2.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g2;
        ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(len * 0.8, -12); ctx.lineTo(len * 0.8, 12); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ctx.fillStyle = '#fff'; ctx.shadowColor = '#ff3b2f'; ctx.shadowBlur = 30; ctx.fill();
        ctx.restore();
      };
      beam(EYE_L); beam(EYE_R);
    },
    mustache(ctx) {
      faceFrame(ctx, () => {
        ctx.translate(4, 36);
        ctx.beginPath();
        ctx.moveTo(0, -6);
        ctx.bezierCurveTo(-18, -20, -44, -10, -56, 4); ctx.bezierCurveTo(-64, 12, -76, 4, -70, -6);
        ctx.bezierCurveTo(-72, 16, -46, 22, -24, 10); ctx.bezierCurveTo(-12, 4, -4, 6, 0, 8);
        ctx.bezierCurveTo(4, 6, 12, 4, 24, 10); ctx.bezierCurveTo(46, 22, 72, 16, 70, -6);
        ctx.bezierCurveTo(76, 4, 64, 12, 56, 4); ctx.bezierCurveTo(44, -10, 18, -20, 0, -6);
        ctx.fillStyle = INK; ctx.fill(); line(ctx, 4, CHAR_YELLOW); ctx.stroke();
      });
    },
    blush(ctx) {
      faceFrame(ctx, () => {
        ctx.fillStyle = 'rgba(245,110,140,0.75)';
        ctx.beginPath(); ctx.ellipse(-58, 30, 20, 10, 0, 0, 7); ctx.fill();
        ctx.beginPath(); ctx.ellipse(52, 26, 20, 10, 0, 0, 7); ctx.fill();
        line(ctx, 3, 'rgba(255,255,255,0.7)');
        [[-64, 26], [-56, 26], [46, 22], [54, 22]].forEach(([x, y]) => { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 4, y + 8); ctx.stroke(); });
      });
    },
  },
  neck: {
    none: null,
    chain(ctx) {
      ctx.save();
      line(ctx, 6, '#e8b923');
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 6;
      for (let i = 0; i <= 13; i++) {
        const t = i / 13;
        const x = 52 + t * 160;
        const y = 168 + Math.sin(t * Math.PI) * 34 - t * 18;
        ctx.beginPath(); ctx.ellipse(x, y, 9, 6, t * 2, 0, 7); ctx.stroke();
      }
      ctx.restore();
      // medallion
      ctx.beginPath(); ctx.arc(130, 214, 26, 0, 7); ctx.fillStyle = YELLOW; ctx.fill(); line(ctx, 5); ctx.stroke();
      ctx.font = '34px "Permanent Marker"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = INK; ctx.fillText('S', 130, 217);
    },
    bowtie(ctx) {
      ctx.save(); ctx.translate(128, 196); ctx.rotate(TILT * 0.6);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-44, -24); ctx.quadraticCurveTo(-52, 0, -44, 24); ctx.closePath();
      ctx.moveTo(0, 0); ctx.lineTo(44, -24); ctx.quadraticCurveTo(52, 0, 44, 24); ctx.closePath();
      ctx.fillStyle = RUST; ctx.fill(); line(ctx, 6); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(0, 0, 11, 14, 0, 0, 7); ctx.fillStyle = RUST; ctx.fill(); ctx.stroke();
      ctx.restore();
    },
  },
};

// deterministic doodle stars for the background
function stars(ctx, color, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  ctx.save();
  ctx.fillStyle = color; ctx.strokeStyle = color; ctx.lineCap = 'round';
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 1000, y = rnd() * 1000, r = 6 + rnd() * 16, k = rnd();
    ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * 3);
    if (k < 0.5) {
      ctx.beginPath();
      for (let j = 0; j < 4; j++) {
        ctx.quadraticCurveTo(0, 0, Math.cos(j * Math.PI / 2) * r, Math.sin(j * Math.PI / 2) * r);
      }
      ctx.lineWidth = 3; ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    } else if (k < 0.8) {
      ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, 7); ctx.fill();
    } else {
      ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r / 2, -r / 2, 0, 0); ctx.quadraticCurveTo(r / 2, r / 2, r, 0); ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

export function initPfp(root) {
  const canvas = root.querySelector('.pfp-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 1000; canvas.height = 1000;
  const paths = [charPaths(0), charPaths(1)];
  const state = { who: 'both', bg: 'ink', head: 'crown', face: 'shades', neck: 'chain', stars: true, tag: true, seed: 7 };

  function drawChar(idx, x, bottom, width) {
    const p = paths[idx];
    const s = width / p.w;
    ctx.save();
    ctx.translate(x - width / 2, bottom - p.h * s);
    ctx.scale(s, s);
    // drop shadow
    ctx.save(); ctx.translate(8, 10); ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fill(p.sil); ctx.restore();
    // ink outline so the yellow ring reads on every background
    ctx.lineWidth = 9; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
    ctx.stroke(p.sil);
    ctx.fillStyle = INK; ctx.fill(p.sil);
    ctx.fillStyle = CHAR_YELLOW; ctx.fill(p.ring, 'evenodd');
    p.eyes.forEach((e) => ctx.fill(e.p));
    ACCESSORIES.face[state.face]?.(ctx);
    ACCESSORIES.neck[state.neck]?.(ctx);
    ACCESSORIES.head[state.head]?.(ctx);
    ctx.restore();
  }

  function render() {
    const bg = BACKGROUNDS[state.bg];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = bg.fill; ctx.fillRect(0, 0, 1000, 1000);
    // vignette
    const v = ctx.createRadialGradient(500, 480, 200, 500, 500, 760);
    v.addColorStop(0, 'rgba(255,255,255,0.08)'); v.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, 1000, 1000);
    if (state.stars) stars(ctx, bg.star, state.seed);
    // ground scribble
    ctx.save(); line(ctx, 8, bg.star); ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(120, 842); ctx.bezierCurveTo(350, 826, 650, 852, 880, 834); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(220, 872); ctx.bezierCurveTo(420, 864, 640, 878, 790, 866); ctx.stroke();
    ctx.restore();
    if (state.who === 'both') { drawChar(0, 300, 830, 400); drawChar(1, 700, 830, 400); }
    else drawChar(state.who === 'testi' ? 0 : 1, 500, 840, 620);
    if (state.tag) {
      ctx.save();
      ctx.translate(500, 950); ctx.rotate(-0.03);
      ctx.font = '62px "Permanent Marker"'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 14; ctx.strokeStyle = state.bg === 'ink' ? '#000' : INK; ctx.lineJoin = 'round';
      ctx.strokeText('$TESTICLES', 0, 0);
      ctx.fillStyle = state.bg === 'yellow' ? CREAM : YELLOW; ctx.fillText('$TESTICLES', 0, 0);
      ctx.restore();
    }
  }

  function syncUI() {
    root.querySelectorAll('[data-opt]').forEach((b) => {
      const [k, v] = b.dataset.opt.split(':');
      const on = String(state[k]) === v;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on);
    });
  }

  function bump() {
    canvas.animate(
      [{ transform: 'scale(0.94) rotate(-1.5deg)' }, { transform: 'scale(1.03) rotate(0.8deg)' }, { transform: 'scale(1) rotate(0)' }],
      { duration: 420, easing: 'cubic-bezier(.3,1.6,.5,1)' }
    );
  }

  root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => {
    const [k, v] = b.dataset.opt.split(':');
    state[k] = v === 'true' ? true : v === 'false' ? false : v;
    render(); syncUI(); bump();
    sound.pop(1 + Math.random() * 0.4, 0.5);
  }));

  const pickKey = (o) => { const ks = Object.keys(o); return ks[Math.floor(Math.random() * ks.length)]; };
  root.querySelector('.pfp-random').addEventListener('click', () => {
    state.who = ['testi', 'cles', 'both'][Math.floor(Math.random() * 3)];
    state.bg = pickKey(BACKGROUNDS);
    state.head = pickKey(ACCESSORIES.head);
    state.face = pickKey(ACCESSORIES.face);
    state.neck = pickKey(ACCESSORIES.neck);
    state.seed = Math.floor(Math.random() * 9999);
    render(); syncUI(); bump();
    sound.boing(1.2);
  });

  root.querySelector('.pfp-download').addEventListener('click', () => {
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `testicles-pfp-${state.who}-${state.head}-${state.face}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      sound.chime();
    }, 'image/png');
  });

  // fonts are needed for the S on the cap/medallion and the tag
  (document.fonts?.ready || Promise.resolve()).then(render);
  render(); syncUI();
  return { render, state };
}
