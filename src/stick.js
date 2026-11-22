// STICK: the stickman the two testicles belong to. A procedurally animated, hand-drawn
// stick figure that walks the bottom of the page. The pets hang between his legs on
// pendulums; they run off now and then and he has to chase them. Drag & throw him too.
import gsap from 'gsap';
import { sound } from './sound.js';

const NS = 'http://www.w3.org/2000/svg';
const G = 2600;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const LINES = {
  enter: ['has anyone seen my testicles?', 'boys? BOYS!', 'not again...'],
  chase: ['come back here!', 'get back here!!', 'boys, please.', 'stop running!'],
  call: ['come down from there!', 'boys? home. now.', 'i can see you.', 'down. now.'],
  found: ['ahh. complete.', 'plural again.', 'much better.', 'back where you belong.', 'there they are.'],
  happy: ['feeling complete.', 'two of them. both mine.', 'nice and swingy.', 'life is good.', 'still bouncing.'],
  escaped: ['NO NO NO', 'not again!!', 'COME BACK', 'why do they keep doing this'],
  cover: ['excuse me?', 'eyes up here.', 'ok that is personal', 'do you mind?!'],
  poke: ['hey!', 'personal space', 'i am just a stick', 'ouch', 'rude.'],
  head: ['ow my head', 'that is my thinking circle'],
  drag: ['PUT ME DOWN', 'AAAAH', 'careful with the boys!', 'too high!!'],
  thrown: ['MY TESTICLES!!', 'nooo the boys'],
  stolen: ['HEY! give those back', 'that is MINE', 'thief!!'],
  fallen: ['ow.', "i'm fine. i'm fine.", 'everything hurts'],
  showoff: ['show-offs.', 'get down from that poster.'],
};

function ik(a, b, l1, l2, bend) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const d = clamp(Math.hypot(dx, dy), 0.001, l1 + l2 - 0.001);
  const ang = Math.atan2(dy, dx);
  const off = Math.acos(clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1));
  const t = ang - bend * off;
  return { x: a.x + Math.cos(t) * l1, y: a.y + Math.sin(t) * l1 };
}

export class Stick {
  constructor(world) {
    this.world = world;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'stick-svg');
    svg.innerHTML = `<g filter="url(#boil)">
      <path class="st-hit"/>
      <path class="st-ink"/>
      <path class="st-line"/>
      <circle class="st-head-ink"/>
      <circle class="st-head"/>
      <path class="st-hair"/>
      <circle class="st-blush"/><circle class="st-blush"/>
      <circle class="st-eye"/><circle class="st-eye"/>
      <path class="st-mouth"/>
      <circle class="st-mouth-o"/>
    </g>`;
    world.layer.prepend(svg);
    this.svg = svg;
    this.el = {
      hit: svg.querySelector('.st-hit'), ink: svg.querySelector('.st-ink'), line: svg.querySelector('.st-line'),
      headInk: svg.querySelector('.st-head-ink'), head: svg.querySelector('.st-head'), hair: svg.querySelector('.st-hair'),
      eyes: [...svg.querySelectorAll('.st-eye')], blush: [...svg.querySelectorAll('.st-blush')],
      mouth: svg.querySelector('.st-mouth'), mouthO: svg.querySelector('.st-mouth-o'),
    };
    this.bubble = document.createElement('div');
    this.bubble.className = 'bubble bubble-stick';
    world.layer.appendChild(this.bubble);
    gsap.set(this.bubble, { xPercent: -50, yPercent: -100, transformOrigin: '50% 100%', scale: 0 });

