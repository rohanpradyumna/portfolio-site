# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository contains TWO portfolio implementations

This repo holds two parallel versions of the same interactive "sticker board" portfolio. Know which one you're editing:

1. **`index.html`** (repo root) — the **original, live, deployed** site. A single self-contained file (HTML + CSS + React 18 via CDN + in-browser Babel, no build step). Also serves `blog.html` / `post.html`. This is what `https://rohan-pradyumna.vercel.app` serves; root `vercel.json` deploys it as static hosting.
2. **`react-portfolio/`** — a **Next.js 16 + React 19 + TypeScript** port that is under **active development** and where most current work happens. It has its own `vercel.json`/`.vercel`.

When a task mentions stickers, cards, modals, scaling, or layout without qualification, it almost always refers to `react-portfolio/`. The vanilla `index.html` is the reference implementation that the React port intentionally mirrors (sticker sizes, positions, copy are matched to it).

## Commands (react-portfolio/)

All commands run from inside `react-portfolio/` (it has its own `package.json`):

```bash
cd react-portfolio
npm run dev      # next dev (Turbopack) — http://localhost:3000
npm run build    # next build
npm run start    # serve production build
npm run lint     # eslint (flat config: core-web-vitals + typescript)
npx tsc --noEmit # typecheck (no test suite exists)
```

There are **no automated tests**. Verification is done visually (often via the Playwright MCP browser tools) and with `tsc --noEmit`.

The vanilla site needs no build — open `index.html` in a browser.

Deploy: the vanilla root site is push-to-`main` → Vercel auto-deploy. **`react-portfolio/` is deployed manually**, from inside the directory: `vercel --prod --yes`, then alias the resulting deployment URL to the production domain with `vercel alias set <deployment-url> rohanpradyumna.vercel.app`. Do this only when explicitly asked.

## CRITICAL: This is not the Next.js you know

`react-portfolio/AGENTS.md` warns that Next.js **16.2.6** has breaking changes from older versions — APIs, conventions, and file structure may differ from training data. **Before writing Next.js framework code (routing, config, fonts, metadata, etc.), read the relevant guide in `react-portfolio/node_modules/next/dist/docs/`.** Heed deprecation notices.

`next.config.ts` rewrites `/blog/:slug` → `/post.html` (the React app reuses the vanilla blog pages from `public/`).

## react-portfolio architecture (the big picture)

The hard part of this codebase is the **layout/scaling system**. It is non-obvious and spread across several files that must be understood together.

### Fixed design canvas + uniform scale (the core idea)

Everything desktop is laid out **once** in a fixed `DESIGN_W × DESIGN_H = 1440 × 900` coordinate space (constants in `src/hooks/useDimensions.ts`). The whole board is then **uniformly CSS-transform-scaled** to fit the viewport by `src/components/layouts/Stage.tsx`. This replaced an older per-element width-scaling approach that distorted the layout on large monitors. Consequences:

- Sticker positions/sizes are **viewport-independent** — never make them depend on `dims`. `useResponsive().scale` is `1` and `s()`/`d()` are identity on desktop; they exist mostly to mirror the vanilla code's structure.
- `Stage` computes `scale = clamp(min((vw-2·MARGIN)/box.w, (vh-2·MARGIN)/box.h), STAGE_MIN_SCALE, STAGE_MAX_SCALE)` and translates so the **card center** (design 720,450) lands at the viewport center. The fit box is built **symmetric about the card center** in `page.tsx` so the card is always dead-center and the cluster is balanced left/right. `STAGE_MAX_SCALE` (currently 1.4) caps growth on big monitors so the board gains margin instead of "buffing up."

### Drag must track the cursor 1:1 under the scaled Stage

framer-motion does **NOT** auto-compensate for a plain-CSS-transformed ancestor. Without help a sticker moves `cursorDelta` in design space → renders as `cursorDelta × scale` on screen and outruns the cursor. `Stage` fixes this with `MotionConfig transformPagePoint={p => ({x: p.x/scale, y: p.y/scale})}`, scoped to the Stage subtree. **Do not** add a second transformPagePoint correction anywhere inside the Stage — it double-corrects and breaks dragging.

### Where things render (and what's inside vs outside the Stage)

`src/app/page.tsx` (`Home`) is the single orchestrator. It owns all modal state, computes orbital positions, and decides mobile vs desktop:

- **Desktop:** `<Stage bbox={bbox}>` wraps `<DesktopStickers/>` + `<CardStack/>`. Both are scaled.
- **Mobile** (`dims.w <= 768`): `<CardStack/>` + `<MobileStickerGrid/>` (no Stage, simple grid).
- **Modals are siblings of `<main>`, OUTSIDE the Stage** — so they render at true viewport scale and are unaffected by the board transform.

