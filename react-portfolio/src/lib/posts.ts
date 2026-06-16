import { readFile } from "node:fs/promises";
import { join } from "node:path";

export type PostMeta = {
  slug: string;
  title: string;
  date: string;
  tags: string[];
  excerpt: string;
  published: boolean;
};

export type Post = {
  meta: PostMeta;
  body: string;
};

const POSTS_DIR = join(process.cwd(), "public", "posts");

// Mirror of the lightweight frontmatter parser used by the vanilla post.html,
// so the React route and the static page agree on how a post's metadata reads.
function parseFrontmatter(raw: string): { meta: Record<string, string | string[]>; body: string } {
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw };

  const meta: Record<string, string | string[]> = {};
  for (const line of match[1].split("\n")) {
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    let value = line.slice(colon + 1).trim();

    if (value.startsWith("[") && value.endsWith("]")) {
      meta[key] = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      continue;
    }

    value = value.replace(/^["']|["']$/g, "");
    meta[key] = value;
  }

  return { meta, body: match[2] };
}

export async function getPostSlugs(): Promise<string[]> {
  const raw = await readFile(join(POSTS_DIR, "index.json"), "utf8");
  const list = JSON.parse(raw) as { slug: string }[];
  return list.map((p) => p.slug);
}

export async function getPost(slug: string): Promise<Post | null> {
  let raw: string;
  try {
    raw = await readFile(join(POSTS_DIR, `${slug}.md`), "utf8");
  } catch {
    return null;
  }

  const { meta, body } = parseFrontmatter(raw);
  if (meta.published === "false") return null;

  return {
    meta: {
      slug,
      title: typeof meta.title === "string" ? meta.title : slug,
      date: typeof meta.date === "string" ? meta.date : "",
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      excerpt: typeof meta.excerpt === "string" ? meta.excerpt : "",
      published: meta.published !== "false",
    },
    body,
  };
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  // Dates are bare YYYY-MM-DD (parsed as UTC midnight); format in UTC so they
  // don't slip back a day in negative-offset timezones.
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
