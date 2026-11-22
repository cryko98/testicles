// Meme styles + character modes. The browser only ever sends ids; prompts live here.
// Prompts never use brand names, logos or the coin's name, so the image model
// doesn't trip on them; the characters come from the reference images.

// Always sent as the LAST reference: the exact logo characters.
export const LOGO_REF = 'ref-logo.png';

const BOTH = [
  'BOTH logo characters must be clearly visible in the image, every time: exactly TWO of them, never one, never three.',
  'Each logo character is a black potato-shaped blob with a thick hand-drawn yellow outline and two small yellow dot eyes (no mouth, no nose), drawn exactly like in the logo reference image.',
  'Keep them as flat 2D marker doodles with the same shape, colors and line quality as the references, even when the rest of the image is in another style.',
  'Funny, wholesome, safe for all ages. No real logos, brand names, watermarks or extra text unless the style asks for a game HUD.',
].join(' ');

export const MODES = {
  heads: {
    label: 'As heads',
    ref: 'ref-heads.png',
    subject: 'two stick figures',
    describe: 'The two logo characters are the HEADS of two thin yellow hand-drawn stick figures (see the stick-figure reference): blob head on top, thin yellow stick body, stick arms with little stick fingers, stick legs. Two figures, one logo character as the head of each.',
  },
  stick: {
    label: "Stickman's boys",
    ref: 'ref-stick.png',
    subject: 'the yellow stickman (with the two blobs hanging between his legs)',
    describe: 'A thin yellow hand-drawn stickman with a small round black head and a smiling face (see the stickman reference). The two logo characters hang side by side between his legs from his wide pelvis line, exactly like in the stickman reference; they are part of him and travel with him. Both blobs always visible.',
  },
  solo: {
    label: 'Just the two',
    ref: null,
    subject: 'the two blob characters',
    describe: 'The two logo characters on their own, with no bodies, arms or legs: just the two blobs, as little mascots placed into the scene (sitting, bouncing, peeking, riding things), like in the logo reference.',
  },
};
export const MODE_IDS = Object.keys(MODES);

export const STYLES = {
  stickman: {
    label: 'Stickman',
    aspect: '1:1',
    style: 'Minimal hand-drawn doodle on a plain near-black background (#181613). Everything drawn as simple yellow marker lines, like a funny sketchbook comic panel. Very few props, lots of empty space.',
    ideas: ['doing a synchronized trampoline backflip', 'fighting a giant red chart candle with tiny swords', 'riding a rocket that is just a firework', 'trying to lift a dumbbell and falling over'],
  },
  irl: {
    label: 'Doodle IRL',
    aspect: '4:3',
    style: 'A realistic candid photograph of a real-world scene, with the flat yellow doodle characters pasted into it like a funny photo collage. Natural lighting, real people reacting to them.',
    ideas: ["bouncing on a trampoline at a kid's birthday party while a magician looks confused", 'photobombing a serious business meeting, pointing at a chart going up', 'in a busy gym doing a bench press', 'in the front row of a fancy opera, eating popcorn'],
  },
  'gta-cover': {
    label: 'Open-world cover',
    aspect: '3:4',
    style: 'Bold painted video-game cover art illustration: a sunset beach city with palm trees, art-deco hotels and a purple-pink neon sky, cel-shaded semi-realistic painting style. The characters pose like game cover stars and may wear cool streetwear.',
    ideas: ['leaning on a vintage muscle car on the beach avenue at sunset', 'on a speedboat with the neon skyline behind', 'in front of a beach hotel with sunglasses and a stack of cash'],
  },
  'gta-game': {
    label: 'Game screenshot',
    aspect: '16:9',
    style: 'A stylized 3D open-world crime video game screenshot from the 2000s: sunny suburban street, palm trees, orange sunset haze. Game HUD on top: a round minimap bottom-left, a row of wanted stars and a green money counter top-right. The characters stay flat yellow-outlined doodles inside the 3D scene.',
    ideas: ['escaping the police in a shopping cart holding a loaf of bread', 'stealing an ice cream truck while the music still plays', 'running from an angry chihuahua with five wanted stars'],
  },
  vintage: {
    label: 'Vintage photo',
    aspect: '4:3',
    style: 'An old grainy black-and-white photograph from the 1960s with dust, scratches and worn paper edges. Only the characters are in color: bright yellow doodle lines and black blobs, like someone drew them onto the old photo.',
    ideas: ['panicking on top of a rocket launch tower while engineers in hard hats watch', 'at a 1960s mission control desk pressing all the buttons', 'standing on the wing of an old propeller plane waving'],
  },
  renaissance: {
    label: 'Renaissance',
    aspect: '3:2',
    style: 'A Renaissance-era oil painting / fresco with cracked old paint texture, dramatic classical composition, robed figures and painted clouds or architecture. The characters are flat yellow-outlined doodles drawn on top of the masterpiece, interacting with it.',
    ideas: ['at a long supper table passing a secret note while everyone gasps', 'reaching toward each other on clouds holding smartphones while bored cherubs watch', 'being crowned by angels with a golden coin'],
  },
};

export function buildPrompt(styleId, modeId, scene) {
  const st = STYLES[styleId], md = MODES[modeId];
  return [
    md.describe,
    BOTH,
    `Style: ${st.style}`,
    `Scene: ${md.subject} ${scene}.`,
    'Reminder: both logo characters must appear in the final image.',
  ].join('\n\n');
}

// very small server-side content filter (the model also runs its own safety filter)
const BLOCK = [
  /\bn[s5]fw\b/i, /\bnud(e|es|ity)\b/i, /\bnaked\b/i, /\bporn/i, /\bsex/i, /\bhentai\b/i, /\bboob/i, /\btit(s|ties)\b/i,
  /\bpenis\b/i, /\bvagin/i, /\bgenital/i, /\berotic\b/i, /\bfetish/i, /\blingerie\b/i, /\bunderwear\b/i, /\bbikini\b/i,
  /\bgore\b/i, /\bblood(y)?\b/i, /\bbehead/i, /\bsuicide\b/i, /\bself[- ]?harm\b/i, /\bkill(ing)? (him|her|them|myself)\b/i,
  /\bnazi/i, /\bhitler\b/i, /\bkkk\b/i, /\bswastika\b/i, /\bterroris/i, /\bschool shoot/i,
  /\b(child|kid|minor|teen|underage)s?\b.*\b(sexy|hot|undress)/i,
];
export function isBlocked(text) { return BLOCK.some((re) => re.test(text)); }
