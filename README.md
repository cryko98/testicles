# TESTICLES

Interactive site for $TESTICLES — two hand-drawn characters that live on the page.

- **Characters**: vectorised 1:1 from the original artwork (`src/chars.json`, traced with potrace), animated with a live "line boil" SVG filter.
- **Pets** (`src/pets.js`): physics, squash & stretch, eye tracking, perching on page elements, drag & throw, sleeping, peeking, and random meetings (bonk, dance, leapfrog, chat, high-five...).
- **Bounce Lab** (`src/lab.js`): Matter.js sandbox rendered from the same traced paths.
- **Motion**: GSAP (ScrollTrigger, SplitText, Draggable, Inertia, MotionPath) + Lenis smooth scroll.
- **Sound**: synthesised with WebAudio (`src/sound.js`), off by default.

```bash
npm install
npm run dev
npm run build   # -> dist/
```

Deploys on Vercel as a Vite project with zero config.
