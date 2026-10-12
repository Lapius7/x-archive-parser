import type { Post } from './parse.js';

export function monthKey(iso: string, tz: string): string {
  const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' })
    .formatToParts(new Date(iso));
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g('year')}-${g('month')}`;
}

export function localTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).format(new Date(iso));
}

export function renderMonth(month: string, posts: Post[], tz: string): string {
  const body = posts.map((p) => {
    const label = p.kind === 'reply' ? ` (reply to @${p.replyToUser ?? '?'})` : p.kind === 'repost' ? ' (repost)' : '';
    const quoted = p.text.split('\n').map((l) => `> ${l}`).join('\n');
    return `### ${localTime(p.createdAt, tz)}${label}\n\nid: ${p.id}\n\n${quoted}\n`;
  });
  return `# ${month} (${posts.length} posts, ${tz})\n\n${body.join('\n')}`;
}

export function renderJsonl(posts: Post[], tz: string): string {
  return posts.map((p) => JSON.stringify({ ...p, localTime: localTime(p.createdAt, tz) })).join('\n') + '\n';
}

export function renderIndex(months: Map<string, number>, tz: string, total: number): string {
  const rows = [...months].map(([m, n]) => `| ${m.slice(0, 4)}/${m} | ${n} |`).join('\n');
  return `# X archive index

Total: ${total} posts. Timezone: ${tz}.

## How to search

1. \`grep -ri "keyword" --include=*.jsonl .\` to find candidate months.
2. Open the matching \`YYYY/YYYY-MM.md\` for context.
3. Use \`jq\` on the JSONL for structured filters (kind, likes, urls).

## Months

| File | Posts |
|---|---|
${rows}
`;
}
