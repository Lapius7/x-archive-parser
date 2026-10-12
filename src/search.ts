import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { t } from './i18n.js';
import type { PostKind, PostRow } from './types.js';

/**
 * 出力フォルダを決める。指定先に index.md があればそこ、なければ直下の実行フォルダのうち最新のもの。
 * 新しさは meta.json の作成時刻（ミリ秒）で決める
 */
export function resolveOutDir(dir: string): string {
  if (existsSync(join(dir, 'index.md'))) return dir;
  const runs = existsSync(dir) ? readdirSync(dir).filter((e) => existsSync(join(dir, e, 'index.md'))).sort() : [];
  if (runs.length === 0) throw new Error(t('noResults', dir));
  const key = (name: string) => {
    try { return (JSON.parse(readFileSync(join(dir, name, 'meta.json'), 'utf8')) as { createdAt: string }).createdAt; } catch { return ''; }
  };
  return join(dir, [...runs].sort((a, b) => key(a).localeCompare(key(b)) || a.localeCompare(b)).at(-1)!);
}

/** 出力ディレクトリの JSONL を古い順に読む */
export function* iterRows(dir: string): Generator<PostRow> {
  dir = resolveOutDir(dir);
  for (const y of readdirSync(dir).filter((e) => /^\d{4}$/.test(e)).sort()) {
    for (const f of readdirSync(join(dir, y)).filter((e) => e.endsWith('.jsonl')).sort()) {
      for (const line of readFileSync(join(dir, y, f), 'utf8').split('\n')) if (line) yield JSON.parse(line) as PostRow;
    }
  }
}

export interface SearchOptions {
  query?: string;
  regex?: boolean;
  kind?: PostKind[];
  since?: string;
  until?: string;
  hashtag?: string;
  mention?: string;
  hasMedia?: boolean;
  minLikes?: number;
}

export function search(dir: string, o: SearchOptions): PostRow[] {
  let test: (t: string) => boolean = () => true;
  if (o.query) {
    if (o.regex) { const re = new RegExp(o.query, 'i'); test = (t) => re.test(t); }
    else { const q = o.query.toLowerCase(); test = (t) => t.toLowerCase().includes(q); }
  }
  const tag = o.hashtag?.replace(/^#/, '').toLowerCase();
  const men = o.mention?.replace(/^@/, '').toLowerCase();
  const out: PostRow[] = [];
  for (const r of iterRows(dir)) {
    const day = r.localTime.slice(0, 10);
    if (o.kind?.length && !o.kind.includes(r.kind)) continue;
    if (o.since && day < o.since) continue;
    if (o.until && day > o.until) continue;
    if (tag && !r.hashtags.some((h) => h.toLowerCase() === tag)) continue;
    if (men && !r.mentions.some((m) => m.toLowerCase() === men)) continue;
    if (o.hasMedia && r.media.length === 0) continue;
    if (o.minLikes && r.likes < o.minLikes) continue;
    if (test(r.text)) out.push(r);
  }
  return out;
}
