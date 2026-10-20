import { database } from '@/lib/server/database';

type EvolutionCard = { code: string; name: string; spriteName: string; stage: string; evolveFrom?: string; dexIds: string[] };
type EvolutionTree = EvolutionCard & { children: EvolutionTree[] };

const normalizedSql = (expression: string) => `replace(replace(replace(replace(replace(lower(trim(${expression})),'-',''),' ',''),'.',''),char(39),''),char(8217),'')`;
const normalizeName = (value: string) => value.toLocaleLowerCase().replace(/[-\s.'’]/g, '');
const normalizeSpecies = (value: string) => normalizeName(value.replace(/^(?:(?:dark|light)\s+|.+?'s\s+|holon's\s+)/i, ''));
const nodeKey = (card: EvolutionCard) => `${normalizeName(card.spriteName)}:${normalizeName(card.stage)}`;
const evolutionCorrections: Record<string, { stage?: string; parent?: string }> = {
  'PK-MISCP-001': { stage: 'Basic' },
  'PK-NEO4-37': { parent: 'Mysterious Fossil' },
};

function parsePayload(value: unknown): Record<string, unknown> {
  if (typeof value !== 'string') return value && typeof value === 'object' ? value as Record<string, unknown> : {};
  try { const parsed: unknown = JSON.parse(value); return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}; }
  catch { return {}; }
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const code = params.get('code')?.trim().slice(0, 64);
  const requestedParent = params.get('evolveFrom')?.trim().slice(0, 80);
  const requestedLanguage = params.get('language')?.toUpperCase();
  const language = requestedLanguage === 'JP' ? 'JP' : requestedLanguage === 'ID' ? 'ID' : 'EN';
  if (!code) return Response.json({ evolution: null }, { status: 400 });

  try {
    const db = database();
    const game = await db.prepare("SELECT id FROM tcg_games WHERE slug='pokemon' LIMIT 1").first<{ id: string }>();
    if (!game) return Response.json({ evolution: null });

    const toCard = (row: { code: string; name: string; sprite_name: string; source_payload: unknown }): EvolutionCard => {
      const payload = parsePayload(row.source_payload);
      const identityName = row.sprite_name || row.name;
      const correction = evolutionCorrections[row.code];
      const megaParent = /^M\s+/i.test(identityName) ? identityName.replace(/^M\s+/i, '').trim() : undefined;
      const vstarParent = /\s+VSTAR$/i.test(identityName) ? identityName.replace(/\s+VSTAR$/i, ' V').trim() : undefined;
      const vmaxParent = /\s+VMAX$/i.test(identityName) ? identityName.replace(/\s+VMAX$/i, ' V').trim() : undefined;
      const vUnion = /\s+V-UNION(?:\s+(?:TOP|BOTTOM|LEFT|RIGHT))?$/i.test(identityName);
      const vstar = Boolean(vstarParent);
      const vmax = Boolean(vmaxParent);
      const vCard = /\s+V$/i.test(identityName);
      const mechanicStage = vstar ? 'VSTAR' : vmax ? 'VMAX' : vUnion ? 'V-UNION' : vCard ? 'Basic' : undefined;
      const stage = correction?.stage ?? (megaParent ? 'MEGA' : mechanicStage ?? (typeof payload.stage === 'string' ? payload.stage.trim() : payload.category === 'Trainer' ? 'Trainer' : ''));
      const levelUpParent = /^LEVEL-UP$/i.test(stage) ? identityName.replace(/\s+LV\.?X$/i, '').trim() : undefined;
      const breakParent = /^BREAK$/i.test(stage) ? identityName.replace(/\s+BREAK$/i, '').trim() : undefined;
      const inferredParent = levelUpParent || breakParent;
      const evolvesFrom = correction?.parent ?? payload.evolvesFrom ?? payload.evolveFrom ?? megaParent ?? vstarParent ?? vmaxParent ?? inferredParent ?? (inferredParent === '' ? identityName : undefined);
      const dex = payload.dexId;
      const dexIds = (Array.isArray(dex) ? dex : dex === undefined || dex === null ? [] : [dex]).map(String).filter(Boolean);
      return { code: row.code, name: row.name, spriteName: identityName, stage, evolveFrom: typeof evolvesFrom === 'string' ? evolvesFrom.trim() : undefined, dexIds };
    };
    const byCode = async (cardCode: string) => {
      const row = await db.prepare(`
        SELECT i.code AS code, COALESCE(NULLIF(l.name,''),i.name) AS name, i.name AS sprite_name, p.source_payload
        FROM tcg_card_identities i
        JOIN tcg_card_printings p ON p.identity_id=i.id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
        WHERE i.game_id=? AND i.code=? AND json_valid(p.source_payload)
        ORDER BY CASE WHEN p.language=? THEN 0 WHEN p.language='EN' THEN 1 ELSE 2 END,p.id LIMIT 1
      `).bind(game.id, cardCode, language).first<{ code: string; name: string; sprite_name: string; source_payload: unknown }>();
      return row ? toCard(row) : undefined;
    };
    const parentStageFor = async (name: string) => {
      const normalizedName = normalizeName(name);
      const row = await db.prepare(`
        SELECT i.code AS code, COALESCE(NULLIF(l.name,''),i.name) AS name, i.name AS sprite_name, p.source_payload
        FROM tcg_card_identities i
        JOIN tcg_card_printings p ON p.identity_id=i.id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
        WHERE i.game_id=? AND (${normalizedSql('i.name')}=? OR ${normalizedSql('l.name')}=?) AND json_valid(p.source_payload)
        ORDER BY CASE WHEN p.language=? THEN 0 WHEN p.language='EN' THEN 1 ELSE 2 END,p.id LIMIT 1
      `).bind(game.id, normalizedName, normalizedName, language).first<{ code: string; name: string; sprite_name: string; source_payload: unknown }>();
      return row ? toCard(row) : undefined;
    };
    const stageRank = (stage: string) => {
      if (/^basic$/i.test(stage)) return 0;
      const match = /^stage\s*(\d+)$/i.exec(stage);
      return match ? Number(match[1]) : undefined;
    };
    const inferStage = async (card: EvolutionCard): Promise<EvolutionCard> => {
      if (!card.evolveFrom || (card.stage && !/^basic$/i.test(card.stage))) return card;
      const parent = await parentStageFor(card.evolveFrom);
      if (!parent) return { ...card, stage: 'Stage 1' };
      let parentRank = stageRank(parent.stage);
      if (parentRank === 0 && parent.evolveFrom) parentRank = 1;
      return { ...card, stage: `Stage ${(parentRank ?? 0) + 1}` };
    };
    const sharedParent = async (name: string) => {
      const normalizedName = normalizeName(name);
      const row = await db.prepare(`
        SELECT p.source_payload
        FROM tcg_card_identities i
        JOIN tcg_card_printings p ON p.identity_id=i.id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
        WHERE i.game_id=? AND (${normalizedSql('i.name')}=? OR ${normalizedSql('l.name')}=?) AND json_valid(p.source_payload)
          AND NULLIF(trim(COALESCE(json_extract(p.source_payload,'$.evolvesFrom'),json_extract(p.source_payload,'$.evolveFrom'))),'') IS NOT NULL
        ORDER BY CASE WHEN p.language=? THEN 0 WHEN p.language='EN' THEN 1 ELSE 2 END,p.id LIMIT 1
      `).bind(game.id, normalizedName, normalizedName, language).first<{ source_payload: unknown }>();
      if (!row) return undefined;
      const payload = parsePayload(row.source_payload);
      const parent = payload.evolvesFrom ?? payload.evolveFrom;
      return typeof parent === 'string' && parent.trim() ? parent.trim() : undefined;
    };
    const dexParent = async (card: EvolutionCard) => {
      // Some ex/reprint payloads incorrectly say Basic or omit evolvesFrom.
      // The Pokédex ID is species-level, so another printing of that same
      // species can still supply its canonical parent and restore the chain.
      if (!card.dexIds.length) return undefined;
      const dexPlaceholders = card.dexIds.map(() => '?').join(',');
      for (const candidateLanguage of language === 'EN' ? ['EN'] : [language, 'EN']) {
        const { results } = await db.prepare(`
          SELECT trim(COALESCE(json_extract(p.source_payload,'$.evolvesFrom'),json_extract(p.source_payload,'$.evolveFrom'))) AS parent
          FROM tcg_card_identities i
          JOIN tcg_card_printings p ON p.identity_id=i.id
          JOIN json_each(CASE WHEN json_valid(p.source_payload) THEN p.source_payload ELSE '{}' END,'$.dexId') dex ON CAST(dex.value AS TEXT) IN (${dexPlaceholders})
          WHERE i.game_id=? AND p.language=? AND json_valid(p.source_payload)
            AND NULLIF(trim(COALESCE(json_extract(p.source_payload,'$.evolvesFrom'),json_extract(p.source_payload,'$.evolveFrom'))),'') IS NOT NULL
          ORDER BY parent COLLATE NOCASE LIMIT 80
        `).bind(...card.dexIds, game.id, candidateLanguage).all<{ parent: string }>();
        const parents = [...new Map(results.filter(row => row.parent?.trim()).map(row => [normalizeSpecies(row.parent), row.parent.trim()])).values()];
        if (parents.length === 1) return parents[0];
      }
      return undefined;
    };
    const byName = async (name: string, excludedStage?: string) => {
      const normalizedName = normalizeName(name);
      const row = await db.prepare(`
        SELECT i.code AS code, COALESCE(NULLIF(l.name,''),i.name) AS name, i.name AS sprite_name, p.source_payload
        FROM tcg_card_identities i
        JOIN tcg_card_printings p ON p.identity_id=i.id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
        WHERE i.game_id=? AND (${normalizedSql("COALESCE(NULLIF(l.name,''),i.name)")}=? OR ${normalizedSql('i.name')}=? OR ${normalizedSql('l.name')}=?) AND json_valid(p.source_payload)
          AND (? IS NULL OR lower(trim(json_extract(p.source_payload,'$.stage')))!=lower(?))
        ORDER BY CASE WHEN p.language=? THEN 0 WHEN p.language='EN' THEN 1 ELSE 2 END,p.id LIMIT 1
      `).bind(game.id, normalizedName, normalizedName, normalizedName, excludedStage ?? null, excludedStage ?? null, language).first<{ code: string; name: string; sprite_name: string; source_payload: unknown }>();
      if (!row) return undefined;
      const card = toCard(row);
      if (!card.evolveFrom) card.evolveFrom = await sharedParent(card.spriteName);
      if (!card.evolveFrom) card.evolveFrom = await dexParent(card);
      return await inferStage(card);
    };
    const childrenOf = async (name: string, baseName = name) => {
      const normalizedName = normalizeName(name);
      const normalizedBaseName = normalizeName(baseName);
      const correctedChildCodes = Object.entries(evolutionCorrections)
        .filter(([, correction]) => correction.parent && [normalizedName, normalizedBaseName].includes(normalizeName(correction.parent)))
        .map(([cardCode]) => cardCode);
      const correctedChildPredicate = correctedChildCodes.length ? ` OR i.code IN (${correctedChildCodes.map(() => '?').join(',')})` : '';
      const { results } = await db.prepare(`
        SELECT i.code AS code, COALESCE(NULLIF(l.name,''),i.name) AS name, i.name AS sprite_name, p.source_payload
        FROM tcg_card_identities i
        JOIN tcg_card_printings p ON p.identity_id=i.id
        LEFT JOIN tcg_card_localizations l ON l.identity_id=i.id AND l.language=p.language
        WHERE i.game_id=? AND json_valid(p.source_payload) AND (
          ${normalizedSql("json_extract(p.source_payload,'$.evolvesFrom')")} IN (?,?) OR
          ${normalizedSql("json_extract(p.source_payload,'$.evolveFrom')")} IN (?,?) OR
          (lower(trim(json_extract(p.source_payload,'$.stage')))='level-up' AND (${normalizedSql('i.name')}=? OR ${normalizedSql('i.name')}=? || 'lvx')) OR
          (lower(trim(json_extract(p.source_payload,'$.stage')))='break' AND (${normalizedSql('i.name')}=? OR ${normalizedSql('i.name')}=? || 'break'))${correctedChildPredicate}
        )
        ORDER BY CASE WHEN p.language=? THEN 0 WHEN p.language='EN' THEN 1 ELSE 2 END,i.name COLLATE NOCASE,p.id LIMIT 160
      `).bind(game.id, normalizedName, normalizedBaseName, normalizedName, normalizedBaseName, normalizedName, normalizedName, normalizedName, normalizedName, ...correctedChildCodes, language).all<{ code: string; name: string; sprite_name: string; source_payload: unknown }>();
      const unique = new Map<string, EvolutionCard>();
      for (const row of results) {
        const card = toCard(row);
        const key = nodeKey(card);
        if (!unique.has(key)) unique.set(key, card);
      }
      return [...unique.values()];
    };

    const selectedRow = await byCode(code);
    let selected = selectedRow;
    if (!selected) return Response.json({ evolution: null });
    // Some reprints omit evolvesFrom even though other printings of the same
    // Pokémon carry it. Use that shared lineage to build the chain, while
    // keeping the selected printing's code, name, stage, and sprite identity.
    if (!selected.evolveFrom) selected.evolveFrom = await sharedParent(selected.spriteName) ?? await dexParent(selected);
    if (!selected.evolveFrom && requestedParent) selected.evolveFrom = requestedParent;
    selected = await inferStage(selected);
    const ancestors = [selected];
    const seen = new Set([nodeKey(selected)]);
    while (ancestors.length < 4) {
      const current = ancestors.at(-1)!;
      const parentName = current.evolveFrom;
      if (!parentName) break;
      const sameName = normalizeName(parentName) === normalizeName(current.spriteName);
      const parent = await byName(parentName, sameName ? current.stage : undefined);
      if (!parent || seen.has(nodeKey(parent))) break;
      ancestors.push(parent);
      seen.add(nodeKey(parent));
    }
    const root = ancestors.at(-1)!;
    const build = async (card: EvolutionCard, depth: number, path: Set<string>): Promise<EvolutionTree> => {
      if (depth >= 3) return { ...card, children: [] };
      const discoveredChildren = (await childrenOf(card.name, card.spriteName)).map(child =>
        nodeKey(child) === nodeKey(selected)
          ? { ...child, code: selected.code, name: selected.name, spriteName: selected.spriteName, stage: selected.stage || child.stage }
          : child,
      );
      // Keep the backwards-resolved lineage even when a reprint omits its
      // evolveFrom field and the forward lookup cannot rediscover that edge.
      const ancestorIndex = ancestors.findIndex(ancestor => nodeKey(ancestor) === nodeKey(card));
      const lineageChild = ancestorIndex > 0 ? ancestors[ancestorIndex - 1] : undefined;
      const children = lineageChild && !discoveredChildren.some(child => nodeKey(child) === nodeKey(lineageChild))
        ? [...discoveredChildren, lineageChild]
        : discoveredChildren;
      const next = await Promise.all(children.filter(child => !path.has(nodeKey(child))).map(child => build(child, depth + 1, new Set([...path, nodeKey(child)]))));
      return { ...card, children: next };
    };
    const tree = await build(root, 0, new Set([nodeKey(root)]));
    return Response.json({ evolution: tree }, { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600' } });
  } catch {
    return Response.json({ evolution: null }, { status: 503 });
  }
}
