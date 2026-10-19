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
      SELECT p.card_image_url AS imageUrl,p.source_payload AS sourcePayload
      FROM tcg_card_printings p
      JOIN tcg_card_identities i ON i.id=p.identity_id
      JOIN tcg_games g ON g.id=i.game_id
      WHERE g.slug='pokemon' AND p.language=?
        AND UPPER(p.set_code)=UPPER(?) AND UPPER(p.printing_code)=UPPER(?)
      LIMIT 1
    `).bind(language, setCode, cardCode).first<{ imageUrl: string | null; sourcePayload: string }>();
    if (!row) return new Response('Not found', { status: 404 });
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(row.sourcePayload) as Record<string, unknown>; } catch { /* Try the catalog path only. */ }
    const set = payload.set && typeof payload.set === 'object' ? payload.set as Record<string, unknown> : {};
    const serie = set.serie && typeof set.serie === 'object' ? set.serie as Record<string, unknown> : {};
    const sourceSet = String(set.id ?? setCode);
    const serieId = String(serie.id ?? '');
    const localId = String(payload.localId ?? cardCode);
    const sourceLanguage = language === 'JP' ? 'ja' : language.toLowerCase();
    const cardCount = set.cardCount && typeof set.cardCount === 'object' ? set.cardCount as Record<string, unknown> : {};
    const officialCountRaw = String(cardCount.official ?? '');
    const officialCount = /^[0-9]{1,4}$/.test(officialCountRaw) ? officialCountRaw.padStart(3, '0') : '';
    const candidates: string[] = [];
    if (row.imageUrl) {
      const imageUrl = row.imageUrl.replace(/\/$/, '');
      if (/\.(?:png|webp|jpe?g)$/i.test(imageUrl)) candidates.push(imageUrl);
      else candidates.push(`${imageUrl}/high.webp`, `${imageUrl}/low.webp`);
    }
    for (const lang of language === 'JP' ? ['ja', 'jp'] : [sourceLanguage]) {
      for (const directory of [serieId ? `${lang}/${serieId}/${sourceSet}` : '', `${lang}/${sourceSet}`].filter(Boolean)) {
        candidates.push(`https://assets.tcgdex.net/${directory}/${encodeURIComponent(localId)}/high.webp`);
        candidates.push(`https://assets.tcgdex.net/${directory}/${encodeURIComponent(localId)}/low.webp`);
      }
    }
    if (language === 'ID' || language === 'JP') {
      const safeSetCodes = [...new Set([sourceSet, sourceSet.toUpperCase(), sourceSet.toLowerCase()])]
        .filter(value => /^[a-z0-9_-]{1,40}$/i.test(value));
      const safeNumber = /^[a-z0-9._-]{1,32}$/i.test(localId) ? localId : '';
      const safeTotal = /^[0-9]{1,4}$/.test(officialCount) ? officialCount : '';
      if (safeNumber && safeTotal) {
        const prefix = language === 'JP' ? 'jp/' : '';
        for (const code of safeSetCodes) candidates.push(`https://cdn.pokepedia.id/${prefix}${encodeURIComponent(code)}/${encodeURIComponent(`${safeNumber}_${safeTotal}.webp`)}`);
      }
    }
    return tcgdexArtResponse(candidates);
  } catch {
    return new Response('Image unavailable', { status: 503 });
  }
}
