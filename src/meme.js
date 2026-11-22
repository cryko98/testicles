// Meme Machine: AI image generator (fal.ai nano banana, via /api/meme).
// The two logo characters are in every image: as heads, between the stickman's legs, or on their own.
import { sound } from './sound.js';

const STYLES = [
  { id: 'stickman', label: 'Stickman' },
  { id: 'irl', label: 'Doodle IRL' },
  { id: 'gta-cover', label: 'GTA cover' },
  { id: 'gta-game', label: 'GTA gameplay' },
  { id: 'vintage', label: 'Vintage photo' },
  { id: 'renaissance', label: 'Renaissance' },
];
const MODES = [
  { id: 'auto', label: '🎲 Surprise me' },
  { id: 'heads', label: 'As heads' },
  { id: 'stick', label: "Stickman's boys" },
  { id: 'solo', label: 'Just the two' },
];
const IDEAS = {
  stickman: ['doing a synchronized trampoline backflip', 'fighting a giant red chart candle with tiny swords', 'riding a rocket that is just a firework'],
  irl: ["bouncing on a trampoline at a kid's birthday party while a magician looks confused", 'photobombing a serious business meeting', 'in a busy gym doing a bench press'],
  'gta-cover': ['leaning on a vintage muscle car on the beach avenue at sunset', 'on a speedboat with the neon skyline behind'],
  'gta-game': ['escaping the police in a shopping cart holding a loaf of bread', 'stealing an ice cream truck while the music still plays'],
  vintage: ['panicking on top of a rocket launch tower while engineers watch', 'at a 1960s mission control desk pressing all the buttons'],
  renaissance: ['at a long supper table passing a secret note while everyone gasps', 'reaching toward each other on clouds holding smartphones'],
};
const LOADING = ['drawing the boys…', 'sharpening the yellow marker…', 'asking the bear for permission…', 'adding extra bounce…', 'making it plural…', 'almost there…'];

