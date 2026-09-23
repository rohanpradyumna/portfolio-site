import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/wheel/admin',
    },
    sitemap: 'https://rohanpradyumna.vercel.app/sitemap.xml',
  };
}
