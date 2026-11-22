// The Bounce Lab: a Matter.js sandbox full of specimens rendered from the traced paths.
import Matter from 'matter-js';
import { charPaths, silhouettePoints, convexHull, CHAR_YELLOW } from './character.js';
import { sound } from './sound.js';

const { Engine, Bodies, Body, Composite, Mouse, MouseConstraint, Events, Vertices } = Matter;
const INK = '#181613';

export function initLab(box, { onCount } = {}) {
  const canvas = box.querySelector('.lab-canvas');
  const ctx = canvas.getContext('2d');
  const paths = [charPaths(0), charPaths(1)];
  const hulls = [0, 1].map((i) => {
    const hull = convexHull(silhouettePoints(i, 64));
    const c = Vertices.centre(hull);
    return { hull, c };
  });

  const engine = Engine.create({ gravity: { x: 0, y: 1.1 } });
  engine.positionIterations = 8;
  engine.velocityIterations = 6;
  let W = 0, H = 0, dpr = 1;
  let walls = [];
  const specimens = [];
  let running = false;
  let raf = 0;
  let flipped = false;

  function size() {
    const r = box.getBoundingClientRect();
    W = r.width; H = r.height;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    if (mc) mc.mouse.pixelRatio = dpr;
    Composite.remove(engine.world, walls);
    const t = 200;
    walls = [
      Bodies.rectangle(W / 2, H + t / 2, W * 3, t, { isStatic: true }),
      Bodies.rectangle(W / 2, -t / 2, W * 3, t, { isStatic: true }),
      Bodies.rectangle(-t / 2, H / 2, t, H * 3, { isStatic: true }),
      Bodies.rectangle(W + t / 2, H / 2, t, H * 3, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
    specimens.forEach((b) => {
      if (b.position.x > W || b.position.y > H) Body.setPosition(b, { x: Math.min(b.position.x, W - 40), y: Math.min(b.position.y, H - 40) });
    });
  }

  function scaleFor() {
    return Math.max(0.24, Math.min(0.5, W / 2200));
  }

  function spawn(x = Math.random() * W * 0.8 + W * 0.1, y = -40, idx = Math.random() < 0.5 ? 0 : 1) {
    if (specimens.length >= 90) {
      const old = specimens.shift();
      Composite.remove(engine.world, old);
    }
    const s = scaleFor() * (0.75 + Math.random() * 0.5);
    const { hull, c } = hulls[idx];
    const verts = hull.map((p) => ({ x: (p.x - c.x) * s, y: (p.y - c.y) * s }));
    const b = Bodies.fromVertices(x, Math.max(y, 60 * s), [verts], {
      restitution: 0.82, friction: 0.08, frictionAir: 0.004, density: 0.0016,
    });
    b.plugin = { idx, s, c, blinkAt: performance.now() + 1000 + Math.random() * 4000, blinkUntil: 0, born: performance.now() };
    Body.setAngle(b, (Math.random() - 0.5) * 0.8);
    Body.setVelocity(b, { x: (Math.random() - 0.5) * 6, y: 2 });
    Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.15);
    Composite.add(engine.world, b);
    specimens.push(b);
    onCount?.(specimens.length);
    box.classList.add('has-specimens');
    sound.pop(1 + Math.random() * 0.5, 0.5);
    return b;
  }

  // mouse drag (desktop); on touch we only tap-to-spawn so page scroll keeps working
  const fine = matchMedia('(pointer: fine)').matches;
  let mc = null;
  if (fine) {
    const mouse = Mouse.create(canvas);
    mouse.pixelRatio = dpr;
    // let the page scroll over the canvas
    canvas.removeEventListener('mousewheel', mouse.mousewheel);
    canvas.removeEventListener('DOMMouseScroll', mouse.mousewheel);
    canvas.removeEventListener('wheel', mouse.mousewheel);
    mc = MouseConstraint.create(engine, { mouse, constraint: { stiffness: 0.25, damping: 0.1, render: { visible: false } } });
    Composite.add(engine.world, mc);
    Events.on(mc, 'startdrag', () => { sound.squeak(1 + Math.random() * 0.3); canvas.style.cursor = 'grabbing'; });
    Events.on(mc, 'enddrag', () => { canvas.style.cursor = ''; });
  }

  let downAt = null;
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now(), onBody: !!(mc && mc.body) }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = Matter.Query.point(specimens, { x, y });
    if (moved < 6 && !hit.length) spawn(x, y);
    else if (moved < 6 && hit.length) {
      const b = hit[0];
      Body.setVelocity(b, { x: b.velocity.x, y: -14 });
      Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.4);
      b.plugin.blinkUntil = performance.now() + 300;
      sound.boing(1 + Math.random() * 0.4, 0.6);
    }
    downAt = null;
  });

  let lastSnd = 0;
  Events.on(engine, 'collisionStart', (ev) => {
    const now = performance.now();
    if (now - lastSnd < 70) return;
    for (const pair of ev.pairs) {
      const a = pair.bodyA, b = pair.bodyB;
      const rel = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y);
      if (rel > 7) {
        sound.boing(0.8 + Math.random() * 0.8, Math.min(0.5, rel / 40));
        lastSnd = now;
        [a, b].forEach((x) => x.plugin && (x.plugin.blinkUntil = now + 220));
        break;
      }
    }
  });

  function draw() {
    const now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    for (const b of specimens) {
      const { idx, s, c } = b.plugin;
      const p = paths[idx];
      if (now > b.plugin.blinkAt) { b.plugin.blinkUntil = now + 140; b.plugin.blinkAt = now + 1500 + Math.random() * 4500; }
      const open = now < b.plugin.blinkUntil ? 0.12 : 1;
      const speed = Math.hypot(b.velocity.x, b.velocity.y);
      const st = Math.min(0.18, speed / 90);
      ctx.save();
      ctx.translate(b.position.x, b.position.y);
      ctx.rotate(b.angle);
      ctx.scale(s * (1 - st * 0.4), s * (1 + st * 0.4));
      ctx.translate(-c.x, -c.y);
      ctx.fillStyle = INK;
      ctx.fill(p.sil);
      ctx.fillStyle = CHAR_YELLOW;
      ctx.fill(p.ring, 'evenodd');
      // eyes look along velocity
      const lx = Math.max(-10, Math.min(10, b.velocity.x * 1.5));
      const ly = Math.max(-8, Math.min(8, b.velocity.y * 1.5));
      for (const e of p.eyes) {
        ctx.save();
        ctx.translate(e.cx + lx, e.cy + ly);
        ctx.scale(1, open);
        ctx.translate(-e.cx, -e.cy);
        ctx.fill(e.p);
        ctx.restore();
      }
      ctx.restore();
    }
  }

  let last = performance.now();
  function loop(now) {
    const dt = Math.min(33, now - last);
    last = now;
    Engine.update(engine, dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  size();
  window.addEventListener('resize', size);

  return {
    spawn,
    play() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
    rain(n = 10) { for (let i = 0; i < n; i++) setTimeout(() => spawn(), i * 70); },
    flip() {
      flipped = !flipped;
      engine.gravity.y = flipped ? -1.1 : 1.1;
      sound.whoosh();
      specimens.forEach((b) => Body.setAngularVelocity(b, (Math.random() - 0.5) * 0.3));
      return flipped;
    },
    shake() {
      sound.whoosh();
      specimens.forEach((b) => Body.setVelocity(b, { x: (Math.random() - 0.5) * 30, y: -Math.random() * 25 * (flipped ? -1 : 1) }));
    },
    clear() {
      specimens.splice(0).forEach((b) => Composite.remove(engine.world, b));
      onCount?.(0);
      box.classList.remove('has-specimens');
      sound.pop(0.6);
    },
    get count() { return specimens.length; },
  };
}
