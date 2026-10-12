import type { LikeRow, Post, PostRow } from './types.js';

export function monthKey(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}`;
}

export function localTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

export const toRow = (p: Post, tz: string): PostRow => ({ ...p, localTime: localTime(p.createdAt, tz) });

export function renderMonth(month: string, rows: PostRow[], tz: string): string {
  const body = rows.map((p) => {
    const tags = [p.kind === 'post' ? '' : p.kind, p.replyToUser ? `to @${p.replyToUser}` : ''].filter(Boolean).join(' ');
    const head = `### ${p.localTime}${tags ? ` · ${tags}` : ''} · [link](${p.url})`;
    const quote = p.text ? p.text.split('\n').map((l) => `> ${l}`).join('\n') : '> (no text)';
    const extra = [
      ...p.media.map((m) => (m.type === 'photo' ? `![photo](${m.url})` : `[${m.type}](${m.url})`)),
      p.quotedUrl ? `quoted: ${p.quotedUrl}` : '',
      `♥ ${p.likes} · ↻ ${p.reposts}`,
    ].filter(Boolean).join('\n\n');
    return `${head}\n\n${quote}\n\n${extra}\n`;
  });
  return `# ${month} (${rows.length} posts, ${tz})\n\n${body.join('\n')}`;
}

export const renderJsonl = (rows: object[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function renderCsv(rows: PostRow[]): string {
  const head = 'id,local_time,created_at,kind,text,url,likes,reposts,hashtags,mentions';
  const lines = rows.map((p) =>
    [p.id, p.localTime, p.createdAt, p.kind, p.text, p.url, p.likes, p.reposts, p.hashtags.join(' '), p.mentions.join(' ')].map(csvCell).join(','));
  return [head, ...lines].join('\n') + '\n';
}

export interface IndexInfo {
  months: Map<string, number>;
  tz: string;
  total: number;
  username?: string;
  range?: [string, string];
  likes?: number;
}

export function renderIndex(i: IndexInfo): string {
  const rows = [...i.months].map(([m, n]) => `| ${m.slice(0, 4)}/${m}.md | ${n} |`).join('\n');
  return `# X archive index

${i.username ? `Account: @${i.username}\n` : ''}Total: ${i.total} posts${i.range ? ` (${i.range[0]} to ${i.range[1]})` : ''}. Timezone: ${i.tz}.${i.likes ? `\nLikes: ${i.likes} (likes.jsonl).` : ''}

## How to search

1. Run \`x-archive-parser search "keyword" .\` or \`grep -ri "keyword" --include=*.jsonl .\` to find candidate months.
2. Open the matching \`YYYY/YYYY-MM.md\` for context.
3. Use \`jq\` on the JSONL for structured filters. Fields: id, localTime, kind, text, url, replyToUser, hashtags, mentions, media, likes, reposts.

## Months

| File | Posts |
|---|---|
${rows}
`;
}

export const renderLikes = (likes: LikeRow[]) => renderJsonl(likes);
