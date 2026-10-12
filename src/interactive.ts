import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { convert, systemTz, validateTz, type Format, type PostKind } from './index.js';
import { pc, progressText, summary } from './ui.js';

/** 探す場所。WSL なら Windows 側の全ユーザーの Downloads も見る */
function searchDirs(): string[] {
  const dirs = [process.cwd(), join(homedir(), 'Downloads')];
  try {
    for (const u of readdirSync('/mnt/c/Users')) dirs.push(join('/mnt/c/Users', u, 'Downloads'));
  } catch { /* WSL 以外は何もしない */ }
  return dirs;
}

const isArchiveDir = (d: string) => existsSync(join(d, 'data', 'tweets.js')) || existsSync(join(d, 'data', 'tweet.js'));

/** twitter-2026-10-05-xxxx / x-archive-… のような名前 */
const ARCHIVE_NAME = /^(twitter|x[-_ ]?archive|x[-_ ]\d{4}-)/i;

function findCandidates(): string[] {
  const out = new Set<string>();
  for (const dir of searchDirs()) {
    let names: string[];
    try { names = readdirSync(dir); } catch { continue; }
    for (const f of names) {
      const full = join(dir, f);
      try {
        if (ARCHIVE_NAME.test(f) && /\.zip$/i.test(f)) out.add(full);
        else if (ARCHIVE_NAME.test(f) && statSync(full).isDirectory() && isArchiveDir(full)) out.add(full);
      } catch { /* 読めないものは飛ばす */ }
    }
  }
  return [...out];
}

/** 長いハッシュ付きの名前を短くする。例: twitter-2026-10-05-cff5…zip → twitter-2026-10-05 (zip) */
function shortLabel(path: string): string {
  const name = basename(path);
  const m = name.match(/^(twitter|x)[-_ ]?(\d{4}-\d{2}-\d{2})/i);
  const kind = name.toLowerCase().endsWith('.zip') ? 'zip' : 'folder';
  return m ? `${m[1]}-${m[2]} (${kind})` : name;
}

const cancelled = (v: unknown) => {
  if (p.isCancel(v)) { p.cancel('Cancelled.'); process.exit(130); }
};

export async function interactive(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' x-archive-parser ')));

  const found = findCandidates();
  let input = '';
  if (found.length) {
    const pick = await p.select({
      message: 'Which X archive do you want to convert?',
      options: [...found.map((f) => ({ value: f, label: shortLabel(f), hint: f })), { value: '', label: 'Choose another path…' }],
    });
    cancelled(pick);
    input = pick as string;
  }
  if (!input) {
    const t = await p.text({
      message: 'Path to the archive (.zip or extracted folder)',
      validate: (v) => (!v || !existsSync(resolve(v)) ? 'Not found. Check the path.' : undefined),
    });
    cancelled(t);
    input = resolve(t as string);
  }

  const out = await p.text({ message: 'Where should the converted files go?', initialValue: './x-posts' });
  cancelled(out);
  const tz = await p.text({
    message: 'Timezone for dates and monthly grouping', initialValue: systemTz(),
    validate: (v) => (v && validateTz(v) ? undefined : 'Unknown timezone. Example: Asia/Tokyo'),
  });
  cancelled(tz);
  const formats = await p.multiselect({
    message: 'Which file formats do you need? (space to toggle)',
    options: [
      { value: 'md', label: 'Markdown', hint: 'easy to read' },
      { value: 'jsonl', label: 'JSONL', hint: 'for grep and jq, used by search and stats' },
      { value: 'csv', label: 'CSV', hint: 'for spreadsheets' },
    ],
    initialValues: ['md', 'jsonl'], required: true,
  });
  cancelled(formats);
  const exclude = await p.multiselect({
    message: 'Skip any post types? (space to toggle, enter with none selected keeps everything)',
    options: [
      { value: 'repost', label: 'Reposts', hint: 'posts that start with "RT @"' },
      { value: 'reply', label: 'Replies', hint: 'replies to other posts' },
      { value: 'quote', label: 'Quote posts', hint: 'posts that quote another post' },
    ],
    required: false,
  });
  cancelled(exclude);
  const likes = await p.confirm({ message: 'Also save the posts you liked? (likes.jsonl)', initialValue: false });
  cancelled(likes);

  const s = p.spinner();
  s.start('Reading the archive…');
  try {
    const r = convert({
      input, out: out as string, tz: tz as string, formats: formats as Format[], exclude: exclude as PostKind[], likes: likes as boolean,
      onProgress: (e) => s.message(progressText(e)),
    });
    s.stop(`Done. Wrote ${pc.bold(r.out)}/index.md`);
    p.note(summary(r), 'Result');
    p.outro(`Next, try: ${pc.cyan(`x-archive-parser search "keyword" ${r.out}`)}`);
  } catch (e) {
    s.stop(pc.red('Failed'));
    p.cancel((e as Error).message);
    process.exit(1);
  }
}