function chips(container, items, onPick) {
  container.innerHTML = items.map((s) => `<button type="button" class="meme-chip" role="radio" aria-checked="false" data-id="${s.id}">${s.label}</button>`).join('');
  container.addEventListener('click', (e) => {
    const b = e.target.closest('.meme-chip');
    if (!b) return;
    onPick(b.dataset.id);
    sound.pop(1 + Math.random() * 0.3, 0.4);
  });
  return (id) => container.querySelectorAll('.meme-chip').forEach((b) => { const on = b.dataset.id === id; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
}

export function initMeme(root, { toast, pets } = {}) {
  const scene = root.querySelector('.meme-scene');
  const count = root.querySelector('.meme-count');
  const dice = root.querySelector('.meme-dice');
  const hp = root.querySelector('.meme-hp');
  const go = root.querySelector('.meme-go');
  const stage = root.querySelector('.meme-stage');
  const out = root.querySelector('.meme-img');
  const loading = root.querySelector('.meme-loading');
  const loadingText = loading.querySelector('p');
  const actions = root.querySelector('.meme-actions');
  const status = root.querySelector('.meme-status');
  const shelf = root.querySelector('.meme-shelf');
  let style = 'irl', mode = 'auto', current = null, busy = false, cooldownUntil = 0;
  const made = [];

  const markStyle = chips(root.querySelector('.meme-styles'), STYLES, (id) => { style = id; markStyle(id); scene.placeholder = 'e.g. ' + IDEAS[id][0]; });
  const markMode = chips(root.querySelector('.meme-modes'), MODES, (id) => { mode = id; markMode(id); });
  markStyle(style); markMode(mode);
  scene.placeholder = 'e.g. ' + IDEAS[style][0];

  scene.addEventListener('input', () => { count.textContent = `${scene.value.length}/160`; });
  dice.addEventListener('click', () => {
    const list = IDEAS[style];
    let next = list[Math.floor(Math.random() * list.length)];
    if (next === scene.value && list.length > 1) next = list[(list.indexOf(next) + 1) % list.length];
    scene.value = next;
    count.textContent = `${scene.value.length}/160`;
    dice.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(360deg)' }], { duration: 450, easing: 'cubic-bezier(.3,1.4,.5,1)' });
    sound.boing(1.3, 0.3);
  });

  function show(item) {
    current = item;
    out.src = item.image;
    out.alt = `${item.styleLabel} meme: ${item.scene}`;
    stage.classList.add('has-image');
    actions.hidden = false;
    out.animate([{ transform: 'scale(.92) rotate(-2deg)', opacity: 0 }, { transform: 'scale(1.02) rotate(.6deg)', opacity: 1 }, { transform: 'none', opacity: 1 }], { duration: 600, easing: 'cubic-bezier(.3,1.5,.5,1)' });
  }
  function addToShelf(item) {
    made.unshift(item);
    made.splice(6);
    shelf.innerHTML = made.map((m, i) => `<button type="button" data-i="${i}" aria-label="Show meme ${i + 1}"><img src="${m.image}" alt="" /></button>`).join('');
  }
  shelf.addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) show(made[Number(b.dataset.i)]); });

  // shared request runner for both generators
  async function run(endpoint, payload, button, toItem) {
    if (busy) return;
    if (Date.now() < cooldownUntil) { status.textContent = 'Give it a few seconds…'; return; }
    busy = true; button.disabled = true; status.textContent = '';
    loading.hidden = false; stage.classList.add('busy');
    let li = 0;
    loadingText.textContent = LOADING[0];
    const ticker = setInterval(() => { li = (li + 1) % LOADING.length; loadingText.textContent = LOADING[li]; }, 2200);
    sound.whoosh();
    try {
      const r = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, website: hp.value }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.image) throw new Error(data.error || (r.status === 404 ? 'The meme machine only runs on the live site.' : r.status === 413 ? 'That photo is too big.' : 'Something went wrong. Try again.'));
      const item = toItem(data);
      show(item);
      addToShelf(item);
      status.textContent = data.left ? `${data.left.hour} more this hour · ${data.left.day} left today` : '';
      sound.chime();
      pets?.forEach((p) => !p.dragging && p.say?.(['nailed it.', 'that is us!', 'frame it.', 'new pfp?'][Math.floor(Math.random() * 4)], 1800));
      return data;
    } catch (e) {
      status.textContent = e.message;
      sound.squeak(0.6);
      toast?.(e.message);
    } finally {
      clearInterval(ticker);
      loading.hidden = true; stage.classList.remove('busy');
      busy = false;
      cooldownUntil = Date.now() + 6000;
      setTimeout(() => (button.disabled = false), 1500);
    }
  }

  async function generate() {
    const data = await run('/api/meme', { style, mode, scene: scene.value.trim() }, go,
      (d) => ({ image: d.image, scene: d.scene || scene.value, style, styleLabel: STYLES.find((s) => s.id === style).label }));
    if (data && !scene.value.trim() && data.scene) { scene.value = data.scene; count.textContent = `${scene.value.length}/160`; }
  }
  go.addEventListener('click', generate);
  scene.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); } });

  // ---------- tabs ----------
  let tab = 'meme';
  const panels = { meme: root.querySelector('.meme-panel'), pfp: root.querySelector('.pfp-panel') };
  root.querySelectorAll('.meme-tab').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    root.querySelectorAll('.meme-tab').forEach((x) => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); });
    panels.meme.hidden = tab !== 'meme';
    panels.pfp.hidden = tab !== 'pfp';
    sound.pop(1.1, 0.4);
  }));

  // ---------- blob-head PFP ----------
  const drop = root.querySelector('.pfp-drop');
  const file = root.querySelector('.pfp-file');
  const thumb = root.querySelector('.pfp-thumb');
  const ok = root.querySelector('.pfp-ok');
  const pfpGo = root.querySelector('.pfp-go');
  let photo = null; // resized JPEG data URL

  // shrink to max 1024px JPEG in the browser: small upload, EXIF orientation applied
  async function prepare(f) {
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) throw new Error('Please use a JPG, PNG or WEBP photo.');
    if (f.size > 25 * 1024 * 1024) throw new Error('That photo is huge. Try one under 25 MB.');
    const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' }).catch(() => null);
    const src = bmp || await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not read that image.')); im.src = URL.createObjectURL(f); });
    const w0 = src.width || src.naturalWidth, h0 = src.height || src.naturalHeight;
    const s = Math.min(1, 1024 / Math.max(w0, h0));
    const c = document.createElement('canvas');
    c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
    const cx = c.getContext('2d');
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height);
    cx.drawImage(src, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.88);
  }
  async function pick(f) {
    if (!f) return;
    try {
      photo = await prepare(f);
      thumb.src = photo; thumb.hidden = false;
      drop.classList.add('has-photo');
      status.textContent = '';
      sound.pop(1.2, 0.5);
    } catch (e) { status.textContent = e.message; photo = null; }
  }
  file.addEventListener('change', () => pick(file.files[0]));
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('drag'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('drag'); }));
  drop.addEventListener('drop', (e) => pick(e.dataTransfer.files[0]));

  async function makePfp() {
    if (!photo) { status.textContent = 'Upload a photo first.'; return; }
    if (!ok.checked) { status.textContent = 'Please confirm you have the right to use this photo.'; ok.focus(); return; }
    await run('/api/pfp', { image: photo, consent: true }, pfpGo, (d) => ({ image: d.image, scene: 'blob-head PFP', style: 'pfp', styleLabel: 'Blob-head PFP' }));
  }
  pfpGo.addEventListener('click', makePfp);
  root.querySelector('.meme-again').addEventListener('click', () => (tab === 'pfp' ? makePfp() : generate()));

  root.querySelector('.meme-download').addEventListener('click', () => {
    if (!current) return;
    const a = document.createElement('a');
    a.href = current.image;
    a.download = `testicles-${current.style === 'pfp' ? 'pfp' : 'meme-' + current.style}-${Date.now()}.jpg`;
    document.body.appendChild(a); a.click(); a.remove();
    sound.chime();
  });
  root.querySelector('.meme-share').href = `https://x.com/intent/tweet?text=${encodeURIComponent('made a $TESTICLES meme with the Meme Machine. they always bounce.')}&url=${encodeURIComponent('https://www.testiclesalwaysbounce.fun/#meme')}`;
}
