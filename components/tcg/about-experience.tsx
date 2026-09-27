'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
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
import {VivreMark} from './brand-assets';

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
    setExpandedFaq(current => (current === index ? null : index));
  };

  const isId = language === 'ID';

  const stats = [
    {
      value: '7,500+',
      label: isId ? 'Versi Cetak Kartu' : 'Card Printings',
      sub: isId ? 'OP-01 s/d OP-17, EB, ST & Promo' : 'OP-01 to OP-17, EB, ST & Promos',
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
      title: isId ? 'Arsip Kartu & Registri Varian' : 'Complete Card & Printing Archive',
      tag: isId ? 'OP-01 s/d OP-17 · JP & EN' : 'OP-01 to OP-17 · JP & EN',
      desc: isId
        ? 'Setiap rilisan dari Romance Dawn hingga seri terbaru OP-17, Extra Booster (EB-01 s/d EB-03), Starter Deck, dan kartu promo turnamen. Bandingkan versi Jepang dan Inggris, periksa varian Manga Rare, SP, parallel art, serta riwayat ralat aturan resmi Bandai.'
        : 'Every card release from Romance Dawn up to the latest OP-17 booster, Extra Boosters (EB-01 to EB-03), Starter Decks, and tournament promos. Compare Japanese and English prints, check Manga Rares, SP cards, parallel arts, and official Bandai errata history.',
      link: '/cards',
      linkText: isId ? 'Buka katalog kartu' : 'Explore card library',
      icon: Cards,
    },
    {
      num: '02',
      title: isId ? 'Pembuat Deck & Analisis Taktis' : 'Tactical Deck Builder & Coach',
      tag: isId ? 'Kurva Don!! · Sinergi Kartu' : 'Don!! Curve · Synergy Stats',
      desc: isId
        ? 'Susun dan uji deck dengan perhitungan kurva Don!!, distribusi kekuatan counter, dan sinergi warna Leader secara langsung. Manfaatkan fitur analisis untuk evaluasi susunan kartu dan bagikan kode visual deck untuk turnamen lokal.'
        : 'Build and tune decks with live Don!! cost curves, counter power distribution, and leader color synergies. Evaluate your list with our coach feature and export visual deck codes ready for locals or online discussion.',
      link: '/decks/builder',
      linkText: isId ? 'Susun deck baru' : 'Build a deck',
      icon: Stack,
    },
    {
      num: '03',
      title: isId ? 'Marketplace & Vault Koleksi' : 'Marketplace & Collection Vault',
      tag: isId ? 'Benchmark Yuyu-tei · Raw & Slab' : 'Yuyu-tei Benchmark · Raw & Slabs',
      desc: isId
        ? 'Pantau portofolio koleksi Anda untuk kartu lepasan maupun slab bergradasi (PSA, BGS, CGC, ARS). Jelajahi listing jual-beli antar pemain dengan tolok ukur harga ritel Yuyu-tei Jepang dan unduh gambar komposit kartu untuk dibagikan.'
        : 'Track your collection across raw binder cards and graded slabs (PSA, BGS, CGC, ARS). Browse player-to-player listings with fair pricing benchmarked against Japanese hobby giant Yuyu-tei, and export clean listing graphics to share.',
      link: '/market',
      linkText: isId ? 'Masuk ke marketplace' : 'Browse marketplace',
      icon: Storefront,
    },
    {
      num: '04',
      title: isId ? 'Arena Latihan & Simulasi Aturan' : 'Arena Practice & Rules Engine',
      tag: isId ? 'Aturan Resmi · Papan Panduan' : 'Comprehensive Rules · Guided Table',
      desc: isId
        ? 'Pelajari dan latih urutan fase, penempelan Don!!, waktu trigger, serta penyelesaian efek kata kunci pada meja simulasi interaktif yang mengikuti buku aturan komprehensif resmi Bandai.'
        : 'Practice turn phases, trigger sequencing, Don!! management, and keyword interactions on a guided digital table calibrated with official Bandai tournament rulesets.',
      link: '/play',
      linkText: isId ? 'Masuk ke Arena' : 'Enter the arena',
      icon: Sword,
    },
  ];

  const principles = [
    {
      icon: Compass,
      title: isId ? 'Fokus pada Pengalaman Pemain' : 'Designed for Focus',
      desc: isId
        ? 'Navigasi cepat, teks efek kartu yang jelas, dan antarmuka bersih tanpa banner iklan mengganggu atau konten spekulatif.'
        : 'Fast navigation, clear card texts, and a calm layout free from intrusive banner ads or speculative crypto noise.',
    },
    {
      icon: Scales,
      title: isId ? 'Dukungan Setara JP & EN' : 'Equal Respect for JP & EN',
      desc: isId
        ? 'Kartu edisi Jepang dan rilisan bahasa Inggris diperlakukan setara dengan verifikasi nomor seri, varian seni, dan tanggal rilis.'
        : 'Both Japanese and English editions receive first-class treatment with authentic artwork variants, set numbers, and release dates.',
    },
    {
      icon: Sparkle,
      title: isId ? 'Apresiasi Fisik Kartu' : 'Appreciation for Physical Cards',
      desc: isId
        ? 'Tampilan gambar beresolusi tinggi yang memperlihatkan tekstur foil, cetakan khusus, dan sertifikasi slab gradasi dengan jelas.'
        : 'High-fidelity card scans that highlight foil stamps, alternate art textures, and verified graded slab certifications.',
    },
    {
      icon: Trophy,
      title: isId ? 'Dibuat untuk Komunitas' : 'Built for the Community',
      desc: isId
        ? 'Dibuat oleh pemain dan kolektor untuk sesama nakama. Seluruh pencarian kartu, perakitan deck, dan pelacakan koleksi dapat diakses bebas.'
        : 'Created by active players and collectors for fellow fans. All card lookups, deck tools, and collection features remain free.',
    },
  ];

  const faqs = [
    {
      q: isId ? 'Apakah VivrePlay gratis digunakan?' : 'Is VivrePlay free to use?',
      a: isId
        ? 'Ya, sepenuhnya gratis. Penelusuran kartu, pembuatan deck, pencarian di marketplace, pencatatan portofolio di Vault, dan simulasi di arena dapat digunakan tanpa biaya langganan.'
        : 'Yes, completely free. Looking up cards, building decks, searching the marketplace, tracking your portfolio in the Vault, and practicing in the Arena require no paid subscription.',
    },
    {
      q: isId ? 'Bagaimana kartu versi Jepang (JP) dan Inggris (EN) dikelola?' : 'How are Japanese (JP) and English (EN) cards organized?',
      a: isId
        ? 'Setiap kartu terhubung ke data cetakan bahasa Jepang dan bahasa Inggris. Anda dapat beralih bahasa di setiap halaman kartu untuk memeriksa perbedaan teks efek, varian kelangkaan, dan jadwal rilis.'
        : 'Every card identity is connected to its Japanese and English printings. You can switch languages on any card page to compare card text, rarity differences, and release schedules across regions.',
    },
    {
      q: isId ? 'Dari mana asal tolok ukur harga pasar?' : 'Where do market benchmark prices come from?',
      a: isId
        ? 'Harga patokan dihitung dari data ritel toko hobi Jepang terkemuka Yuyu-tei yang dipadukan dengan data transaksi komunitas terverifikasi, lalu dikonversi ke USD, JPY, dan IDR.'
        : 'Benchmark prices are based on retail pricing from Japanese hobby retailer Yuyu-tei combined with verified community sales, converted into USD, JPY, and IDR for quick reference.',
    },
    {
      q: isId ? 'Bisakah saya mencatat kartu slab gradasi di Vault?' : 'Can I track graded slabs in my collection?',
      a: isId
        ? 'Bisa. Vault mendukung pencatatan kartu raw lepasan maupun slab bergradasi dari lembaga PSA, BGS (Beckett), CGC, dan ARS lengkap dengan nomor sertifikasi dan sub-grade.'
        : 'Yes. The Vault lets you catalog raw binder cards as well as graded slabs from PSA, BGS (Beckett), CGC, and ARS, including grade numbers and certification IDs.',
    },
    {
      q: isId ? 'Bagaimana keakuratan ralat teks kartu dan aturan dijaga?' : 'How are card erratas and rules maintained?',
      a: isId
        ? 'Kami memperbarui teks efek dan catatan aturan berdasarkan dokumen ralat resmi dan lembar FAQ juri turnamen dari Bandai, sehingga persiapan tanding Anda tetap sesuai standar.'
        : 'We update card texts and ruling notes based on official Bandai FAQ releases and tournament judge documents so your tournament preparations stay accurate.',
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
                Meja kerja terpadu untuk komunitas <br />
                <span className="accent-highlight">One Piece Card Game.</span>
              </>
            ) : (
              <>
                A dedicated table for the <br />
                <span className="accent-highlight">One Piece Card Game</span> community.
              </>
            )}
          </h1>

          <p className="about-hero-lead">
            {isId
              ? 'Terinspirasi oleh Vivre Card, secarik kertas yang selalu mengarah ke rekan seperjuangan melintasi samudra, VivrePlay menyatukan pencarian kartu, perakitan deck, harga pasar, dan latihan bermain ke dalam satu tempat yang tenang dan terpercaya.'
              : 'Inspired by the Vivre Card, the scrap of paper that always points toward your crew across any ocean, VivrePlay brings card discovery, deck building, market pricing, and tabletop practice into one quiet, reliable place.'}
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
            {stats.map(stat => {
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
              {isId ? 'LATAR BELAKANG' : 'THE INSPIRATION'}
            </span>
            <h2>{isId ? 'Mengapa kami menamainya VivrePlay' : 'Why we named it VivrePlay'}</h2>
          </div>

          <div className="about-lore-grid">
            <div className="about-lore-quote-card">
              <div className="about-quote-mark">“</div>
              <blockquote>
                {isId
                  ? 'Secarik kertas yang diresapi jiwa kehidupan. Di tengah badai dan kabut samudra, kertas ini akan selalu bergerak dan menunjuk ke arah pemiliknya.'
                  : 'A scrap of paper imbued with life. Across storms and ocean fog, it always moves and points in the direction of its owner.'}
              </blockquote>
              <cite>{isId ? 'Konsep Vivre Card dalam One Piece' : 'The Vivre Card Concept in One Piece'}</cite>
              <div className="about-lore-seal">
                <VivreMark size={32} />
              </div>
            </div>

            <div className="about-lore-prose">
              <p>
                {isId
                  ? 'Dalam cerita One Piece, menjelajahi Grand Line membutuhkan lebih dari sekadar kompas biasa. Ketika rekan seperjuangan berpisah jalan, mereka merobek sepotong Vivre Card. Sekalipun terpisah lautan luas dan cuaca yang ganas, secarik kertas itu akan selalu menunjuk ke arah rekan mereka tanpa pernah keliru.'
                  : 'In One Piece, navigating the Grand Line takes more than an ordinary compass. When crewmates part ways, they tear a piece of a Vivre Card. Even through turbulent waters and thick fog, that small piece of paper always pulls toward their companions.'}
              </p>
              <p>
                {isId
                  ? 'Sebagai pemain dan kolektor One Piece Card Game, kami merasakan kebutuhan yang serupa. Data kartu dan ralat teks sering tercecer di berbagai wiki lama, daftar deck tersimpan di tangkapan layar media sosial yang buram, lini masa rilis kartu Jepang dan Inggris membingungkan, serta perbincangan harga kerap tertutup hiruk-pikuk spekulasi.'
                  : 'As One Piece Card Game players and collectors, we felt the community needed that same steady guide. Card data and erratas were scattered across disparate wikis, decklists were trapped in blurry screenshots, Japanese and English release timelines clashed, and pricing discussions were often obscured by noise.'}
              </p>
              <p className="about-lore-conclusion">
                <strong>
                  {isId
                    ? 'VivrePlay dibangun untuk menjadi kompas tersebut.'
                    : 'VivrePlay was built to be that steady compass.'}
                </strong>{' '}
                {isId
                  ? 'Sebuah meja kerja yang bersih dan cepat, tempat setiap versi cetak kartu, aturan permainan, dan ide susunan deck dapat ditelusuri dengan nyaman.'
                  : 'A clean, fast workspace where every card printing, ruling clarification, and deck idea is simple to find and explore.'}
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
            {isId ? 'FITUR UTAMA' : 'CORE CAPABILITIES'}
          </span>
          <h2>{isId ? 'Empat pilar untuk melengkapi permainan Anda.' : 'Four pillars built for every stage of your play.'}</h2>
          <p>
            {isId
              ? 'Mulai dari menelusuri kartu parallel art di koleksi hingga mempersiapkan kurva deck turnamen, VivrePlay dirancang untuk memenuhi kebutuhan pemain dan kolektor.'
              : 'From checking a parallel art in your binder to tuning your tournament deck curve, VivrePlay is engineered for collectors and competitors alike.'}
          </p>
        </div>

        <div className="about-pillars-grid">
          {pillars.map(pillar => {
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
            {isId ? 'PRINSIP KAMI' : 'WHAT WE CARE ABOUT'}
          </span>
          <h2>{isId ? 'Standar yang kami pegang untuk setiap fitur.' : 'The standards we hold for every feature.'}</h2>
          <p>
            {isId
              ? 'Kami meyakini bahwa komunitas permainan kartu berhak menikmati aplikasi yang praktis, cepat, dan menghargai kartu fisiknya.'
              : 'We believe card game players deserve software that feels direct, reliable, and respectful of physical cards.'}
          </p>
        </div>

        <div className="about-tech-grid">
          {principles.map(item => {
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
          <h2>{isId ? 'Pertanyaan seputar penggunaan VivrePlay.' : 'Common questions about VivrePlay.'}</h2>
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
          <span>{isId ? 'Dibuat untuk para nakama dan pemain kartu di mana pun berada.' : 'Made for players, collectors, and nakama everywhere.'}</span>
          <Link href="/" className="about-footer-back-link">
            <span>{isId ? 'Kembali ke Beranda' : 'Return to Home'}</span>
            <ArrowUpRight size={14} />
          </Link>
        </div>
      </section>
    </main>
  );
}
