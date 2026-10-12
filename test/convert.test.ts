import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { computeStats, convert, search } from '../src/index.js';
import { readZip } from '../src/zip.js';

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
    expect(r.total).toBe(4);
    expect(r.username).toBe('alice');
    expect(r.kinds).toEqual({ post: 1, reply: 1, repost: 1, quote: 1 });
    const md = readFileSync(join(root, 'out/2024/2024-01.md'), 'utf8');
    expect(md).toContain('https://www.example.com/x');
    expect(md).toContain('hi & ');
    expect(md).toContain('https://x.com/alice/status/1');
    expect(readFileSync(join(root, 'out/2024/2024-03.md'), 'utf8')).toContain('![photo](https://pbs.example/p.jpg)');
    expect(readFileSync(join(root, 'out/2024/2024-02.csv'), 'utf8')).toContain('"yo, ""quoted"""');
    expect(readFileSync(join(root, 'out/likes.jsonl'), 'utf8')).toContain('"tweetId":"9"');
  });

  it('applies filters and cleans stale output on re-run', () => {
    const root = fixture();
    const base = { input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC' };
    convert(base);
    const r = convert({ ...base, exclude: ['repost'], since: '2024-02-01' });
    expect(r.total).toBe(2);
    expect(existsSync(join(root, 'out/2024/2024-01.md'))).toBe(false);
  });

  it('refuses a non-empty folder without index.md', () => {
    const root = fixture();
    expect(() => convert({ input: join(root, 'in'), out: join(root, 'in') })).toThrow(/空ではなく/);
  });

  it('rejects bad timezone and date', () => {
    const root = fixture();
    expect(() => convert({ input: join(root, 'in'), out: join(root, 'o'), tz: 'Mars/Base' })).toThrow(/タイムゾーン/);
    expect(() => convert({ input: join(root, 'in'), out: join(root, 'o'), since: '2024/01/01' })).toThrow(/YYYY-MM-DD/);
  });
});

describe('search and stats', () => {
  it('filters converted posts', () => {
    const root = fixture();
    const out = join(root, 'out');
    convert({ input: join(root, 'in'), out, tz: 'UTC' });
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
