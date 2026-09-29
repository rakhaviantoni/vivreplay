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
      value: '7,500+',
      label: isId ? 'Versi Cetak Kartu' : 'Card Printings',
      sub: isId ? 'OP-01 s/d OP-18, EB, ST & Promo' : 'OP-01 to OP-18, EB, ST & Promos',
      icon: Cards,
    },
    {
      value: 'Dual',
      label: isId ? 'Bahasa Jepang & Inggris' : 'Language Sync',
      sub: isId ? 'Sinkronisasi rilis JP dan EN' : 'Original JP & localized EN',
      icon: Scales,
    },
    {
      value: 'Live',
      label: isId ? 'Tolok Ukur Pasar' : 'Market Benchmark',
      sub: isId ? 'Data ritel Yuyu-tei & transaksi' : 'Yuyu-tei retail data & sales',
      icon: Coins,
    },
    {
      value: '100% Free',
      label: isId ? 'Proyek Komunitas' : 'Community Driven',
      sub: isId ? 'Bebas iklan, tanpa biaya langganan' : 'No paywalls, ads, or fees',
      icon: ShieldCheck,
    },
  ];

  const pillars = [
    {
      num: '01',
      title: isId ? 'Katalog Kartu & Registri Varian' : 'Card Database & Printings',
      tag: isId ? 'OP-01 s/d OP-18 · JP & EN' : 'OP-01 to OP-18 · JP & EN',
      desc: isId
        ? 'Setiap kartu dari Romance Dawn hingga rilisan terbaru OP-18, Extra Booster, Starter Deck, dan kartu promo turnamen. Bandingkan versi Jepang dan Inggris, telusuri varian parallel art dan Manga Rare, serta cek riwayat ralat aturan resmi Bandai.'
        : 'Every set from Romance Dawn through OP-18, Extra Boosters, Starter Decks, and tournament promos. Compare Japanese and English prints side-by-side, view Manga Rares and parallel arts, and read official Bandai erratas.',
      link: '/cards',
      linkText: isId ? 'Buka katalog kartu' : 'Browse card library',
      icon: Cards,
    },
    {
      num: '02',
      title: isId ? 'Pembuat Deck' : 'Deck Builder',
      tag: isId ? 'Kurva Don!! · Sinergi Kartu' : 'Cost Curves · Synergy Stats',
      desc: isId
        ? 'Susun dan uji deck dengan kalkulasi kurva biaya Don!!, distribusi counter power, dan sinergi Leader secara langsung. Ekspor gambar visual deck atau salin kode teks yang siap digunakan untuk turnamen.'
        : 'Build and test decklists with live Don!! cost curves, counter distribution, and leader synergies. Export visual deck images or copy text codes ready for tournament deck registration.',
      link: '/decks/builder',
      linkText: isId ? 'Susun deck baru' : 'Build a deck',
      icon: Stack,
    },
    {
      num: '03',
      title: isId ? 'Market & Vault Koleksi' : 'Market & Collection Vault',
      tag: isId ? 'Tolok Ukur Yuyu-tei · Raw & Slab' : 'Yuyu-tei Benchmark · Raw & Slabs',
      desc: isId
        ? 'Catat kartu binder lepasan maupun slab bergradasi (PSA, BGS, CGC, ARS). Jelajahi listing jual-beli antar pemain dengan tolok ukur harga ritel toko hobi Yuyu-tei Jepang.'
        : 'Catalog your raw binder cards and graded slabs (PSA, BGS, CGC, ARS). Browse player-to-player listings benchmarked against Japanese hobby retailer Yuyu-tei.',
      link: '/market',
      linkText: isId ? 'Buka Market & Vault' : 'Browse Market & Vault',
      icon: Storefront,
    },
    {
      num: '04',
      title: isId ? 'Arena Simulasi Aturan' : 'Rules & Practice Arena',
      tag: isId ? 'Aturan Resmi · Simulasi Meja' : 'Official Rules · Interactive Table',
      desc: isId
        ? 'Pelajari alur fase giliran, alokasi Don!!, waktu trigger, dan penyelesaian efek kata kunci pada meja simulasi digital yang mengikuti buku aturan komprehensif resmi Bandai.'
        : 'Learn turn phases, Don!! allocation, trigger timing, and keyword interactions on an interactive board calibrated against official Bandai tournament rules.',
      link: '/play',
      linkText: isId ? 'Masuk ke Arena' : 'Enter the arena',
      icon: Sword,
    },
  ];

  const principles = [
    {
      icon: Compass,
      title: isId ? 'Fokus & Bebas Iklan' : 'Fast & Ad-Free',
      desc: isId
        ? 'Pemuatan cepat, navigasi ringkas, dan bebas dari iklan banner atau popup yang mengganggu.'
        : 'Fast loading times, clean layouts, and zero intrusive ads, tracking banners, or paywalls.',
    },
    {
      icon: Scales,
      title: isId ? 'Dukungan Setara JP & EN' : 'First-Class JP & EN Support',
      desc: isId
        ? 'Perhatian penuh untuk rilisan asli Jepang maupun cetakan bahasa Inggris, dengan verifikasi nomor kartu dan tanggal rilis.'
        : 'First-class treatment for both Japanese original releases and English editions with verified set numbers and errata dates.',
    },
    {
      icon: Sparkle,
      title: isId ? 'Kualitas Gambar Kartu' : 'High-Quality Imagery',
      desc: isId
        ? 'Tampilan gambar kartu yang tajam untuk memperlihatkan tekstur foil, parallel art, dan detail sertifikasi slab gradasi.'
        : 'Crisp card imagery showing parallel art textures, foil stamps, and graded slab certification details.',
    },
    {
      icon: Trophy,
      title: isId ? 'Dibuat untuk Komunitas' : 'Built for the Community',
      desc: isId
        ? 'Dibuat dan dirawat secara independen oleh sesama pemain kartu. Seluruh fitur dapat digunakan gratis.'
        : 'Built and maintained independently by players for the community. All tools remain completely free.',
    },
  ];

  const faqs = [
    {
      q: isId ? 'Apakah VivrePlay gratis digunakan?' : 'Is VivrePlay free to use?',
      a: isId
        ? 'Ya, 100% gratis. Mencari kartu, menyusun deck, mencatat koleksi di Vault, melihat listing di Market, dan latihan di Arena dapat diakses tanpa biaya atau langganan.'
        : 'Yes, completely free. Looking up cards, building decks, managing your collection in the Vault, browsing Market listings, and practicing in the Arena require no paid subscription.',
    },
    {
      q: isId ? 'Bagaimana kartu versi Jepang (JP) dan Inggris (EN) dikelola?' : 'How are Japanese (JP) and English (EN) cards organized?',
      a: isId
        ? 'Setiap kartu terhubung ke data cetakan bahasa Jepang dan bahasa Inggris. Anda dapat beralih bahasa di setiap kartu untuk memeriksa perbedaan teks efek, varian kelangkaan, dan tanggal rilis.'
        : 'Every card entry links its Japanese and English printings. You can switch languages on any card page to compare effect texts, rarity variants, and regional release dates.',
    },
    {
      q: isId ? 'Dari mana asal tolok ukur harga pasar?' : 'Where do market benchmark prices come from?',
      a: isId
        ? 'Harga tolok ukur dihitung dari data ritel toko hobi Jepang terpercaya Yuyu-tei yang dipadukan dengan data transaksi komunitas, lalu dikonversi ke USD, JPY, dan IDR.'
        : 'Benchmark prices are based on retail pricing from Japanese hobby retailer Yuyu-tei combined with community market sales, converted into USD, JPY, and IDR for quick reference.',
    },
    {
      q: isId ? 'Bisakah saya mencatat kartu slab gradasi di Vault?' : 'Can I track graded slabs in my collection?',
      a: isId
        ? 'Bisa. Vault mendukung kartu raw lepasan maupun slab gradasi dari PSA, BGS (Beckett), CGC, dan ARS lengkap dengan nomor sertifikasi dan sub-grade.'
        : 'Yes. The Vault supports raw binder cards as well as graded slabs from PSA, BGS (Beckett), CGC, and ARS, including grade numbers and certification IDs.',
    },
    {
      q: isId ? 'Bagaimana ralat teks kartu dan aturan resmi diperbarui?' : 'How are card erratas and rules maintained?',
      a: isId
        ? 'Kami memperbarui teks efek dan catatan aturan berdasarkan dokumen ralat resmi dan lembar FAQ juri turnamen dari Bandai secara berkala.'
        : 'We regularly update card texts and ruling clarifications from official Bandai tournament FAQ sheets and errata announcements.',
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
            <span>{isId ? 'TENTANG VIVREPLAY · PANDUAN ONE PIECE TCG' : 'ABOUT VIVREPLAY · ONE PIECE TCG COMPANION'}</span>
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
              ? 'VivrePlay menyatukan database kartu Jepang dan Inggris, pembuat deck, pencatatan koleksi vault, dan tolok ukur harga pasar ke dalam satu aplikasi web yang bersih — tanpa iklan, tanpa paywall, dan dibuat oleh sesama pemain.'
              : 'VivrePlay combines a bilingual card catalog (JP & EN), deck builder, collection vault, and market price benchmarks into one clean web app — with no ads, no paywalls, and built by active players.'}
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
              <span>{isId ? 'Market & Vault' : 'Market & Vault'}</span>
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
                  ? 'Seperti Vivre Card yang menjaga rekan kru tetap terhubung, VivrePlay dirancang untuk menjadi titik rujukan yang praktis dan andal: pencarian kartu instan, teks efek akurat, registri varian cetak asli, serta tolok ukur harga ritel yang transparan.'
                  : 'Like the Vivre Card that keeps crewmates connected, VivrePlay is designed to be a straightforward reference point: fast card lookups, accurate effect texts, genuine variant registries, and fair retail benchmarks.'}
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
              ? 'Mulai dari memeriksa kartu parallel art di koleksi hingga mempersiapkan kurva deck untuk turnamen, VivrePlay dibuat untuk melengkapi permainan Anda.'
              : 'From checking a parallel art in your binder to tuning your tournament deck curve, VivrePlay covers every aspect of the physical card game.'}
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
