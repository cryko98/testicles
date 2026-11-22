// POST /api/meme — generates one meme image with fal.ai.
//
// Credit protection, in layers:
//   1. Vercel BotID (invisible bot check, see vercel.json + initBotId in the browser)
//   2. honeypot field + same-origin check
//   3. per-IP limits (hour + day) and a global daily cap
//      -> Upstash Redis when configured (recommended), in-memory fallback otherwise
//   4. fixed model / parameters: the browser can only choose a style id and a short scene text
//   5. content filter + strict model safety setting
//   6. kill switch: MEME_DISABLED=1
//
// Env (set in Vercel → Project → Settings → Environment Variables):
//   FAL_KEY                       required  fal.ai API key
//   UPSTASH_REDIS_REST_URL/TOKEN  optional  (or KV_REST_API_URL/TOKEN from the Vercel marketplace)
//   MEME_PER_HOUR (3) MEME_PER_DAY (10) MEME_DAILY_CAP (150) MEME_DISABLED (unset)
//   MEME_MODEL (fal-ai/nano-banana/edit)  MEME_REF_BASE (defaults to <site>/meme/)
import { checkBotId } from 'botid/server';
import { STYLES, MODES, MODE_IDS, LOGO_REF, buildPrompt, isBlocked } from './_styles.js';

const MODEL = process.env.MEME_MODEL || 'fal-ai/nano-banana/edit';
const PER_HOUR = Number(process.env.MEME_PER_HOUR || 3);
const PER_DAY = Number(process.env.MEME_PER_DAY || 10);
const DAILY_CAP = Number(process.env.MEME_DAILY_CAP || 150);
const SITE = 'https://www.testiclesalwaysbounce.fun';
const ALLOWED_HOSTS = ['www.testiclesalwaysbounce.fun', 'testiclesalwaysbounce.fun', 'localhost', '127.0.0.1'];

const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

/* ------------------------------ rate limiting ------------------------------ */
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const mem = globalThis.__memeLimits || (globalThis.__memeLimits = new Map());

