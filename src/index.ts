import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { openSource, parseYtd } from './source.js';
import { toLike, toPost, toUsername } from './parse.js';
import { monthKey, renderCsv, renderIndex, renderJsonl, renderLikes, renderMonth, toRow } from './render.js';
import type { LikeRow, Post, PostKind, PostRow } from './types.js';

export type { Post, PostKind, PostRow, LikeRow };
export { toPost, toLike };
export { iterRows, search, type SearchOptions } from './search.js';
export { computeStats, type Stats } from './stats.js';

export type Format = 'md' | 'jsonl' | 'csv';

export interface ConvertOptions {
  input: string;
  out: string;
  tz?: string;
  formats?: Format[];
  /** 含めない投稿の種別 */
  exclude?: PostKind[];
  /** YYYY-MM-DD（タイムゾーン変換後の日付、両端を含む） */
  since?: string;
  until?: string;
  likes?: boolean;
  onStage?: (stage: 'read' | 'parse' | 'write') => void;
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
  out: string;
}

export const systemTz = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

export function validateTz(tz: string): boolean {
  try { new Intl.DateTimeFormat('en', { timeZone: tz }); return true; } catch { return false; }
}

export function convert(o: ConvertOptions): ConvertResult {
  const tz = o.tz ?? systemTz();
  if (!validateTz(tz)) throw new Error(`不正なタイムゾーンです: ${tz}`);
  const formats = new Set<Format>(o.formats ?? ['md', 'jsonl']);
  const exclude = new Set(o.exclude ?? []);
  for (const d of [o.since, o.until]) if (d && !/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`日付は YYYY-MM-DD で指定してください: ${d}`);

  if (existsSync(o.out) && readdirSync(o.out).length > 0 && !existsSync(join(o.out, 'index.md'))) {
    throw new Error(`出力先が空ではなく index.md もありません: ${o.out}`);
  }

  o.onStage?.('read');
  const src = openSource(o.input);
  const tweetFiles = src.files('tweets?');
  if (tweetFiles.length === 0) throw new Error('data/tweets*.js が見つかりません。X のアーカイブですか？');
  const username = src.files('account').flatMap((f) => parseYtd(f)).map(toUsername).find(Boolean);

  o.onStage?.('parse');
  const seen = new Set<string>();
  const byMonth = new Map<string, PostRow[]>();
  const kinds: Record<PostKind, number> = { post: 0, reply: 0, repost: 0, quote: 0 };
  let skipped = 0;
  for (const f of tweetFiles) {
    for (const raw of parseYtd(f)) {
      const p = toPost(raw, username);
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

  o.onStage?.('write');
  // 前回の出力を消す（index.md があるときだけここに来る）
  if (existsSync(join(o.out, 'index.md'))) {
    for (const e of readdirSync(o.out)) if (/^\d{4}$/.test(e)) rmSync(join(o.out, e), { recursive: true });
    rmSync(join(o.out, 'likes.jsonl'), { force: true });
  }
  mkdirSync(o.out, { recursive: true });
  const keys = [...byMonth.keys()].sort();
  const months = new Map<string, number>();
  const years = new Map<string, number>();
  let first = '', last = '';
  for (const k of keys) {
    const rows = byMonth.get(k)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const dir = join(o.out, k.slice(0, 4));
    mkdirSync(dir, { recursive: true });
    if (formats.has('md')) writeFileSync(join(dir, `${k}.md`), renderMonth(k, rows, tz));
    if (formats.has('jsonl')) writeFileSync(join(dir, `${k}.jsonl`), renderJsonl(rows));
    if (formats.has('csv')) writeFileSync(join(dir, `${k}.csv`), renderCsv(rows));
    months.set(k, rows.length);
    years.set(k.slice(0, 4), (years.get(k.slice(0, 4)) ?? 0) + rows.length);
    first ||= rows[0]!.localTime.slice(0, 10);
    last = rows[rows.length - 1]!.localTime.slice(0, 10);
  }
  if (likes.length) writeFileSync(join(o.out, 'likes.jsonl'), renderLikes(likes));
  const total = [...months.values()].reduce((a, b) => a + b, 0);
  const range: [string, string] | undefined = first ? [first, last] : undefined;
  writeFileSync(join(o.out, 'index.md'), renderIndex({ months, tz, total, username, range, likes: likes.length }));

  return { username, tz, total, skipped, months: [...months], years: [...years], kinds, range, likes: likes.length, out: o.out };
}
