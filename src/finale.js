// Jelly typography: every finale letter hangs on springs (Matter.js constraints).
// Grab one, fling it, it wobbles back home. Scroll speed jostles them too.
import Matter from 'matter-js';
import { sound } from './sound.js';

const { Engine, Bodies, Body, Composite, Constraint, Query } = Matter;

export function initFinale(title, chars) {
  const engine = Engine.create({ gravity: { x: 0, y: 0 } });
  const fine = matchMedia('(pointer: fine)').matches;
  let items = [];
  let running = false, raf = 0, last = 0;

  function build() {
    Composite.clear(engine.world, false);
    chars.forEach((c) => (c.style.transform = ''));
    const base = title.getBoundingClientRect();
    items = chars.map((el) => {
      const r = el.getBoundingClientRect();
      const cx = r.left - base.left + r.width / 2;
      const cy = r.top - base.top + r.height / 2;
      const w = Math.max(8, r.width * 0.9), h = r.height * 0.62;
      const body = Bodies.rectangle(cx, cy, w, h, { frictionAir: 0.022, collisionFilter: { group: -1 }, density: 0.002 });
      const k = h * 0.35;
      const c1 = Constraint.create({ pointA: { x: cx, y: cy + k }, bodyB: body, pointB: { x: 0, y: k }, stiffness: 0.009, damping: 0.03, length: 0 });
      const c2 = Constraint.create({ pointA: { x: cx, y: cy - k }, bodyB: body, pointB: { x: 0, y: -k }, stiffness: 0.009, damping: 0.03, length: 0 });
      Composite.add(engine.world, [body, c1, c2]);
      return { el, body, cx, cy };
    });
  }

  // grab & fling with our own pointer handling (client coords, scroll-proof)
  let grab = null;
  const local = (e) => { const r = title.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const hitAt = (p) => {
    const b = Query.point(items.map((i) => i.body), p)[0];
    return items.find((i) => i.body === b);
  };
  title.addEventListener('pointerdown', (e) => {
    const p = local(e);
    const it = hitAt(p);
    if (!it) return;
    if (!fine) { kick(it, 1.4); sound.boing(1 + Math.random() * 0.5, 0.5); return; }
    e.preventDefault();
    title.setPointerCapture(e.pointerId);
    const b = it.body;
    const off = Matter.Vector.rotate({ x: p.x - b.position.x, y: p.y - b.position.y }, -b.angle);
    const c = Constraint.create({ pointA: p, bodyB: b, pointB: off, stiffness: 0.2, damping: 0.1, length: 0 });
    Composite.add(engine.world, c);
    grab = { c, id: e.pointerId };
    title.classList.add('dragging');
    sound.squeak(1 + Math.random() * 0.4);
  });
  title.addEventListener('pointermove', (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    grab.c.pointA = local(e);
  });
  const release = (e) => {
    if (!grab || e.pointerId !== grab.id) return;
    Composite.remove(engine.world, grab.c);
    grab = null;
    title.classList.remove('dragging');
    sound.boing(0.8 + Math.random() * 0.5, 0.5);
  };
  title.addEventListener('pointerup', release);
  title.addEventListener('pointercancel', release);

  // entrance: letters start scattered above and spring into place
  function scatter(power = 1) {
    items.forEach((it, i) => {
      Body.setPosition(it.body, { x: it.cx + (Math.random() - 0.5) * 300 * power, y: it.cy - (200 + Math.random() * 300) * power });
      Body.setAngle(it.body, (Math.random() - 0.5) * 2.4 * power);
      Body.setVelocity(it.body, { x: 0, y: 0 });
    });
  }

  function kick(it, f = 1) {
    Body.setVelocity(it.body, { x: (Math.random() - 0.5) * 8 * f, y: -(10 + Math.random() * 8) * f });
    Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.4 * f);
  }

  function wave() {
    items.forEach((it, i) => setTimeout(() => kick(it, 0.55), i * 35));
  }

  // hovering a letter nudges it
  chars.forEach((el, i) => el.addEventListener('pointerenter', () => {
    if (grab) return;
    const it = items[i];
    if (it) { Body.setVelocity(it.body, { x: it.body.velocity.x, y: it.body.velocity.y - 6 }); Body.setAngularVelocity(it.body, (Math.random() - 0.5) * 0.25); }
  }));

  function render() {
    for (const it of items) {
      const dx = it.body.position.x - it.cx, dy = it.body.position.y - it.cy;
      it.el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px) rotate(${it.body.angle.toFixed(3)}rad)`;
    }
  }

  function loop(now) {
    const dt = Math.min(33, now - last);
    last = now;
    Engine.update(engine, dt);
    render();
    raf = requestAnimationFrame(loop);
  }

  build();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 200); });

  return {
    play() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(loop); },
    pause() { running = false; cancelAnimationFrame(raf); },
    scatter, wave,
    jostle(v) {
      if (!running || Math.abs(v) < 18) return;
      items.forEach((it) => { if (Math.random() < 0.25) Body.setVelocity(it.body, { x: it.body.velocity.x + (Math.random() - 0.5) * 2, y: it.body.velocity.y + v * 0.08 }); });
    },
    rebuild: build,
    get _dbg() { return { engine, items }; },
  };
}
