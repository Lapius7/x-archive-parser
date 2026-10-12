import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { readZip } from './zip.js';

export interface Source {
  /** data/<name>(-partN).js の本文を名前順で返す。name は正規表現の断片（例: "tweets?"） */
  files(name: string): string[];
}

export function openSource(input: string): Source {
  if (statSync(input).isDirectory()) {
    return {
      files(name) {
        const re = new RegExp(`^${name}(-part\\d+)?\\.js$`);
        let list: string[];
        try { list = readdirSync(join(input, 'data')); } catch { return []; }
        return list.filter((f) => re.test(f)).sort().map((f) => readFileSync(join(input, 'data', f), 'utf8'));
      },
    };
  }
  const entries = readZip(readFileSync(input));
  return {
    files(name) {
      const re = new RegExp(`(^|/)data/${name}(-part\\d+)?\\.js$`);
      return entries
        .filter((e) => re.test(e.name.replace(/\\/g, '/')))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((e) => e.read().toString('utf8'));
    },
  };
}

/** `window.YTD.tweets.part0 = [...]` 形式から配列を取り出す */
export function parseYtd(src: string): unknown[] {
  const i = src.indexOf('[');
  if (i < 0) return [];
  return JSON.parse(src.slice(i));
}
