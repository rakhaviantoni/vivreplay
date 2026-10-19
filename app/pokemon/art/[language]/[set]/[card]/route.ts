import { database } from '@/lib/server/database';
import { tcgdexArtResponse } from '@/lib/server/tcgdex-art-response';

const languageCodes: Record<string, string> = { id: 'ID', en: 'EN', jp: 'JP', ja: 'JP' };

export async function GET(_request: Request, { params }: { params: Promise<{ language: string; set: string; card: string }> }) {
  const { language: rawLanguage, set: rawSet, card: rawCard } = await params;
  const language = languageCodes[rawLanguage.toLowerCase()];
  const setCode = rawSet;
  const cardCode = rawCard;
  if (!language || !/^[\p{L}\p{N}._-]{1,32}$/u.test(setCode) || !/^[\p{L}\p{N}._-]{1,32}$/u.test(cardCode)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    const row = await database().prepare(`
      SELECT p.card_image_url AS imageUrl
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      JOIN tcg_games g ON g.id=i.game_id
      WHERE g.slug='pokemon' AND p.language=?
        AND UPPER(p.set_code)=UPPER(?) AND UPPER(p.printing_code)=UPPER(?)
      LIMIT 1
    `).bind(language, setCode, cardCode).first<{ imageUrl: string | null }>();
    if (!row?.imageUrl) return new Response('Not found', { status: 404 });
    return tcgdexArtResponse(row.imageUrl);
  } catch {
    return new Response('Image unavailable', { status: 503 });
  }
}
