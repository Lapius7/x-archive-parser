export interface Post {
  id: string;
  createdAt: string; // ISO 8601 (UTC)
  text: string;
  kind: 'post' | 'reply' | 'repost';
  replyToId?: string;
  replyToUser?: string;
  urls: string[];
  likes: number;
  reposts: number;
}

interface RawTweet {
  id_str?: string;
  created_at?: string;
  full_text?: string;
  text?: string;
  in_reply_to_status_id_str?: string;
  in_reply_to_screen_name?: string;
  favorite_count?: string | number;
  retweet_count?: string | number;
  entities?: { urls?: { url?: string; expanded_url?: string }[] };
}

export function toPost(item: unknown): Post | null {
  const t = ((item as { tweet?: RawTweet })?.tweet ?? item) as RawTweet;
  const id = t.id_str;
  const date = t.created_at ? new Date(t.created_at) : null;
  if (!id || !date || Number.isNaN(date.getTime())) return null;

  let text = t.full_text ?? t.text ?? '';
  const urls: string[] = [];
  for (const u of t.entities?.urls ?? []) {
    if (u.url && u.expanded_url) {
      text = text.split(u.url).join(u.expanded_url);
      urls.push(u.expanded_url);
    }
  }
  const kind = /^RT @/.test(text) ? 'repost' : t.in_reply_to_status_id_str ? 'reply' : 'post';
  return {
    id,
    createdAt: date.toISOString(),
    text,
    kind,
    replyToId: t.in_reply_to_status_id_str || undefined,
    replyToUser: t.in_reply_to_screen_name || undefined,
    urls,
    likes: Number(t.favorite_count ?? 0) || 0,
    reposts: Number(t.retweet_count ?? 0) || 0,
  };
}
