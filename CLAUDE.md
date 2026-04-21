# Portfolio Site

Personal portfolio website for Rohan Pradyumna — an interactive, sticker-based single-page application.

## Tech Stack

- **Single HTML file** (`index.html`) containing all HTML, CSS, and JavaScript
- **React 18** via CDN with Babel standalone (in-browser JSX transpilation)
- **Vanilla CSS** with CSS custom properties (no preprocessors)
- **Deployed on Vercel** (static hosting)

## Project Structure

```
portfolio_site/
├── index.html          # Everything lives here (HTML + CSS + React components)
├── assets/
│   ├── believer.mp3    # Background music (headphones sticker)
│   ├── rohan-portrait.jpg
│   └── icons/          # Sticker images (PNG)
│       ├── beach.png
│       ├── charminar.png
│       ├── coffee.png
│       ├── dc.png
│       ├── gym.png
│       ├── linkedin.png
│       ├── plane.png
│       └── whatsapp.png
├── vercel.json         # Vercel deployment config
└── README.md
```

## Key Features

### Interactive Stickers
- Draggable stickers with physics-based animations
- Orbital positioning system that places stickers around the central card
- Overlap resolution algorithm to prevent sticker collisions
- Tap sound effects using Web Audio API

### Audio Player
- Triggered by clicking the headphones sticker
- Audio file: `assets/believer.mp3`
- Configured at line ~964: `songAudio.src = 'assets/believer.mp3'`
- EQ visualizer bars animate when playing

### Modals
- Contact modal (phone number reveal)
- Music player modal with play/pause controls
- Lego counter easter egg

## Design System

CSS custom properties defined in `:root`:
- `--paper`: #faf7ef (background)
- `--ink`: #1a1a1a (primary text)
- `--accent`: #e85d3a (orange accent)
- `--accent-blue`: #2d6cdf
- `--accent-green`: #3a7d44
- `--accent-yellow`: #f2c230

Fonts:
- **Instrument Serif** — headings/name
- **Geist** — body text
- **Geist Mono** — code/monospace elements

## Deployment

```bash
# Deploy to Vercel production
vercel --prod
```

After deployment, users may need to hard refresh (`Cmd+Shift+R`) to clear browser cache.

## Common Tasks

### Change the background song
1. Add new MP3 to `assets/` folder
2. Update line ~964 in `index.html`:
   ```javascript
   songAudio.src = 'assets/your-new-song.mp3';
   ```
3. Redeploy with `vercel --prod`

### Add a new sticker
1. Add PNG image to `assets/icons/`
2. Create a new `<StickerName>Sticker` component following existing patterns
3. Add to the `positions` object in `App()` using `placeOrbital(angle, distance, width, height, rotation)`
4. Render in the JSX with appropriate `entranceDelay`

### Update contact info
Search for phone number or email patterns in `index.html` and update accordingly.
