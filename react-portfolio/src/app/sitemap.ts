import type { MetadataRoute } from 'next';
import fs from 'node:fs';
import path from 'node:path';

const BASE_URL = 'https://rohanpradyumna.vercel.app';

interface PostIndexEntry {
  slug: string;
  date: string;
}

// Read the same index the blog page consumes so the sitemap can never drift
// from the actual post list. Runs at build time on the server.
function readPosts(): PostIndexEntry[] {
  try {
    const file = path.join(process.cwd(), 'public', 'posts', 'index.json');
    return JSON.parse(fs.readFileSync(file, 'utf8')) as PostIndexEntry[];
  } catch {
    return [];
  }
}

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = readPosts();

  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: `${BASE_URL}/blog.html`,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...posts.map((p) => ({
      url: `${BASE_URL}/blog/${p.slug}`,
      lastModified: new Date(p.date),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ];
}
