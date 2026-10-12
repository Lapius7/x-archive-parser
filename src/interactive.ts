import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { t } from './i18n.js';
import { convert, systemTz, validateTz, type Format, type PostKind } from './index.js';
import { pc, progressText, stageTimer, summary } from './ui.js';

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
  if (p.isCancel(v)) { p.cancel(t('cancelled')); process.exit(130); }
};

export async function interactive(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' x-archive-parser ')));

  const found = findCandidates();
  let input = '';
  if (found.length) {
    const pick = await p.select({
      message: t('qArchive'),
      options: [...found.map((f) => ({ value: f, label: shortLabel(f), hint: f })), { value: '', label: t('qOtherPath') }],
    });
    cancelled(pick);
    input = pick as string;
  }
  if (!input) {
    const path = await p.text({
      message: t('qPath'),
      validate: (v) => (!v || !existsSync(resolve(v)) ? t('notFound') : undefined),
    });
    cancelled(path);
    input = resolve(path as string);
  }

  const out = await p.text({ message: t('qOut'), initialValue: './x-posts' });
  cancelled(out);
  const tz = await p.text({
    message: t('qTz'), initialValue: systemTz(),
    validate: (v) => (v && validateTz(v) ? undefined : t('badTzHint')),
  });
  cancelled(tz);
  const formats = await p.multiselect({
    message: t('qFormats'),
    options: [
      { value: 'md', label: 'Markdown', hint: t('fmtMd') },
      { value: 'jsonl', label: 'JSONL', hint: t('fmtJsonl') },
      { value: 'csv', label: 'CSV', hint: t('fmtCsv') },
    ],
    initialValues: ['md', 'jsonl'], required: true,
  });
  cancelled(formats);
  const exclude = await p.multiselect({
    message: t('qSkip'),
    options: [
      { value: 'repost', label: t('skipRepost'), hint: t('skipRepostHint') },
      { value: 'reply', label: t('skipReply'), hint: t('skipReplyHint') },
      { value: 'quote', label: t('skipQuote'), hint: t('skipQuoteHint') },
    ],
    required: false,
  });
  cancelled(exclude);
  const likes = await p.confirm({ message: t('qLikes'), initialValue: false });
  cancelled(likes);

  const s = p.spinner();
  s.start(`${t('stageRead')}…`);
  const timer = stageTimer();
  try {
    const r = convert({
      input, out: out as string, tz: tz as string, formats: formats as Format[], exclude: exclude as PostKind[], likes: likes as boolean,
      onProgress: (e) => { timer.onProgress(e); s.message(progressText(e)); },
    });
    s.stop(t('done'));
    for (const l of timer.lines(r)) p.log.message(l);
    p.note(summary(r), t('resultTitle'));
    p.log.info(t('nextTry', pc.cyan(`x-archive-parser search "keyword" "${r.out}"`)));
    p.outro(`${t('savedTo')} ${pc.bold(r.out)}`);
  } catch (e) {
    s.stop(pc.red(t('failed')));
    p.cancel((e as Error).message);
    process.exit(1);
  }
}