    this.mode = 'offstage'; // offstage | normal | drag | fall | fallen
    this.X = -300; this.vx = 0; this.target = null; this.speed = 0;
    this.facing = 1; this.phase = 0;
    this.airY = 0; this.airV = 0; this.crouch = 0;
    this.pose = 'idle'; this.poseUntil = 0;
    this.mouth = 'smile';
    this.look = { x: 0, y: 0 };
    this.blush = 0;
    this.anchors = [{ x: 0, y: 0, ax: 0, ay: 0, vx: 0, vy: 0, init: false }, { x: 0, y: 0, ax: 0, ay: 0, vx: 0, vy: 0, init: false }];
    this.H = { x: 0, y: 0 }; this.Hv = { x: 0, y: 0 };
    this.theta = 0; this.thetaV = 0;
    this.lie = 0; this.lieSide = 1;
    this.nextSay = 0; this.nextCall = 0; this.nextWander = 0;
    this.releaseAt = 0;
    this.lastCover = 0;
    this.bindPointer();
  }

  get u() { return this.world.normalSize(); }
  get pets() { return this.world.pets; }

  say(text, ms = 2000) {
    const b = this.bubble;
    b.textContent = text;
    b.classList.add('show');
    gsap.killTweensOf(b);
    gsap.fromTo(b, { scale: 0.2, rotate: rand(-10, 10) }, { scale: 1, rotate: rand(-3, 3), duration: 0.5, ease: 'elastic.out(1, 0.5)' });
    sound.blab(0.75, Math.min(7, Math.ceil(text.length / 4)));
    clearTimeout(this._sayT);
    this._sayT = setTimeout(() => gsap.to(b, { scale: 0, duration: 0.2, ease: 'back.in(2)', onComplete: () => b.classList.remove('show') }), ms);
    this.nextSay = performance.now() + ms + 600;
  }
  setPose(p, ms = 0) { this.pose = p; this.poseUntil = ms ? performance.now() + ms : 0; }

  attachedPets() { return this.pets.filter((p) => p.attachedTo === this); }

  jump(v = 760) {
    if (this.mode !== 'normal' || this.airY < 0) return;
    this.crouch = 0.25;
    setTimeout(() => { this.airV = -v; sound.boing(0.6, 0.5); }, 90);
  }

  // ---------------------------------------------------------------- skeleton
  // Pose in a local frame: origin = floor point under the feet centre, y down.
  localSkeleton(now) {
    const u = this.u;
    const f = this.facing;
    const t = now / 1000;
    const hw = 1.14 * u;
    const legLen = 1.3 * u;
    const moving = Math.abs(this.vx) > 8 && this.mode === 'normal' && this.airY === 0;
    const dangle = this.mode === 'drag' || this.mode === 'fall';
    let bob = moving ? Math.abs(Math.sin(this.phase)) * 0.07 * u : Math.sin(t * 2.2) * 0.012 * u;
    const py = -legLen + bob + this.crouch * 0.4 * u;
    const lean = moving ? f * clamp(Math.abs(this.vx) / 2600, 0, 0.12) * u : 0;
    const pelvisL = { x: -hw, y: py }, pelvisR = { x: hw, y: py };
    const arch = { x: 0, y: py - 0.22 * u };
    const torsoB = { x: 0, y: py - 0.11 * u };
    const neck = { x: lean * 3, y: py - 1.05 * u };
    const head = { x: neck.x + lean, y: neck.y - 0.34 * u, r: 0.3 * u };
    const shoulder = { x: neck.x, y: neck.y + 0.06 * u };
    const thigh = 0.7 * u, shin = 0.7 * u, upper = 0.48 * u, fore = 0.48 * u;

    // feet
    const feet = [-1, 1].map((s, i) => {
      const base = s * (hw + 0.1 * u);
      if (dangle) return { x: s * (hw + 0.05 * u) + Math.sin(t * 9 + i * 2) * 0.18 * u, y: py + legLen * 0.97 };
      if (!moving) return { x: base, y: this.airY < 0 ? py + legLen * 0.92 : 0 };
      const ph = this.phase + (i ? Math.PI : 0);
      const A = 0.32 * u * clamp(Math.abs(this.vx) / 160, 0.5, 1.3);
      const lift = Math.max(0, Math.cos(ph)) * 0.24 * u;
      return { x: base + f * Math.sin(ph) * A, y: -lift };
    });
    const knees = [pelvisL, pelvisR].map((h, i) => ik(h, feet[i], thigh, shin, f));

    // hands by pose
    let pose = dangle ? 'dangle' : this.pose;
    if (moving && (pose === 'idle' || pose === 'happy')) pose = 'walk';
    const hands = [-1, 1].map((s, i) => {
      switch (pose) {
        case 'walk': {
          const sw = -Math.sin(this.phase + (i ? Math.PI : 0)) * 0.7;
          return { x: shoulder.x + s * 0.12 * u + Math.sin(sw) * 0.85 * u * f, y: shoulder.y + Math.cos(sw) * 0.85 * u };
        }
        case 'cover': return { x: s * 0.2 * u, y: py + 0.12 * u };
        case 'call':
          return s === f ? { x: head.x + f * 0.32 * u, y: head.y + 0.12 * u } : { x: -f * 0.34 * u, y: py - 0.32 * u };
        case 'panic': return { x: shoulder.x + s * 0.45 * u + Math.sin(t * 15 + i) * 0.1 * u, y: shoulder.y - 0.78 * u + Math.cos(t * 13 + i) * 0.08 * u };
        case 'wave':
          return s === f ? { x: shoulder.x + f * 0.4 * u + Math.sin(t * 10) * 0.18 * u, y: shoulder.y - 0.82 * u } : { x: shoulder.x - f * 0.3 * u, y: shoulder.y + 0.85 * u };
        case 'happy': return { x: s * 0.36 * u, y: py - 0.36 * u };
        case 'dangle': return { x: shoulder.x + s * 0.55 * u + Math.sin(t * 16 + i * 2) * 0.16 * u, y: shoulder.y - 0.55 * u + Math.cos(t * 13 + i) * 0.12 * u };
        default: return { x: shoulder.x + s * 0.34 * u, y: shoulder.y + 0.86 * u + Math.sin(t * 2.2) * 0.02 * u };
      }
    });
    const elbows = hands.map((h, i) => ik(shoulder, h, upper, fore, i ? 1 : -1));

    return { pelvisL, pelvisR, arch, torsoB, neck, head, shoulder, feet, knees, hands, elbows, py, hw };
  }

  // maps local points to the screen depending on mode
  transformer(sk) {
    const Y = this.world.floorY;
    if (this.mode === 'drag' || this.mode === 'fall') {
      const R = -this.theta;
      const c = Math.cos(R), s = Math.sin(R);
      const hx = sk.head.x, hy = sk.head.y;
      return (p) => {
        const dx = p.x - hx, dy = p.y - hy;
        return { x: this.H.x + dx * c - dy * s, y: this.H.y + dx * s + dy * c };
      };
    }
    if (this.lie > 0) {
      const R = this.lieSide * (Math.PI / 2) * this.lie;
      const c = Math.cos(R), s = Math.sin(R);
      const lift = (sk.hw + 0.14 * this.u) * Math.abs(Math.sin(R));
      return (p) => ({ x: this.X + p.x * c - p.y * s, y: Y - lift + p.x * s + p.y * c });
    }
    return (p) => ({ x: this.X + p.x, y: Y + p.y + this.airY });
  }

  // ---------------------------------------------------------------- pointer
  bindPointer() {
    const onDown = (e) => {
      if (e.button !== 0 || this.mode === 'offstage') return;
      e.preventDefault();
      const start = { x: e.clientX, y: e.clientY };
      const onHead = e.target.classList.contains('st-head-ink');
      let dragging = false;
      const hist = [];
      const move = (ev) => {
        const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
        if (!dragging && dx * dx + dy * dy > 36) {
          dragging = true;
          this.startDrag(ev);
        }
        if (dragging) {
          this.dragTarget = { x: ev.clientX, y: ev.clientY };
          hist.push({ x: ev.clientX, y: ev.clientY, t: performance.now() });
          while (hist.length > 6) hist.shift();
        }
      };
      const up = () => {
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        this.world.setCursor(null);
        if (!dragging) { this.poke(onHead); return; }
        let vx = 0, vy = 0;
        if (hist.length >= 2) {
          const a = hist[0], b = hist[hist.length - 1];
          const dt = Math.max(16, b.t - a.t) / 1000;
          if (performance.now() - b.t < 120) { vx = (b.x - a.x) / dt; vy = (b.y - a.y) / dt; }
        }
        this.release(clamp(vx, -3000, 3000), clamp(vy, -3000, 3000));
      };
      addEventListener('pointermove', move);
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
    };
    this.el.hit.addEventListener('pointerdown', onDown);
    this.el.headInk.addEventListener('pointerdown', onDown);
    [this.el.hit, this.el.headInk].forEach((n) => {
      n.addEventListener('pointerenter', () => this.world.setCursor('grab'));
      n.addEventListener('pointerleave', () => this.world.setCursor(null));
    });
  }

  poke(onHead) {
    this.say(pick(onHead ? LINES.head : LINES.poke), 1600);
    this.jump(520);
    this.mouth = 'o';
    setTimeout(() => (this.mouth = 'smile'), 900);
    sound.squeak(0.7);
  }

  startDrag(ev) {
    const sk = this._sk;
    if (!sk) return;
    const head = this._T(sk.head);
    this.mode = 'drag';
    this.H = { x: head.x, y: head.y };
    this.Hv = { x: 0, y: 0 };
    this.theta = 0; this.thetaV = 0;
    this.lie = 0;
    this.airY = 0; this.airV = 0;
    this.dragTarget = { x: ev.clientX, y: ev.clientY };
    this.mouth = 'o';
    this.world.setCursor('grabbing');
    sound.squeak(0.6);
    if (Math.random() < 0.7) this.say(pick(LINES.drag), 1600);
  }

  release(vx, vy) {
    this.mode = 'fall';
    this.Hv = { x: vx, y: vy };
    this.dragTarget = null;
    const sp = Math.hypot(vx, vy);
    if (sp > 1300) {
      const att = this.attachedPets();
      att.forEach((p, i) => p.detach(vx * 0.7 + rand(-200, 200), vy * 0.7 - rand(200, 500)));
      if (att.length) setTimeout(() => this.say(pick(LINES.thrown), 1800), 100);
      sound.whoosh();
    }
  }

  // ---------------------------------------------------------------- update
  update(dt, now) {
    const W = innerWidth;
    const Y = this.world.floorY;
    const u = this.u;

    if (this.mode === 'offstage') {
      const w = this.world;
      if (w.introAt && (scrollY > innerHeight * 0.55 || now - w.introAt > 16000)) {
        this.mode = 'normal';
        this.X = -2 * u;
        this.target = W * 0.22;
        this.speed = 180;
        this.setPose('idle');
        setTimeout(() => this.say(pick(LINES.enter), 2400), 700);
        this.nextCall = now + 3500;
      } else return;
    }

    if (this.mode === 'drag') {
      const px = this.H.x, py = this.H.y;
      if (this.dragTarget) {
        this.H.x += (this.dragTarget.x - this.H.x) * Math.min(1, dt * 20);
        this.H.y += (this.dragTarget.y - this.H.y) * Math.min(1, dt * 20);
      }
      const nvx = (this.H.x - px) / dt, nvy = (this.H.y - py) / dt;
      const ax = (nvx - this.Hv.x) / dt, ay = (nvy - this.Hv.y) / dt;
      this.Hv = { x: nvx, y: nvy };
      const L = 1.8 * u;
      const acc = -((G + clamp(ay, -20000, 20000)) / L) * Math.sin(this.theta) - (clamp(ax, -20000, 20000) / L) * Math.cos(this.theta) - 2.2 * this.thetaV;
      this.thetaV += acc * dt;
      this.theta += this.thetaV * dt;
    } else if (this.mode === 'fall') {
      this.Hv.y += G * dt;
      this.H.x += this.Hv.x * dt; this.H.y += this.Hv.y * dt;
      this.theta += this.thetaV * dt;
      this.thetaV *= 0.995;
      if (this.H.x < u * 0.5) { this.H.x = u * 0.5; this.Hv.x = Math.abs(this.Hv.x) * 0.5; }
      if (this.H.x > W - u * 0.5) { this.H.x = W - u * 0.5; this.Hv.x = -Math.abs(this.Hv.x) * 0.5; }
      // landing: lowest point of the skeleton hits the floor
      if (this._sk) {
        const T = this.transformer(this._sk);
        const pts = [...this._sk.feet, ...this._sk.knees, this._sk.head].map(T);
        const maxY = Math.max(...pts.map((p) => p.y));
        if (maxY >= Y && this.Hv.y > 0) this.land();
      }
    } else if (this.mode === 'fallen') {
      // lying / getting up handled by tweens
    } else {
      // normal: brain + locomotion
      this.brain(now);
      if (this.target !== null && this.airY === 0) {
        const dx = this.target - this.X;
        const want = Math.abs(dx) < 8 ? 0 : Math.sign(dx) * this.speed;
        this.vx += (want - this.vx) * Math.min(1, dt * 6);
        if (Math.abs(dx) < 8) { this.vx = 0; this.target = null; }
      } else if (this.airY === 0) this.vx *= Math.pow(0.001, dt);
      this.X += this.vx * dt;
      this.X = clamp(this.X, -3 * u, W + 3 * u);
      if (Math.abs(this.vx) > 8) this.facing = Math.sign(this.vx);
      else if (this.world.pointer.active && this.pose === 'idle') this.facing = this.world.pointer.x > this.X ? 1 : -1;
      this.phase += (Math.abs(this.vx) * dt) / (0.3 * u);
      // jump
      if (this.airY < 0 || this.airV < 0) {
        this.airV += G * dt;
        this.airY += this.airV * dt;
        if (this.airY >= 0) { this.airY = 0; this.airV = 0; this.crouch = 0.3; sound.pop(0.5, 0.3); }
      }
      this.crouch *= Math.pow(0.0005, dt);
    }

    // skeleton + anchors for the pets
    const sk = this.localSkeleton(now);
    const T = this.transformer(sk);
    this._sk = sk; this._T = T;
    [-1, 1].forEach((s, i) => {
      const p = T({ x: s * 0.5 * u, y: sk.py - 0.06 * u });
      const a = this.anchors[i];
      if (!a.init) { a.x = p.x; a.y = p.y; a.vx = 0; a.vy = 0; a.init = true; }
      const vx = (p.x - a.x) / dt, vy = (p.y - a.y) / dt;
      a.ax = clamp((vx - a.vx) / dt, -30000, 30000);
      a.ay = clamp((vy - a.vy) / dt, -30000, 30000);
      a.vx = vx; a.vy = vy; a.x = p.x; a.y = p.y;
    });

    // eyes look at the cursor, else at a missing pet
    let tx = null, ty = null;
    const head = T(sk.head);
    if (this.world.pointer.active) { tx = this.world.pointer.x; ty = this.world.pointer.y; }
    const missing = this.pets.find((p) => !p.attachedTo);
    if (missing && (!this.world.pointer.active || Math.hypot(tx - head.x, ty - head.y) > 500)) { tx = missing.x; ty = missing.y - missing.h / 2; }
    let lx = 0, ly = 0;
    if (tx !== null) {
      const dx = tx - head.x, dy = ty - head.y, d = Math.hypot(dx, dy) || 1;
      lx = (dx / d) * 0.1 * u; ly = (dy / d) * 0.08 * u;
    }
    this.look.x += (lx - this.look.x) * Math.min(1, dt * 10);
    this.look.y += (ly - this.look.y) * Math.min(1, dt * 10);
    this.blush += ((this.pose === 'cover' ? 1 : 0) - this.blush) * Math.min(1, dt * 6);
  }

  land() {
    const th = Math.atan2(Math.sin(this.theta), Math.cos(this.theta));
    const hard = Math.abs(th) > 0.7 || this.Hv.y > 1700;
    const sk = this._sk;
    const feetX = this._T({ x: 0, y: 0 }).x;
    this.X = clamp(feetX, this.u, innerWidth - this.u);
    this.vx = 0; this.target = null; this.airY = 0; this.airV = 0;
    if (!hard) {
      this.mode = 'normal';
      this.crouch = 0.5;
      this.theta = 0;
      sound.pop(0.5, 0.5);
      this.mouth = 'smile';
      return;
    }
    // faceplant
    this.mode = 'fallen';
    this.lieSide = th === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(th) * -1;
    this.lie = 1;
    this.theta = 0;
    this.mouth = 'o';
    sound.boing(0.45, 0.8);
    this.world.burst(this.X, this.world.floorY - 20, 10);
    this.attachedPets().forEach((p) => p.detach(rand(-500, 500), -rand(600, 900)));
    setTimeout(() => this.say(pick(LINES.fallen), 1800), 500);
    gsap.to(this, {
      lie: 0, duration: 0.8, delay: 1.6, ease: 'back.out(1.6)',
      onComplete: () => { this.mode = 'normal'; this.mouth = 'smile'; this.crouch = 0.4; },
    });
  }

  // ---------------------------------------------------------------- brain
  brain(now) {
    if (this.poseUntil && now > this.poseUntil) this.setPose('idle');
    const u = this.u;
    const W = innerWidth;
    const att = this.attachedPets();
    const p = this.world.pointer;

    // someone looking where they should not
    if (att.length && p.active && Math.abs(p.x - this.X) < 1.1 * u && p.y > this.world.floorY - 1.4 * u && p.y < this.world.floorY) {
      if (this.pose !== 'cover') {
        this.setPose('cover', 1400);
        this.target = null;
        if (now - this.lastCover > 5000) { this.lastCover = now; this.say(pick(LINES.cover), 1600); }
      } else this.poseUntil = now + 600;
      return;
    }
    if (this.pose === 'cover' || this.pose === 'panic' && this.poseUntil) return;

    if (att.length === 2) {
      this.mouth = 'smile';
      if (!this.releaseAt) this.releaseAt = now + rand(22000, 40000);
      if (now > this.releaseAt) {
        // they get bored and run off
        this.releaseAt = 0;
        const runners = Math.random() < 0.55 ? att : [pick(att)];
        runners.forEach((pt, i) => setTimeout(() => {
          if (pt.attachedTo !== this) return;
          const dir = pt.idx === 0 ? -1 : 1;
          pt.detach(dir * rand(300, 600), -rand(800, 1100));
          setTimeout(() => pt.say(pick(['freedom!', 'brb', 'we need space', 'see ya stick', 'wheee']), 1600), 200);
        }, i * 250));
        setTimeout(() => { this.setPose('panic', 1800); this.mouth = 'o'; this.say(pick(LINES.escaped), 1800); sound.squeak(0.5); }, 400);
        return;
      }
      if (now > this.nextWander) {
        this.nextWander = now + rand(2500, 6000);
        const r = Math.random();
        if (r < 0.45) { this.target = clamp(this.X + rand(-0.35, 0.35) * W, 2 * u, W - 2 * u); this.speed = rand(90, 150); this.setPose('idle'); }
        else if (r < 0.6) { this.setPose('happy', 2200); this.target = null; }
        else if (r < 0.72) { this.setPose('wave', 1800); this.target = null; }
        else if (r < 0.8) { this.jump(rand(600, 820)); }
        else if (now > this.nextSay) this.say(pick(LINES.happy));
      }
      return;
    }

    this.releaseAt = 0;
    const visible = (pt) => pt.y > 0 && pt.y - pt.h < innerHeight + 20;
    const free = this.pets.filter((pt) => !pt.attachedTo && !pt.attachAnim && !pt.dragging && visible(pt));
    const onFloor = free.filter((pt) => pt.grounded && !pt.perch && pt.busy !== 'meet' && pt.busy !== 'homing' && pt.busy !== 'leaving');
    const onPerch = free.filter((pt) => pt.grounded && pt.perch);

    if (onFloor.length) {
      const tgt = onFloor.reduce((a, b) => (Math.abs(a.x - this.X) < Math.abs(b.x - this.X) ? a : b));
      const dx = tgt.x - this.X;
      this.mouth = 'o';
      this.setPose('idle');
      if (Math.abs(dx) < 0.9 * u) {
        this.target = null; this.vx *= 0.5;
        tgt.attach(this);
        return;
      }
      this.target = tgt.x;
      this.speed = Math.abs(dx) > 250 ? 360 : 200;
      if (now > this.nextSay && Math.random() < 0.01) this.say(pick(LINES.chase), 1500);
      return;
    }
    if (onPerch.length) {
      const tgt = onPerch[0];
      const stage = tgt.perch === this.world.stage;
      if (stage && scrollY < 40) {
        // they are posing on the hero: let them, but complain
        this.mouth = 'flat';
        if (now > this.nextCall) { this.nextCall = now + rand(9000, 14000); this.target = clamp(tgt.x, 2 * u, W - 2 * u); this.speed = 150; setTimeout(() => this.say(pick(LINES.showoff), 1800), 1200); }
        return;
      }
      if (Math.abs(tgt.x - this.X) > 1.2 * u) { this.target = clamp(tgt.x, 2 * u, W - 2 * u); this.speed = 260; this.mouth = 'o'; return; }
      this.target = null;
      if (now > this.nextCall) {
        this.nextCall = now + rand(3200, 5000);
        this.setPose('call', 1400);
        this.mouth = 'o';
        this.say(pick(LINES.call), 1500);
        if (Math.random() < 0.45) setTimeout(() => tgt.comeHome?.(this), 900);
      }
      return;
    }
    // nobody around: wander worried
    this.mouth = 'worried';
    if (now > this.nextWander) {
      this.nextWander = now + rand(3000, 6000);
      this.target = clamp(rand(0.1, 0.9) * W, 2 * u, W - 2 * u);
      this.speed = 140;
      if (Math.random() < 0.35 && now > this.nextSay) this.say(pick(LINES.enter), 1800);
    }
  }

  onAttached(pet) {
    this.crouch = 0.35;
    if (this.attachedPets().length === 2) {
      this.setPose('happy', 1800);
      this.mouth = 'grin';
      this.say(pick(LINES.found), 1800);
      sound.chime();
    }
  }
  onStolen() {
    this.setPose('panic', 1600);
    this.mouth = 'o';
    this.say(pick(LINES.stolen), 1600);
  }

  // ---------------------------------------------------------------- render
  render() {
    if (this.mode === 'offstage' || !this._sk) { this.svg.style.display = 'none'; return; }
    this.svg.style.display = '';
    const sk = this._sk, T = this._T, u = this.u, f = this.facing;
    const P = (p) => { const q = T(p); return `${q.x.toFixed(1)} ${q.y.toFixed(1)}`; };
    let d = '';
    d += `M${P(sk.torsoB)} L${P(sk.neck)}`;
    d += ` M${P(sk.pelvisL)} Q${P(sk.arch)} ${P(sk.pelvisR)}`;
    [sk.pelvisL, sk.pelvisR].forEach((h, i) => {
      const ft = sk.feet[i];
      d += ` M${P(h)} L${P(sk.knees[i])} L${P(ft)} L${P({ x: ft.x + f * 0.16 * u, y: ft.y })}`;
    });
    sk.hands.forEach((h, i) => { d += ` M${P(sk.shoulder)} L${P(sk.elbows[i])} L${P(h)}`; });
    const ink = 0.12 * u, line = 0.055 * u;
    for (const [el, w] of [[this.el.hit, 0.4 * u], [this.el.ink, ink], [this.el.line, line]]) {
      el.setAttribute('d', d);
      el.style.strokeWidth = w;
    }
    const hc = T(sk.head), r = sk.head.r;
    for (const [el, w] of [[this.el.headInk, ink], [this.el.head, line]]) {
      el.setAttribute('cx', hc.x.toFixed(1)); el.setAttribute('cy', hc.y.toFixed(1)); el.setAttribute('r', r.toFixed(1));
      el.style.strokeWidth = w;
    }
    const hx = sk.head.x, hy = sk.head.y;
    const F = (x, y) => T({ x: hx + x, y: hy + y });
    const Fp = (x, y) => { const q = F(x, y); return `${q.x.toFixed(1)} ${q.y.toFixed(1)}`; };
    this.el.hair.setAttribute('d', `M${Fp(-0.25 * r, -0.95 * r)} Q${Fp(-0.15 * r, -1.45 * r)} ${Fp(0, -1 * r)} Q${Fp(0.12 * r, -1.5 * r)} ${Fp(0.28 * r, -0.95 * r)}`);
    this.el.hair.style.strokeWidth = line;
    const ex = f * 0.1 * r + this.look.x, ey = -0.05 * r + this.look.y;
    this.el.eyes.forEach((e, i) => {
      const q = F((i ? 0.34 : -0.3) * r + ex, ey);
      e.setAttribute('cx', q.x.toFixed(1)); e.setAttribute('cy', q.y.toFixed(1)); e.setAttribute('r', (0.1 * r).toFixed(1));
    });
    this.el.blush.forEach((e, i) => {
      const q = F((i ? 0.5 : -0.45) * r + f * 0.08 * r, 0.3 * r);
      e.setAttribute('cx', q.x.toFixed(1)); e.setAttribute('cy', q.y.toFixed(1)); e.setAttribute('r', (0.16 * r).toFixed(1));
      e.style.opacity = this.blush * 0.85;
    });
    const mx = f * 0.12 * r + this.look.x * 0.5;
    const mo = this.mouth === 'o';
    this.el.mouthO.style.display = mo ? '' : 'none';
    this.el.mouth.style.display = mo ? 'none' : '';
    if (mo) {
      const q = F(mx, 0.42 * r);
      this.el.mouthO.setAttribute('cx', q.x.toFixed(1)); this.el.mouthO.setAttribute('cy', q.y.toFixed(1)); this.el.mouthO.setAttribute('r', (0.13 * r).toFixed(1));
      this.el.mouthO.style.strokeWidth = line * 0.8;
    } else {
      const shapes = {
        smile: [[-0.38, 0.32], [0, 0.6], [0.38, 0.32]],
        grin: [[-0.5, 0.25], [0, 0.85], [0.5, 0.25]],
        flat: [[-0.3, 0.45], [0, 0.45], [0.3, 0.45]],
        worried: [[-0.35, 0.55], [0, 0.3], [0.35, 0.55]],
      };
      const s = shapes[this.mouth] || shapes.smile;
      this.el.mouth.setAttribute('d', `M${Fp(mx + s[0][0] * r, s[0][1] * r)} Q${Fp(mx + s[1][0] * r, s[1][1] * r)} ${Fp(mx + s[2][0] * r, s[2][1] * r)}`);
      this.el.mouth.style.strokeWidth = line * 0.9;
    }

    if (this.bubble.classList.contains('show')) {
      const bx = clamp(hc.x, 110, innerWidth - 110);
      this.bubble.style.left = bx + 'px';
      this.bubble.style.top = Math.max(46, hc.y - r - 14) + 'px';
      this.bubble.style.setProperty('--tail', `${clamp(hc.x - bx, -80, 80)}px`);
    }
  }
}
