import {isIndonesianRequest} from './locale';
import {localeHref} from './locale-path';
import {pageMetadata} from './site-metadata';

const indonesian: Record<string, [string, string]> = {
  '/': ['Katalog Kartu & Pembuat Deck One Piece', 'Cari kartu dan set One Piece, susun deck, kelola koleksi, dan jelajahi Market di VivrePlay.'],
  '/about': ['Tentang VivrePlay', 'Jelajahi katalog One Piece dan Pokémon serta fitur koleksi dan permainan di VivrePlay.'],
  '/cards': ['Katalog Kartu One Piece', 'Cari kartu One Piece berdasarkan nama, nomor, set, warna, tipe, bahasa, dan cetakan.'],
  '/cards/index': ['Indeks Kartu', 'Telusuri kartu One Piece berdasarkan set dan nomor kartu.'],
  '/sets': ['Arsip Set', 'Jelajahi rilisan One Piece Card Game dan kartu dalam setiap set.'],
  '/archetypes': ['Arketipe', 'Temukan kartu One Piece berdasarkan sifat dan arketipenya.'],
  '/decks': ['Deck', 'Susun, simpan, dan perbarui deck One Piece di VivrePlay.'],
  '/meta': ['Statistik Meta', 'Lihat tingkat kemenangan Leader, hasil turnamen, dan daftar deck One Piece.'],
  '/market': ['Market', 'Jelajahi listing kartu komunitas dan temukan kartu untuk koleksi Anda.'],
  '/pokemon': ['Katalog & Koleksi Pokémon TCG', 'Jelajahi kartu dan set Pokémon, kelola koleksi, dan lihat listing komunitas.'],
  '/pokemon/cards': ['Katalog Kartu Pokémon TCG', 'Jelajahi kartu Pokémon dan cetakannya dalam bahasa Indonesia, Inggris, dan Jepang.'],
  '/pokemon/sets': ['Set Pokémon TCG', 'Jelajahi rilisan, tanggal rilis, dan jumlah kartu setiap set Pokémon TCG.'],
  '/play': ['Arena', 'Latihan giliran One Piece Card Game di meja interaktif VivrePlay Arena.'],
  '/play/tutorial': ['Panduan Arena', 'Pelajari meja, zona, dan alur giliran One Piece melalui panduan interaktif.'],
  '/play/replay': ['Simulasi Pertandingan Turnamen', 'Ikuti simulasi pertandingan berdasarkan hasil turnamen dan daftar deck.'],
};

export async function requestPageMetadata(options: Parameters<typeof pageMetadata>[0]) {
  const locale = (await isIndonesianRequest()) ? 'ID' : 'EN';
  const translated = locale === 'ID' ? indonesian[options.path] : undefined;
  const metadata = pageMetadata({...options, path: localeHref(options.path, locale), ...(translated ? {title: translated[0], description: translated[1]} : {})});
  return {...metadata, alternates: {...metadata.alternates, languages: {'en': options.path, 'id': localeHref(options.path, 'ID'), 'x-default': options.path}}};
}
