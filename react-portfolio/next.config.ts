import type { NextConfig } from "next";

// /blog/:slug is now served by the native app route at src/app/blog/[slug]/,
// which gives crawlers real per-post metadata and a generated share card.
const nextConfig: NextConfig = {};

export default nextConfig;
