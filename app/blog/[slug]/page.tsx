import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import ReactMarkdown from 'react-markdown';
import ShareButtons from '@/components/blog/ShareButtons';

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
    openGraph: { title: post.metaTitle || post.title, description: post.metaDesc || '' },
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

  const related = await prisma.blogPost.findMany({
    where: { published: true, category: post.category, slug: { not: post.slug } },
    orderBy: { createdAt: 'desc' },
    take: 3,
    select: { slug: true, title: true, excerpt: true, createdAt: true },
  });

  return (
    <div className="min-h-screen bg-white">
      {/* Nav */}
      <div className="border-b border-gray-100 sticky top-0 bg-white/95 backdrop-blur-sm z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/landing" className="text-emerald-600 font-bold hover:text-emerald-700">Rotahr</Link>
          <Link href="/blog" className="text-sm text-gray-500 hover:text-gray-800">← All Articles</Link>
        </div>
      </div>

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

        <ShareButtons title={post.title} slug={post.slug} />

        <hr className="border-gray-100 my-8" />

        {/* Content */}
        <div className="prose prose-gray prose-headings:text-gray-900 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-8 prose-h2:mb-3 prose-p:text-gray-700 prose-p:leading-relaxed prose-li:text-gray-700 prose-strong:text-gray-900 max-w-none">
          <ReactMarkdown>{post.content}</ReactMarkdown>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100">
          <ShareButtons title={post.title} slug={post.slug} />
        </div>

        {/* CTA inline */}
        <div className="mt-12 bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
          <h3 className="font-bold text-gray-900 text-lg mb-1">Try Rotahr free for a month</h3>
          <p className="text-gray-600 text-sm mb-4">Built for Irish restaurants, bars and hotels. No credit card needed.</p>
          <Link
            href="/auth/register"
            className="inline-block bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-xl hover:bg-emerald-700 transition-colors text-sm"
          >
            Start Free Trial
          </Link>
        </div>
      </article>

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
