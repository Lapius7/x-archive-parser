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
