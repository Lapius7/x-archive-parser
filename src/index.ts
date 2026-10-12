import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { getLang, t, type Lang } from './i18n.js';
import { openSource, parseYtd } from './source.js';
import { buildNotes, toLike, toPost, toUsername } from './parse.js';
import { localTime, monthKey, renderCsv, renderIndex, renderJsonl, renderLikes, renderMonth, renderReadme, toRow } from './render.js';
import type { LikeRow, Post, PostKind, PostRow, RunMeta } from './types.js';

export type { Post, PostKind, PostRow, LikeRow };
export { toPost, toLike };
export { detectLang, getLang, parseLang, setLang, type Lang } from './i18n.js';
export { iterRows, resolveOutDir, search, type SearchOptions } from './search.js';
export { computeStats, type Stats } from './stats.js';

const VERSION = (() => {
  try { return (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version; } catch { return 'unknown'; }
})();

export type Format = 'md' | 'jsonl' | 'csv';

export interface ProgressEvent { stage: 'read' | 'parse' | 'write'; done: number; total: number }

export interface ConvertOptions {
  input: string;
  /** 親フォルダ。実行ごとにこの下へ一意な名前のフォルダを作る */
  out: string;
  /** true なら親フォルダを作らず out にそのまま書く（前回の出力は置き換える） */
  here?: boolean;
  tz?: string;
  formats?: Format[];
  /** 含めない投稿の種別 */
  exclude?: PostKind[];
  /** YYYY-MM-DD（タイムゾーン変換後の日付、両端を含む） */
  since?: string;
  until?: string;
  likes?: boolean;
  /** README.md と index.md の言語（既定は現在の言語設定） */
  lang?: Lang;
  /** 進捗通知。read は件数なし、parse は投稿数、write は月数で done/total を数える */
  onProgress?: (e: ProgressEvent) => void;
}

export interface ConvertResult {
  username?: string;
  tz: string;
  total: number;
  skipped: number;
  months: [string, number][];
  years: [string, number][];
  kinds: Record<PostKind, number>;
  range?: [string, string];
  likes: number;
  /** 実際に書き出したフォルダ */
  out: string;
  runId: string;
  createdAt: string;
}

export const systemTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function validateTz(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

export function convert(o: ConvertOptions): ConvertResult {
  const tz = o.tz ?? systemTz();
  const lang = o.lang ?? getLang();
  if (!validateTz(tz)) throw new Error(t('badTz', tz));
  const formats = new Set<Format>(o.formats ?? ['md', 'jsonl']);
  const exclude = new Set(o.exclude ?? []);
  for (const d of [o.since, o.until]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(t('badDate', d));

  if (o.here && existsSync(o.out) && readdirSync(o.out).length > 0 && !existsSync(join(o.out, 'index.md'))) {
    throw new Error(t('notEmpty', o.out));
  }

  const report = (stage: ProgressEvent['stage'], done = 0, total = 0) => o.onProgress?.({ stage, done, total });
  report('read');
  const src = openSource(o.input);
  const tweetFiles = src.files('tweets?');
  if (tweetFiles.length === 0) throw new Error(t('noTweets'));
  const username = src.files('account').flatMap((f) => parseYtd(f)).map(toUsername).find(Boolean);

  const notes = buildNotes(src.files('note[-_]tweets?').flatMap((f) => parseYtd(f)));
  const parsed = tweetFiles.map((f) => parseYtd(f));
  const totalPosts = parsed.reduce((n, a) => n + a.length, 0);
  let done = 0;
  report('parse', 0, totalPosts);
  const seen = new Set<string>();
  const byMonth = new Map<string, PostRow[]>();
  const kinds: Record<PostKind, number> = { post: 0, reply: 0, repost: 0, quote: 0 };
  let skipped = 0;
  for (const items of parsed) {
    for (const raw of items) {
      if (++done % 200 === 0) report('parse', done, totalPosts);
      const p = toPost(raw, username, notes);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      const row = toRow(p, tz);
      const day = row.localTime.slice(0, 10);
      if (exclude.has(p.kind) || (o.since && day < o.since) || (o.until && day > o.until)) { skipped++; continue; }
      kinds[p.kind]++;
      const k = monthKey(p.createdAt, tz);
      (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(row);
    }
  }
  const likes: LikeRow[] = o.likes ? src.files('likes?').flatMap((f) => parseYtd(f)).flatMap((x) => toLike(x) ?? []) : [];

  report('parse', totalPosts, totalPosts);
  report('write', 0, byMonth.size);
  const now = new Date();
  const stamp = localTime(now.toISOString(), tz).replace(/[-: ]/g, '').replace(/^(\d{8})(\d{6})$/, '$1-$2');
  const runId = `${(username ?? 'x').replace(/[^\w.-]/g, '_')}_${stamp}_${randomUUID().slice(0, 8)}`;
  const dest = o.here ? o.out : join(o.out, runId);
  // 前回の出力を消す（index.md があるときだけここに来る）
  if (o.here && existsSync(join(dest, 'index.md'))) {
    for (const e of readdirSync(dest)) if (/^\d{4}$/.test(e)) rmSync(join(dest, e), { recursive: true });
    for (const f of ['likes.jsonl', 'README.md', 'meta.json']) rmSync(join(dest, f), { force: true });
  }
  mkdirSync(dest, { recursive: true });
  const keys = [...byMonth.keys()].sort();
  const months = new Map<string, number>();
  const years = new Map<string, number>();
  let first = '', last = '';
  let written = 0;
  for (const k of keys) {
    report('write', written++, keys.length);
    const rows = byMonth.get(k)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const dir = join(dest, k.slice(0, 4));
    mkdirSync(dir, { recursive: true });
    if (formats.has('md')) writeFileSync(join(dir, `${k}.md`), renderMonth(k, rows, tz));
    if (formats.has('jsonl')) writeFileSync(join(dir, `${k}.jsonl`), renderJsonl(rows));
    if (formats.has('csv')) writeFileSync(join(dir, `${k}.csv`), renderCsv(rows));
    months.set(k, rows.length);
    years.set(k.slice(0, 4), (years.get(k.slice(0, 4)) ?? 0) + rows.length);
    first ||= rows[0]!.localTime.slice(0, 10);
    last = rows[rows.length - 1]!.localTime.slice(0, 10);
  }
  report('write', keys.length, keys.length);
  if (likes.length) writeFileSync(join(dest, 'likes.jsonl'), renderLikes(likes));
  const total = [...months.values()].reduce((a, b) => a + b, 0);
  const range: [string, string] | undefined = first ? [first, last] : undefined;
  writeFileSync(join(dest, 'index.md'), renderIndex({ months, tz, total, username, range, likes: likes.length }, lang));

  const inputPath = resolve(o.input);
  const meta: RunMeta = {
    runId, createdAt: now.toISOString(), createdAtLocal: localTime(now.toISOString(), tz), tool: `x-archive-parser ${VERSION}`,
    source: { path: inputPath, kind: statSync(inputPath).isDirectory() ? 'folder' : 'zip', bytes: statSync(inputPath).isDirectory() ? undefined : statSync(inputPath).size },
    username, tz, total, skipped, kinds, range, likes: likes.length, formats: [...formats], exclude: [...exclude], since: o.since, until: o.until,
    months: Object.fromEntries(months), folder: resolve(dest),
  };
  writeFileSync(join(dest, 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
  writeFileSync(join(dest, 'README.md'), renderReadme(meta, lang));

  return { username, tz, total, skipped, months: [...months], years: [...years], kinds, range, likes: likes.length, out: resolve(dest), runId, createdAt: meta.createdAt };
}
