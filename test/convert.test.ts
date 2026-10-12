import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { convert } from '../src/index.js';

it('converts a directory archive into monthly files', () => {
  const root = mkdtempSync(join(tmpdir(), 'xap-'));
  mkdirSync(join(root, 'in/data'), { recursive: true });
  const tweets = [
    { tweet: { id_str: '1', created_at: 'Wed Jan 10 12:00:00 +0000 2024', full_text: 'hi https://t.co/a', entities: { urls: [{ url: 'https://t.co/a', expanded_url: 'https://example.com' }] } } },
    { tweet: { id_str: '2', created_at: 'Thu Feb 01 00:00:00 +0000 2024', full_text: 'yo', in_reply_to_status_id_str: '1', in_reply_to_screen_name: 'a' } },
  ];
  writeFileSync(join(root, 'in/data/tweets.js'), 'window.YTD.tweets.part0 = ' + JSON.stringify(tweets));
  const r = convert({ input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC' });
  expect(r).toEqual({ total: 2, months: 2 });
  expect(readFileSync(join(root, 'out/2024/2024-01.md'), 'utf8')).toContain('https://example.com');
  expect(readFileSync(join(root, 'out/2024/2024-02.jsonl'), 'utf8')).toContain('"kind":"reply"');
  convert({ input: join(root, 'in'), out: join(root, 'out'), tz: 'UTC' }); // idempotent
});
