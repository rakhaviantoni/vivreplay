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
  ShieldCheckIcon as ShieldCheck,
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
      value: 'Browse',
      label: isId ? 'Katalog Kartu' : 'Card Library',
      sub: isId ? 'Cari kartu dan cetakannya' : 'Search cards and printings',
      icon: Cards,
    },
    {
      value: 'JP + EN',
      label: isId ? 'Bahasa Kartu' : 'Card Languages',
      sub: isId ? 'Jelajahi data kartu JP dan EN' : 'Explore JP and EN card data',
      icon: Scales,
    },
    {
      value: 'Build',
      label: isId ? 'Deck dan Koleksi' : 'Decks and Collections',
      sub: isId ? 'Atur deck dan koleksi kartu' : 'Organize decks and card vault',
      icon: Coins,
    },
    {
      value: 'Play',
      label: isId ? 'Arena Online' : 'Online Arena',
      sub: isId ? 'Latihan permainan di browser' : 'Practice games in your browser',
      icon: ShieldCheck,
    },
  ];

  const pillars = [
    {
      num: '01',
      title: isId ? 'Katalog Kartu & Registri Varian' : 'Card Database & Printings',
      tag: isId ? 'Data kartu JP & EN' : 'JP & EN card data',
      desc: isId
        ? 'Cari kartu dan cetakannya berdasarkan nama, nomor, set, warna, atau tipe. Periksa detail yang tersedia dan bandingkan data versi Jepang dan Inggris.'
        : 'Search cards and printings by name, number, set, color, or type. Explore available card details and compare Japanese and English data.',
      link: '/cards',
      linkText: isId ? 'Buka katalog kartu' : 'Browse card library',
      icon: Cards,
    },
    {
      num: '02',
      title: isId ? 'Pembuat Deck' : 'Deck Builder',
      tag: isId ? 'Kurva Don!! · Sinergi Kartu' : 'Cost Curves · Synergy Stats',
      desc: isId
        ? 'Susun deck dengan pilihan filter kartu, lihat ringkasan komposisi, lalu simpan dan bagikan deck.'
        : 'Build decklists with card filters, review deck composition, then save and share your deck.',
      link: '/decks/builder',
      linkText: isId ? 'Susun deck baru' : 'Build a deck',
      icon: Stack,
    },
    {
      num: '03',
      title: isId ? 'Market & Koleksi' : 'Market & Collection Vault',
      tag: isId ? 'Market dan koleksi kartu' : 'Market and Card Vault',
      desc: isId
        ? 'Kelola kartu dalam koleksi pribadi dan telusuri listing Market yang tersedia.'
        : 'Manage cards in your personal collection and browse available Market listings.',
      link: '/market',
      linkText: isId ? 'Buka Market & Koleksi' : 'Browse Market & Vault',
      icon: Storefront,
    },
    {
      num: '04',
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
      title: isId ? 'Dukungan Setara JP & EN' : 'First-Class JP & EN Support',
      desc: isId
        ? 'Perhatian penuh untuk rilisan asli Jepang maupun cetakan bahasa Inggris, dengan verifikasi nomor kartu dan tanggal rilis.'
        : 'Explore Japanese and English card data where available.',
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
        ? 'Setiap kartu terhubung ke data cetakan bahasa Jepang dan bahasa Inggris. Anda dapat beralih bahasa di setiap kartu untuk memeriksa perbedaan teks efek, varian kelangkaan, dan tanggal rilis.'
        : 'Every card entry links its Japanese and English printings. You can switch languages on any card page to compare effect texts, rarity variants, and regional release dates.',
    },
    {
      q: isId ? 'Bagaimana informasi Market ditampilkan?' : 'How is Market information displayed?',
      a: isId
        ? 'Market menampilkan listing komunitas yang tersedia. Harga dan ketersediaan dapat berubah; periksa detail pada setiap listing.'
        : 'Market displays available community listings. Prices and availability can change; check each listing for details.',
    },
    {
      q: isId ? 'Bisakah saya mencatat kartu slab gradasi di koleksi?' : 'Can I track graded slabs in my collection?',
      a: isId
        ? 'Koleksi tersedia setelah masuk ke akun. Pilihan pencatatan yang didukung dapat dilihat di halaman koleksi.'
        : 'Vault is available after signing in. Check the Vault for currently supported collection details.',
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
            <span>{isId ? 'TENTANG VIVREPLAY · PENDAMPING ONE PIECE TCG' : 'ABOUT VIVREPLAY · ONE PIECE CARD GAME COMPANION'}</span>
            <span className="about-hero-badge">{isId ? 'Karya Komunitas' : 'Community Project'}</span>
          </div>

          <h1 className="about-hero-title">
            {isId ? (
              <>
                Aplikasi pendamping terbuka untuk <br />
                <span className="accent-highlight">One Piece Card Game.</span>
              </>
            ) : (
              <>
                A fast, open companion for the <br />
                <span className="accent-highlight">One Piece Card Game.</span>
              </>
            )}
          </h1>

          <p className="about-hero-lead">
            {isId
              ? 'VivrePlay menyediakan katalog kartu, pembuat deck, koleksi kartu, listing Market komunitas, dan arena latihan sebagai proyek penggemar independen.'
              : 'VivrePlay offers a card catalog, deck builder, collection vault, community Market listings, and practice arena as an independent fan project.'}
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
                  ? 'Kami membuat VivrePlay karena mencari informasi One Piece Card Game sering kali melelahkan. Catatan ralat teks dan klarifikasi juri tercecer di berbagai forum lama, daftar deck tersimpan di tangkapan layar buram, jadwal rilis kartu Jepang dan Inggris membingungkan, serta diskusi harga kerap tertutup spekulasi.'
                  : 'We built VivrePlay because keeping up with the One Piece Card Game was unnecessarily fragmented. Errata notices and ruling updates were buried in old forum posts, deck lists lived in blurry screenshots, Japanese and English release dates were hard to compare, and market discussions were obscured by speculation.'}
              </p>
              <p>
                {isId
                  ? 'VivrePlay menggabungkan pencarian kartu, detail cetakan yang tersedia, pembuat deck, pengelolaan koleksi, listing komunitas, dan arena latihan.'
              : 'VivrePlay brings card lookup, printing details, deck building, collection management, community listings, and browser-based practice into one place.'}
              </p>
              <p className="about-lore-conclusion">
                <strong>
                  {isId ? 'Satu meja kerja yang bersih dan terbuka.' : 'A clean, open workspace.'}
                </strong>{' '}
                {isId
                  ? 'Tempat setiap versi cetak kartu, aturan permainan, dan ide susunan deck dapat ditelusuri dengan nyaman oleh seluruh komunitas.'
                  : 'Where every card printing, ruling clarification, and deck idea is easy to explore for everyone in the community.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. FOUR CORE CAPABILITIES */}
      <section className="about-pillars-section" aria-label="Core Capabilities">
        <div className="about-pillars-header">
          <span className="about-section-kicker">
            <BookOpen size={14} weight="bold" />
            {isId ? 'FITUR UTAMA' : 'FEATURES'}
          </span>
          <h2>{isId ? 'Fitur yang dirancang untuk pemain dan kolektor.' : 'Features built for players and collectors.'}</h2>
          <p>
            {isId
              ? 'Jelajahi cetakan yang tersedia, susun deck, catat koleksi, dan berlatih interaksi kartu.'
              : 'Explore available printings, shape a deck, track a collection, and practice card interactions.'}
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
              ? 'One Piece beserta seluruh karakter dan elemen cerita adalah hak cipta © Eiichiro Oda / Shueisha, Toei Animation. One Piece Card Game beserta gambar kartu, nama, logo, simbol, dan teks aturan adalah milik © Bandai Co., Ltd. Seluruh merek dagang ditampilkan di sini semata-mata untuk tujuan informasi, referensi edukasi, dan apresiasi komunitas pemain.'
              : 'One Piece and all related characters are © Eiichiro Oda / Shueisha, Toei Animation. One Piece Card Game and all card illustrations, names, logos, symbols, and game text are © Bandai Co., Ltd. All trademarks and copyrights belong to their respective owners and appear here strictly for informational, educational, and community reference purposes.'}
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
