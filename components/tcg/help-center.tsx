'use client';

import Link from 'next/link';
import {ArrowRight, MagnifyingGlass, X} from '@phosphor-icons/react';
import {useMemo, useState} from 'react';
import {helpArticles, helpCategories, type HelpLocale} from '@/lib/help/articles';

function localizedHref(path: string, locale: HelpLocale) {
  return locale === 'id' ? (path === '/' ? '/id' : `/id${path}`) : path;
}

export function HelpCenter({locale}: {locale: HelpLocale}) {
  const id = locale === 'id';
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const needle = query.trim().toLocaleLowerCase(locale === 'id' ? 'id-ID' : 'en-US');
  const results = useMemo(() => helpArticles.filter((article) => {
    if (category !== 'all' && article.category !== category) return false;
    if (!needle) return true;
    const text = [article.title[locale], article.summary[locale], ...article.keywords[locale]].join(' ').toLocaleLowerCase(locale === 'id' ? 'id-ID' : 'en-US');
    return text.includes(needle);
  }), [category, locale, needle]);
  const featured = helpArticles.find((article) => article.slug === 'report-a-market-order-problem')!;

  return <main className="page help-page">
    <header className="directory-hero page-intro-surface help-hero">
      <p className="eyebrow">{id ? 'VIVREPLAY · PUSAT BANTUAN' : 'VIVREPLAY · HELP CENTER'}</p>
      <h1>{id ? 'Butuh bantuan?' : 'What do you need help with?'}</h1>
      <p>{id ? 'Cari langkah untuk pesanan, kartu, akun, dan Market.' : 'Find clear steps for orders, cards, your account, and Market.'}</p>
      <label className="help-search">
        <MagnifyingGlass size={19} aria-hidden="true"/>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={id ? 'Cari topik atau masalah…' : 'Search a topic or problem…'} aria-label={id ? 'Cari artikel bantuan' : 'Search help articles'}/>
        {query && <button type="button" onClick={() => setQuery('')} aria-label={id ? 'Hapus pencarian' : 'Clear search'}><X size={16}/></button>}
      </label>
    </header>

    {!needle && category === 'all' && <section className="help-featured" aria-labelledby="help-featured-title">
      <div><span>{id ? 'PANDUAN PESANAN' : 'ORDER GUIDE'}</span><h2 id="help-featured-title">{featured.title[locale]}</h2><p>{featured.summary[locale]}</p></div>
      <Link href={localizedHref(`/help/${featured.slug}`, locale)} aria-label={id ? 'Buka panduan masalah pesanan' : 'Open the order problem guide'}><ArrowRight size={19}/></Link>
    </section>}

    <nav className="help-categories" aria-label={id ? 'Kategori bantuan' : 'Help categories'}>
      <button type="button" className={category === 'all' ? 'is-active' : ''} aria-pressed={category === 'all'} onClick={() => setCategory('all')}>{id ? 'Semua topik' : 'All topics'}</button>
      {helpCategories.map((item) => <button type="button" key={item.id} className={category === item.id ? 'is-active' : ''} aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label[locale]}</button>)}
    </nav>

    <section className="help-results" aria-live="polite" aria-busy="false">
      <header><h2>{needle || category !== 'all' ? (id ? 'Hasil pencarian' : 'Search results') : (id ? 'Panduan' : 'Guides')}</h2><span>{id ? `${results.length} artikel` : `${results.length} articles`}</span></header>
      {results.length ? <div className="help-article-list">{results.map((article) => {
        const group = helpCategories.find((item) => item.id === article.category)!;
        return <Link href={localizedHref(`/help/${article.slug}`, locale)} key={article.slug} className="help-article-link">
          <span className="help-article-category">{group.label[locale]}</span>
          <span className="help-article-copy"><strong>{article.title[locale]}</strong><small>{article.summary[locale]}</small></span>
          <ArrowRight size={17} aria-hidden="true"/>
        </Link>;
      })}</div> : <div className="help-empty"><p>{id ? 'Tidak ada artikel yang cocok.' : 'No articles matched that search.'}</p><button type="button" onClick={() => {setQuery('');setCategory('all')}}>{id ? 'Tampilkan semua topik' : 'Show all topics'}</button></div>}
    </section>

    <footer className="help-contact-strip"><p>{id ? 'Belum menemukan jawabannya?' : 'Still need a hand?'}</p><span>{id ? 'Kirim detail masalah agar kami tahu halaman atau pesanan yang perlu diperiksa.' : 'Send the details so we know which page or order needs attention.'}</span><Link href={localizedHref('/feedback', locale)}>{id ? 'Hubungi dukungan' : 'Contact support'}<ArrowRight size={15}/></Link></footer>
  </main>;
}
