import { Metadata } from 'next';
import { articleSchema, breadcrumbSchema, faqSchema, jsonLdProps } from "@/lib/seo/structured-data";
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ReactMarkdown from 'react-markdown';
import ShareButtons from '@/components/blog/ShareButtons';
import { suggestTemplates } from '@/lib/templates/suggest';

export const revalidate = 3600;

interface Props {
  params: { slug: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug, published: true },
    select: { metaTitle: true, metaDesc: true, title: true },
  });
  if (!post) return { title: 'Not Found' };
  return {
    title: post.metaTitle || post.title,
    description: post.metaDesc,
    alternates: { canonical: `/blog/${params.slug}` },
    openGraph: {
      type: 'article',
      title: post.metaTitle || post.title,
      description: post.metaDesc || '',
      url: `/blog/${params.slug}`,
    },
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  scheduling: 'Scheduling', compliance: 'Compliance', hr: 'HR & People',
  finance: 'Finance', costs: 'Costs', payroll: 'Payroll',
  management: 'Management', technology: 'Technology', product: 'Rotahr',
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPostPage({ params }: Props) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug, published: true },
  });
  if (!post) notFound();

  // FAQ block written by the autopilot from real related searches. Stored as
  // JSON so a bad row can never break the page.
  let faq: { q: string; a: string }[] = [];
  if (post.faq) {
    try {
      const parsed = JSON.parse(post.faq);
      if (Array.isArray(parsed)) faq = parsed.filter((f) => f?.q && f?.a).slice(0, 8);
    } catch {
      faq = [];
    }
  }

  // Templates worth offering under this specific article. Returns nothing when
  // nothing genuinely matches — a block of unrelated downloads reads as filler
  // and is a worse internal link than none.
  const templates = suggestTemplates(
    `${post.title} ${post.excerpt ?? ""} ${post.content ?? ""}`
  );

  const related = await prisma.blogPost.findMany({
    where: { published: true, category: post.category, slug: { not: post.slug } },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { slug: true, title: true, excerpt: true, createdAt: true },
  });

  return (
    <div className="min-h-screen bg-white">
      <script
        {...jsonLdProps([
          articleSchema({
            title: post.title,
            description: post.metaDesc || post.excerpt,
            slug: post.slug,
            published: post.createdAt,
            updated: post.updatedAt,
          }),
          breadcrumbSchema([
            { name: "Rotahr", path: "/landing" },
            { name: "Blog", path: "/blog" },
            { name: post.title, path: `/blog/${post.slug}` },
          ]),
          ...(faq.length ? [faqSchema(faq)] : []),
        ])}
      />
      {/* Nav */}
      <div className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/landing" className="text-emerald-600 font-bold hover:text-emerald-700">Rotahr</Link>
          <Link href="/blog" className="text-sm text-gray-500 hover:text-gray-800">← All Articles</Link>
        </div>
      </div>

      <main>
      <article className="max-w-3xl mx-auto px-4 py-12">
        {/* Meta */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-medium bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
              {CATEGORY_LABELS[post.category] || post.category}
            </span>
            <span className="text-sm text-gray-400">{formatDate(post.createdAt)}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 leading-tight mb-4">{post.title}</h1>
          <p className="text-lg text-gray-500 leading-relaxed">{post.excerpt}</p>
        </div>

        {post.coverImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.coverImage} alt={post.title} className="w-full h-64 sm:h-80 object-cover rounded-2xl mb-8" />
        )}

        <ShareButtons title={post.title} slug={post.slug} />

        <hr className="border-gray-100 my-8" />

        {/* Content */}
        <div className="prose prose-gray prose-headings:text-gray-900 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none">
          <ReactMarkdown
            components={{
              // The generated body often repeats the title as its own `# H1`,
              // which gave these pages two H1s. Demote any body H1 to H2 so the
              // template heading stays the single topical signal.
              h1: ({ children }) => (
                <h2 className="text-2xl font-bold text-gray-900 mt-8 mb-3">{children}</h2>
              ),
            }}
          >
            {post.content}
          </ReactMarkdown>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100">
          <ShareButtons title={post.title} slug={post.slug} />
        </div>

        {/* FAQ — answers the related searches Google shows for this query */}
        {faq.length > 0 && (
          <section className="mt-12">
            <h2 className="font-bold text-gray-900 text-xl mb-4">Frequently asked questions</h2>
            <div className="divide-y divide-gray-100 border-t border-gray-100">
              {faq.map((f, i) => (
                <details key={i} className="group py-4" open={i === 0}>
                  <summary className="cursor-pointer list-none font-semibold text-gray-900 text-[15px] flex items-start justify-between gap-3">
                    <span>{f.q}</span>
                    <span className="text-gray-300 group-open:rotate-45 transition-transform text-lg leading-none">+</span>
                  </summary>
                  <p className="mt-2 text-gray-700 text-sm leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {/* Free templates. When nothing genuinely matches this article the
            block collapses to a single line rather than showing three
            unrelated downloads — but the link to the library stays, so every
            article is a crawl path to /templates, not just the 25 that
            happen to match. */}
        {templates.length === 0 ? (
          <p className="mt-12 text-sm text-gray-500">
            Free printable{" "}
            <Link href="/templates" className="text-emerald-700 hover:underline">
              hospitality templates
            </Link>{" "}
            — rotas, temperature logs, cleaning schedules and more, in PDF and
            Excel. No email needed.
          </p>
        ) : (
          <section className="mt-12 rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-1">
              Free templates for this
            </h3>
            <p className="text-gray-600 text-sm mb-4">
              Printable PDF and editable Excel. No email address, no sign-up.
            </p>
            <ul className="space-y-3">
              {templates.map((t) => (
                <li key={t.slug} className="flex flex-wrap items-center gap-3">
                  <Link
                    href={`/templates/${t.slug}`}
                    className="font-semibold text-sm text-gray-900 hover:text-emerald-700"
                  >
                    {t.name}
                  </Link>
                  <a
                    href={`/templates/${t.slug}.pdf`}
                    download
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    PDF
                  </a>
                  <a
                    href={`/templates/${t.slug}.xlsx`}
                    download
                    className="text-xs font-semibold text-emerald-700 hover:underline"
                  >
                    Excel
                  </a>
                </li>
              ))}
            </ul>
            <Link
              href="/templates"
              className="mt-4 inline-block text-sm text-gray-500 hover:text-emerald-700"
            >
              All free templates →
            </Link>
          </section>
        )}

        {/* CTA inline */}
        <div className="mt-12 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 text-lg mb-1">Try Rotahr free for a month</h3>
          <p className="text-gray-600 text-sm mb-4">Built for restaurants, bars and hotels. No credit card needed.</p>
          <Link
            href="/auth/register"
            className="inline-block bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
          >
            Start Free Trial
          </Link>
        </div>
      </article>
      </main>

      {/* Related posts */}
      {related.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50 py-12">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="font-bold text-gray-900 text-xl mb-6">More articles</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {related.map(r => (
                <Link key={r.slug} href={`/blog/${r.slug}`} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm hover:border-emerald-200 transition-all">
                  <p className="text-xs text-gray-400 mb-1">{formatDate(r.createdAt)}</p>
                  <h3 className="font-semibold text-sm text-gray-800 leading-snug">{r.title}</h3>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-100 py-8 text-center">
        <Link href="/blog" className="text-sm text-gray-400 hover:text-emerald-600">← Back to all articles</Link>
      </div>
    </div>
  );
}
