import { Metadata } from 'next';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Blog | Rotahr — Irish Hospitality Insights',
  description: 'Practical advice for Irish restaurant, bar and hotel owners. Staff scheduling, employment law, rota tips, and more.',
};

export const revalidate = 3600;

const CATEGORY_LABELS: Record<string, string> = {
  scheduling: 'Scheduling',
  compliance: 'Compliance',
  hr: 'HR & People',
  finance: 'Finance',
  costs: 'Costs',
  payroll: 'Payroll',
  management: 'Management',
  technology: 'Technology',
  product: 'Rotahr',
};

const CATEGORY_COLORS: Record<string, string> = {
  scheduling: 'bg-blue-100 text-blue-700',
  compliance: 'bg-red-100 text-red-700',
  hr: 'bg-purple-100 text-purple-700',
  finance: 'bg-green-100 text-green-700',
  costs: 'bg-orange-100 text-orange-700',
  payroll: 'bg-yellow-100 text-yellow-700',
  management: 'bg-indigo-100 text-indigo-700',
  technology: 'bg-teal-100 text-teal-700',
  product: 'bg-emerald-100 text-emerald-700',
};

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { slug: true, title: true, excerpt: true, category: true, createdAt: true },
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-16 text-center">
          <Link href="/landing" className="inline-flex items-center gap-2 text-emerald-600 font-bold text-xl mb-8 hover:text-emerald-700">
            ← Rotahr
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 mt-4 mb-3">Rotahr Blog</h1>
          <p className="text-lg text-gray-500 max-w-xl mx-auto">
            Practical advice for Irish restaurant, bar and hotel owners. Scheduling, compliance, people management and more.
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-xl">Articles coming soon — check back tomorrow.</p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {posts.map(post => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-md hover:border-emerald-300 transition-all group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${CATEGORY_COLORS[post.category] || 'bg-gray-100 text-gray-600'}`}>
                    {CATEGORY_LABELS[post.category] || post.category}
                  </span>
                </div>
                <h2 className="font-semibold text-gray-900 group-hover:text-emerald-600 transition-colors mb-2 leading-snug">
                  {post.title}
                </h2>
                <p className="text-sm text-gray-500 line-clamp-3 mb-4">{post.excerpt}</p>
                <p className="text-xs text-gray-400">{formatDate(post.createdAt)}</p>
              </Link>
            ))}
          </div>
        )}

        {/* CTA */}
        <div className="mt-16 bg-emerald-600 rounded-2xl p-8 text-center text-white">
          <h3 className="text-2xl font-bold mb-2">Ready to simplify your rota?</h3>
          <p className="text-emerald-100 mb-6">Join Irish restaurants and bars already using Rotahr. First month free.</p>
          <Link
            href="/auth/register"
            className="inline-block bg-white text-emerald-700 font-semibold px-8 py-3 rounded-xl hover:bg-emerald-50 transition-colors"
          >
            Start Free Trial
          </Link>
        </div>
      </div>
    </div>
  );
}
