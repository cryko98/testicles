// POST /api/pfp — blob-head PFP: replaces the head in an uploaded photo with the logo blob.
// The photo is sent to fal as a data URI (never written to any storage by us) and with
// x-fal-store-io: 0 so it is not kept in fal's request history either.
// Same protection + shared limits as /api/meme (see ./_guard.js).
import { gate, takeQuota, generate, json, REF_BASE, MODEL } from './_guard.js';

// optional: PFP_MODEL=fal-ai/nano-banana-2/edit blends styles better (~$0.08/image instead of ~$0.04)
const PFP_MODEL = process.env.PFP_MODEL || MODEL;

const MAX_BYTES = 2.5 * 1024 * 1024; // decoded image
const HEAD_REF = 'ref-head.png';          // the logo (two heads)
const HEAD_CLOSEUP = 'ref-head-single.png'; // one head, exact traced outline, close-up

const PROMPT = `Edit the first image. Replace ONLY the head of the main subject (a person, an animal or a character) with ONE blob head based on the second image (the logo): a lumpy, irregular, slightly tilted potato-shaped black blob, NOT a circle, with a wobbly yellow outline (#E8B020) and two small yellow dot eyes, the right dot slightly taller. No mouth, no nose. Make it look like it was really there when the image was made: BIG and oversized: about 1.6 times wider than the original head, clearly bigger than a normal head and fully covering where the original head and hair were, sitting naturally on the neck, turned and tilted the same way the original head faced. Anything that was in front of the face (a hand, phone, cup, microphone, collar) stays in front of the blob. Anything in the mouth (cigar, pipe, straw) keeps sticking out of the blob where the mouth was. Hair, ears, snout and beard are gone; for an animal the neck and body fur stay.

KEEP EVERYTHING THE SUBJECT WEARS ON THE HEAD, refitted to the new blob head:
- Hats, caps, beanies, helmets, crowns, hoods, veils, bandanas, headbands, headphones and similar headwear stay on, in the same style, color and angle, resized to fit the bigger blob: a hat or cap sits snugly on top of the blob, a hood or veil wraps around it, headphones go over its sides.
- Glasses, sunglasses or goggles stay on and are worn ON THE BLOB'S EYES. The blob has EXACTLY TWO yellow dot eyes in total, never more, and when glasses or goggles are worn those two dots are INSIDE the lenses: one dot behind each lens (for a single wide goggle lens, both dots behind it, side by side). NEVER draw extra eye dots above, below or next to the glasses. The glasses decide where the eyes are: place the glasses on the upper middle of the blob, at the height where the logo's eyes are, and draw the two dots behind them; resize the frames to the blob, follow its tilt, and run the temples or strap around the sides of the blob. Through clear or tinted lenses the dots are visible; very dark sunglasses may hide them, but then there are no other eyes anywhere.
- Masks, face paint, earrings, piercings and other accessories keep their look and are moved onto the matching spot of the blob where they make sense.
All of these keep the exact style, lighting and rendering of the original image. Keep everything else exactly the same: body, clothes, hands, pose, background, framing and crop. Do not add text or change any existing text.

The third image is a close-up of the exact head design to copy. The new head must have exactly its design: the same silhouette and outline shape (a lumpy potato shape, wider at the upper right, with the small bump/notch on the upper-left edge and the straighter right side), a thick, slightly wobbly YELLOW outline all the way around (yellow, never white or black), a black inside, and the same two yellow eyes in the same places (a small round dot on the left and a slightly taller oval dot on the right). Do not redesign it: it is a lumpy, slightly tilted potato that is WIDER than it is tall, never an egg, an upright oval, a circle or a helmet shape.

MOST IMPORTANT: blend the head into the first image so it looks like part of the original artwork, never a clean flat sticker pasted on top. The reference images only define the SHAPE, colors and eyes; do NOT copy their clean, flat, smooth vector rendering. Redraw the head in the exact same medium, technique and level of detail as the rest of the first image:
- pixel art: draw the head as pixel art on the same pixel grid, with the same pixel size, the same limited color palette and hard pixel edges, including a pixel outline; no smooth vector curves or soft anti-aliasing that the rest of the image does not have.
- painting, fresco or illustration: paint it with the same brush strokes, texture, cracks, canvas grain and color palette.
- drawing, comic or cartoon: the same line weight, line color treatment and shading style as the other lines in the image.
- 3D render or video game: the same 3D shading, materials and render quality.
- photo: a real physical object with real material and texture, the same lens blur, depth of field, film grain, noise, color cast and JPEG softness.
Light it with the scene's own light: the same light direction, highlights on the lit side, shading on the shadow side, rim light and colored glow from bright things around it (fire, halo, sun, neon, screens), reflected color from nearby surfaces, a soft contact shadow on the neck, collar or hood. The black inside is the scene's darkest tone with subtle shading, not flat pure black. The yellow outline takes on the image's lighting and palette (use the image's own yellow/gold if it has one) and has the same thickness and edge quality as the other outlines in the image. Match contrast, saturation, sharpness and color grading so the head is indistinguishable in style from everything around it.`;

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

  const out = await generate({ prompt: PROMPT, image_urls: [body.image, REF_BASE + HEAD_REF, REF_BASE + HEAD_CLOSEUP], aspect_ratio: 'auto' }, q.keys, { privateIO: true, model: PFP_MODEL });
  if (out.error) return out.error;
  return json({ image: out.image, left: q.left });
}