async function redis(cmds) {
  const r = await fetch(`${REDIS_URL}/pipeline`, {
    method: 'POST',
    headers: { authorization: `Bearer ${REDIS_TOKEN}`, 'content-type': 'application/json' },
    body: JSON.stringify(cmds),
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  return (await r.json()).map((x) => x.result);
}

async function bump(keys) {
  // keys: [[key, ttlSeconds], ...] -> returns the new counts
  if (REDIS_URL && REDIS_TOKEN) {
    const cmds = keys.flatMap(([k, ttl]) => [['SET', k, '0', 'EX', String(ttl), 'NX'], ['INCR', k]]);
    const res = await redis(cmds);
    return keys.map((_, i) => Number(res[i * 2 + 1]));
  }
  const now = Date.now();
  return keys.map(([k, ttl]) => {
    const e = mem.get(k);
    const v = e && e.exp > now ? e.v + 1 : 1;
    mem.set(k, { v, exp: e && e.exp > now ? e.exp : now + ttl * 1000 });
    return v;
  });
}
async function unbump(keys) {
  try {
    if (REDIS_URL && REDIS_TOKEN) await redis(keys.map(([k]) => ['DECR', k]));
    else keys.forEach(([k]) => { const e = mem.get(k); if (e) e.v = Math.max(0, e.v - 1); });
  } catch { /* best effort */ }
}

function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for') || '';
  return (xf.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64);
}

/* --------------------------------- handler --------------------------------- */
export async function POST(request) {
  if (process.env.MEME_DISABLED === '1') return json({ error: 'The meme machine is taking a nap. Try again later.' }, 503);
  if (!process.env.FAL_KEY) return json({ error: 'Meme machine is not configured yet.' }, 503);

  // same-origin only (browsers always send Origin on POST)
  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).hostname : ''; } catch { host = ''; }
  const vercelHost = process.env.VERCEL_URL || '';
  const branchHost = process.env.VERCEL_BRANCH_URL || '';
  if (!host || !(ALLOWED_HOSTS.includes(host) || host === vercelHost || host === branchHost)) {
    return json({ error: 'Forbidden' }, 403);
  }

  // invisible bot check
  try {
    const verdict = await checkBotId({ advancedOptions: { headers: Object.fromEntries(request.headers) } });
    if (verdict.isBot) return json({ error: 'Bots are not allowed to make memes. Sorry, robot.' }, 403);
  } catch (e) {
    return json({ error: 'Could not verify your browser. Reload the page and try again.' }, 403);
  }

  // body
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 2000) return json({ error: 'Request too large' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Bad request' }, 400); }
  if (body.website) return json({ error: 'Bad request' }, 400); // honeypot
  const style = STYLES[body.style];
  if (!style) return json({ error: 'Unknown style' }, 400);
  const mode = !body.mode || body.mode === 'auto' ? MODE_IDS[Math.floor(Math.random() * MODE_IDS.length)] : body.mode;
  if (!MODES[mode]) return json({ error: 'Unknown mode' }, 400);
  let scene = String(body.scene || '').replace(/[\u0000-\u001f\u007f<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!scene) scene = style.ideas[Math.floor(Math.random() * style.ideas.length)];
  if (isBlocked(scene)) return json({ error: 'Keep it funny and safe for work, please. Try another idea.' }, 422);

  // limits
  const ip = clientIp(request);
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  const keys = [[`meme:ip:${ip}:h:${hour}`, 3600], [`meme:ip:${ip}:d:${day}`, 86400], [`meme:all:d:${day}`, 86400]];
  let counts;
  try { counts = await bump(keys); } catch { return json({ error: 'Busy, try again in a minute.' }, 503); }
  const [h, d, all] = counts;
  if (h > PER_HOUR || d > PER_DAY || all > DAILY_CAP) {
    await unbump(keys);
    const msg = all > DAILY_CAP ? 'The meme machine hit its daily limit. Come back tomorrow!' : d > PER_DAY ? `Daily limit reached (${PER_DAY}/day). Come back tomorrow!` : `Slow down! Max ${PER_HOUR} memes per hour.`;
    return json({ error: msg }, 429, { 'retry-after': all > DAILY_CAP || d > PER_DAY ? '3600' : '600' });
  }

  // generate
  // mode reference first, the exact logo pair last
  const base = (process.env.MEME_REF_BASE || `${SITE}/meme/`).replace(/\/?$/, '/');
  const refs = [MODES[mode].ref, LOGO_REF].filter(Boolean).map((f) => base + f);
  const prompt = buildPrompt(body.style, mode, scene);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const r = await fetch(`https://fal.run/${MODEL}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        prompt,
        image_urls: refs,
        num_images: 1,
        aspect_ratio: style.aspect,
        output_format: 'jpeg',
        safety_tolerance: '2',
        sync_mode: true,
      }),
    });
    const data = await r.json().catch(() => ({}));
    const img = data?.images?.[0]?.url;
    if (!r.ok || !img) {
      await unbump(keys);
      const unsafe = JSON.stringify(data).toLowerCase().includes('safety') || JSON.stringify(data).toLowerCase().includes('nsfw');
      return json({ error: unsafe ? 'That one got blocked by the safety filter. Try a different idea.' : 'The meme machine jammed. Try again.' }, unsafe ? 422 : 502);
    }
    return json({ image: img, scene, style: body.style, mode, left: { hour: Math.max(0, PER_HOUR - h), day: Math.max(0, PER_DAY - d) } });
  } catch (e) {
    await unbump(keys);
    return json({ error: e?.name === 'AbortError' ? 'That took too long. Try again.' : 'The meme machine jammed. Try again.' }, 504);
  } finally {
    clearTimeout(timer);
  }
}

export function GET() {
  return json({
    styles: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, { label: v.label, ideas: v.ideas }])),
    modes: Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.label])),
  });
}