### Orbital layout + collision resolution

`src/utils/layoutEngine.ts`:
- `placeOrbital(angleDeg, distance, w, h, rot, config)` — distance is the gap **beyond the card edge** along an ellipse; reducing it pulls a sticker toward the card.
- `resolveCluster(items, obstacles, {pad})` — the active overlap resolver. Minimal-translation push-apart with **immovable obstacles** (the center card and the bottom-left coffee machine) and a weak spring back toward each sticker's orbital home, preserving the hand-placed feel. (`resolveOverlaps`/`resolveOverlapsSimple` are older, unused variants.)

In `page.tsx`, the `{ positions, bbox }` `useMemo` is the layout brain: it places the `raw` orbital array, applies a gentle radial `PULL` factor to tighten the cluster, resolves collisions against the card + coffee-machine obstacles, and derives the symmetric `bbox` the Stage consumes.

### Stickers

`src/components/stickers/base/Sticker.tsx` is the draggable base (framer-motion `motion.div`, `drag`, momentum, magnetic grid snap at `GRID_SIZE=140`, tap-vs-drag discrimination via a `hasMoved` ref, z-index bumped directly on the DOM node to avoid re-renders, Web Audio tap sound + haptics). Specialized stickers in `stickers/specialized/` wrap it (`ImageSticker`, `PhotoSticker`, `WordSticker`, plus interactive ones like `AirPodsSticker`→music, `CoffeeMachineSticker`→stoic quote, `LaptopSticker`→experience takeover, `FolderSticker`→`/blog.html`).

### The experience takeover

The laptop sticker opens `src/components/experience/ExperienceTakeover.tsx`, a **full-screen** panel (not the shared `Modal`) rendered as a sibling of `<main>`, outside the Stage. It reimplements the `Modal` a11y contract (focus trap, Escape to close, body scroll lock) and composes three data sources: `data/now.ts` (current-focus hero), `data/projects.ts` (trajectory list), and `data/skills.ts` (grouped capabilities). It replaced the older `WorkCardStack` carousel.

### Data, hooks, content

- Card stack copy lives in **`src/data/cards.ts`** (`CARDS`), not in `CardStack.tsx`. Projects in `data/projects.ts`, stoic quotes in `data/quotes.ts`, the experience takeover's current-focus hero in `data/now.ts` and grouped capabilities in `data/skills.ts`. Cards use `minHeight` (not a fixed height), so over-long copy grows a card past its box and pokes out behind shorter stacked cards: keep bullets to ~1-2 lines.
- `src/hooks/useAudio.ts` — tap sounds (Web Audio) + the background song player (`/assets/believer.mp3`). `useDimensions.ts` — viewport tracking + `DESIGN_W/H` + `useResponsive`.
- Easter eggs: typing `ai` opens an AI showcase modal (key listener in `page.tsx`); the coffee machine "brews" a random stoic quote; the lego brick counts clicks.

## Writing / blog posts

Posts are plain Markdown in `react-portfolio/public/posts/<slug>.md` with a YAML-ish frontmatter block (`title`, `slug`, `date`, `tags`, `excerpt`, `published`). To publish a new post: (1) add the `<slug>.md` file, and (2) add a matching entry to `public/posts/index.json` (the list `blog.html` reads). `post.html` renders a single post via marked.js; `next.config.ts` rewrites `/blog/:slug` → `/post.html`. The WRITING folder sticker's count badge is driven by a fetch of `index.json` in `page.tsx`, so the badge updates automatically when `index.json` grows.

## Design system

CSS custom properties live in `react-portfolio/src/styles/theme.css` / `globals.css` (and `:root` of `index.html` for the vanilla site):
`--paper #faf7ef`, `--ink #1a1a1a`, `--accent #e85d3a`, `--accent-blue #2d6cdf`, `--accent-green #3a7d44`, `--accent-yellow #f2c230`. Fonts: **Instrument Serif** (name/headings), **Geist** (body), **Geist Mono** (code/mono UI).

## Conventions

- Components touching `window`, framer-motion, or audio must be `'use client'`.
- **Never use em dashes (—) in any user-facing copy, content, or comments.** Use a period, comma, colon, parentheses, or the middot separator (·) instead. This applies to card copy, modal text, project data, alt text, and prose everywhere. En dashes (–) in ranges should also be plain hyphens (-).
- Comments: sparing, and only for genuinely complex logic (e.g. the Stage scaling/drag math). Keep them explanatory of the *why*; humor is on-brand but optional.
- Path alias: `@/*` → `react-portfolio/src/*`.
- Many stray `*.png` / `*.jpeg` screenshots in the repo root are throwaway visual-verification artifacts, not source.
