// "They live here now": two autonomous characters roaming the whole page.
// Each pet has simple 2D physics (gravity, walls, perches on DOM elements), a jelly
// squash-and-stretch spring, eye tracking, a small behaviour brain, drag & throw,
// and the World director makes them meet every now and then.
import gsap from 'gsap';
import { mountCharacter, CHAR_W, CHAR_H, NAMES, CHARS } from './character.js';
import { sound } from './sound.js';

const G = 2600;
const RENDER_W = 340; // svg is rendered big and scaled DOWN (stays crisp)
const RENDER_H = (RENDER_W * CHAR_H) / CHAR_W;
const NAV_H = 72;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const CANCEL = Symbol('cancel');

const LINES = {
  poke: ['boing.', 'hey!', 'that tickles', 'plural!', 'S stands for sorry', 'again?', 'rude.', 'i bounce, therefore i am', 'careful. fragile.', 'do it again', 'hi :)', 'boop received'],
  drag: ['wheee', 'put me down', 'too high!!', 'i can see my house', 'this is fine', 'WHERE ARE WE GOING'],
  thrown: ['ow.', '10/10 landing', 'again!', 'my spine (i have no spine)', 'nailed it'],
  think: [
    ['i was here first.', '$25.9M. as a test.', 'who put an S on me?', 'thinking about bouncing', 'is it launch yet?', 'left one. obviously.', 'hmm.'],
    ["i'm the S.", 'sequel > original', 'right one. the RIGHT one.', 'that freezer looks cold', '100 years? brrr', "i'm new here", 'hmm.'],
  ],
  stage: ['welcome.', "we're the plural.", 'grab us. we dare you.', 'scroll. there is lore.', 'make it bounce →', 'hi.'],
  wake: ['!!', 'i was NOT sleeping', 'huh?', '5 more minutes'],
  dizzy: ['@_@', 'the room is spinning', 'who threw that', 'blrbl'],
  angry: ['ok STOP', 'enough.', 'i am leaving'],
  shy: ['...', 'hehe', ':)'],
  freeze: ['BRRRR', 'c-c-cold', 'thawed. barely.'],
};

const DIALOGS = [
  ["we're plural now.", 'sorry.'],
  ['did you see the chart?', 'i AM the chart.'],
  ['$25.9M was a test.', 'test passed.'],
  ["who's the left one?", 'depends where you stand.'],
  ['100 years in the freezer?', 'brr. worth it.'],
  ['bounce?', 'always.'],
  ["where's the S?", "it's us. we're the S."],
  ['is the CA out?', 'at launch. be patient.'],
];

class Token {
  constructor() { this.cancelled = false; this.cbs = []; }
  cancel() {
    if (this.cancelled) return;
    this.cancelled = true;
    this.cbs.splice(0).forEach((f) => f());
  }
  onCancel(fn) { if (this.cancelled) fn(); else this.cbs.push(fn); }
  check() { if (this.cancelled) throw CANCEL; }
}

function wait(ms, t) {
  return new Promise((res, rej) => {
    if (t?.cancelled) return rej(CANCEL);
    const id = setTimeout(res, ms);
    t?.onCancel(() => { clearTimeout(id); rej(CANCEL); });
  });
}

function playTL(tl, t) {
  return new Promise((res, rej) => {
    tl.eventCallback('onComplete', res);
    t?.onCancel(() => { tl.kill(); rej(CANCEL); });
  });
}

class Pet {
  constructor(world, idx) {
    this.world = world;
    this.idx = idx;
    this.name = NAMES[idx];
    this.el = document.createElement('div');
    this.el.className = `pet pet-${idx}`;
    this.el.style.width = RENDER_W + 'px';
    this.el.style.height = RENDER_H + 'px';
    world.layer.appendChild(this.el);
    this.chr = mountCharacter(this.el, idx);
    this.eyeData = CHARS[idx].eyes;

    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble';
    world.layer.appendChild(this.bubble);
    gsap.set(this.bubble, { xPercent: -50, yPercent: -100, transformOrigin: '50% 100%', scale: 0 });

    this.ice = null;

    // physics / pose state
    this.x = innerWidth / 2; this.y = -300;
    this.vx = 0; this.vy = 0;
    this.prevY = this.y;
    this.grounded = false;
    this.perch = null;
    this.localX = 0;
    this.size = world.normalSize();
    this.sizeTarget = this.size;
    this.facing = 1; this.faceVis = 1;
    this.rot = 0; this.lean = 0; this.spin = 0;
    this.ox = 0; this.oy = 0;
    this.sq = 0; this.sqV = 0;
    this.look = { x: 0, y: 0 };
    this.lookOverride = null;
    this.eyeOpen = 1; this.eyeScale = 1; this.eyeRot = 0;
    this.token = null;
    this.busy = null; // 'meet' | 'freeze' | 'script'
    this.dragging = false;
    this.sleeping = false;
    this.dizzyUntil = 0;
    this.nextThink = performance.now() + 2500 + idx * 900;
    this.leftHomeAt = 0;
    this.lastSleep = performance.now();
    this.pokes = [];
    this._eyeStr = ['', ''];

    this.blinkLoop();
    this.bindPointer();
  }

  get h() { return (this.size * CHAR_H) / CHAR_W; }
  get partner() { return this.world.pets[1 - this.idx]; }
  get onStage() { return this.perch === this.world.stage; }
  get free() { return !this.dragging && !this.busy && !this.frozen; }

  // ---------- action plumbing ----------
  cancel() {
    if (this.token) { const t = this.token; this.token = null; t.cancel(); }
    this.busy = null;
    gsap.killTweensOf(this, 'ox,oy,lean,spin,localX');
    this.ox = 0; this.oy = 0;
    gsap.to(this, { lean: 0, spin: 0, duration: 0.3 });
  }

  act(fn, busy = null) {
    this.cancel();
    const t = new Token();
    this.token = t;
    this.busy = busy;
    const p = fn(t);
    p.catch((e) => { if (e !== CANCEL) console.error(e); })
      .finally(() => {
        if (this.token === t) { this.token = null; this.busy = null; }
        this.nextThink = performance.now() + rand(500, 2200);
      });
    return p;
  }

