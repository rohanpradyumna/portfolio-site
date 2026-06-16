import { ImageResponse } from "next/og";
import { formatDate, getPost } from "@/lib/posts";

export const alt = "Rohan Pradyumna, writing";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const PAPER = "#fdfbf7";
const INK = "#2a251f";
const INK_SOFT = "#6b5d52";
const ACCENT = "#d95f3e";

const TAG_STYLES: Record<string, { bg: string; fg: string }> = {
  ai: { bg: "rgba(217,95,62,0.15)", fg: "#c44e30" },
  startups: { bg: "rgba(61,111,168,0.15)", fg: "#3d6fa8" },
  philosophy: { bg: "rgba(74,139,84,0.15)", fg: "#3f7a48" },
  life: { bg: "rgba(230,179,42,0.25)", fg: "#9a7a0a" },
};
const DEFAULT_TAG = { bg: "rgba(107,93,82,0.12)", fg: INK_SOFT };

// Pull real font binaries from Google Fonts so the card matches the site's
// display serif. Subset by the glyphs we actually draw to keep payloads small.
async function loadGoogleFont(family: string, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(
      / /g,
      "+",
    )}&text=${encodeURIComponent(text)}`;
    const css = await (await fetch(url)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const res = await fetch(src[1]);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function titleSize(title: string): number {
  const len = title.length;
  if (len <= 24) return 88;
  if (len <= 40) return 74;
  if (len <= 60) return 62;
  return 52;
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);

  const title = post?.meta.title ?? "Writing";
  const tags = post?.meta.tags ?? [];
  const date = post ? formatDate(post.meta.date) : "";

  const monoGlyphs =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ,.&:|-/·";
  const [serif, mono] = await Promise.all([
    loadGoogleFont("Instrument Serif", title),
    loadGoogleFont("Geist Mono:wght@500", monoGlyphs),
  ]);

  const fonts = [
    ...(serif ? [{ name: "Instrument Serif", data: serif, weight: 400 as const, style: "normal" as const }] : []),
    ...(mono ? [{ name: "Geist Mono", data: mono, weight: 500 as const, style: "normal" as const }] : []),
  ];

  const serifFamily = serif ? "Instrument Serif" : "Georgia, serif";
  const monoFamily = mono ? "Geist Mono" : "monospace";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "76px 84px 72px 96px",
          background: PAPER,
          backgroundImage:
            "radial-gradient(ellipse at 28% 18%, #fffdf7 0%, #fbf6ea 60%, #f3ebd8 100%)",
          position: "relative",
        }}
      >
        {/* brand spine */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: 16,
            background: ACCENT,
          }}
        />

        {/* kicker */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{ width: 14, height: 14, borderRadius: 999, background: ACCENT }}
          />
          <div
            style={{
              fontFamily: monoFamily,
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: INK_SOFT,
              display: "flex",
            }}
          >
            Rohan · Writing
          </div>
        </div>

        {/* tags + title */}
        <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
          {tags.length > 0 && (
            <div style={{ display: "flex", gap: 12 }}>
              {tags.slice(0, 4).map((tag) => {
                const s = TAG_STYLES[tag] ?? DEFAULT_TAG;
                return (
                  <div
                    key={tag}
                    style={{
                      display: "flex",
                      padding: "8px 18px",
                      borderRadius: 8,
                      background: s.bg,
                      color: s.fg,
                      fontFamily: monoFamily,
                      fontSize: 20,
                      letterSpacing: 2,
                      textTransform: "uppercase",
                    }}
                  >
                    {tag}
                  </div>
                );
              })}
            </div>
          )}
          <div
            style={{
              display: "flex",
              fontFamily: serifFamily,
              fontSize: titleSize(title),
              lineHeight: 1.05,
              color: INK,
              letterSpacing: -0.5,
              maxWidth: 980,
            }}
          >
            {title}
          </div>
        </div>

        {/* footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontFamily: monoFamily,
            fontSize: 22,
            color: INK_SOFT,
          }}
        >
          <div style={{ display: "flex" }}>{date}</div>
          <div style={{ display: "flex", color: ACCENT }}>
            rohanpradyumna.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
