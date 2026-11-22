// POST /api/meme — AI meme (fal.ai nano banana). Protection lives in ./_guard.js.
// Env: FAL_KEY (required), UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN (recommended),
//      MEME_PER_HOUR (10) MEME_PER_DAY (30) MEME_DAILY_CAP (150) MEME_DISABLED, MEME_MODEL, MEME_REF_BASE
import { STYLES, MODES, MODE_IDS, LOGO_REF, buildPrompt, isBlocked } from './_styles.js';
import { gate, takeQuota, generate, json, REF_BASE } from './_guard.js';

export async function POST(request) {
  const g = await gate(request, { maxBody: 2000 });
  if (g.error) return g.error;
  const { body, ip } = g;

  const style = STYLES[body.style];
  if (!style) return json({ error: 'Unknown style' }, 400);
  const mode = !body.mode || body.mode === 'auto' ? MODE_IDS[Math.floor(Math.random() * MODE_IDS.length)] : body.mode;
  if (!MODES[mode]) return json({ error: 'Unknown mode' }, 400);
  let scene = String(body.scene || '').replace(/[\u0000-\u001f\u007f<>{}]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 160);
  if (!scene) scene = style.ideas[Math.floor(Math.random() * style.ideas.length)];
  if (isBlocked(scene)) return json({ error: 'Keep it funny and safe for work, please. Try another idea.' }, 422);

  const q = await takeQuota(ip);
  if (q.error) return q.error;

  // mode reference first, the exact logo pair last
  const refs = [MODES[mode].ref, LOGO_REF].filter(Boolean).map((f) => REF_BASE + f);
  const out = await generate({ prompt: buildPrompt(body.style, mode, scene), image_urls: refs, aspect_ratio: style.aspect }, q.keys);
  if (out.error) return out.error;
  return json({ image: out.image, scene, style: body.style, mode, left: q.left });
}

export function GET() {
  return json({
    styles: Object.fromEntries(Object.entries(STYLES).map(([k, v]) => [k, { label: v.label, ideas: v.ideas }])),
    modes: Object.fromEntries(Object.entries(MODES).map(([k, v]) => [k, v.label])),
  });
}
