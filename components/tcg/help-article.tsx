import LocalizedAnchor from '@/components/ui/localized-link';
import Link from '@/components/ui/localized-link';
import {ArrowLeft, ArrowRight} from 'lucide-react';
import {helpArticles, helpCategories, helpArticleText, type HelpLocale} from '@/lib/help/articles';

function localizedHref(path: string, locale: HelpLocale) {
  return locale === 'id' ? (path === '/' ? '/id' : `/id${path}`) : path;
}

export function HelpArticlePage({slug, locale}: {slug: string; locale: HelpLocale}) {
  const article = helpArticles.find((item) => item.slug === slug);
  if (!article) return null;
  const id = locale === 'id';
  const copy = helpArticleText(article, locale);
  const category = helpCategories.find((item) => item.id === article.category)!;
  const related = article.related.map((relatedSlug) => helpArticles.find((item) => item.slug === relatedSlug)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const contactSubject = encodeURIComponent(`${id ? 'Bantuan VivrePlay' : 'VivrePlay support'}: ${copy.title}`);
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: copy.title,
    description: copy.summary,
    inLanguage: locale,
    mainEntityOfPage: `https://vivreplay.com${localizedHref(`/help/${slug}`, locale)}`,
    publisher: {'@type': 'Organization', name: 'VivrePlay', url: 'https://vivreplay.com'},
  };

  return <main className="page help-article-page">
    <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify(structuredData)}}/>
    <nav className="help-breadcrumbs" aria-label={id ? 'Jejak navigasi' : 'Breadcrumb'}>
      <Link href={localizedHref('/help', locale)}><ArrowLeft size={15}/>{id ? 'Pusat bantuan' : 'Help center'}</Link>
      <span>/</span><span>{category.label[locale]}</span>
    </nav>
    <header className="help-article-heading">
      <p className="eyebrow">{category.label[locale]}</p>
      <h1>{copy.title}</h1>
      <p>{copy.summary}</p>
    </header>
    <div className="help-article-layout">
      <article className="help-article-body">
        {copy.sections.map((section, index) => <section key={section.heading} id={`help-section-${index}`}>
          <h2>{section.heading}</h2>
          {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          {section.steps && <ol>{section.steps.map((step) => <li key={step}>{step}</li>)}</ol>}
          {section.bullets && <ul>{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
          {section.note && <aside className="help-note">{section.note}</aside>}
        </section>)}
        <div className="help-article-support">
          <strong>{id ? 'Masih perlu bantuan?' : 'Still need help?'}</strong>
          <p>{id ? 'Sertakan nomor pesanan atau kode kartu agar kami dapat memahami konteksnya.' : 'Include the order number or card code so we can see the context.'}</p>
          <LocalizedAnchor href={`mailto:support@vivreplay.com?subject=${contactSubject}`}>{id ? 'Email dukungan' : 'Email support'}</LocalizedAnchor>
          <LocalizedAnchor href={`https://wa.me/6287892660993?text=${encodeURIComponent(id ? `Halo VivrePlay, saya perlu bantuan tentang: ${copy.title}. ` : `Hi VivrePlay, I need help with: ${copy.title}. `)}`} target="_blank" rel="noreferrer">WhatsApp</LocalizedAnchor>
        </div>
      </article>
      <aside className="help-article-aside">
        <div><span>{id ? 'LANGKAH BERIKUTNYA' : 'NEXT STEP'}</span><p>{article.summary[locale]}</p><Link className="button" href={localizedHref(article.action.href, locale)}>{article.action.label[locale]}<ArrowRight size={15}/></Link></div>
        {related.length > 0 && <nav aria-label={id ? 'Artikel terkait' : 'Related guides'}><h2>{id ? 'Artikel terkait' : 'Related guides'}</h2>{related.map((item) => <Link href={localizedHref(`/help/${item.slug}`, locale)} key={item.slug}>{item.title[locale]}<ArrowRight size={14}/></Link>)}</nav>}
        <Link className="help-aside-faq" href={localizedHref('/faq', locale)}>{id ? 'Buka tanya jawab' : 'Browse the FAQ'}<ArrowRight size={14}/></Link>
      </aside>
    </div>
  </main>;
}
