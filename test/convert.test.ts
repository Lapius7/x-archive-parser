import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { beforeAll, describe, expect, it } from 'vitest';
import { computeStats, convert, parseLang, resolveOutDir, search, setLang } from '../src/index.js';
import { readZip } from '../src/zip.js';

beforeAll(() => setLang('en'));

const tweet = (o: Record<string, unknown>) => ({ tweet: o });
const TWEETS = [
  tweet({ id_str: '1', created_at: 'Wed Jan 10 12:00:00 +0000 2024', full_text: 'hi &amp; https://t.co/a #cats', favorite_count: '5',
    entities: { urls: [{ url: 'https://t.co/a', expanded_url: 'https://www.example.com/x' }], hashtags: [{ text: 'cats' }], user_mentions: [{ screen_name: 'bob' }] } }),
  tweet({ id_str: '2', created_at: 'Thu Feb 01 00:00:00 +0000 2024', full_text: 'yo, "quoted"', in_reply_to_status_id_str: '1', in_reply_to_screen_name: 'bob' }),
  tweet({ id_str: '3', created_at: 'Fri Mar 01 00:00:00 +0000 2024', full_text: 'RT @bob: hello' }),
  tweet({ id_str: '3', created_at: 'Fri Mar 01 00:00:00 +0000 2024', full_text: 'duplicate' }),
  tweet({ id_str: '4', created_at: 'Fri Mar 08 00:00:00 +0000 2024', full_text: 'look https://t.co/m', is_quote_status: true,
    quoted_status_permalink: { expanded: 'https://x.com/bob/status/1' },
    extended_entities: { media: [{ url: 'https://t.co/m', type: 'photo', media_url_https: 'https://pbs.example/p.jpg' }] } }),
];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'xap-'));
  mkdirSync(join(root, 'in/data'), { recursive: true });
  writeFileSync(join(root, 'in/data/tweets.js'), 'window.YTD.tweets.part0 = ' + JSON.stringify(TWEETS));
  writeFileSync(join(root, 'in/data/account.js'), 'window.YTD.account.part0 = [{"account":{"username":"alice"}}]');
  writeFileSync(join(root, 'in/data/like.js'), 'window.YTD.like.part0 = [{"like":{"tweetId":"9","fullText":"liked","expandedUrl":"https://x.com/z/status/9"}}]');
  return root;
}

