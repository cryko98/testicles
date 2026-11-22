// KEEP 'EM UP — tap-to-juggle mini-game using the traced characters.
import { charPaths, CHAR_YELLOW } from './character.js';
import { sound } from './sound.js';

const INK = '#181613';
const CREAM = '#fff2d3';
const YELLOW = '#fac332';
const RUST = '#b8452d';
const BEST_KEY = 'testicles-best';

const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function readBest() {
  try { return parseInt(localStorage.getItem(BEST_KEY) || '0', 10) || 0; } catch { return 0; }
}
function writeBest(v) {
  try { localStorage.setItem(BEST_KEY, String(v)); } catch { /* private mode etc. */ }
}

export function initGame(root, { onGameOver, onScore } = {}) {
  const screen = root.querySelector('.arcade-screen');
  const canvas = root.querySelector('.game-canvas');
  const ctx = canvas.getContext('2d');
  const hudScore = root.querySelector('.hud-score');
  const hudBest = root.querySelector('.hud-best b');
  const startEl = root.querySelector('.game-start');
  const overEl = root.querySelector('.game-over');
  const paths = [charPaths(0), charPaths(1)];

  let W = 0, H = 0, dpr = 1;
  let state = 'idle'; // idle | playing | over
  let balls = [];
  let parts = [];   // particles / floating texts
  let bonus = null; // the loose S
  let score = 0, best = readBest(), combo = 0, lastHit = 0;
  let shake = 0, nextBonus = 0, deadBall = null;
  let running = false, raf = 0, last = 0;
  const pointer = { x: -1, y: -1 };

  hudBest.textContent = best;

  function size() {
    const r = screen.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
  }
  const ballW = () => clamp(W * 0.2, 74, 138);
  const gravity = () => (H / 620) * Math.min(2300, 1450 + score * 22);
  const floorY = () => H - 26;

  function makeBall(idx, x, y) {
    const w = ballW();
    return {
      idx, x, y, vx: rand(-60, 60), vy: 0, rot: rand(-0.2, 0.2), vr: 0,
      w, h: (w * paths[idx].h) / paths[idx].w, sq: 0, sqV: 0, blink: 0, hitFlash: 0, trail: [],
    };
  }

  function idleScene() {
    const w = ballW();
    balls = [makeBall(0, W / 2 - w * 0.52, floorY()), makeBall(1, W / 2 + w * 0.52, floorY())];
    balls.forEach((b) => { b.vx = 0; b.rot = 0; b.idle = true; });
  }

  function start() {
    state = 'playing';
    score = 0; combo = 0; parts = []; bonus = null; deadBall = null;
    nextBonus = performance.now() + rand(7000, 11000);
    balls = [makeBall(0, W / 2, H * 0.25)];
    balls[0].vy = -200;
    hudScore.textContent = '0';
    startEl.hidden = true; overEl.hidden = true;
    screen.classList.add('playing');
    sound.boing(1);
    float('GO!', W / 2, H * 0.45, 46, YELLOW);
  }

  function gameOver(b) {
    state = 'over';
    deadBall = b;
    shake = 18;
    sound.pop(0.4); sound.boing(0.45, 0.8);
    const isBest = score > best;
    if (isBest) { best = score; writeBest(best); hudBest.textContent = best; }
    screen.classList.remove('playing');
    setTimeout(() => {
      overEl.querySelector('.go-score').textContent = score;
      overEl.querySelector('.go-best').textContent = isBest && score > 0 ? '★ new best ★' : `best: ${best}`;
      const text = `I kept TESTICLES up for ${score} bounce${score === 1 ? '' : 's'}. they always bounce.`;
      overEl.querySelector('.go-share').href = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent('https://www.testiclesalwaysbounce.fun/')}`;
      overEl.hidden = false;
      onGameOver?.(score, isBest, best);
    }, 650);
  }

  function float(text, x, y, size = 28, color = CREAM) {
    parts.push({ type: 'text', text, x, y, vy: -60, life: 1, size, color, rot: rand(-0.2, 0.2) });
  }
  function burst(x, y, n = 8, color = YELLOW) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const sp = rand(160, 320);
      parts.push({ type: 'line', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 1, color });
    }
  }

  function hit(px, py) {
    if (state === 'idle' || state === 'over') return false;
    // the loose S first
    if (bonus && Math.hypot(px - bonus.x, py - bonus.y) < bonus.r * 1.5) {
      score += 5;
      hudScore.textContent = score;
      burst(bonus.x, bonus.y, 12, RUST);
      float('+5 S!', bonus.x, bonus.y - 20, 34, YELLOW);
      sound.chime();
      bonus = null;
      nextBonus = performance.now() + rand(8000, 13000);
      return true;
    }
    let target = null, bd = Infinity;
    for (const b of balls) {
      const d = Math.hypot(px - b.x, py - (b.y - b.h * 0.5));
      if (d < b.w * 0.78 && d < bd) { bd = d; target = b; }
    }
    if (!target) return false;
    const b = target;
    const g = gravity();
    const now = performance.now();
    combo = now - lastHit < 900 ? combo + 1 : 1;
    lastHit = now;
    // apex roughly 55-70% up the screen, whatever the gravity
    b.vy = -Math.sqrt(2 * g * H * rand(0.5, 0.62));
    const off = (b.x - px) / (b.w * 0.5); // hit side -> sideways kick
    b.vx = clamp(b.vx * 0.3 + off * 260 + rand(-50, 50), -520, 520);
    b.vr = off * 5 + rand(-1, 1);
    b.sqV -= 8;
    b.blink = 0.18;
    b.hitFlash = 1;
    score += 1;
    hudScore.textContent = score;
    hudScore.classList.remove('pop'); void hudScore.offsetWidth; hudScore.classList.add('pop');
    burst(px, py, 7);
    float(combo >= 3 ? `+1 ×${combo}` : '+1', px, py - 30, combo >= 3 ? 30 : 24, combo >= 3 ? YELLOW : CREAM);
    sound.boing(0.9 + Math.min(0.8, score * 0.02) + (b.idx ? 0.15 : 0), 0.7);
    if (score === 5 && balls.length === 1) {
      const nb = makeBall(1 - b.idx, b.x < W / 2 ? W * 0.75 : W * 0.25, -40);
      nb.vy = 120;
      balls.push(nb);
      float('PLURAL MODE', W / 2, H * 0.35, 40, YELLOW);
      sound.chime();
    }
    if (score > 0 && score % 25 === 0) float(['unreal.', 'still bouncing', 'certified bouncer', 'testicles 4ever'][(score / 25 - 1) % 4], W / 2, H * 0.3, 34, YELLOW);
    onScore?.(score);
    return true;
  }

  canvas.addEventListener('pointerdown', (e) => {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (state === 'playing') { if (hit(x, y)) e.preventDefault(); }
  });
  canvas.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.x = e.clientX - r.left; pointer.y = e.clientY - r.top;
  });
  canvas.addEventListener('pointerleave', () => { pointer.x = -1; });
  startEl.addEventListener('click', start);
  overEl.querySelector('.go-again').addEventListener('click', start);

  function step(dt, now) {
    const g = gravity();
    const fy = floorY();
    for (const b of balls) {
      b.sqV += (-420 * b.sq - 14 * b.sqV) * dt;
      b.sq = clamp(b.sq + b.sqV * dt, -0.3, 0.4);
      b.blink = Math.max(0, b.blink - dt);
      b.hitFlash = Math.max(0, b.hitFlash - dt * 3);
      if (b.idle) {
        b.y = fy; b.sq = Math.sin(now / 260 + b.idx * 1.7) * 0.05;
        if (Math.random() < 0.004) b.blink = 0.14;
        continue;
      }
      if (b === deadBall) continue;
      b.vy += g * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.rot += b.vr * dt; b.vr *= 0.99;
      b.rot *= 0.995;
      const half = b.w * 0.45;
      if (b.x < half) { b.x = half; b.vx = Math.abs(b.vx) * 0.8; b.sqV += 3; sound.pop(0.9, 0.3); }
      if (b.x > W - half) { b.x = W - half; b.vx = -Math.abs(b.vx) * 0.8; b.sqV += 3; sound.pop(0.9, 0.3); }
      if (b.y - b.h < 0 && b.vy < 0) { b.y = b.h; b.vy = -b.vy * 0.4; }
      b.trail.push({ x: b.x, y: b.y - b.h * 0.5 });
      if (b.trail.length > 7) b.trail.shift();
      if (state === 'playing' && b.y >= fy) {
        b.y = fy; b.sq = 0.4; b.vx = 0; b.vy = 0; b.vr = 0;
        burst(b.x, fy - 6, 12, RUST);
        float('SPLAT', b.x, fy - b.h - 10, 40, RUST);
        gameOver(b);
      }
      if (state === 'over' && b.y >= fy) { b.y = fy; b.vy = -Math.abs(b.vy) * 0.3; b.vx *= 0.7; }
    }
    // the loose S bonus
    if (state === 'playing' && score >= 3 && !bonus && now > nextBonus) {
      bonus = { x: rand(W * 0.15, W * 0.85), y: H + 30, vy: -rand(90, 130), t: 0, r: clamp(W * 0.05, 22, 34) };
    }
    if (bonus) {
      bonus.t += dt; bonus.y += bonus.vy * dt; bonus.x += Math.sin(bonus.t * 2.4) * 40 * dt;
      if (bonus.y < -40 || state !== 'playing') { bonus = null; nextBonus = now + rand(8000, 13000); }
    }
    // particles
    for (const p of parts) {
      p.life -= dt * (p.type === 'text' ? 0.9 : 2.4);
      if (p.type === 'line') { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.9; p.vy *= 0.9; }
      else p.y += p.vy * dt;
    }
    parts = parts.filter((p) => p.life > 0);
    shake *= 0.86;
  }

  function drawBall(b, now) {
    const p = paths[b.idx];
    const s = b.w / p.w;
    const sx = 1 + b.sq * 0.7, sy = 1 - b.sq;
    // shadow on the floor
    const fy = floorY();
    const hgt = clamp((fy - b.y) / H, 0, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.ellipse(b.x, fy + 4, b.w * 0.42 * (1 - hgt * 0.6), 6 * (1 - hgt * 0.6), 0, 0, Math.PI * 2);
    ctx.fill();
    // speed trail
    if (b.trail.length > 2 && Math.abs(b.vy) > 700) {
      ctx.strokeStyle = 'rgba(250,195,50,0.25)';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      b.trail.forEach((t, i) => (i ? ctx.lineTo(t.x, t.y) : ctx.moveTo(t.x, t.y)));
      ctx.stroke();
    }
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.rot);
    ctx.scale(s * sx, s * sy);
    ctx.translate(-p.w / 2, -p.h);
    ctx.fillStyle = INK;
    ctx.fill(p.sil);
    ctx.fillStyle = b.hitFlash > 0 ? '#fff6c8' : CHAR_YELLOW;
    ctx.fill(p.ring, 'evenodd');
    // eyes: look at the pointer (or up while flying)
    let lx = 0, ly = -4;
    if (pointer.x >= 0) {
      const dx = pointer.x - b.x, dy = pointer.y - (b.y - b.h * 0.5);
      const d = Math.hypot(dx, dy) || 1;
      lx = (dx / d) * 12; ly = (dy / d) * 9;
    } else if (!b.idle) { lx = clamp(b.vx / 40, -12, 12); ly = clamp(b.vy / 120, -9, 9); }
    const dead = b === deadBall;
    const open = dead ? 0.15 : b.blink > 0 ? 0.12 : 1;
    ctx.fillStyle = CHAR_YELLOW;
    for (const e of p.eyes) {
      ctx.save();
      ctx.translate(e.cx + lx, e.cy + ly);
      if (dead) ctx.rotate(now / 120);
      ctx.scale(1, open);
      ctx.translate(-e.cx, -e.cy);
      ctx.fill(e.p);
      ctx.restore();
    }
    ctx.restore();
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (shake > 0.5) ctx.translate(rand(-shake, shake), rand(-shake, shake));

    // background score
    if (state !== 'idle') {
      ctx.save();
      ctx.font = `${Math.round(H * 0.42)}px "Permanent Marker", cursive`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,242,211,0.05)';
      ctx.fillText(String(score), W / 2, H * 0.48);
      ctx.restore();
    }

    // danger floor
    const fy = floorY();
    ctx.save();
    ctx.strokeStyle = 'rgba(184,69,45,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) ctx.lineTo(x, fy + 2 + Math.sin(x * 0.08 + now / 400) * 1.5);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(184,69,45,0.25)';
    for (let x = -20; x < W; x += 18) { ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 18, fy + 6); ctx.stroke(); }
    ctx.restore();

    for (const b of balls) drawBall(b, now);

    if (bonus) {
      ctx.save();
      ctx.translate(bonus.x, bonus.y);
      ctx.rotate(Math.sin(bonus.t * 3) * 0.3);
      const pulse = 1 + Math.sin(bonus.t * 8) * 0.06;
      ctx.scale(pulse, pulse);
      ctx.fillStyle = INK; ctx.strokeStyle = YELLOW; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, bonus.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = `${Math.round(bonus.r * 1.5)}px "Permanent Marker", cursive`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = YELLOW;
      ctx.fillText('S', 0, 2);
      ctx.restore();
    }

    for (const p of parts) {
      ctx.save();
      ctx.globalAlpha = clamp(p.life, 0, 1);
      if (p.type === 'text') {
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.font = `${p.size}px "Permanent Marker", cursive`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.strokeText(p.text, 0, 0);
        ctx.fillStyle = p.color; ctx.fillText(p.text, 0, 0);
      } else {
        ctx.strokeStyle = p.color; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.05, p.y - p.vy * 0.05); ctx.stroke();
      }
      ctx.restore();
    }
  }

  function loop(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    step(dt, now);
    draw(now);
    raf = requestAnimationFrame(loop);
  }

  size();
  idleScene();
  window.addEventListener('resize', () => {
    size();
    if (state === 'idle') idleScene();
    balls.forEach((b) => { b.w = ballW(); b.h = (b.w * paths[b.idx].h) / paths[b.idx].w; b.x = clamp(b.x, b.w / 2, W - b.w / 2); });
  });

  return {
    play() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
    get state() { return state; },
    get best() { return best; },
    get _debug() { return { balls, score, W, H }; },
  };
}
