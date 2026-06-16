# rohanpradyumna.vercel.app

An interactive sticker-board portfolio. Drag stickers around, swipe through cards, tap things to hear sounds, read the blog.

**Live:** https://rohanpradyumna.vercel.app

## Stack

- Next.js 16 (Turbopack) + React 19 + TypeScript
- framer-motion for drag and animation
- Markdown blog with native `/blog/[slug]` route + per-post share cards
- Deployed on Vercel

## Local dev

```bash
cd react-portfolio
npm install
npm run dev
```

The app lives entirely inside `react-portfolio/`. See `CLAUDE.md` for architecture notes.

## Deploy

From `react-portfolio/`: `vercel --prod --yes`.
