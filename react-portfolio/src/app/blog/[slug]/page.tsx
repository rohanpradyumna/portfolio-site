import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { marked } from "marked";
import { formatDate, getPost, getPostSlugs } from "@/lib/posts";
import "./post.css";

const KNOWN_TAGS = new Set(["ai", "startups", "philosophy", "life"]);

export async function generateStaticParams() {
  const slugs = await getPostSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return {};

  const title = `${post.meta.title} · Rohan Pradyumna`;
  const description = post.meta.excerpt || "A note from Rohan Pradyumna.";
  const url = `/blog/${slug}`;

  // og:image / twitter:image are supplied by the colocated opengraph-image.tsx,
  // so we deliberately omit `images` here to let the generated card take over.
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      siteName: "Rohan Pradyumna",
      publishedTime: post.meta.date || undefined,
      authors: ["Rohan Pradyumna"],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  const html = await marked.parse(post.body, { gfm: true, breaks: true });

  return (
    <>
      <div className="postBoard" />

      <div className="postBrand">
        <a href="/">
          <span className="name">rohan</span>
        </a>
        <span className="dot" />
        <span className="sub">writing</span>
      </div>

      <div className="postCorner">
        <a href="/blog.html">all posts</a>
      </div>

      <article className="postContentWrap">
        <a href="/blog.html" className="backLink">
          back to all posts
        </a>

        <header className="postHeader">
          {post.meta.tags.length > 0 && (
            <div className="postTags">
              {post.meta.tags.map((tag) => (
                <span
                  key={tag}
                  className={`postTag ${KNOWN_TAGS.has(tag) ? tag : ""}`}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <h1 className="postTitle">{post.meta.title}</h1>
          <div className="postMeta">{formatDate(post.meta.date)}</div>
        </header>

        <div
          className="postBody"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </article>
    </>
  );
}
