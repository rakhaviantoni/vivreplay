import {withRequestLocale} from '@/lib/with-request-locale';
import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {HelpArticlePage} from '@/components/tcg/help-article';
import {findHelpArticle, helpArticles} from '@/lib/help/articles';
import {isIndonesianRequest} from '@/lib/locale';

export function generateStaticParams() {
  return helpArticles.map(({slug}) => ({slug}));
}

export async function generateMetadata({params}: {params: Promise<{slug: string}>}): Promise<Metadata> {
  const {slug} = await params;
  const article = findHelpArticle(slug);
  if (!article) return {title: 'Guide not found', robots: {index: false, follow: false}};
  const id = await isIndonesianRequest();
  const locale = id ? 'id' : 'en';
  const path = `/help/${slug}`;
  const title = article.title[locale];
  const description = article.summary[locale];
  return {
    title,
    description,
    alternates: {canonical: id ? `/id${path}` : path, languages: {'en-US': path, 'id-ID': `/id${path}`}},
    openGraph: {type: 'article', title: `${title} | VivrePlay`, description, url: id ? `/id${path}` : path},
    twitter: {card: 'summary_large_image', title: `${title} | VivrePlay`, description},
  };
}

async function HelpArticleRoute({params}: {params: Promise<{slug: string}>}) {
  const {slug} = await params;
  if (!findHelpArticle(slug)) notFound();
  const id = await isIndonesianRequest();
  return <HelpArticlePage slug={slug} locale={id ? 'id' : 'en'}/>;
}

export default withRequestLocale(HelpArticleRoute);
