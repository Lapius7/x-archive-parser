import type { LikeRow, Post, PostKind } from './types.js';

interface RawEntities {
  urls?: { url?: string; expanded_url?: string }[];
  hashtags?: { text?: string }[];
  user_mentions?: { screen_name?: string }[];
  media?: RawMedia[];
}
interface RawMedia { url?: string; type?: string; media_url_https?: string }
interface RawTweet {
  id_str?: string;
  created_at?: string;
  full_text?: string;
  text?: string;
  in_reply_to_status_id_str?: string;
  in_reply_to_screen_name?: string;
  is_quote_status?: boolean | string;
  quoted_status_permalink?: { expanded?: string };
  favorite_count?: string | number;
  retweet_count?: string | number;
  entities?: RawEntities;
  extended_entities?: { media?: RawMedia[] };
}

const decode = (s: string) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');

export function toPost(item: unknown, username?: string): Post | null {
  const t = ((item as { tweet?: RawTweet })?.tweet ?? item) as RawTweet;
  const id = t?.id_str;
  const date = t?.created_at ? new Date(t.created_at) : null;
  if (!id || !date || Number.isNaN(date.getTime())) return null;

  let text = t.full_text ?? t.text ?? '';
  const urls: string[] = [];
  for (const u of t.entities?.urls ?? []) {
    if (u.url && u.expanded_url) {
      text = text.split(u.url).join(u.expanded_url);
      urls.push(u.expanded_url);
    }
  }
  const rawMedia = t.extended_entities?.media ?? t.entities?.media ?? [];
  const media = rawMedia.flatMap((m) => {
    if (m.url) text = text.split(m.url).join('');
    return m.media_url_https ? [{ type: m.type ?? 'media', url: m.media_url_https }] : [];
  });
  text = decode(text).trim();

  const quotedUrl = t.quoted_status_permalink?.expanded;
  const isQuote = t.is_quote_status === true || t.is_quote_status === 'true' || !!quotedUrl;
  const kind: PostKind = /^RT @/.test(text) ? 'repost' : t.in_reply_to_status_id_str ? 'reply' : isQuote ? 'quote' : 'post';

  return {
    id,
    createdAt: date.toISOString(),
    text,
    kind,
    url: `https://x.com/${username || 'i'}/status/${id}`,
    replyToId: t.in_reply_to_status_id_str || undefined,
    replyToUser: t.in_reply_to_screen_name || undefined,
    quotedUrl,
    urls,
    hashtags: (t.entities?.hashtags ?? []).flatMap((h) => (h.text ? [h.text] : [])),
    mentions: (t.entities?.user_mentions ?? []).flatMap((m) => (m.screen_name ? [m.screen_name] : [])),
    media,
    likes: Number(t.favorite_count ?? 0) || 0,
    reposts: Number(t.retweet_count ?? 0) || 0,
  };
}

export function toLike(item: unknown): LikeRow | null {
  const l = ((item as { like?: Record<string, string> })?.like ?? item) as Record<string, string | undefined>;
  if (!l?.tweetId) return null;
  return { tweetId: l.tweetId, text: decode(l.fullText ?? ''), url: l.expandedUrl ?? `https://x.com/i/status/${l.tweetId}` };
}

export function toUsername(item: unknown): string | undefined {
  const a = ((item as { account?: { username?: string } })?.account ?? item) as { username?: string };
  return a?.username;
}
