import type { Lang } from './i18n.js';
import type { LikeRow, Post, PostRow, RunMeta } from './types.js';

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

const n = (x: number) => x.toLocaleString('en-US');
const mb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** README.md と index.md に使う文言。月別ファイルと JSONL は検索しやすいよう英語のまま */
const L = {
  en: {
    indexTitle: '# X archive index',
    account: 'Account', total: (t: number, r?: [string, string]) => `Total: ${t} posts${r ? ` (${r[0]} to ${r[1]})` : ''}`,
    tz: 'Timezone', likes: (c: number) => `Likes: ${c} (likes.jsonl).`,
    howTitle: '## How to search',
    how: (c: string) => `1. Run \`${c}\` or \`grep -ri "keyword" --include=*.jsonl .\` to find candidate months.
2. Open the matching \`YYYY/YYYY-MM.md\` for context.
3. Use \`jq\` on the JSONL for structured filters. Fields: id, localTime, kind, text, url, replyToUser, hashtags, mentions, media, likes, reposts.`,
    monthsTitle: '## Months', fileCol: 'File', postsCol: 'Posts',
    readmeTitle: '# X archive conversion', created: 'Created', runId: 'Run id', tool: 'Tool',
    summary: '## Summary', item: 'Item', value: 'Value', posts: 'Posts', byKind: 'Posts by kind', period: 'Period of posts',
    monthsWith: 'Months with posts', liked: 'Liked posts saved', notSaved: 'not saved', formats: 'Formats', filters: 'Filters', none: 'none',
    leftOut: (c: number) => ` (${c} posts left out)`,
    fPeriod: (s: string, u: string) => `period: ${s} to ${u}`, start: 'start', end: 'end', fExclude: (k: string) => `excluded kinds: ${k}`,
    source: '## Source', zip: 'Zip file', folder: 'Folder',
    files: '## Files', fIndex: 'entry point for agents (totals and how to search)', fMeta: 'this information as JSON',
    fMonth: 'posts of each month', fLikes: 'liked posts',
    use: '## Use', perMonth: '## Posts per month',
    kinds: (k: Record<string, number>) => `post ${n(k.post!)}, reply ${n(k.reply!)}, repost ${n(k.repost!)}, quote ${n(k.quote!)}`,
  },
  ja: {
    indexTitle: '# X アーカイブの目次',
    account: 'アカウント', total: (t: number, r?: [string, string]) => `合計: ${t} 件${r ? `（${r[0]} から ${r[1]}）` : ''}`,
    tz: 'タイムゾーン', likes: (c: number) => `いいね: ${c} 件（likes.jsonl）`,
    howTitle: '## 検索のしかた',
    how: (c: string) => `1. \`${c}\` または \`grep -ri "キーワード" --include=*.jsonl .\` で、該当しそうな月を探します。
2. 該当する \`YYYY/YYYY-MM.md\` を開いて、前後の文脈を確認します。
3. 条件を細かく絞るときは、JSONL に \`jq\` を使います。項目: id, localTime, kind, text, url, replyToUser, hashtags, mentions, media, likes, reposts。`,
    monthsTitle: '## 月別', fileCol: 'ファイル', postsCol: '投稿数',
    readmeTitle: '# X アーカイブの変換結果', created: '作成日時', runId: '実行 ID', tool: 'ツール',
    summary: '## 概要', item: '項目', value: '内容', posts: '投稿数', byKind: '種別ごとの投稿数', period: '投稿の期間',
    monthsWith: '投稿のあった月数', liked: '保存したいいね', notSaved: '保存していません', formats: '形式', filters: '絞り込み', none: 'なし',
    leftOut: (c: number) => `（${c} 件を除外）`,
    fPeriod: (s: string, u: string) => `期間: ${s} から ${u}`, start: '最初', end: '最後', fExclude: (k: string) => `除外した種別: ${k}`,
    source: '## 元データ', zip: 'zip ファイル', folder: 'フォルダ',
    files: '## ファイル', fIndex: 'エージェント向けの入口（合計と検索のしかた）', fMeta: 'この情報を JSON にしたもの',
    fMonth: '月ごとの投稿', fLikes: 'いいねした投稿',
    use: '## 使い方', perMonth: '## 月ごとの投稿数',
    kinds: (k: Record<string, number>) => `投稿 ${n(k.post!)}、リプライ ${n(k.reply!)}、リポスト ${n(k.repost!)}、引用 ${n(k.quote!)}`,
  },
} as const;

export function renderIndex(i: IndexInfo, lang: Lang): string {
  const s = L[lang];
  const rows = [...i.months].map(([m, c]) => `| ${m.slice(0, 4)}/${m}.md | ${c} |`).join('\n');
  return `${s.indexTitle}

${i.username ? `${s.account}: @${i.username}\n` : ''}${s.total(i.total, i.range)}. ${s.tz}: ${i.tz}.${i.likes ? `\n${s.likes(i.likes)}` : ''}

${s.howTitle}

${s.how('x-archive-parser search "keyword" .')}

${s.monthsTitle}

| ${s.fileCol} | ${s.postsCol} |
|---|---|
${rows}
`;
}

/** 実行フォルダの説明書。あとから「いつ・何から・どんな条件で作ったか」が分かるようにする */
export function renderReadme(m: RunMeta, lang: Lang): string {
  const s = L[lang];
  const filters = [
    m.since || m.until ? s.fPeriod(m.since ?? s.start, m.until ?? s.end) : '',
    m.exclude.length ? s.fExclude(m.exclude.join(', ')) : '',
  ].filter(Boolean);
  const months = Object.entries(m.months).map(([k, c]) => `| ${k.slice(0, 4)}/${k}.md | ${n(c)} |`).join('\n');
  const cmd = (c: string) => `x-archive-parser ${c} "${m.folder}"`;
  return `${s.readmeTitle}

${m.username ? `${s.account}: @${m.username}\n` : ''}${s.created}: ${m.createdAtLocal} (${m.tz}) / ${m.createdAt} (UTC)
${s.runId}: ${m.runId}
${s.tool}: ${m.tool}

${s.summary}

| ${s.item} | ${s.value} |
|---|---|
| ${s.posts} | ${n(m.total)} |
| ${s.byKind} | ${s.kinds(m.kinds)} |
| ${s.period} | ${m.range ? `${m.range[0]} ${lang === "ja" ? "から" : "to"} ${m.range[1]}` : '-'} |
| ${s.monthsWith} | ${Object.keys(m.months).length} |
| ${s.liked} | ${m.likes ? n(m.likes) : s.notSaved} |
| ${s.tz} | ${m.tz} |
| ${s.formats} | ${m.formats.join(', ')} |
| ${s.filters} | ${filters.length ? filters.join('; ') : s.none}${m.skipped ? s.leftOut(m.skipped) : ''} |

${s.source}

- ${m.source.kind === 'zip' ? s.zip : s.folder}: ${m.source.path}${m.source.bytes ? ` (${mb(m.source.bytes)})` : ''}

${s.files}

- \`index.md\`: ${s.fIndex}
- \`meta.json\`: ${s.fMeta}
- \`YYYY/YYYY-MM.md|jsonl|csv\`: ${s.fMonth}${m.likes ? `\n- \`likes.jsonl\`: ${s.fLikes}` : ''}

${s.use}

\`\`\`bash
${cmd('search "keyword"')}
${cmd('stats')}
\`\`\`

${s.perMonth}

| ${s.fileCol} | ${s.postsCol} |
|---|---|
${months}
`;
}

export const renderLikes = (likes: LikeRow[]) => renderJsonl(likes);
