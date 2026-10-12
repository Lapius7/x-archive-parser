import { existsSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import * as p from '@clack/prompts';
import { convert, systemTz, validateTz, type Format, type PostKind } from './index.js';
import { pc, summary } from './ui.js';

function findCandidates(): string[] {
  const out: string[] = [];
  for (const dir of [process.cwd(), join(homedir(), 'Downloads'), '/mnt/c/Users/' + (process.env.USER ?? '') + '/Downloads']) {
    if (!existsSync(dir)) continue;
    try {
      for (const f of readdirSync(dir)) {
        const full = join(dir, f);
        if (/(twitter|x[-_ ]?archive|archive).*\.zip$/i.test(f) || (statSync(full).isDirectory() && existsSync(join(full, 'data', 'tweets.js')))) out.push(full);
      }
    } catch { /* 読めないディレクトリは飛ばす */ }
  }
  return [...new Set(out)];
}

const cancelled = (v: unknown): never | void => {
  if (p.isCancel(v)) { p.cancel('Cancelled'); process.exit(130); }
};

export async function interactive(): Promise<void> {
  p.intro(pc.bgCyan(pc.black(' x-archive-parser ')));

  const found = findCandidates();
  let input: string;
  if (found.length) {
    const pick = await p.select({
      message: 'Which archive?',
      options: [...found.map((f) => ({ value: f, label: basename(f), hint: f })), { value: '', label: 'Enter a path…' }],
    });
    cancelled(pick);
    input = pick as string;
  } else input = '';
  if (!input) {
    const t = await p.text({
      message: 'Path to the archive zip or extracted folder',
      validate: (v) => (!v || !existsSync(resolve(v ?? '')) ? 'File not found' : undefined),
    });
    cancelled(t);
    input = resolve(t as string);
  }

  const out = await p.text({ message: 'Output folder', initialValue: './x-posts' });
  cancelled(out);
  const tz = await p.text({
    message: 'Timezone (IANA)', initialValue: systemTz(),
    validate: (v) => (v && validateTz(v) ? undefined : 'Unknown timezone'),
  });
  cancelled(tz);
  const formats = await p.multiselect({
    message: 'Output formats',
    options: [{ value: 'md', label: 'Markdown', hint: 'for reading' }, { value: 'jsonl', label: 'JSONL', hint: 'for grep / jq' }, { value: 'csv', label: 'CSV', hint: 'for spreadsheets' }],
    initialValues: ['md', 'jsonl'], required: true,
  });
  cancelled(formats);
  const exclude = await p.multiselect({
    message: 'Leave out (space to toggle, enter to keep everything)',
    options: [{ value: 'repost', label: 'Reposts' }, { value: 'reply', label: 'Replies' }, { value: 'quote', label: 'Quote posts' }],
    required: false,
  });
  cancelled(exclude);
  const likes = await p.confirm({ message: 'Also save liked posts (likes.jsonl)?', initialValue: false });
  cancelled(likes);

  const s = p.spinner();
  s.start('Reading archive');
  try {
    const r = convert({
      input, out: out as string, tz: tz as string, formats: formats as Format[], exclude: exclude as PostKind[], likes: likes as boolean,
      onStage: (st) => s.message({ read: 'Reading archive', parse: 'Parsing posts', write: 'Writing files' }[st]),
    });
    s.stop(`Wrote ${pc.bold(r.out)}/index.md`);
    p.note(summary(r), 'Done');
    p.outro(`Try: ${pc.cyan(`x-archive-parser search "keyword" ${r.out}`)}`);
  } catch (e) {
    s.stop(pc.red('Failed'));
    p.cancel((e as Error).message);
    process.exit(1);
  }
}
