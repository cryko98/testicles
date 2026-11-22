// POST /api/pfp — blob-head PFP: replaces the head in an uploaded photo with the logo blob.
// The photo is sent to fal as a data URI (never written to any storage by us) and with
// x-fal-store-io: 0 so it is not kept in fal's request history either.
// Same protection + shared limits as /api/meme (see ./_guard.js).
import { gate, takeQuota, generate, json, REF_BASE } from './_guard.js';

const MAX_BYTES = 2.5 * 1024 * 1024; // decoded image
const HEAD_REF = 'ref-head.png';

const PROMPT = `Edit the first image. Replace ONLY the head of the main subject (a person, an animal or a character) with ONE blob head based on the second image (the logo): a lumpy, irregular, slightly tilted potato-shaped black blob, NOT a circle, with a wobbly yellow outline (#E8B020) and two small yellow dot eyes, the right dot slightly taller. No mouth, no nose. Make it look like it was really there when the photo was taken: BIG and oversized: about 1.6 times wider than the original head, clearly bigger than a normal head and fully covering where the original head and hair were, sitting naturally on the neck, turned and tilted the same way the original head faced. It must match the photo exactly: same lighting direction, same soft shadow on the neck and collar, same focus and blur, same film grain, noise, color cast and JPEG softness, so it is not a clean sticker. Anything that was in front of the face (a hand, phone, cup, microphone, collar) stays in front of the blob. A hat or headwear stays on and sits snugly on top of the blob. Anything in the mouth (cigar, pipe, straw) keeps sticking out of the blob where the mouth was. Hair, ears, snout, beard and glasses are gone; for an animal the neck and body fur stay. Keep everything else exactly the same: body, clothes, hands, pose, background, framing and crop. Do not add text or change any existing text.`;

function checkImage(dataUri) {
  const m = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUri || '');
  if (!m) return 'Please upload a JPG, PNG or WEBP photo.';
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length < 2000) return 'That image looks empty.';
  if (bytes.length > MAX_BYTES) return 'That photo is too big. Try a smaller one.';
  // magic bytes must match the declared type
  const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  const isWebp = bytes.slice(0, 4).toString('latin1') === 'RIFF' && bytes.slice(8, 12).toString('latin1') === 'WEBP';
  if (!((m[1] === 'jpeg' && isJpeg) || (m[1] === 'png' && isPng) || (m[1] === 'webp' && isWebp))) return 'That file is not a real image.';
  return null;
}

export async function POST(request) {
  const g = await gate(request, { maxBody: 3_600_000 });
  if (g.error) return g.error;
  const { body, ip } = g;

  if (body.consent !== true) return json({ error: 'Please confirm you have the right to use this photo.' }, 400);
  const bad = checkImage(body.image);
  if (bad) return json({ error: bad }, 400);

  const q = await takeQuota(ip);
  if (q.error) return q.error;

  const out = await generate({ prompt: PROMPT, image_urls: [body.image, REF_BASE + HEAD_REF], aspect_ratio: 'auto' }, q.keys, { privateIO: true });
  if (out.error) return out.error;
  return json({ image: out.image, left: q.left });
}
