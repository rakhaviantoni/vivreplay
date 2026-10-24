'use client';

import Link from 'next/link';
import {useEffect, useState} from 'react';
import {ArrowUpRightIcon as ArrowUpRight, CardsIcon as Cards, StackIcon as Stack, StorefrontIcon as Storefront, BooksIcon as Books, GameControllerIcon as GameController, QuestionIcon as Question} from '@phosphor-icons/react';
import {GAME_LOGOS, VivreMark} from './brand-assets';
import {Tabs, TabsContent, TabsList, TabsTrigger} from '@/components/ui/tabs';

type Locale = 'EN' | 'ID';

export function AboutExperience() {
  const [language, setLanguage] = useState<Locale>('EN');
  const isId = language === 'ID';

  useEffect(() => {
    const syncLocale = () => setLanguage(window.localStorage.getItem('vivreplay-locale') === 'ID' ? 'ID' : 'EN');
    const onLocale = (event: Event) => setLanguage((event as CustomEvent<Locale>).detail);
    syncLocale();
    window.addEventListener('vivreplay:locale', onLocale);
    return () => window.removeEventListener('vivreplay:locale', onLocale);
  }, []);

  const games = [
    {
      id: 'one-piece' as const,
      title: 'One Piece Card Game',
      description: isId ? 'Dari mencari kartu hingga menyusun deck untuk pertandingan berikutnya.' : 'From finding a card to building your next deck.',
      languages: 'EN / JP',
      tools: [
        {href:'/cards', icon:Cards, title:isId?'Katalog kartu':'Card library', description:isId?'Cari nama, set, warna, cost, atau tipe kartu.':'Search by name, set, color, cost, or card type.'},
        {href:'/decks/builder', icon:Stack, title:isId?'Pembuat deck':'Deck Builder', description:isId?'Susun, simpan, dan bagikan deck.':'Build, save, and share your deck.'},
        {href:'/play', icon:GameController, title:isId?'Arena latihan':'Practice Arena', description:isId?'Latihan giliran dan interaksi kartu di browser.':'Practice turns and card interactions in your browser.'},
        {href:'/market', icon:Storefront, title:'Market', description:isId?'Jelajahi listing kartu dari komunitas.':'Explore card listings from the community.'},
      ],
    },
    {
      id: 'pokemon' as const,
      title: 'Pokémon TCG',
      description: isId ? 'Temukan cetakan yang dicari dan catat koleksi Anda, kartu demi kartu.' : 'Find the printing you want and track your collection, card by card.',
      languages: 'EN / JP / ID',
      tools: [
        {href:'/pokemon/cards', icon:Cards, title:isId?'Katalog kartu':'Card library', description:isId?'Cari kartu dan bandingkan versi cetaknya.':'Find cards and compare their printings.'},
        {href:'/pokemon/sets', icon:Books, title:isId?'Jelajahi set':'Browse sets', description:isId?'Lihat kartu dalam setiap ekspansi.':'Explore the cards in each expansion.'},
        {href:'/vault?game=pokemon', icon:Stack, title:'Vault', description:isId?'Catat jumlah, kondisi, dan kartu graded.':'Keep track of copies, condition, and graded cards.'},
      ],
    },
  ];

  const localize = (path: string) => isId ? `/id${path}` : path;

  return (
    <main className="page about-page">
      <header className="directory-hero page-intro-surface about-intro">
        <p className="eyebrow about-intro-label"><VivreMark size={24}/>{isId ? 'TENTANG VIVREPLAY' : 'ABOUT VIVREPLAY'}</p>
        <h1>{isId ? 'Kartu untuk dimainkan. Koleksi untuk disimpan.' : 'Cards to play. Collections to keep.'}</h1>
        <p>
          {isId
            ? 'Jelajahi kartu One Piece dan Pokémon, susun deck One Piece, lalu simpan koleksi kedua permainan di satu Vault.'
            : 'Browse One Piece and Pokémon cards, build One Piece decks, and keep both collections in one Vault.'}
        </p>
        <div className="about-intro-actions">
          <Link className="button" href={localize('/cards')}><Cards size={17}/>{isId ? 'Kartu One Piece' : 'One Piece cards'}<ArrowUpRight size={15}/></Link>
          <Link className="button secondary" href={localize('/pokemon/cards')}><Cards size={17}/>{isId ? 'Kartu Pokémon' : 'Pokémon cards'}<ArrowUpRight size={15}/></Link>
        </div>
      </header>

      <section className="about-games" aria-labelledby="about-games-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{isId ? 'PILIH PERMAINAN' : 'THE CARD GAMES'}</p>
            <h2 id="about-games-title">{isId ? 'Dua katalog, dengan alat yang sesuai.' : 'Two catalogs, with tools for each.'}</h2>
          </div>
        </div>

        <Tabs defaultValue="one-piece" className="about-explorer">
          <TabsList className="about-game-tabs" aria-label={isId ? 'Pilih permainan' : 'Choose a game'}>
            {games.map(game => <TabsTrigger key={game.id} value={game.id} className={`about-game-tab is-${game.id}`}>
              <img src={GAME_LOGOS[game.id]} alt={game.title} width={180} height={64}/>
            </TabsTrigger>)}
          </TabsList>
          {games.map(game => <TabsContent key={game.id} value={game.id} className={`about-game-panel is-${game.id}`}>
            <div className="about-game-overview">
              <span className="about-language-note">{isId ? 'Bahasa kartu' : 'Card languages'} <b>{game.languages}</b></span>
              <h3>{game.title}</h3>
              <p>{game.description}</p>
              <Link className="text-action" href={localize(game.tools[0].href)}>{isId ? 'Jelajahi kartu' : 'Explore cards'} <ArrowUpRight size={16}/></Link>
            </div>
            <nav className="about-tool-list" aria-label={isId ? `Fitur ${game.title}` : `${game.title} tools`}>
              {game.tools.map(tool => <Link key={tool.href} href={localize(tool.href)} className="about-tool-link">
                <tool.icon size={23} aria-hidden="true"/>
                <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
                <ArrowUpRight size={18} aria-hidden="true"/>
              </Link>)}
            </nav>
          </TabsContent>)}
        </Tabs>
      </section>

      <section className="home-utility about-vault" aria-labelledby="about-vault-title">
        <div>
          <p className="eyebrow">{isId ? 'SATU KOLEKSI' : 'ONE COLLECTION'}</p>
          <h2 id="about-vault-title">{isId ? 'Simpan kedua permainan di Vault.' : 'Keep both games in your Vault.'}</h2>
          <p>{isId ? 'Catat versi cetak, jumlah, kondisi, dan kartu graded yang Anda miliki.' : 'Track printings, quantities, condition, and graded cards you own.'}</p>
        </div>
        <div className="utility-links">
          <Link href={localize('/vault')}><Stack size={20}/><span><b>{isId ? 'Buka Vault' : 'Open your Vault'}</b><small>{isId ? 'Koleksi One Piece dan Pokémon' : 'One Piece and Pokémon collections'}</small></span><ArrowUpRight size={16}/></Link>
          <Link href={localize('/faq')}><Question size={20}/><span><b>{isId ? 'Bantuan dan FAQ' : 'Help and FAQs'}</b><small>{isId ? 'Jawaban tentang fitur dan akun' : 'Answers about features and accounts'}</small></span><ArrowUpRight size={16}/></Link>
        </div>
      </section>

      <footer className="about-disclosure">
        <VivreMark size={24}/>
        <p>
          {isId
            ? 'VivrePlay adalah proyek penggemar independen dan tidak berafiliasi dengan Bandai, Nintendo, Creatures, GAME FREAK, atau The Pokémon Company. Semua merek dan hak cipta milik pemegangnya.'
            : 'VivrePlay is an independent fan project and is not affiliated with Bandai, Nintendo, Creatures, GAME FREAK, or The Pokémon Company. All trademarks and copyrights belong to their respective owners.'}
        </p>
        <Link className="text-action" href={localize('/legal/terms')}>{isId ? 'Ketentuan' : 'Terms'} <ArrowUpRight size={14}/></Link>
      </footer>
    </main>
  );
}
