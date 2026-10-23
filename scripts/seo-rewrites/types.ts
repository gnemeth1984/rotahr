/** A hand-written replacement for a live blog post, applied in place. */
export interface SeoRewrite {
  slug: string;
  title: string;
  metaTitle: string;
  metaDesc: string;
  excerpt: string;
  keyword: string;
  tags: string;
  content: string;
  faq: { q: string; a: string }[];
}
