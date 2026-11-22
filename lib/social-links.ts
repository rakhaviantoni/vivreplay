export type PublicSocialConnection = {
  platform: string;
  platformAccountId: string;
  username: string;
  displayName: string | null;
};

export function socialProfileUrl(conn: PublicSocialConnection): string | null {
  const p = conn.platform.toLowerCase();
  const handle = conn.username.replace(/^@/, '').trim();
  if (p === 'instagram' && handle) {
    return `https://www.instagram.com/${encodeURIComponent(handle)}/`;
  }
  if (p === 'facebook' && conn.platformAccountId) {
    return `https://www.facebook.com/${encodeURIComponent(conn.platformAccountId)}`;
  }
  if (p === 'threads' && handle) {
    return `https://www.threads.net/@${encodeURIComponent(handle)}`;
  }
  if ((p === 'twitter' || p === 'x') && handle) {
    return `https://x.com/${encodeURIComponent(handle)}`;
  }
  if (p === 'tiktok' && handle) {
    return `https://www.tiktok.com/@${encodeURIComponent(handle)}`;
  }
  if (p === 'bluesky' && handle) {
    return `https://bsky.app/profile/${encodeURIComponent(handle)}`;
  }
  return null;
}

export function socialDisplayHandle(conn: PublicSocialConnection): string {
  const p = conn.platform.toLowerCase();
  if (p === 'facebook' && conn.displayName) return conn.displayName;
  const clean = conn.username.replace(/^@/, '').trim();
  return clean ? `@${clean}` : conn.displayName || conn.platform;
}
