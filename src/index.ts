import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadTweetFiles, parseYtd } from './source.js';
import { toPost, type Post } from './parse.js';
import { monthKey, renderIndex, renderJsonl, renderMonth } from './render.js';

export type { Post };
export { toPost };

export interface ConvertOptions { input: string; out: string; tz?: string }
export interface ConvertResult { total: number; months: number }

export function convert({ input, out, tz = Intl.DateTimeFormat().resolvedOptions().timeZone }: ConvertOptions): ConvertResult {
  if (existsSync(out) && readdirSync(out).length > 0 && !existsSync(join(out, 'index.md'))) {
    throw new Error(`出力先が空ではなく index.md もありません: ${out}`);
  }
  const files = loadTweetFiles(input);
  if (files.length === 0) throw new Error('data/tweets*.js が見つかりません');

  const seen = new Set<string>();
  const byMonth = new Map<string, Post[]>();
  for (const f of files) {
    for (const raw of parseYtd(f)) {
      const p = toPost(raw);
      if (!p || seen.has(p.id)) continue;
      seen.add(p.id);
      const k = monthKey(p.createdAt, tz);
      (byMonth.get(k) ?? byMonth.set(k, []).get(k)!).push(p);
    }
  }
  const keys = [...byMonth.keys()].sort();
  const counts = new Map<string, number>();
  for (const k of keys) {
    const posts = byMonth.get(k)!.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const dir = join(out, k.slice(0, 4));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, `${k}.md`), renderMonth(k, posts, tz));
    writeFileSync(join(dir, `${k}.jsonl`), renderJsonl(posts, tz));
    counts.set(k, posts.length);
  }
  mkdirSync(out, { recursive: true });
  writeFileSync(join(out, 'index.md'), renderIndex(counts, tz, seen.size));
  return { total: seen.size, months: keys.length };
}
