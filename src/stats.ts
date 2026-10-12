import { iterRows } from './search.js';

export interface Stats {
  total: number;
  range?: [string, string];
  activeDays: number;
  byKind: Record<string, number>;
  byYear: [string, number][];
  byHour: number[];
  topHashtags: [string, number][];
  topMentions: [string, number][];
  topDomains: [string, number][];
  topLiked: { url: string; likes: number; text: string }[];
}

const top = (m: Map<string, number>, n = 10): [string, number][] => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);

export function computeStats(dir: string): Stats {
  const byKind: Record<string, number> = {};
  const byYear = new Map<string, number>();
  const byHour = Array<number>(24).fill(0);
  const tags = new Map<string, number>(), men = new Map<string, number>(), dom = new Map<string, number>();
  const days = new Set<string>();
  const liked: Stats['topLiked'] = [];
  let total = 0, first = '', last = '';
  for (const r of iterRows(dir)) {
    total++;
    const day = r.localTime.slice(0, 10);
    first ||= day; last = day; days.add(day);
    byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
    inc(byYear, day.slice(0, 4));
    byHour[Number(r.localTime.slice(11, 13)) % 24]!++;
    r.hashtags.forEach((h) => inc(tags, `#${h}`));
    r.mentions.forEach((m) => inc(men, `@${m}`));
    for (const u of r.urls) { try { inc(dom, new URL(u).hostname.replace(/^www\./, '')); } catch { /* 不正な URL は無視 */ } }
    if (r.likes > 0) {
      liked.push({ url: r.url, likes: r.likes, text: r.text });
      if (liked.length > 200) { liked.sort((a, b) => b.likes - a.likes); liked.length = 5; }
    }
  }
  liked.sort((a, b) => b.likes - a.likes);
  return {
    total, range: first ? [first, last] : undefined, activeDays: days.size, byKind,
    byYear: [...byYear], byHour, topHashtags: top(tags), topMentions: top(men), topDomains: top(dom), topLiked: liked.slice(0, 5),
  };
}