  untilGrounded(t, timeout = 5000) {
    return new Promise((res, rej) => {
      const start = performance.now();
      const tick = () => {
        if (t?.cancelled) { gsap.ticker.remove(tick); rej(CANCEL); return; }
        if (this.grounded || performance.now() - start > timeout) { gsap.ticker.remove(tick); res(); }
      };
      gsap.ticker.add(tick);
    });
  }

  // ---------- movement primitives ----------
  face(dir) { if (dir) this.facing = dir > 0 ? 1 : -1; }

  squash(a) { this.sqV += a * 18; }

  launch(vx, vy) {
    if (this.grounded && this.perch) this.lastPerch = this.perch;
    this.grounded = false;
    this.perch = null;
    this.vx = vx; this.vy = vy;
    this.prevY = this.y;
  }

  async hop(t, dir, dist, power = 480) {
    if (!this.grounded) await this.untilGrounded(t);
    this.face(dir);
    this.sqV += 5; // anticipation
    await wait(80, t);
    const T = (2 * power) / G;
    this.squash(-0.1);
    this.launch((dir * dist) / T, -power);
    if (Math.random() < 0.35) sound.boing(1.6 + Math.random() * 0.4, 0.25);
    await this.untilGrounded(t);
  }

  surfaceBounds() {
    const pad = this.size * 0.42;
    if (this.perch) {
      const r = this.world.rectOf(this.perch);
      if (r) return [r.left + pad * 0.6, r.right - pad * 0.6];
    }
    return [pad, innerWidth - pad];
  }

  async walkTo(t, tx) {
    let guard = 0;
    const startPerch = this.perch;
    while (guard++ < 40) {
      const [a, b] = this.surfaceBounds();
      const target = clamp(tx, a, b);
      const dx = target - this.x;
      if (Math.abs(dx) < 10) break;
      const step = Math.min(Math.abs(dx), rand(36, 70) * (this.size / 100));
      await this.hop(t, Math.sign(dx), step, rand(340, 470));
      if (this.perch !== startPerch) break; // fell off / landed somewhere else
      await wait(rand(20, 160), t);
    }
  }

  async jumpTo(t, tx, ty, sizeTarget = this.world.normalSize()) {
    if (!this.grounded) await this.untilGrounded(t);
    const apexY = Math.min(ty, this.y) - rand(110, 180) * (this.world.normalSize() / 90);
    const vy0 = -Math.sqrt(2 * G * Math.max(40, this.y - apexY));
    const t1 = -vy0 / G;
    const t2 = Math.sqrt((2 * Math.max(1, ty - apexY)) / G);
    const vx = (tx - this.x) / (t1 + t2);
    this.face(Math.sign(tx - this.x));
    this.sqV += 7;
    await wait(130, t);
    this.squash(-0.16);
    this.launch(vx, vy0);
    this.sizeTarget = sizeTarget;
    sound.whoosh();
    await this.untilGrounded(t, 6000);
  }

  async jumpToPerch(t, el, frac = rand(0.25, 0.75)) {
    const r = this.world.rectOf(el);
    if (!r) return;
    this.landOnly = el;
    const size = el === this.world.stage ? this.world.heroSize() : this.world.normalSize();
    await this.jumpTo(t, r.left + r.width * frac, r.top, size);
  }

  async jumpToFloor(t, x = rand(innerWidth * 0.1, innerWidth * 0.9)) {
    this.landOnly = 'floor';
    await this.jumpTo(t, x, this.world.floorY, this.world.normalSize());
  }

