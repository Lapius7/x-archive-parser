export type PostKind = 'post' | 'reply' | 'repost' | 'quote';

export interface Media { type: string; url: string }

export interface Post {
  id: string;
  createdAt: string; // ISO 8601 (UTC)
  text: string;
  kind: PostKind;
  url: string;
  replyToId?: string;
  replyToUser?: string;
  quotedUrl?: string;
  urls: string[];
  hashtags: string[];
  mentions: string[];
  media: Media[];
  likes: number;
  reposts: number;
}

/** JSONL に書き出す行（タイムゾーン変換済みの時刻つき） */
export interface PostRow extends Post { localTime: string }

export interface LikeRow { tweetId: string; text: string; url: string }

/** 各実行フォルダの meta.json と README.md の元になる情報 */
export interface RunMeta {
  runId: string;
  createdAt: string;
  createdAtLocal: string;
  tool: string;
  source: { path: string; kind: 'zip' | 'folder'; bytes?: number };
  username?: string;
  tz: string;
  total: number;
  skipped: number;
  kinds: Record<PostKind, number>;
  range?: [string, string];
  likes: number;
  formats: string[];
  exclude: string[];
  since?: string;
  until?: string;
  months: Record<string, number>;
  folder: string;
}
