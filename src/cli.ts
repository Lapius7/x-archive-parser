import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import * as p from '@clack/prompts';
import { convert, computeStats, search, type Format, type PostKind } from './index.js';
import { interactive } from './interactive.js';
import { hit, num, pc, progressText, statsReport, summary } from './ui.js';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const KINDS = ['post', 'reply', 'repost', 'quote'];

const HELP = `${pc.bold('x-archive-parser')} ${pc.dim('v' + VERSION)}
Turn an X (Twitter) archive into per-month Markdown / JSONL / CSV, then search it.

${pc.bold('Usage')}
  x-archive-parser                          interactive mode
  x-archive-parser [convert] <archive>      convert a zip or extracted folder
  x-archive-parser search [query] [dir]     search converted posts
  x-archive-parser stats [dir]              activity summary

${pc.bold('convert options')}
  -o, --out <dir>        output folder (default ./x-posts)
      --tz <zone>        IANA timezone (default: system)
  -f, --format <list>    md,jsonl,csv (default md,jsonl)
      --since <date>     YYYY-MM-DD, inclusive
      --until <date>     YYYY-MM-DD, inclusive
      --exclude <kinds>  comma list of reply,repost,quote
      --likes            also save likes.jsonl
      --json             print the result as JSON
  -q, --quiet            no output except errors

${pc.bold('search options')}
  -E, --regex   treat query as a regular expression
  -k, --kind <list>   post,reply,repost,quote
      --since / --until <date>
      --hashtag <tag>   --mention <user>   --media   --min-likes <n>
  -n, --limit <n>  (default 20; 0 = all)   --full   --json
`;

const fail = (msg: string): never => { console.error(`${pc.red('error:')} ${msg}`); process.exit(1); };
const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
const checkKinds = (v: string[] | undefined, allowed: string[]) => {
  const bad = v?.find((k) => !allowed.includes(k));
  if (bad) fail(`unknown kind "${bad}" (allowed: ${allowed.join(', ')})`);
  return v as PostKind[] | undefined;
};

async function runConvert(args: string[]) {
  const { values: v, positionals } = parseArgs({
    args, allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o', default: './x-posts' }, tz: { type: 'string' }, format: { type: 'string', short: 'f' },
      since: { type: 'string' }, until: { type: 'string' }, exclude: { type: 'string' }, likes: { type: 'boolean' },
      json: { type: 'boolean' }, quiet: { type: 'boolean', short: 'q' },
    },
  });
  if (positionals.length !== 1) fail('specify one archive (zip or extracted folder). Run with --help for usage.');
  const formats = list(v.format) ?? ['md', 'jsonl'];
  const badFormat = formats.find((f) => !['md', 'jsonl', 'csv'].includes(f));
  if (badFormat) fail(`unknown format "${badFormat}" (allowed: md, jsonl, csv)`);
  const exclude = checkKinds(list(v.exclude), ['reply', 'repost', 'quote']);

  const quiet = v.quiet || v.json;
  const s = !quiet && process.stderr.isTTY ? p.spinner() : null;
  s?.start('Reading the archive…');
  try {
    const r = convert({
      input: positionals[0]!, out: v.out!, tz: v.tz, formats: formats as Format[], exclude, since: v.since, until: v.until, likes: v.likes,
      onProgress: (e) => s?.message(progressText(e)),
    });
    s?.stop(`Wrote ${pc.bold(v.out!)}/index.md`);
    if (v.json) console.log(JSON.stringify(r, null, 2));
    else if (!quiet) console.log(`${s ? '' : `Wrote ${v.out}/index.md\n`}\n${summary(r)}\n\n${pc.dim('Next:')} ${pc.cyan(`x-archive-parser search "keyword" ${v.out}`)}`);
  } catch (e) {
    s?.stop(pc.red('Failed'));
    fail((e as Error).message);
  }
}

function runSearch(args: string[]) {
  const { values: v, positionals } = parseArgs({
    args, allowPositionals: true,
    options: {
      regex: { type: 'boolean', short: 'E' }, kind: { type: 'string', short: 'k' }, since: { type: 'string' }, until: { type: 'string' },
      hashtag: { type: 'string' }, mention: { type: 'string' }, media: { type: 'boolean' }, 'min-likes': { type: 'string' },
      limit: { type: 'string', short: 'n', default: '20' }, full: { type: 'boolean' }, json: { type: 'boolean' },
    },
  });
  // 引数が1つで index.md を持つ場所ならディレクトリ、そうでなければクエリとみなす
  let query: string | undefined = positionals[0];
  let dir = positionals[1] ?? './x-posts';
  if (positionals.length === 1 && isOutDir(query!)) { dir = query!; query = undefined; }
  try {
    const hits = search(dir, {
      query, regex: v.regex, kind: checkKinds(list(v.kind), KINDS), since: v.since, until: v.until,
      hashtag: v.hashtag, mention: v.mention, hasMedia: v.media, minLikes: v['min-likes'] ? Number(v['min-likes']) : undefined,
    });
    const limit = Number(v.limit);
    const shown = limit > 0 ? hits.slice(-limit) : hits; // 新しいほうを優先して表示
    if (v.json) return console.log(JSON.stringify(shown));
    const width = process.stdout.columns || 100;
    for (const r of shown) console.log(hit(r, { query, regex: v.regex, full: v.full, width }));
    console.error(pc.dim(`${num(hits.length)} hit${hits.length === 1 ? '' : 's'}${shown.length < hits.length ? ` (showing latest ${shown.length}, use -n 0 for all)` : ''}`));
    if (hits.length === 0) process.exitCode = 1;
  } catch (e) {
    fail((e as Error).message);
  }
}

const isOutDir = (d: string) => existsSync(join(d, 'index.md'));

function runStats(args: string[]) {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } });
  try {
    const s = computeStats(positionals[0] ?? './x-posts');
    console.log(v.json ? JSON.stringify(s, null, 2) : statsReport(s));
  } catch (e) {
    fail((e as Error).message);
  }
}

const [first, ...rest] = process.argv.slice(2);
try {
  if (first === '-h' || first === '--help' || first === 'help') process.stdout.write(HELP);
  else if (first === '-v' || first === '--version') console.log(VERSION);
  else if (first === undefined) {
    if (process.stdin.isTTY && process.stdout.isTTY) await interactive();
    else process.stdout.write(HELP);
  } else if (first === 'search') runSearch(rest);
  else if (first === 'stats') runStats(rest);
  else if (first === 'convert') await runConvert(rest);
  else await runConvert([first, ...rest]);
} catch (e) {
  fail((e as Error).message);
}
