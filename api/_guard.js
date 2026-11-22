// Shared protection + fal call for the paid AI endpoints (/api/meme, /api/pfp).
//   1. kill switch + config check
//   2. same-origin only
//   3. Vercel BotID (invisible bot check; see vercel.json + initBotId in the browser)
//   4. body size limit, JSON only, honeypot
//   5. per-IP hourly/daily limits + global daily cap (Upstash Redis if configured)
// Both endpoints share the same counters, so the limits cover memes + PFPs together.
import { checkBotId } from 'botid/server';

export const MODEL = process.env.MEME_MODEL || 'fal-ai/nano-banana/edit';
export const PER_HOUR = Number(process.env.MEME_PER_HOUR || 10);
export const PER_DAY = Number(process.env.MEME_PER_DAY || 30);
export const DAILY_CAP = Number(process.env.MEME_DAILY_CAP || 150);
export const SITE = 'https://www.testiclesalwaysbounce.fun';
export const REF_BASE = (process.env.MEME_REF_BASE || `${SITE}/meme/`).replace(/\/?$/, '/');
const ALLOWED_HOSTS = ['www.testiclesalwaysbounce.fun', 'testiclesalwaysbounce.fun', 'localhost', '127.0.0.1'];

export const json = (body, status = 200, headers = {}) =>
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
export async function refund(keys) {
  try {
    if (REDIS_URL && REDIS_TOKEN) await redis(keys.map(([k]) => ['DECR', k]));
    else keys.forEach(([k]) => { const e = mem.get(k); if (e) e.v = Math.max(0, e.v - 1); });
  } catch { /* best effort */ }
}
function clientIp(request) {
  const xf = request.headers.get('x-forwarded-for') || '';
  return (xf.split(',')[0] || request.headers.get('x-real-ip') || 'unknown').trim().slice(0, 64);
}

/* ------------------------------- request gate ------------------------------- */
// returns { error: Response } or { body, ip }
export async function gate(request, { maxBody = 2000 } = {}) {
  if (process.env.MEME_DISABLED === '1') return { error: json({ error: 'The meme machine is taking a nap. Try again later.' }, 503) };
  if (!process.env.FAL_KEY) return { error: json({ error: 'Meme machine is not configured yet.' }, 503) };

  const origin = request.headers.get('origin');
  let host = '';
  try { host = origin ? new URL(origin).hostname : ''; } catch { host = ''; }
  const okHost = ALLOWED_HOSTS.includes(host) || host === (process.env.VERCEL_URL || '-') || host === (process.env.VERCEL_BRANCH_URL || '-');
  if (!host || !okHost) return { error: json({ error: 'Forbidden' }, 403) };

  try {
    const verdict = await checkBotId({ advancedOptions: { headers: Object.fromEntries(request.headers) } });
    if (verdict.isBot) return { error: json({ error: 'Bots are not allowed to make memes. Sorry, robot.' }, 403) };
  } catch {
    return { error: json({ error: 'Could not verify your browser. Reload the page and try again.' }, 403) };
  }

  const len = Number(request.headers.get('content-length') || 0);
  if (len > maxBody) return { error: json({ error: 'That file is too big.' }, 413) };
  let body;
  try {
    const raw = await request.text();
    if (raw.length > maxBody) return { error: json({ error: 'That file is too big.' }, 413) };
    body = JSON.parse(raw);
  } catch { return { error: json({ error: 'Bad request' }, 400) }; }
  if (!body || typeof body !== 'object' || body.website) return { error: json({ error: 'Bad request' }, 400) };
  return { body, ip: clientIp(request) };
}

// returns { error: Response } or { keys, left }
export async function takeQuota(ip) {
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  const keys = [[`meme:ip:${ip}:h:${hour}`, 3600], [`meme:ip:${ip}:d:${day}`, 86400], [`meme:all:d:${day}`, 86400]];
  let counts;
  try { counts = await bump(keys); } catch { return { error: json({ error: 'Busy, try again in a minute.' }, 503) }; }
  const [h, d, all] = counts;
  if (h > PER_HOUR || d > PER_DAY || all > DAILY_CAP) {
    await refund(keys);
    const msg = all > DAILY_CAP ? 'The meme machine hit its daily limit. Come back tomorrow!' : d > PER_DAY ? `Daily limit reached (${PER_DAY}/day). Come back tomorrow!` : `Slow down! Max ${PER_HOUR} per hour.`;
    return { error: json({ error: msg }, 429, { 'retry-after': all > DAILY_CAP || d > PER_DAY ? '3600' : '600' }) };
  }
  return { keys, left: { hour: Math.max(0, PER_HOUR - h), day: Math.max(0, PER_DAY - d) } };
}

/* --------------------------------- fal call --------------------------------- */
// returns { image } or { error: Response }; refunds the quota on failure
export async function generate(input, keys, { privateIO = false, model = MODEL } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 55000);
  try {
    const headers = { authorization: `Key ${process.env.FAL_KEY}`, 'content-type': 'application/json' };
    if (privateIO) headers['x-fal-store-io'] = '0'; // keep the uploaded photo out of fal's request history
    const r = await fetch(`https://fal.run/${model}`, {
      method: 'POST',
      signal: ctrl.signal,
      headers,
      body: JSON.stringify({ num_images: 1, output_format: 'jpeg', safety_tolerance: '2', sync_mode: true, ...input }),
    });
    const data = await r.json().catch(() => ({}));
    const img = data?.images?.[0]?.url;
    if (!r.ok || !img) {
      await refund(keys);
      const txt = JSON.stringify(data).toLowerCase();
      const unsafe = txt.includes('safety') || txt.includes('nsfw') || txt.includes('content policy');
      return { error: json({ error: unsafe ? 'That one got blocked by the safety filter. Try a different one.' : 'The machine jammed. Try again.' }, unsafe ? 422 : 502) };
    }
    return { image: img };
  } catch (e) {
    await refund(keys);
    return { error: json({ error: e?.name === 'AbortError' ? 'That took too long. Try again.' : 'The machine jammed. Try again.' }, 504) };
  } finally {
    clearTimeout(timer);
  }
}
