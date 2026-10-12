import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import * as p from '@clack/prompts';
import { t, parseLang, setLang, getLang } from './i18n.js';
import { convert, computeStats, resolveOutDir, search, type Format, type PostKind } from './index.js';
import { interactive } from './interactive.js';
import { renderCsv, renderJsonl } from './render.js';
import { hit, num, pc, progressText, stageTimer, statsReport, summary } from './ui.js';

const VERSION = (JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }).version;
const KINDS = ['post', 'reply', 'repost', 'quote'];

const HELP = {
  en: () => `${pc.bold('x-archive-parser')} ${pc.dim('v' + VERSION)}
Turn an X (Twitter) archive into per-month Markdown / JSONL / CSV, then search it.

${pc.bold('Usage')}
  x-archive-parser                          interactive mode
  x-archive-parser [convert] <archive>      convert a zip or extracted folder
  x-archive-parser search [query] [dir]     search converted posts
  x-archive-parser stats [dir]              activity summary

${pc.bold('Global options')}
  -l, --lang <en|ja>     language (default: from XAP_LANG / LANG)

${pc.bold('convert options')}
  -o, --out <dir>        parent folder (default ./x-posts). A new subfolder
                         <user>_<date>_<id>/ is created in it on every run
      --here             write straight into --out instead (replaces its old output)
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
  -n, --limit <n>  (default 20; 0 = all)   --full
  -f, --format <fmt>   text (default) | json | jsonl | csv
  -o, --output <file>  save results to a file (default format: jsonl)
      --json           same as -f json
`,
  ja: () => `${pc.bold('x-archive-parser')} ${pc.dim('v' + VERSION)}
X（旧 Twitter）のアーカイブを、月ごとの Markdown / JSONL / CSV に変換して検索できるようにします。

${pc.bold('使い方')}
  x-archive-parser                          対話モード
  x-archive-parser [convert] <archive>      zip または展開済みフォルダを変換
  x-archive-parser search [query] [dir]     変換した投稿を検索
  x-archive-parser stats [dir]              投稿の集計

${pc.bold('共通オプション')}
  -l, --lang <en|ja>     表示言語（既定: XAP_LANG / LANG から判定）

${pc.bold('convert のオプション')}
  -o, --out <dir>        親フォルダ（既定 ./x-posts）。実行のたびに、この中へ
                         <ユーザー>_<日時>_<ID>/ という新しいフォルダを作ります
      --here             サブフォルダを作らず --out に直接書き出す（以前の出力は置き換え）
      --tz <zone>        IANA タイムゾーン（既定: システムの設定）
  -f, --format <list>    md,jsonl,csv（既定 md,jsonl）
      --since <date>     この日以降（YYYY-MM-DD、当日を含む）
      --until <date>     この日まで（YYYY-MM-DD、当日を含む）
      --exclude <kinds>  除外する種別をカンマ区切りで（reply,repost,quote）
      --likes            いいねも likes.jsonl に保存
      --json             結果を JSON で表示
  -q, --quiet            エラー以外は表示しない

${pc.bold('search のオプション')}
  -E, --regex   クエリを正規表現として扱う
  -k, --kind <list>   post,reply,repost,quote
      --since / --until <date>
      --hashtag <tag>   --mention <user>   --media   --min-likes <n>
  -n, --limit <n>  表示件数（既定 20、0 で全件）   --full
  -f, --format <fmt>   text（既定）| json | jsonl | csv
  -o, --output <file>  結果をファイルに保存（形式の既定は jsonl）
      --json           -f json と同じ
`,
};

const fail = (msg: string): never => { console.error(`${pc.red(t('errorLabel'))} ${msg}`); process.exit(1); };
const list = (v?: string) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined);
const checkKinds = (v: string[] | undefined, allowed: string[]) => {
  const bad = v?.find((k) => !allowed.includes(k));
  if (bad) fail(t('unknownKind', bad, allowed.join(', ')));
  return v as PostKind[] | undefined;
};