  say(text, ms = 2200) {
    const b = this.bubble;
    b.textContent = text;
    b.classList.add('show');
    gsap.killTweensOf(b);
    gsap.fromTo(b, { scale: 0.2, rotate: rand(-12, 12) }, { scale: 1, rotate: rand(-4, 4), duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    sound.blab(this.idx ? 1.25 : 0.95, Math.min(6, Math.ceil(text.length / 4)));
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => {
      gsap.to(b, { scale: 0, duration: 0.2, ease: 'back.in(2)', onComplete: () => b.classList.remove('show') });
    }, ms);
  }

  lookAtPoint(x, y, ms = 1500) {
    this.lookOverride = { x, y, until: performance.now() + ms };
  }

  blinkLoop() {
    const next = () => {
      this._blinkT = setTimeout(() => {
        if (!this.sleeping && this.eyeOpen > 0.9) {
          const double = Math.random() < 0.2;
          gsap.to(this, { eyeOpen: 0.08, duration: 0.06, yoyo: true, repeat: double ? 3 : 1, ease: 'power2.in' });
        }
        next();
      }, rand(1800, 5200));
    };
    next();
  }

  // ---------- reactions ----------
  poke() {
    const now = performance.now();
    this.pokes = this.pokes.filter((p) => now - p < 2500);
    this.pokes.push(now);
    this.world.onPoke?.(this);
    if (this.sleeping) { this.wake(true); return; }
    if (this.frozen) { this.squash(0.1); sound.pop(2); return; }
    if (this.busy === 'meet') {
      this.squash(0.3); sound.squeak(this.idx ? 1.2 : 1);
      return;
    }
    if (this.pokes.length >= 5) {
      this.pokes = [];
      this.act(async (t) => {
        this.say(pick(LINES.angry), 1600);
        this.world.fx('💢', this.x + this.size * 0.3, this.y - this.h, { color: '#e5533a', size: 28 });
        await wait(300, t);
        const away = this.x < innerWidth / 2 ? innerWidth * 0.85 : innerWidth * 0.15;
        if (this.perch) await this.jumpToFloor(t, away);
        else await this.walkTo(t, away);
      });
      return;
    }
    this.act(async (t) => {
      if (!this.grounded) return;
      this.sqV += 6;
      await wait(60, t);
      const flip = Math.random() < 0.3;
      this.launch(rand(-60, 60), -rand(820, 1050));
      sound.boing(this.idx ? 1.15 : 0.95);
      if (flip) gsap.fromTo(this, { spin: 0 }, { spin: 360 * (Math.random() < 0.5 ? 1 : -1), duration: 0.6, ease: 'power2.out', onComplete: () => (this.spin = 0) });
      this.say(pick(LINES.poke), 1600);
      await this.untilGrounded(t);
    });
  }

  wake(startled) {
    this.sleeping = false;
    clearInterval(this._zzz);
    gsap.to(this, { eyeOpen: 1, eyeScale: startled ? 1.45 : 1, duration: 0.15 });
    gsap.to(this, { eyeScale: 1, delay: 0.9, duration: 0.4 });
    if (startled) {
      this.world.fx('!', this.x + this.size * 0.2, this.y - this.h - 10, { size: 44 });
      this.act(async (t) => {
        this.launch(0, -700);
        sound.squeak();
        this.say(pick(LINES.wake), 1800);
        await this.untilGrounded(t);
      });
    } else this.cancel();
  }

  async sleep(t) {
    this.sleeping = true;
    this.lastSleep = performance.now();
    gsap.to(this, { eyeOpen: 0.1, duration: 0.6 });
    this._zzz = setInterval(() => {
      this.world.fx('z', this.x + this.size * 0.35 * this.facing, this.y - this.h * 0.9, { size: rand(18, 30), drift: 40 * this.facing, dur: 2.4 });
    }, 900);
    try { await wait(rand(6000, 11000), t); }
    finally {
      clearInterval(this._zzz);
      if (this.sleeping) { this.sleeping = false; gsap.to(this, { eyeOpen: 1, duration: 0.3 }); }
    }
  }

  dizzy(ms = 2200) {
    this.dizzyUntil = performance.now() + ms;
    gsap.fromTo(this, { eyeRot: 0 }, { eyeRot: 720, duration: ms / 1000, ease: 'power1.out', onComplete: () => (this.eyeRot = 0) });
    for (let i = 0; i < 3; i++) {
      this.world.orbitStar(this, i, ms);
    }
    setTimeout(() => this.say(pick(LINES.dizzy), 1600), 200);
  }

  async freeze(ms = 3200) {
    if (this.frozen) return;
    this.cancel();
    this.frozen = true;
    this.busy = 'freeze';
    if (this.sleeping) this.wake(false);
    const ice = document.createElement('div');
    ice.className = 'ice';
    ice.innerHTML = '<i></i><i></i><i></i>';
    this.world.layer.appendChild(ice);
    this.ice = ice;
    gsap.fromTo(ice, { scale: 1.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.35, ease: 'back.out(2)' });
    gsap.to(this, { eyeScale: 1.35, duration: 0.2 });
    sound.crack();
    const shiver = gsap.to(this, { ox: 2.5, duration: 0.05, repeat: -1, yoyo: true, ease: 'none' });
    await new Promise((r) => setTimeout(r, ms));
    shiver.kill();
    this.ox = 0;
    sound.crack();
    const r = ice.getBoundingClientRect();
    for (let i = 0; i < 9; i++) {
      this.world.fx('◆', r.left + r.width / 2, r.top + r.height / 2, { color: '#bfe6ff', size: rand(10, 22), vx: rand(-260, 260), vy: rand(-420, -120), gravity: true, dur: 1 });
    }
    ice.remove();
    this.ice = null;
    this.frozen = false;
    this.busy = null;
    gsap.to(this, { eyeScale: 1, duration: 0.4 });
    this.say(pick(LINES.freeze), 1800);
    if (this.grounded) { this.launch(0, -800); sound.boing(1.3); }
  }

  // ---------- brain ----------
  async think(t) {
    const r = Math.random();
    const world = this.world;
    if (this.onStage) {
      if (r < 0.3) { this.lookAtPoint(rand(0, innerWidth), rand(0, innerHeight), 1600); await wait(rand(900, 2200), t); }
      else if (r < 0.45) {
        this.launch(0, -rand(500, 750));
        if (Math.random() < 0.4) gsap.fromTo(this, { spin: 0 }, { spin: 360 * this.facing, duration: 0.55, ease: 'power2.out' });
        sound.boing(1.4, 0.4);
        await this.untilGrounded(t);
      } else if (r < 0.58) { this.say(pick(LINES.stage)); await wait(2200, t); }
      else if (r < 0.7) {
        const [a, b] = this.surfaceBounds();
        const mid = (a + b) / 2;
        const tx = this.idx === 0 ? rand(a, mid - this.size * 0.3) : rand(mid + this.size * 0.3, b);
        await this.walkTo(t, tx);
      } else if (r < 0.76 && window.scrollY < 10 && innerWidth > 700) {
        this.leftHomeAt = performance.now();
        await this.jumpToFloor(t);
      } else await wait(rand(700, 2000), t);
      return;
    }

    if (r < 0.3) {
      const [a, b] = this.surfaceBounds();
      await this.walkTo(t, rand(a, b));
    } else if (r < 0.48) {
      const perches = world.visiblePerches(this.perch);
      if (perches.length) await this.jumpToPerch(t, pick(perches));
      else if (this.perch) await this.jumpToFloor(t);
      else await this.walkTo(t, rand(0, innerWidth));
    } else if (r < 0.57) {
      this.lookAtPoint(rand(0, innerWidth), rand(0, innerHeight), 1200);
      await wait(rand(700, 1600), t);
      this.face(-this.facing);
      await wait(rand(400, 1200), t);
    } else if (r < 0.66) {
      this.say(pick(LINES.think[this.idx]));
      await wait(2400, t);
    } else if (r < 0.72 && performance.now() - this.lastSleep > 35000) {
      await this.sleep(t);
    } else if (r < 0.79 && !this.perch) {
      await this.peek(t);
    } else if (r < 0.85) {
      this.sqV += 7;
      await wait(120, t);
      this.launch(this.facing * 120, -1000);
      sound.boing(1.2);
      await new Promise((res) => gsap.fromTo(this, { spin: 0 }, { spin: -360 * this.facing, duration: 0.7, ease: 'power2.inOut', onComplete: res }));
      this.spin = 0;
      await this.untilGrounded(t);
    } else if (r < 0.92 && this.perch) {
      await this.jumpToFloor(t);
    } else await wait(rand(800, 2400), t);
  }

  async peek(t) {
    const left = this.x < innerWidth / 2;
    const edge = left ? this.size * 0.5 : innerWidth - this.size * 0.5;
    await this.walkTo(t, edge);
    this.face(left ? 1 : -1);
    this.busy = 'script';
    const hide = this.size * 0.62 * (left ? -1 : 1);
    await playTL(gsap.timeline().to(this, { localX: `+=${hide}`, duration: 0.5, ease: 'power2.in' }), t);
    this.lookAtPoint(innerWidth / 2, innerHeight / 2, 2500);
    await wait(rand(1500, 2600), t);
    await playTL(gsap.timeline().to(this, { localX: `-=${hide}`, duration: 0.45, ease: 'back.out(2)' }), t);
    this.say(left ? 'peekaboo' : 'boo.', 1400);
    this.busy = null;
  }

  // ---------- pointer ----------
  bindPointer() {
    const el = this.el;
    el.addEventListener('pointerenter', () => {
      this.world.setCursor('grab');
      if (!this.sleeping && !this.dragging) gsap.to(this, { eyeScale: 1.25, duration: 0.25, ease: 'back.out(3)' });
    });
    el.addEventListener('pointerleave', () => {
      this.world.setCursor(null);
      if (!this.dragging && !this.frozen) gsap.to(this, { eyeScale: 1, duration: 0.3 });
    });
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY, t: performance.now() };
      const off = { x: this.x - e.clientX, y: this.y - e.clientY };
      let dragging = false;
      const hist = [];
      const move = (ev) => {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (!dragging && dx * dx + dy * dy > 36 && !this.frozen) {
          dragging = true;
          this.cancel();
          if (this.sleeping) this.wake(false);
          this.dragging = true;
          this.landOnly = null;
          this.grounded = false;
          this.perch = null;
          this.sizeTarget = this.world.normalSize();
          this.world.setCursor('grabbing');
          sound.squeak(this.idx ? 1.2 : 1);
          if (Math.random() < 0.6) this.say(pick(LINES.drag), 1600);
          gsap.to(this, { eyeScale: 1.4, duration: 0.2 });
        }
        if (dragging) {
          this.dragTarget = { x: ev.clientX + off.x * 0.5, y: ev.clientY + this.h * 0.5 };
          hist.push({ x: ev.clientX, y: ev.clientY, t: performance.now() });
          while (hist.length > 6) hist.shift();
        }
      };
      const up = () => {
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', up);
        if (!dragging) { this.poke(); return; }
        this.dragging = false;
        this.dragTarget = null;
        this.world.setCursor(null);
        gsap.to(this, { eyeScale: 1, duration: 0.4 });
        let vx = 0, vy = 0;
        if (hist.length >= 2) {
          const a = hist[0], b = hist[hist.length - 1];
          const dt = Math.max(16, b.t - a.t) / 1000;
          if (performance.now() - b.t < 120) { vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
        }
        vx = clamp(vx, -3400, 3400); vy = clamp(vy, -3400, 3400);
        this.launch(vx, vy);
        this.thrown = Math.hypot(vx, vy) > 900;
        if (this.thrown) sound.whoosh();
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
  }

  // ---------- simulation ----------
  update(dt, now) {
    const W = innerWidth;
    const world = this.world;
    const floor = world.floorY;

    if (this.dragging && this.dragTarget) {
      const px = this.x, py = this.y;
      this.x += (this.dragTarget.x - this.x) * Math.min(1, dt * 22);
      this.y += (this.dragTarget.y - this.y) * Math.min(1, dt * 22);
      this.vx = (this.x - px) / dt; this.vy = (this.y - py) / dt;
    } else if (!this.grounded) {
      this.prevY = this.y;
      this.vy += G * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      const half = this.size * 0.45;
      if (this.x < half) { this.x = half; this.vx = Math.abs(this.vx) * 0.55; this.squash(0.12); if (Math.abs(this.vx) > 300) sound.pop(0.8, 0.5); }
      if (this.x > W - half) { this.x = W - half; this.vx = -Math.abs(this.vx) * 0.55; this.squash(0.12); if (Math.abs(this.vx) > 300) sound.pop(0.8, 0.5); }
      if (this.y - this.h < 0 && this.vy < 0) { this.y = this.h; this.vy = -this.vy * 0.35; this.squash(0.15); }
      if (this.vy > 0) {
        for (const p of world.perchList) {
          const r = p.r;
          if (!p.landable) continue;
          if (this.landOnly && p.el !== this.landOnly) continue;
          if (this.x > r.left + 6 && this.x < r.right - 6 && this.prevY <= r.top + 3 && this.y >= r.top) {
            this.land(p.el, r);
            break;
          }
        }
      }
      if (!this.grounded && this.y >= floor) this.land(null, null);
    } else {
      // grounded: glued to the surface (which may scroll)
      if (this.perch) {
        const p = world.perchMap.get(this.perch);
        const r = p?.r;
        if (!r || r.top > floor - 4) {
          // surface scrolled below the floor -> stand on the floor instead
          this.perch = null;
          this.localX = this.x;
          this.y = floor;
        } else if (r.top < NAV_H * 0.6 || r.width < 10) {
          // surface scrolled away above: fall
          this.launch(0, 0);
          this.y = Math.max(this.y, NAV_H * 0.6);
        } else {
          this.x = r.left + this.localX;
          this.y = r.top;
        }
      } else {
        this.x = this.localX;
        this.y = floor;
      }
    }

    // smooth size
    this.size += (this.sizeTarget - this.size) * Math.min(1, dt * 5);

    // squash spring
    const k = 380, c = 13;
    this.sqV += (-k * this.sq - c * this.sqV) * dt;
    this.sq += this.sqV * dt;
    this.sq = clamp(this.sq, -0.28, 0.45);

    // rotation: lean into velocity
    let rotT = 0;
    if (this.dragging) rotT = clamp(this.vx * 0.02, -35, 35);
    else if (!this.grounded) rotT = clamp(this.vx * 0.012, -22, 22);
    this.rot += (rotT - this.rot) * Math.min(1, dt * 10);

    this.faceVis += (this.facing - this.faceVis) * Math.min(1, dt * 16);

    // eyes look target
    let tx = null, ty = null;
    if (this.lookOverride && now < this.lookOverride.until) { tx = this.lookOverride.x; ty = this.lookOverride.y; }
    else if (this.dragging) { tx = this.x + this.vx; ty = this.y + 200; }
    else if (world.pointer.active && Math.hypot(world.pointer.x - this.x, world.pointer.y - this.y) < 650) { tx = world.pointer.x; ty = world.pointer.y; }
    else if (this.partner) { tx = this.partner.x; ty = this.partner.y - this.partner.h * 0.6; }
    let lx = 0, ly = 0;
    if (tx !== null) {
      const cx = this.x, cy = this.y - this.h * 0.55;
      let dx = (tx - cx) * Math.sign(this.faceVis || 1), dy = ty - cy;
      const d = Math.hypot(dx, dy) || 1;
      const m = Math.min(1, d / 220);
      lx = (dx / d) * 14 * m; ly = (dy / d) * 10 * m;
    }
    if (world.scrollV) ly = clamp(ly + world.scrollV * 0.25, -12, 12);
    this.look.x += (lx - this.look.x) * Math.min(1, dt * 12);
    this.look.y += (ly - this.look.y) * Math.min(1, dt * 12);

    if (this.dizzyUntil && now > this.dizzyUntil) this.dizzyUntil = 0;
  }

  land(el, r) {
    const impact = this.vy;
    this.landOnly = null;
    if (el) { this.perch = el; this.localX = this.x - r.left; this.y = r.top; }
    else { this.perch = null; this.localX = this.x; this.y = this.world.floorY; }
    this.sizeTarget = el === this.world.stage ? this.world.heroSize() : this.world.normalSize();
    this.squash(clamp(impact / 2800, 0.06, 0.5));
    if (impact > 1500 && !this.busy) {
      // bounce
      this.launch(this.vx * 0.5, -impact * 0.36);
      sound.boing(0.8 + Math.random() * 0.3, 0.6);
      if (impact > 2300 && !this.dizzyUntil) this.dizzy();
      return;
    }
    this.grounded = true;
    this.vx = 0; this.vy = 0;
    if (impact > 500) sound.pop(0.6 + Math.random() * 0.3, 0.35);
    if (this.thrown) {
      this.thrown = false;
      if (!this.dizzyUntil && Math.random() < 0.5) setTimeout(() => this.say(pick(LINES.thrown), 1500), 150);
      this.nextThink = performance.now() + 900;
    }
  }

  render(now) {
    const s = this.size / RENDER_W;
    let sy = 1 - this.sq;
    let sx = 1 + this.sq * 0.7;
    if (this.grounded && !this.busy && !this.dragging) {
      const br = Math.sin(now / 1000 * (this.sleeping ? 2 : 3.2) + this.idx * 2) * (this.sleeping ? 0.035 : 0.014);
      sy += br; sx -= br * 0.6;
    }
    if (!this.grounded && !this.dragging) {
      const st = clamp(Math.abs(this.vy) / 4200, 0, 0.13);
      sy *= 1 + st; sx *= 1 - st * 0.6;
    }
    if (this.dragging) {
      const sp = clamp(Math.hypot(this.vx, this.vy) / 5000, 0, 0.25);
      sy *= 1 + sp; sx *= 1 - sp * 0.5;
    }
    const fx = Math.abs(this.faceVis) < 0.05 ? 0.05 * Math.sign(this.faceVis || 1) : this.faceVis;
    const px = this.x + this.ox;
    const py = this.y + this.oy;
    const halfH = (RENDER_H / 2) * s * sy;
    const r = this.rot + this.lean * this.facing;
    this.el.style.transform =
      `translate3d(${(px - RENDER_W / 2).toFixed(2)}px,${(py - RENDER_H).toFixed(2)}px,0) rotate(${r.toFixed(2)}deg)` +
      (this.spin ? ` translateY(${-halfH}px) rotate(${this.spin.toFixed(1)}deg) translateY(${halfH}px)` : '') +
      ` scale(${(s * sx * fx).toFixed(4)},${(s * sy).toFixed(4)})`;

    // eyes
    for (let i = 0; i < this.chr.eyeEls.length; i++) {
      const e = this.eyeData[i];
      const open = this.eyeOpen;
      const es = this.eyeScale;
      const str = `translate(${this.look.x.toFixed(1)} ${this.look.y.toFixed(1)}) translate(${e.cx} ${e.cy}) rotate(${(this.eyeRot * (i ? -1 : 1)).toFixed(0)}) scale(${es.toFixed(3)} ${(es * open).toFixed(3)}) translate(${-e.cx} ${-e.cy})`;
      if (str !== this._eyeStr[i]) { this.chr.eyeEls[i].setAttribute('transform', str); this._eyeStr[i] = str; }
    }

    // bubble
    if (this.bubble.classList.contains('show')) {
      const bx = clamp(px, 110, innerWidth - 110);
      const by = Math.max(py - this.h * (1 - this.sq) - 12, 46);
      this.bubble.style.left = bx + 'px';
      this.bubble.style.top = by + 'px';
      this.bubble.style.setProperty('--tail', `${clamp(px - bx, -80, 80)}px`);
    }
    if (this.ice) {
      const w = this.size * 1.18, h = this.h * 1.2;
      this.ice.style.width = w + 'px';
      this.ice.style.height = h + 'px';
      this.ice.style.left = px - w / 2 + 'px';
      this.ice.style.top = py - h + this.h * 0.08 + 'px';
    }
  }
}

export class World {
  constructor(layer, { stage, perchSelector = '[data-perch]' } = {}) {
    this.layer = layer;
    this.stage = stage;
    this.perchSelector = perchSelector;
    this.pointer = { x: -999, y: -999, active: false };
    this.scrollV = 0;
    this.perchList = [];
    this.perchMap = new Map();
    this.refreshPerches();
    this.pets = [new Pet(this, 0), new Pet(this, 1)];
    this.nextMeet = performance.now() + rand(9000, 14000);
    this.atTopSince = performance.now();
    this.running = false;

    window.addEventListener('pointermove', (e) => {
      this.pointer.x = e.clientX; this.pointer.y = e.clientY;
      this.pointer.active = e.pointerType === 'mouse' || e.pointerType === 'pen';
    }, { passive: true });
    document.addEventListener('pointerleave', () => (this.pointer.active = false));
    window.addEventListener('resize', () => {
      this.refreshPerches();
      this.pets.forEach((p) => {
        p.sizeTarget = p.onStage ? this.heroSize() : this.normalSize();
        if (!p.perch && p.grounded) p.localX = clamp(p.localX, p.size / 2, innerWidth - p.size / 2);
      });
    });
    this.tick = this.tick.bind(this);
  }

  get floorY() { return innerHeight - 3; }
  normalSize() { return clamp(innerWidth * 0.072, 62, 104); }
  heroSize() {
    const r = this.stage?.getBoundingClientRect();
    return r ? clamp(r.width * 0.46, 90, 300) : 200;
  }

  refreshPerches() {
    this.perchEls = [...document.querySelectorAll(this.perchSelector)];
  }

  rectOf(el) { return this.perchMap.get(el)?.r || null; }

  visiblePerches(exclude) {
    const H = innerHeight;
    return this.perchList
      .filter((p) => p.el !== exclude && p.el !== this.stage && p.r.top > NAV_H + 150 && p.r.top < H - 90 && p.r.width > 140 && p.r.height > 0)
      .map((p) => p.el);
  }

  setCursor(mode) { this.onCursor?.(mode); }

  start() {
    if (this.running) return;
    this.running = true;
    gsap.ticker.add(this.tick);
  }

  // dramatic entrance: both fall from the sky onto the hero stage
  intro() {
    const r = this.stage.getBoundingClientRect();
    const hs = this.heroSize();
    this.pets.forEach((p, i) => {
      p.size = p.sizeTarget = hs;
      p.x = r.left + r.width * (i ? 0.745 : 0.255);
      p.y = -hs - i * 260;
      p.vx = 0; p.vy = 400;
      p.grounded = false;
      p.landOnly = this.stage;
      p.facing = 1; p.faceVis = 1;
      p.nextThink = performance.now() + 3200 + i * 1500;
    });
    this.start();
    setTimeout(() => this.pets[1].say('found it!', 1800), 1300);
    setTimeout(() => this.pets[0].say("we're plural now.", 2000), 2600);
  }

  tick(time, deltaMs) {
    const dt = Math.min(0.033, deltaMs / 1000);
    const now = performance.now();

    // measure perches once per frame
    this.perchList.length = 0;
    this.perchMap.clear();
    for (const el of this.perchEls) {
      const r = el.getBoundingClientRect();
      const p = { el, r, landable: r.top > NAV_H * 0.6 && r.top < this.floorY - 4 && r.width > 0 };
      this.perchList.push(p);
      this.perchMap.set(el, p);
    }
    this.scrollV *= 0.9;

    const stageR = this.rectOf(this.stage);
    const stageVisible = stageR && stageR.top > NAV_H + 60 && stageR.top < innerHeight - 40;
    if (window.scrollY < 30) { if (!this.atTop) { this.atTop = true; this.atTopSince = now; } }
    else this.atTop = false;

    for (const p of this.pets) {
      // leave the stage when the hero scrolls away
      if (p.onStage && stageR && stageR.top < innerHeight * 0.42 && p.grounded && !p.dragging && !p.frozen && p.busy !== 'leaving') {
        const delay = p.idx * 180;
        p.act(async (t) => {
          await wait(delay, t);
          p.leftHomeAt = now;
          await p.jumpToFloor(t, innerWidth * (p.idx ? rand(0.6, 0.85) : rand(0.15, 0.4)));
        }, 'leaving');
      }
      // come home when back at the top
      else if (!p.onStage && this.atTop && stageVisible && now - this.atTopSince > 700 && now - p.leftHomeAt > 9000 &&
        p.free && p.grounded && !p.sleeping) {
        p.act(async (t) => {
          await p.jumpToPerch(t, this.stage, p.idx ? 0.745 : 0.255);
          p.face(1);
        }, 'homing');
        p.leftHomeAt = now;
      }
      else if (p.free && !p.token && p.grounded && now > p.nextThink && !p.sleeping) {
        p.act((t) => p.think(t));
      }
      p.update(dt, now);
    }

    // director: meetings
    if (now > this.nextMeet) {
      const [a, b] = this.pets;
      const ok = [a, b].every((p) => !p.dragging && !p.frozen && p.grounded && p.busy !== 'leaving' && p.busy !== 'homing');
      if (ok) this.meet();
      this.nextMeet = now + rand(16000, 26000);
    }

    for (const p of this.pets) p.render(now);
  }

  async meet() {
    const [a, b] = this.pets;
    a.cancel(); b.cancel();
    if (a.sleeping) a.wake(false);
    if (b.sleeping) b.wake(false);
    const t = new Token();
    a.token = b.token = t;
    a.busy = b.busy = 'meet';
    const done = () => {
      for (const p of [a, b]) {
        if (p.token === t) { p.token = null; p.busy = null; }
        p.nextThink = performance.now() + rand(1200, 3000);
        p.lean = 0; p.oy = 0; p.ox = 0;
      }
    };
    try {
      // host: whoever is on the floor (always reachable), else the one on the stage, else a
      let host = a, guest = b;
      if (b.perch === null && a.perch !== null) { host = b; guest = a; }
      if (a.onStage) { host = a; guest = b; }
      const gap = Math.max(host.size, guest.size) * 0.98;
      if (guest.perch !== host.perch) {
        const side = host.x < innerWidth / 2 ? 1 : -1;
        const tx = host.x + side * gap * 1.4;
        guest.lookAtPoint(host.x, host.y, 800);
        await wait(400, t);
        guest.say(pick(['wait for me', 'oi!', 'hey ' + host.name.toLowerCase(), 'coming!']), 1200);
        if (host.perch) await guest.jumpToPerch(t, host.perch, clamp((tx - host.world.rectOf(host.perch).left) / host.world.rectOf(host.perch).width, 0.1, 0.9));
        else await guest.jumpToFloor(t, clamp(tx, 60, innerWidth - 60));
        if (guest.perch !== host.perch) { done(); return; }
      }
      // walk toward each other
      const left = a.x < b.x ? a : b;
      const right = left === a ? b : a;
      const [lo, hi] = host.surfaceBounds();
      let mid = clamp((left.x + right.x) / 2, lo + gap / 2, hi - gap / 2);
      await Promise.all([left.walkTo(t, mid - gap / 2), right.walkTo(t, mid + gap / 2)]);
      left.face(1); right.face(-1);
      await wait(250, t);
      const acts = [this.bonk, this.dance, this.leapfrog, this.chat, this.love, this.highfive];
      const fn = pick(acts);
      await fn.call(this, left, right, t);
      await wait(600, t);
      // part ways
      if (Math.random() < 0.5 && !left.onStage) {
        await Promise.all([left.walkTo(t, left.x - rand(80, 200)), right.walkTo(t, right.x + rand(80, 200))]);
      } else if (left.onStage) {
        left.face(1); right.face(1);
      }
    } catch (e) {
      if (e !== CANCEL) console.error(e);
    }
    done();
  }

  midTop(l, r) { return { x: (l.x + r.x) / 2, y: Math.min(l.y - l.h, r.y - r.h) }; }

  async bonk(l, r, t) {
    const d = (r.x - l.x) * 0.16;
    const tl = gsap.timeline();
    tl.to([l, r], { lean: -14, duration: 0.35, ease: 'power2.out' })
      .add(() => { l.sqV += 3; r.sqV += 3; })
      .to(l, { ox: d, duration: 0.12, ease: 'power4.in' }, '+=0.05')
      .to(r, { ox: -d, duration: 0.12, ease: 'power4.in' }, '<')
      .to([l, r], { lean: 18, duration: 0.12, ease: 'power4.in' }, '<')
      .add(() => {
        const m = { x: (l.x + r.x) / 2, y: l.y - l.h * 0.6 };
        this.burst(m.x, m.y, 8);
        this.fx('BONK!', m.x, m.y - 40, { size: 34, rot: rand(-12, 12), dur: 1.1, color: '#fff2d3' });
        l.squash(0.35); r.squash(0.35);
        sound.pop(0.7); sound.boing(0.7, 0.7);
      })
      .to(l, { ox: -d * 0.6, duration: 0.5, ease: 'elastic.out(1,0.4)' })
      .to(r, { ox: d * 0.6, duration: 0.5, ease: 'elastic.out(1,0.4)' }, '<')
      .to([l, r], { lean: -6, duration: 0.4 }, '<')
      .add(() => { l.dizzy(1500); r.dizzy(1500); })
      .to([l, r], { ox: 0, lean: 0, duration: 0.6, ease: 'power2.inOut' }, '+=1.2');
    await playTL(tl, t);
  }

  async dance(l, r, t) {
    const tl = gsap.timeline();
    for (let i = 0; i < 6; i++) {
      const dir = i % 2 ? 1 : -1;
      tl.to([l, r], { oy: -l.size * 0.28, lean: 12 * dir, duration: 0.17, ease: 'power2.out' })
        .add(() => {
          sound.boing(1 + i * 0.12, 0.4);
          this.fx(pick(['♪', '♫']), l.x + rand(-20, 60), l.y - l.h * 1.2, { size: 28, drift: rand(-40, 40) });
        }, '<')
        .to([l, r], { oy: 0, duration: 0.17, ease: 'power2.in' })
        .add(() => { l.squash(0.2); r.squash(0.2); });
    }
    tl.to([l, r], { lean: 0, duration: 0.3 });
    l.say('♪ boing boing ♪', 2200);
    await playTL(tl, t);
  }

  async leapfrog(l, r, t) {
    const jumper = Math.random() < 0.5 ? l : r;
    const other = jumper === l ? r : l;
    const dir = jumper === l ? 1 : -1;
    const dist = Math.abs(r.x - l.x) * 2;
    const h = other.h * 1.35;
    jumper.busy = 'meet';
    const tl = gsap.timeline();
    tl.add(() => { jumper.sqV += 7; other.say('?', 900); })
      .to({}, { duration: 0.15 })
      .add(() => { sound.whoosh(); other.squash(0.25); other.lookAtPoint(other.x, other.y - 500, 900); })
      .to(jumper, { localX: `+=${dist * dir}`, duration: 0.75, ease: 'none' })
      .to(jumper, { oy: -h, duration: 0.375, ease: 'power2.out' }, '<')
      .to(jumper, { oy: 0, duration: 0.375, ease: 'power2.in' }, '>')
      .fromTo(jumper, { spin: 0 }, { spin: 360 * dir, duration: 0.75, ease: 'power1.inOut' }, '<-0.375')
      .add(() => { jumper.spin = 0; jumper.squash(0.4); jumper.face(-dir); sound.boing(0.9); this.burst(jumper.x, jumper.y - 10, 5); })
      .to({}, { duration: 0.3 })
      .add(() => { other.face(dir); other.say(pick(['show-off.', 'ok wow', 'my turn next']), 1600); jumper.say('ta-da', 1200); });
    await playTL(tl, t);
    await wait(1200, t);
  }

  async chat(l, r, t) {
    const [q, a] = pick(DIALOGS);
    const first = Math.random() < 0.5 ? l : r;
    const second = first === l ? r : l;
    first.say(q, 2200);
    gsap.fromTo(first, { oy: 0 }, { oy: -8, yoyo: true, repeat: 3, duration: 0.1 });
    await wait(2000, t);
    second.say(a, 2400);
    gsap.fromTo(second, { oy: 0 }, { oy: -8, yoyo: true, repeat: 3, duration: 0.1 });
    await wait(2300, t);
    if (Math.random() < 0.5) { first.launch(0, -500); second.launch(0, -500); sound.boing(1.2, 0.5); await first.untilGrounded(t); }
  }

  async love(l, r, t) {
    for (let i = 0; i < 5; i++) {
      this.fx('♥', (l.x + r.x) / 2 + rand(-20, 20), l.y - l.h * 0.9, { size: rand(20, 34), color: '#e5533a', drift: rand(-30, 30), dur: 1.8 });
      await wait(170, t);
    }
    gsap.to([l, r], { eyeScale: 0.7, duration: 0.3 });
    await wait(500, t);
    l.face(-1); r.face(1);
    l.say(pick(LINES.shy), 1200);
    await wait(900, t);
    l.face(1); r.face(-1);
    gsap.to([l, r], { eyeScale: 1, duration: 0.3 });
    await wait(400, t);
  }

  async highfive(l, r, t) {
    l.sqV += 6; r.sqV += 6;
    await wait(140, t);
    const tl = gsap.timeline();
    const d = (r.x - l.x) * 0.22;
    tl.to([l, r], { oy: -l.size * 0.9, duration: 0.35, ease: 'power2.out' })
      .to(l, { ox: d, lean: 20, duration: 0.35, ease: 'power2.out' }, '<')
      .to(r, { ox: -d, lean: 20, duration: 0.35, ease: 'power2.out' }, '<')
      .add(() => {
        this.burst((l.x + r.x) / 2, l.y + l.oy - l.h * 0.5, 10);
        this.fx('✶', (l.x + r.x) / 2, l.y + l.oy - l.h, { size: 56, dur: 0.8 });
        sound.pop(1.3); sound.chime();
      })
      .to([l, r], { oy: 0, ox: 0, lean: 0, duration: 0.4, ease: 'power2.in' })
      .add(() => { l.squash(0.35); r.squash(0.35); });
    await playTL(tl, t);
    r.say(pick(['team.', 'plural power', 'two is better']), 1600);
    await wait(700, t);
  }

  // ---------- fx ----------
  fx(text, x, y, o = {}) {
    const el = document.createElement('span');
    el.className = 'fx';
    el.textContent = text;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.fontSize = (o.size || 24) + 'px';
    if (o.color) el.style.color = o.color;
    this.layer.appendChild(el);
    const dur = o.dur || 1.4;
    if (o.gravity) {
      const st = { x: 0, y: 0, vx: o.vx || 0, vy: o.vy || -300 };
      gsap.to(st, {
        duration: dur, ease: 'none',
        onUpdate() {
          const dt = 1 / 60;
          st.vy += 1600 * dt; st.x += st.vx * dt; st.y += st.vy * dt;
          el.style.transform = `translate(-50%,-50%) translate(${st.x}px,${st.y}px) rotate(${st.x}deg)`;
          el.style.opacity = 1 - this.progress();
        },
        onComplete: () => el.remove(),
      });
      return;
    }
    gsap.fromTo(el, { xPercent: -50, yPercent: -50, scale: 0.2, rotate: o.rot || rand(-20, 20), opacity: 1 },
      { scale: 1, duration: 0.35, ease: 'back.out(3)' });
    gsap.to(el, { y: -(o.rise || 70), x: o.drift || 0, opacity: 0, duration: dur, ease: 'power1.out', delay: 0.1, onComplete: () => el.remove() });
  }

  burst(x, y, n = 8) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const el = document.createElement('span');
      el.className = 'fx fx-line';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.transform = `rotate(${a}rad)`;
      this.layer.appendChild(el);
      gsap.fromTo(el, { '--d': '6px', scaleX: 0.2, opacity: 1 }, { '--d': `${rand(34, 52)}px`, scaleX: 1, opacity: 0, duration: 0.45, ease: 'power2.out', onComplete: () => el.remove() });
    }
  }

