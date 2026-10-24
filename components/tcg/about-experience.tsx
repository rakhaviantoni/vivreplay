'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AnchorIcon as Anchor,
  ArrowRightIcon as ArrowRight,
  ArrowUpRightIcon as ArrowUpRight,
  BookOpenIcon as BookOpen,
  CardsIcon as Cards,
  CaretDownIcon as CaretDown,
  CheckCircleIcon as CheckCircle,
  CoinsIcon as Coins,
  CompassIcon as Compass,
  ScalesIcon as Scales,
  SparkleIcon as Sparkle,
  StackIcon as Stack,
  StorefrontIcon as Storefront,
  SwordIcon as Sword,
  TrophyIcon as Trophy,
} from '@phosphor-icons/react';
import { VivreMark } from './brand-assets';

type Locale = 'EN' | 'ID';

export function AboutExperience() {
  const [language, setLanguage] = useState<Locale>('EN');
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useEffect(() => {
    const syncLocale = () => {
      const stored = window.localStorage.getItem('vivreplay-locale');
      setLanguage(stored === 'ID' ? 'ID' : 'EN');
    };
    syncLocale();
    const onLocale = (event: Event) => {
      setLanguage((event as CustomEvent<Locale>).detail);
    };
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const toggleFaq = (index: number) => {
    setExpandedFaq((current) => (current === index ? null : index));
  };

  const isId = language === 'ID';

  const stats = [
    {
      value: 'One Piece',
      label: isId ? 'Katalog kartu' : 'Card library',
      sub: isId ? 'Kartu, cetakan, dan set' : 'Cards, printings, and sets',
      icon: Cards,
    },
    {
      value: 'Pokémon',
      label: isId ? 'Katalog kartu' : 'Card library',
      sub: isId ? 'Katalog terus dikembangkan' : 'Catalog and tools in progress',
      icon: Compass,
    },
    {
      value: isId ? 'Koleksi' : 'Collection',
      label: isId ? 'Vault pribadi' : 'Personal Vault',
      sub: isId ? 'Catat kartu dari kedua permainan' : 'Track cards from either game',
      icon: Coins,
    },
    {
      value: 'Market',
      label: isId ? 'Listing komunitas' : 'Community listings',
      sub: isId ? 'Listing One Piece' : 'Listings for One Piece',
      icon: Storefront,
    },
  ];

  const pillars = [
    {
      num: '01',
      title: isId ? 'Katalog One Piece' : 'One Piece card library',
      tag: isId ? 'Kartu dan cetakan' : 'Cards and printings',
      desc: isId
        ? 'Cari kartu One Piece berdasarkan nama, nomor, set, warna, atau tipe dan lihat detail cetakan yang tersedia.'
        : 'Search One Piece cards by name, number, set, color, or type and explore available printing details.',
      link: '/cards',
      linkText: isId ? 'Buka katalog kartu' : 'Browse card library',
      icon: Cards,
    },
    {
      num: '02',
      title: isId ? 'Pembuat Deck' : 'Deck Builder',
      tag: isId ? 'Susun dan simpan deck' : 'Build and save decks',
      desc: isId
        ? 'Susun deck dengan pilihan filter kartu, lihat ringkasan komposisi, lalu simpan dan bagikan deck.'
        : 'Build decklists with card filters, review deck composition, then save and share your deck.',
      link: '/decks/builder',
      linkText: isId ? 'Susun deck baru' : 'Build a deck',
      icon: Stack,
    },
    {
      num: '03',
      title: 'Vault & Market',
      tag: isId ? 'Koleksi dua permainan' : 'Collection tools for both games',
      desc: isId
        ? 'Catat kartu Pokémon dan One Piece di Vault. Listing Market komunitas saat ini tersedia untuk One Piece.'
        : 'Track Pokémon and One Piece cards in your Vault. Community Market listings currently support One Piece.',
      link: '/vault',
      linkText: isId ? 'Buka Vault' : 'Open your Vault',
      icon: Storefront,
    },
    {
      num: '04',
      title: isId ? 'Katalog Pokémon' : 'Pokémon card library',
      tag: isId ? 'Sedang dikembangkan' : 'Still in progress',
      desc: isId
        ? 'Jelajahi kartu dan set Pokémon yang tersedia. Cakupan data dan fitur terus bertambah; tidak semua alat One Piece tersedia untuk Pokémon.'
        : 'Browse Pokémon cards and sets currently in the catalog. Coverage and tools are still growing; not every One Piece feature is available for Pokémon.',
      link: '/pokemon/cards',
      linkText: isId ? 'Jelajahi Pokémon' : 'Browse Pokémon cards',
      icon: Cards,
    },
    {
      num: '05',
      title: isId ? 'Arena Simulasi Aturan' : 'Rules & Practice Arena',
      tag: isId ? 'Arena latihan di browser' : 'Browser-based practice arena',
      desc: isId
        ? 'Pelajari alur fase giliran, alokasi Don!!, waktu trigger, dan penyelesaian efek kata kunci pada meja simulasi digital yang mengikuti buku aturan komprehensif resmi Bandai.'
        : 'Practice turn phases, Don!! allocation, triggers, and card interactions in the browser. Check official Bandai sources for current tournament rules.',
      link: '/play',
      linkText: isId ? 'Masuk ke Arena' : 'Enter the arena',
      icon: Sword,
    },
  ];

  const principles = [
    {
      icon: Compass,
      title: isId ? 'Dibuat untuk Pemain' : 'Made for Players',
      desc: isId
        ? 'Tempat untuk mencari kartu, menyusun deck, mengelola koleksi, dan bermain.'
        : 'A focused place to search cards, build decks, manage collections, and play.',
    },
    {
      icon: Scales,
      title: isId ? 'Data cetakan yang tersedia' : 'Available printings',
      desc: isId
        ? 'Jelajahi versi bahasa Jepang dan Inggris jika tersedia untuk kartu tersebut.'
        : 'Explore Japanese and English versions where they are available.',
    },
    {
      icon: Sparkle,
      title: isId ? 'Kualitas Gambar Kartu' : 'High-Quality Imagery',
      desc: isId
        ? 'Tampilan gambar kartu yang tajam untuk memperlihatkan tekstur foil, parallel art, dan detail sertifikasi slab gradasi.'
        : 'View card images and printing details available in the catalog.',
    },
    {
      icon: Trophy,
      title: isId ? 'Dibuat untuk Komunitas' : 'Built for the Community',
      desc: isId
        ? 'Dibuat dan dirawat secara independen oleh sesama pemain kartu. Seluruh fitur dapat digunakan gratis.'
        : 'Built and maintained independently as a community fan project.',
    },
  ];

  const faqs = [
    {
      q: isId ? 'Fitur apa yang dapat dijelajahi tanpa akun?' : 'Which features can I explore without an account?',
      a: isId
        ? 'Katalog kartu dan alat deck dapat dijelajahi tanpa akun. Fitur yang menyimpan data akun memerlukan sign-in; lihat detail akses pada fitur terkait.'
        : 'The card library and deck tools can be explored without an account. Account-backed features require sign-in; check each feature for current access details.',
    },
    {
      q: isId ? 'Bagaimana kartu versi Jepang (JP) dan Inggris (EN) ditampilkan?' : 'How are Japanese (JP) and English (EN) cards displayed?',
      a: isId
        ? 'Halaman kartu One Piece menampilkan cetakan bahasa Jepang dan Inggris jika tersedia. Cakupan katalog Pokémon berbeda untuk setiap kartu dan set.'
        : 'One Piece card pages show Japanese and English printings where available. Pokémon catalog coverage varies by card and set.',
    },
    {
      q: isId ? 'Bagaimana informasi Market ditampilkan?' : 'How is Market information displayed?',
      a: isId
              ? 'Listing komunitas saat ini tersedia untuk One Piece. Harga dan ketersediaan dapat berubah; periksa detail setiap listing.'
              : 'Community listings currently support One Piece. Prices and availability can change; check each listing for details.',
    },
    {
      q: isId ? 'Bisakah saya mencatat kartu slab gradasi di koleksi?' : 'Can I track graded slabs in my collection?',
      a: isId
        ? 'Koleksi tersedia setelah masuk ke akun. Pilihan pencatatan yang didukung dapat dilihat di halaman koleksi.'
        : 'The Vault can track One Piece and Pokémon cards. Market price estimates are currently limited to supported One Piece cards.',
    },
    {
      q: isId ? 'Bagaimana ralat teks kartu dan aturan resmi diperbarui?' : 'How are card erratas and rules maintained?',
      a: isId
        ? 'VivrePlay adalah proyek penggemar independen. Periksa sumber resmi Bandai untuk aturan, ralat, dan keputusan turnamen yang berlaku.'
        : 'VivrePlay is an independent fan project. Refer to official Bandai sources for current rules, errata, and tournament rulings.',
    },
  ];

  return (
    <main className="about-v2-page page">
      {/* 1. HERO SECTION */}
      <section className="about-v2-hero" aria-label="About VivrePlay Overview">
        <div className="about-hero-compass-backdrop" aria-hidden="true">
          <div className="about-compass-ring ring-outer" />
          <div className="about-compass-ring ring-inner" />
          <div className="about-compass-crosshair" />
        </div>

        <div className="about-hero-content">
          <div className="about-hero-eyebrow">
            <Compass size={18} weight="bold" />
            <span>{isId ? 'KATALOG DAN KOLEKSI KARTU' : 'CARD LIBRARIES AND COLLECTIONS'}</span>
            <span className="about-hero-badge">{isId ? 'Karya Komunitas' : 'Community Project'}</span>
          </div>

          <h1 className="about-hero-title">
            {isId ? (
              <>
                Alat kartu untuk <br />
                <span className="accent-highlight">One Piece dan Pokémon.</span>
              </>
            ) : (
              <>
                Card tools for <br />
                <span className="accent-highlight">One Piece and Pokémon.</span>
              </>
            )}
          </h1>

          <p className="about-hero-lead">
            {isId
              ? 'Jelajahi kartu One Piece dan Pokémon, catat koleksi pribadi, dan temukan listing komunitas One Piece. Fitur Pokémon masih terus dikembangkan.'
              : 'Browse One Piece and Pokémon cards, keep a personal collection, and explore community listings for One Piece. Pokémon features are still being built.'}
          </p>

          <div className="about-hero-actions">
            <Link className="button about-primary-action" href="/cards">
              <Compass size={17} weight="bold" />
              <span>{isId ? 'Jelajahi Katalog Kartu' : 'Browse Card Library'}</span>
              <ArrowRight size={15} />
            </Link>
            <Link className="button secondary about-secondary-action" href="/decks/builder">
              <Stack size={17} />
              <span>{isId ? 'Buka Pembuat Deck' : 'Open Deck Builder'}</span>
            </Link>
            <Link className="button secondary about-secondary-action" href="/market">
              <Storefront size={17} />
              <span>{isId ? 'Market & Koleksi' : 'Market & Vault'}</span>
            </Link>
            <Link className="button secondary about-secondary-action" href="/pokemon/cards">
              <Cards size={17} />
              <span>{isId ? 'Kartu Pokémon' : 'Pokémon cards'}</span>
            </Link>
          </div>
        </div>

        {/* HERO STATS BAR */}
        <div className="about-stats-container">
          <div className="about-stats-grid">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="about-stat-card">
                  <div className="about-stat-icon">
                    <Icon size={20} />
                  </div>
                  <div className="about-stat-body">
                    <strong className="about-stat-val">{stat.value}</strong>
                    <span className="about-stat-lbl">{stat.label}</span>
                    <small className="about-stat-sub">{stat.sub}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. THE INSPIRATION & ORIGIN */}
      <section className="about-lore-section">
        <div className="about-lore-inner">
          <div className="about-lore-header">
            <span className="about-section-kicker">
              <Anchor size={14} weight="bold" />
              {isId ? 'LATAR BELAKANG' : 'THE PROJECT'}
            </span>
            <h2>{isId ? 'Mengapa VivrePlay?' : 'Why VivrePlay?'}</h2>
          </div>

          <div className="about-lore-grid">
            <div className="about-lore-quote-card">
              <div className="about-quote-mark">“</div>
              <blockquote>
                {isId
                  ? 'Secarik kertas yang selalu mengarah ke rekan kru Anda melintasi samudra.'
                  : 'A simple piece of paper that always points toward your crewmates.'}
              </blockquote>
              <cite>{isId ? 'Konsep Vivre Card dalam One Piece' : 'The Vivre Card in One Piece'}</cite>
              <div className="about-lore-seal">
                <VivreMark size={32} />
              </div>
            </div>

            <div className="about-lore-prose">
              <p>
                {isId
                  ? 'VivrePlay bermula sebagai kumpulan alat untuk pemain One Piece Card Game: katalog kartu, pembuat deck, pencatatan koleksi, dan listing komunitas. Kini katalog dan pencatatan koleksi Pokémon juga tersedia, sementara cakupan data serta fiturnya terus bertambah.'
                  : 'VivrePlay began as a set of tools for One Piece Card Game players: a card library, deck tools, collection tracking, and community listings. Pokémon is now part of the site too, with card browsing and collection tracking available while its catalog and features continue to grow.'}
              </p>
              <p>
                {isId
                  ? 'Fitur kedua permainan belum sama. Pembuat deck, latihan aturan, dan listing Market saat ini berfokus pada One Piece; kartu Pokémon dapat dijelajahi dan dicatat di Vault.'
                  : 'The two games do not share every tool. Deck building, rules practice, and Market listings currently focus on One Piece; Pokémon support is available in the library and Vault.'}
              </p>
              <p className="about-lore-conclusion">
                <strong>
                  {isId ? 'Dibuat untuk kebutuhan kolektor.' : 'Built around the cards you collect.'}
                </strong>{' '}
                {isId
                  ? 'Lihat fitur yang tersedia sekarang, sementara cakupan Pokémon terus dikembangkan.'
                  : 'See what is supported today, with more Pokémon coverage being added over time.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features available across the site */}
      <section className="about-pillars-section" aria-label="Core Capabilities">
        <div className="about-pillars-header">
          <span className="about-section-kicker">
            <BookOpen size={14} weight="bold" />
            {isId ? 'FITUR' : 'FEATURES'}
          </span>
          <h2>{isId ? 'Fitur yang dirancang untuk pemain dan kolektor.' : 'Features built for players and collectors.'}</h2>
          <p>
            {isId
              ? 'Jelajahi cetakan yang tersedia, susun deck, catat koleksi, dan berlatih interaksi kartu.'
              : 'Browse the card libraries, build One Piece decks, and keep a personal collection for either game.'}
          </p>
        </div>

        <div className="about-pillars-grid">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article key={pillar.num} className="about-pillar-card">
                <div className="about-pillar-top">
                  <span className="about-pillar-number">{pillar.num}</span>
                  <span className="about-pillar-tag">{pillar.tag}</span>
                </div>

                <div className="about-pillar-icon-badge">
                  <Icon size={24} />
                </div>

                <h3 className="about-pillar-title">{pillar.title}</h3>
                <p className="about-pillar-desc">{pillar.desc}</p>

                <Link className="about-pillar-link" href={pillar.link}>
                  <span>{pillar.linkText}</span>
                  <ArrowRight size={14} />
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      {/* 4. PRINCIPLES & FOCUS */}
      <section className="about-tech-section" aria-label="Principles & Focus">
        <div className="about-tech-header">
          <span className="about-section-kicker">
            <CheckCircle size={14} weight="bold" />
            {isId ? 'PRINSIP KAMI' : 'OUR PRINCIPLES'}
          </span>
          <h2>{isId ? 'Hal yang kami utamakan.' : 'What we care about.'}</h2>
          <p>
            {isId
              ? 'Kami meyakini bahwa komunitas permainan kartu berhak menikmati aplikasi yang praktis, cepat, dan menghargai kartu fisiknya.'
              : 'We believe card game players deserve software that feels direct, reliable, and respectful of physical cards.'}
          </p>
        </div>

        <div className="about-tech-grid">
          {principles.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="about-tech-card">
                <div className="about-tech-icon-wrap">
                  <Icon size={22} />
                </div>
                <h4>{item.title}</h4>
                <p>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* 5. FREQUENTLY ASKED QUESTIONS */}
      <section className="about-faq-section" aria-label="Frequently Asked Questions">
        <div className="about-faq-header">
          <span className="about-section-kicker">
            <Compass size={14} weight="bold" />
            {isId ? 'PERTANYAAN UMUM' : 'FREQUENTLY ASKED QUESTIONS'}
          </span>
          <h2>{isId ? 'Pertanyaan seputar VivrePlay.' : 'Common questions about VivrePlay.'}</h2>
        </div>

        <div className="about-faq-list">
          {faqs.map((faq, index) => {
            const isOpen = expandedFaq === index;
            return (
              <div
                key={faq.q}
                className={`about-faq-item ${isOpen ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className="about-faq-trigger"
                  onClick={() => toggleFaq(index)}
                  aria-expanded={isOpen}
                >
                  <span className="about-faq-question">{faq.q}</span>
                  <CaretDown
                    size={16}
                    className={`about-faq-arrow ${isOpen ? 'is-rotated' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="about-faq-answer">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 6. COMMUNITY & TRADEMARK ATTRIBUTION */}
      <section className="about-disclaimer-card" aria-label="Legal & Trademark Notice">
        <div className="about-disclaimer-header">
          <div className="about-disclaimer-emblem">
            <VivreMark size={28} />
          </div>
          <div>
            <span className="about-section-kicker">
              {isId ? 'PEMBERITAHUAN MEREK DAGANG' : 'TRADEMARK & COMMUNITY NOTICE'}
            </span>
            <h3>{isId ? 'Penghormatan untuk Karya Asli' : 'Respect for the Original Creators'}</h3>
          </div>
        </div>

        <div className="about-disclaimer-content">
          <p>
            {isId
              ? 'VivrePlay adalah proyek penggemar independen yang dibuat secara sukarela oleh komunitas dan tidak berafiliasi dengan, disponsori oleh, atau disetujui oleh Bandai Co., Ltd., Shueisha, maupun Toei Animation.'
              : 'VivrePlay is an independent, non-commercial fan project created by the community and is not affiliated with, sponsored by, or approved by Bandai Co., Ltd., Shueisha, or Toei Animation.'}
          </p>
          <p>
            {isId
              ? 'One Piece dan karakter terkait adalah hak cipta © Eiichiro Oda / Shueisha, Toei Animation. One Piece Card Game adalah milik © Bandai Co., Ltd. Pokémon dan karakter terkait adalah hak cipta © Nintendo, Creatures Inc., GAME FREAK inc., dan The Pokémon Company. VivrePlay adalah proyek penggemar independen dan tidak berafiliasi dengan pemilik hak tersebut.'
              : 'One Piece and related characters are © Eiichiro Oda / Shueisha, Toei Animation; One Piece Card Game materials are © Bandai Co., Ltd. Pokémon and related names, characters, and artwork are © Nintendo, Creatures Inc., GAME FREAK inc., and The Pokémon Company. All trademarks and copyrights belong to their respective owners. VivrePlay is an independent fan project and is not affiliated with these companies.'}
          </p>
        </div>

        <div className="about-disclaimer-footer">
          <span>{isId ? 'Dibuat untuk para pemain dan kolektor kartu di mana pun berada.' : 'Made for players and collectors everywhere.'}</span>
          <Link href="/" className="about-footer-back-link">
            <span>{isId ? 'Kembali ke Beranda' : 'Return to Home'}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
