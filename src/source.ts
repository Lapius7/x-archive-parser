import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readZip } from './zip.js';

/** data/ 配下の tweets*.js の本文を返す。zip でもディレクトリでも可 */
export function loadTweetFiles(input: string): string[] {
  const isTweetFile = (p: string) => /(^|\/)data\/tweets?(-part\d+)?\.js$/.test(p.replace(/\\/g, '/'));
  if (statSync(input).isDirectory()) {
    const dir = join(input, 'data');
    return readdirSync(dir)
      .filter((f) => /^tweets?(-part\d+)?\.js$/.test(f))
      .sort()
      .map((f) => readFileSync(join(dir, f), 'utf8'));
  }
  return readZip(readFileSync(input))
    .filter((e) => isTweetFile(e.name))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((e) => e.read().toString('utf8'));
}

/** `window.YTD.tweets.part0 = [...]` 形式から配列を取り出す */
export function parseYtd(src: string): unknown[] {
  const i = src.indexOf('[');
  if (i < 0) return [];
  return JSON.parse(src.slice(i));
}