  orbitStar(p, i, ms) {
    const el = document.createElement('span');
    el.className = 'fx';
    el.textContent = '✶';
    el.style.fontSize = '18px';
    this.layer.appendChild(el);
    const st = { a: (i / 3) * Math.PI * 2 };
    gsap.to(st, {
      a: st.a + Math.PI * 6, duration: ms / 1000, ease: 'none',
      onUpdate: () => {
        const rx = p.size * 0.45, ry = p.size * 0.1;
        el.style.left = p.x + p.ox + Math.cos(st.a) * rx + 'px';
        el.style.top = p.y + p.oy - p.h - 6 + Math.sin(st.a) * ry + 'px';
        el.style.transform = `translate(-50%,-50%) scale(${0.7 + Math.sin(st.a) * 0.3})`;
      },
      onComplete: () => el.remove(),
    });
  }

  // ---------- global actions ----------
  bounceAll() {
    this.pets.forEach((p, i) => {
      if (p.frozen) return;
      setTimeout(() => {
        p.cancel();
        if (p.sleeping) p.wake(false);
        if (p.dragging) return;
        p.sqV += 8;
        setTimeout(() => {
          p.launch(rand(-80, 80), -rand(1250, 1500));
          sound.boing(0.9 + i * 0.25);
          gsap.fromTo(p, { spin: 0 }, { spin: 360 * (i ? -1 : 1), duration: 0.8, ease: 'power2.inOut', onComplete: () => (p.spin = 0) });
          p.nextThink = performance.now() + 1800;
        }, 110);
      }, i * 140);
    });
  }

  freezeNearest(x, y) {
    let best = null, bd = Infinity;
    for (const p of this.pets) {
      if (p.frozen || p.dragging) continue;
      const vis = p.y > 0 && p.y - p.h < innerHeight;
      const d = Math.hypot(p.x - x, p.y - y) + (vis ? 0 : 1e5);
      if (d < bd) { bd = d; best = p; }
    }
    best?.freeze();
    return best;
  }

  nudge(v) {
    this.scrollV = clamp(v, -40, 40);
    if (Math.abs(v) > 30) {
      for (const p of this.pets) {
        if (p.grounded && !p.perch && p.free && !p.sleeping && Math.random() < 0.04) {
          p.launch(rand(-40, 40), -rand(280, 420));
        }
      }
    }
  }
}

export { RENDER_W, RENDER_H };
