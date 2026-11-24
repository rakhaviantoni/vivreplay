import type { D1Database } from '@cloudflare/workers-types';
import { getPostForMeApiKey, publishOrScheduleDrop } from '@/lib/server/postforme';

export type AdminSocialPostStatus = 'DRAFT' | 'SCHEDULED' | 'PUBLISHED' | 'FAILED';

export interface AdminSocialPostRecord {
  id: string;
  title: string;
  pillar: string;
  locale: 'EN' | 'ID';
  platforms: string[];
  accountIds: string[];
  caption: string;
  mediaUrls: string[];
  assetConfig: Record<string, unknown> | null;
  status: AdminSocialPostStatus;
  scheduledAt: string | null;
  publishedAt: string | null;
  postId: string | null;
  errorMessage: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type AdminSocialRow = {
  id: string;
  title: string;
  pillar: string;
  locale: string;
  platforms: string;
  account_ids: string;
  caption: string;
  media_urls: string;
  asset_config: string | null;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  post_id: string | null;
  error_message: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

let schemaReady = false;

export async function ensureAdminSocialSchema(db: D1Database): Promise<void> {
  if (schemaReady) return;
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS admin_social_posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      pillar TEXT NOT NULL DEFAULT 'Campaign',
      locale TEXT NOT NULL DEFAULT 'EN',
      platforms TEXT NOT NULL DEFAULT '[]',
      account_ids TEXT NOT NULL DEFAULT '[]',
      caption TEXT NOT NULL,
      media_urls TEXT NOT NULL DEFAULT '[]',
      asset_config TEXT,
      status TEXT NOT NULL DEFAULT 'DRAFT',
      scheduled_at TEXT,
      published_at TEXT,
      post_id TEXT,
      error_message TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`
  ).run();
  schemaReady = true;
}

function parseJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function parseJsonObject(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function mapRow(row: AdminSocialRow): AdminSocialPostRecord {
  return {
    id: row.id,
    title: row.title,
    pillar: row.pillar,
    locale: row.locale === 'ID' ? 'ID' : 'EN',
    platforms: parseJsonArray(row.platforms),
    accountIds: parseJsonArray(row.account_ids),
    caption: row.caption,
    mediaUrls: parseJsonArray(row.media_urls),
    assetConfig: parseJsonObject(row.asset_config),
    status: (['DRAFT', 'SCHEDULED', 'PUBLISHED', 'FAILED'].includes(row.status)
      ? row.status
      : 'DRAFT') as AdminSocialPostStatus,
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    postId: row.post_id,
    errorMessage: row.error_message,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAdminSocialPosts(db: D1Database): Promise<AdminSocialPostRecord[]> {
  await ensureAdminSocialSchema(db);
  const res = await db
    .prepare(
      `SELECT id, title, pillar, locale, platforms, account_ids, caption, media_urls, asset_config,
              status, scheduled_at, published_at, post_id, error_message, created_by, created_at, updated_at
       FROM admin_social_posts
       ORDER BY
         CASE status WHEN 'SCHEDULED' THEN 0 WHEN 'DRAFT' THEN 1 WHEN 'FAILED' THEN 2 ELSE 3 END ASC,
         COALESCE(scheduled_at, created_at) DESC
       LIMIT 100`
    )
    .all<AdminSocialRow>();
  return (res.results ?? []).map(mapRow);
}

export async function saveOrPublishAdminSocialPost(
  db: D1Database,
  adminId: string,
  input: {
    id?: string;
    title: string;
    pillar: string;
    locale: 'EN' | 'ID';
    platforms: string[];
    accountIds: string[];
    caption: string;
    mediaUrls: string[];
    assetConfig?: Record<string, unknown> | null;
    mode: 'draft' | 'schedule' | 'publish';
    scheduledAt?: string | null;
  },
): Promise<AdminSocialPostRecord> {
  await ensureAdminSocialSchema(db);
  const id = input.id?.trim() || crypto.randomUUID();
  const title = input.title.trim() || 'VivrePlay Post';
  const pillar = input.pillar.trim() || 'Campaign';
  const locale = input.locale === 'ID' ? 'ID' : 'EN';
  const caption = input.caption.trim();
  const platformsJson = JSON.stringify(input.platforms ?? []);
  const accountIdsJson = JSON.stringify(input.accountIds ?? []);
  const mediaUrlsJson = JSON.stringify(input.mediaUrls ?? []);
  const assetConfigJson = input.assetConfig ? JSON.stringify(input.assetConfig) : null;

  let status: AdminSocialPostStatus = 'DRAFT';
  let scheduledAt: string | null = input.scheduledAt ? new Date(input.scheduledAt).toISOString() : null;
  let publishedAt: string | null = null;
  let postId: string | null = null;
  let errorMessage: string | null = null;

  if (input.mode === 'publish') {
    if (!input.accountIds.length) {
      throw new Error('Select at least one connected social account before publishing.');
    }
    const result = await publishOrScheduleDrop({
      sellerId: adminId,
      listingId: null,
      accountIds: input.accountIds,
      text: caption,
      mediaUrls: input.mediaUrls,
    });
    if (result.success) {
      status = 'PUBLISHED';
      publishedAt = new Date().toISOString();
      postId = result.postId ?? null;
      errorMessage = result.error ?? null;
    } else {
      status = 'FAILED';
      errorMessage = result.error ?? 'Publish failed';
    }
  } else if (input.mode === 'schedule') {
    if (!scheduledAt) {
      throw new Error('Choose a date and time to schedule this post.');
    }
    status = 'SCHEDULED';
    if (getPostForMeApiKey() && input.accountIds.length > 0) {
      const result = await publishOrScheduleDrop({
        sellerId: adminId,
        listingId: null,
        accountIds: input.accountIds,
        text: caption,
        mediaUrls: input.mediaUrls,
        scheduledAt,
      });
      if (!result.success) {
        status = 'FAILED';
        errorMessage = result.error ?? 'Schedule failed';
      } else {
        postId = result.postId ?? null;
      }
    }
  }

  await db
    .prepare(
      `INSERT INTO admin_social_posts (
         id, title, pillar, locale, platforms, account_ids, caption, media_urls, asset_config,
         status, scheduled_at, published_at, post_id, error_message, created_by, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         pillar = excluded.pillar,
         locale = excluded.locale,
         platforms = excluded.platforms,
         account_ids = excluded.account_ids,
         caption = excluded.caption,
         media_urls = excluded.media_urls,
         asset_config = excluded.asset_config,
         status = excluded.status,
         scheduled_at = excluded.scheduled_at,
         published_at = excluded.published_at,
         post_id = excluded.post_id,
         error_message = excluded.error_message,
         updated_at = CURRENT_TIMESTAMP`
    )
    .bind(
      id,
      title,
      pillar,
      locale,
      platformsJson,
      accountIdsJson,
      caption,
      mediaUrlsJson,
      assetConfigJson,
      status,
      scheduledAt,
      publishedAt,
      postId,
      errorMessage,
      adminId,
    )
    .run();

  const saved = await db
    .prepare(
      `SELECT id, title, pillar, locale, platforms, account_ids, caption, media_urls, asset_config,
              status, scheduled_at, published_at, post_id, error_message, created_by, created_at, updated_at
       FROM admin_social_posts WHERE id = ?`
    )
    .bind(id)
    .first<AdminSocialRow>();

  if (!saved) {
    throw new Error('Failed to load saved social post.');
  }
  return mapRow(saved);
}

export async function deleteAdminSocialPost(db: D1Database, id: string): Promise<void> {
  await ensureAdminSocialSchema(db);
  await db.prepare('DELETE FROM admin_social_posts WHERE id = ?').bind(id).run();
}

export async function processDueAdminSocialPosts(db: D1Database): Promise<{ processed: number; published: number; failed: number }> {
  await ensureAdminSocialSchema(db);
  if (getPostForMeApiKey()) {
    return { processed: 0, published: 0, failed: 0 };
  }

  const nowIso = new Date().toISOString();
  const dueRows = await db
    .prepare(
      `SELECT id, title, pillar, locale, platforms, account_ids, caption, media_urls, asset_config,
              status, scheduled_at, published_at, post_id, error_message, created_by, created_at, updated_at
       FROM admin_social_posts
       WHERE status = 'SCHEDULED' AND scheduled_at IS NOT NULL AND scheduled_at <= ? AND post_id IS NULL
       ORDER BY scheduled_at ASC
       LIMIT 10`
    )
    .bind(nowIso)
    .all<AdminSocialRow>();

  let processed = 0;
  let published = 0;
  let failed = 0;

  for (const row of dueRows.results ?? []) {
    const post = mapRow(row);
    if (!post.createdBy || post.accountIds.length === 0) {
      await db
        .prepare(
          `UPDATE admin_social_posts SET status = 'FAILED', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
        )
        .bind('No connected social account selected for scheduled publish.', post.id)
        .run();
      processed++;
      failed++;
      continue;
    }

    const result = await publishOrScheduleDrop({
      sellerId: post.createdBy,
      listingId: null,
      accountIds: post.accountIds,
      text: post.caption,
      mediaUrls: post.mediaUrls,
    });
    processed++;
    if (result.success) {
      published++;
      await db
        .prepare(
          `UPDATE admin_social_posts
           SET status = 'PUBLISHED', published_at = ?, post_id = ?, error_message = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(new Date().toISOString(), result.postId ?? null, result.error ?? null, post.id)
        .run();
    } else {
      failed++;
      await db
        .prepare(
          `UPDATE admin_social_posts
           SET status = 'FAILED', error_message = ?, updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`
        )
        .bind(result.error ?? 'Scheduled publish failed', post.id)
        .run();
    }
  }

  return { processed, published, failed };
}
