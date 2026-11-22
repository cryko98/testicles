// Tiny WebAudio synth: every sound on the site is generated, nothing to download.
let ctx = null;
let master = null;
let enabled = false;
const listeners = new Set();

function ensure() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const sound = {
  get enabled() { return enabled; },
  toggle(force) {
    enabled = typeof force === 'boolean' ? force : !enabled;
    if (enabled) ensure();
    listeners.forEach((fn) => fn(enabled));
    if (enabled) this.boing(1.1);
    return enabled;
  },
  onChange(fn) { listeners.add(fn); },

  // cartoon "boing": sine with a falling-then-rising pitch and vibrato
  boing(pitch = 1, vol = 1) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoG = ctx.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(180 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(520 * pitch, t + 0.09);
    o.frequency.exponentialRampToValueAtTime(260 * pitch, t + 0.35);
    lfo.frequency.value = 22;
    lfoG.gain.value = 30 * pitch;
    lfo.connect(lfoG).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5 * vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    o.connect(g).connect(master);
    o.start(t); lfo.start(t);
    o.stop(t + 0.45); lfo.stop(t + 0.45);
  },

  pop(pitch = 1, vol = 1) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(900 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(220 * pitch, t + 0.08);
    g.gain.setValueAtTime(0.4 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.12);
  },

  squeak(pitch = 1) {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(1200 * pitch, t);
    o.frequency.exponentialRampToValueAtTime(1800 * pitch, t + 0.06);
    o.frequency.exponentialRampToValueAtTime(1300 * pitch, t + 0.12);
    g.gain.setValueAtTime(0.08, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + 0.15);
  },

  // tiny "voice" blips for speech bubbles
  blab(pitch = 1, n = 4) {
    if (!enabled || !ensure()) return;
    for (let i = 0; i < n; i++) {
      const t = ctx.currentTime + i * 0.065;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'square';
      o.frequency.value = (380 + Math.random() * 220) * pitch;
      g.gain.setValueAtTime(0.05, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.06);
    }
  },

  crack() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const len = 0.25;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 1800;
    const g = ctx.createGain(); g.gain.value = 0.5;
    s.buffer = buf;
    s.connect(f).connect(g).connect(master);
    s.start(t);
  },

  whoosh() {
    if (!enabled || !ensure()) return;
    const t = ctx.currentTime;
    const len = 0.4;
    const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI);
    const s = ctx.createBufferSource();
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(400, t);
    f.frequency.exponentialRampToValueAtTime(2400, t + len);
    const g = ctx.createGain(); g.gain.value = 0.35;
    s.buffer = buf;
    s.connect(f).connect(g).connect(master);
    s.start(t);
  },

  chime() {
    if (!enabled || !ensure()) return;
    [660, 880, 1320].forEach((fr, i) => {
      const t = ctx.currentTime + i * 0.08;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = fr;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(master);
      o.start(t); o.stop(t + 0.55);
    });
  },
};