describe('convert', () => {
  it('writes monthly files, classifies kinds, expands links and media', () => {
    const root = fixture();
    const r = convert({ input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC', formats: ['md', 'jsonl', 'csv'], likes: true });
    const d = r.out;
    expect(r.total).toBe(4);
    expect(r.username).toBe('alice');
    expect(r.kinds).toEqual({ post: 1, reply: 1, repost: 1, quote: 1 });
    const md = readFileSync(join(d, '2024/2024-01.md'), 'utf8');
    expect(md).toContain('https://www.example.com/x');
    expect(md).toContain('hi & ');
    expect(md).toContain('https://x.com/alice/status/1');
    expect(readFileSync(join(d, '2024/2024-03.md'), 'utf8')).toContain('![photo](https://pbs.example/p.jpg)');
    expect(readFileSync(join(d, '2024/2024-02.csv'), 'utf8')).toContain('"yo, ""quoted"""');
    expect(readFileSync(join(d, 'likes.jsonl'), 'utf8')).toContain('"tweetId":"9"');
  });

  it('creates a new unique subfolder on every run and never overwrites', () => {
    const root = fixture();
    const base = { input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC' };
    const a = convert(base);
    const b = convert({ ...base, exclude: ['repost'], since: '2024-02-01' });
    expect(a.out).not.toBe(b.out);
    expect(a.out).toMatch(/alice_\d{8}-\d{6}_[0-9a-f]{8}$/);
    expect(a.total).toBe(4);
    expect(b.total).toBe(2);
    expect(existsSync(join(a.out, '2024/2024-01.md'))).toBe(true); // 1回目は残る
    expect(existsSync(join(b.out, '2024/2024-01.md'))).toBe(false);
  });

  it('writes README.md and meta.json describing the run', () => {
    const root = fixture();
    const r = convert({ input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC', since: '2024-01-01' });
    const readme = readFileSync(join(r.out, 'README.md'), 'utf8');
    expect(readme).toContain('@alice');
    expect(readme).toContain('| Posts | 4 |');
    expect(readme).toContain('2024-01-10 to 2024-03-08');
    expect(readme).toContain('period: 2024-01-01 to end');
    expect(readme).toContain(join(root, 'in'));
    const meta = JSON.parse(readFileSync(join(r.out, 'meta.json'), 'utf8'));
    expect(meta).toMatchObject({ runId: r.runId, total: 4, username: 'alice', tz: 'UTC', range: ['2024-01-10', '2024-03-08'] });
  });

  it('--here writes into the folder itself and replaces its old output', () => {
    const root = fixture();
    const base = { input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC', here: true };
    convert(base);
    const r = convert({ ...base, since: '2024-02-01' });
    expect(r.out).toBe(join(root, 'out'));
    expect(existsSync(join(root, 'out/2024/2024-01.md'))).toBe(false);
    expect(() => convert({ ...base, out: join(root, 'in') })).toThrow(/not empty/);
  });

  it('rejects bad timezone and date', () => {
    const root = fixture();
    expect(() => convert({ input: join(root, 'in'), out: join(root, 'o'), tz: 'Mars/Base' })).toThrow(/timezone/i);
    expect(() => convert({ input: join(root, 'in'), out: join(root, 'o'), since: '2024/01/01' })).toThrow(/YYYY-MM-DD/);
  });
});

describe('progress', () => {
  it('reports parse and write progress ending at 100%', () => {
    const root = fixture();
    const ev: { stage: string; done: number; total: number }[] = [];
    convert({ input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC', onProgress: (e) => ev.push(e) });
    expect(ev[0]!.stage).toBe('read');
    const parse = ev.filter((e) => e.stage === 'parse').at(-1)!;
    expect(parse).toMatchObject({ done: 5, total: 5 });
    const write = ev.filter((e) => e.stage === 'write').at(-1)!;
    expect(write.done).toBe(write.total);
  });
});

describe('search and stats', () => {
  it('filters converted posts', () => {
    const root = fixture();
    const out = join(root, 'out');
    convert({ input: join(root, 'in'), out, tz: 'UTC', since: '2024-03-01' }); // 古い実行
    const latest = convert({ input: join(root, 'in'), out, tz: 'UTC' });
    expect(resolveOutDir(out)).toBe(latest.out); // 親を指定すると最新の実行を使う（同じ秒でもミリ秒で判定）
    expect(search(out, { query: 'HI' }).map((r) => r.id)).toEqual(['1']);
    expect(search(out, { kind: ['reply'] }).map((r) => r.id)).toEqual(['2']);
    expect(search(out, { hashtag: '#cats' })).toHaveLength(1);
    expect(search(out, { hasMedia: true }).map((r) => r.id)).toEqual(['4']);
    expect(search(out, { query: '^yo', regex: true })).toHaveLength(1);
    const s = computeStats(out);
    expect(s.total).toBe(4);
    expect(s.topDomains[0]).toEqual(['example.com', 1]);
    expect(s.byYear).toEqual([['2024', 4]]);
  });
});

describe('zip', () => {
  it('reads deflate and stored entries', () => {
    const files = [['data/tweets.js', Buffer.from('abc'.repeat(50)), 8], ['x.txt', Buffer.from('plain'), 0]] as const;
    const parts: Buffer[] = [], central: Buffer[] = [];
    let off = 0;
    for (const [name, data, method] of files) {
      const body = method === 8 ? deflateRawSync(data) : data;
      const nm = Buffer.from(name);
      const lh = Buffer.alloc(30); lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(method, 8); lh.writeUInt32LE(body.length, 18); lh.writeUInt32LE(data.length, 22); lh.writeUInt16LE(nm.length, 26);
      const ch = Buffer.alloc(46); ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(method, 10); ch.writeUInt32LE(body.length, 20); ch.writeUInt32LE(data.length, 24); ch.writeUInt16LE(nm.length, 28); ch.writeUInt32LE(off, 42);
      parts.push(lh, nm, body); central.push(ch, nm);
      off += 30 + nm.length + body.length;
    }
    const cd = Buffer.concat(central);
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
    const z = readZip(Buffer.concat([...parts, cd, end]));
    expect(z.map((e) => e.name)).toEqual(['data/tweets.js', 'x.txt']);
    expect(z[0]!.read().toString()).toBe('abc'.repeat(50));
    expect(z[1]!.read().toString()).toBe('plain');
  });
});

describe('language', () => {
  it('parses language names', () => {
    expect(parseLang('ja')).toBe('ja');
    expect(parseLang('ja-JP')).toBe('ja');
    expect(parseLang('EN')).toBe('en');
    expect(parseLang('fr')).toBeUndefined();
  });
});