async function runConvert(args: string[]) {
  const { values: v, positionals } = parseArgs({
    args, allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o', default: './x-posts' }, tz: { type: 'string' }, format: { type: 'string', short: 'f' },
      since: { type: 'string' }, until: { type: 'string' }, exclude: { type: 'string' }, likes: { type: 'boolean' }, here: { type: 'boolean' },
      json: { type: 'boolean' }, quiet: { type: 'boolean', short: 'q' },
    },
  });
  if (positionals.length !== 1) fail(t('oneArchive'));
  const formats = list(v.format) ?? ['md', 'jsonl'];
  const badFormat = formats.find((f) => !['md', 'jsonl', 'csv'].includes(f));
  if (badFormat) fail(t('unknownFormat', badFormat));
  const exclude = checkKinds(list(v.exclude), ['reply', 'repost', 'quote']);

  const quiet = v.quiet || v.json;
  const s = !quiet && process.stderr.isTTY ? p.spinner() : null;
  s?.start(`${t('stageRead')}…`);
  const timer = stageTimer();
  try {
    const r = convert({
      input: positionals[0]!, out: v.out!, here: v.here, tz: v.tz, formats: formats as Format[], exclude, since: v.since, until: v.until, likes: v.likes,
      onProgress: (e) => { timer.onProgress(e); s?.message(progressText(e)); },
    });
    s?.stop(t('wrote', pc.bold(r.out)));
    if (s) console.log(timer.lines(r).join('\n'));
    if (v.json) console.log(JSON.stringify(r, null, 2));
    else if (!quiet) console.log(`${s ? '' : `${t('wrote', r.out)}\n`}\n${summary(r)}\n\n${pc.dim(t('next'))} ${pc.cyan(`x-archive-parser search "keyword" "${r.out}"`)}\n\n${t('savedTo')} ${pc.bold(r.out)}`);
    else if (quiet && !v.json) console.log(r.out);
  } catch (e) {
    s?.stop(pc.red(t('failed')));
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
      format: { type: 'string', short: 'f' }, output: { type: 'string', short: 'o' },
    },
  });
  // 引数が1つで index.md を持つ場所ならディレクトリ、そうでなければクエリとみなす
  let query: string | undefined = positionals[0];
  let dir = positionals[1] ?? './x-posts';
  if (positionals.length === 1 && isOutDir(query!)) { dir = query!; query = undefined; }
  try {
    const used = resolveOutDir(dir);
    if (used !== dir) console.error(pc.dim(t('using', used)));
    const hits = search(used, {
      query, regex: v.regex, kind: checkKinds(list(v.kind), KINDS), since: v.since, until: v.until,
      hashtag: v.hashtag, mention: v.mention, hasMedia: v.media, minLikes: v['min-likes'] ? Number(v['min-likes']) : undefined,
    });
    const limit = Number(v.limit);
    const shown = limit > 0 ? hits.slice(-limit) : hits; // 新しいほうを優先して表示
    const fmt = v.format ?? (v.json ? 'json' : v.output ? 'jsonl' : 'text');
    if (fmt !== 'text') {
      if (!['json', 'jsonl', 'csv'].includes(fmt)) throw new Error(t('unknownSearchFormat', fmt));
      const body = fmt === 'json' ? JSON.stringify(shown, null, 2) + '\n' : fmt === 'jsonl' ? renderJsonl(shown) : renderCsv(shown);
      if (v.output) {
        writeFileSync(v.output, body);
        console.error(t('savedHits', num(shown.length), num(hits.length), resolve(v.output)));
      } else process.stdout.write(body);
      if (hits.length === 0) process.exitCode = 1;
      return;
    }
    const width = process.stdout.columns || 100;
    for (const r of shown) console.log(hit(r, { query, regex: v.regex, full: v.full, width }));
    console.error(pc.dim(t('hits', num(hits.length), shown.length, hits.length)));
    if (hits.length === 0) process.exitCode = 1;
  } catch (e) {
    fail((e as Error).message);
  }
}

const isOutDir = (d: string) => { try { resolveOutDir(d); return true; } catch { return false; } };

function runStats(args: string[]) {
  const { values: v, positionals } = parseArgs({ args, allowPositionals: true, options: { json: { type: 'boolean' } } });
  try {
    const dir = positionals[0] ?? './x-posts';
    const used = resolveOutDir(dir);
    if (used !== dir) console.error(pc.dim(t('using', used)));
    const s = computeStats(used);
    console.log(v.json ? JSON.stringify(s, null, 2) : statsReport(s));
  } catch (e) {
    fail((e as Error).message);
  }
}

/** --lang / -l はサブコマンドの前後どちらにあっても受け付ける */
function takeLang(argv: string[]): string[] {
  const out: string[] = [];
  let value: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--lang' || a === '-l') value = argv[++i] ?? '';
    else if (a.startsWith('--lang=')) value = a.slice(7);
    else out.push(a);
  }
  if (value !== undefined) {
    const l = parseLang(value);
    if (!l) fail(t('unknownLang', value));
    else setLang(l);
  }
  return out;
}

const [first, ...rest] = takeLang(process.argv.slice(2));
try {
  if (first === '-h' || first === '--help' || first === 'help') process.stdout.write(HELP[getLang()]());
  else if (first === '-v' || first === '--version') console.log(VERSION);
  else if (first === undefined) {
    if (process.stdin.isTTY && process.stdout.isTTY) await interactive();
    else process.stdout.write(HELP[getLang()]());
  } else if (first === 'search') runSearch(rest);
  else if (first === 'stats') runStats(rest);
  else if (first === 'convert') await runConvert(rest);
  else await runConvert([first, ...rest]);
} catch (e) {
  fail((e as Error).message);
}
