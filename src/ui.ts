import pc from 'picocolors';
import type { ConvertResult } from './index.js';
import type { Stats } from './stats.js';
import type { PostRow } from './types.js';

export { pc };

const SPARK = '▁▂▃▄▅▆▇█';
const nf = new Intl.NumberFormat('en-US');
export const num = (n: number) => nf.format(n);

export function sparkline(values: number[]): string {
  const max = Math.max(...values, 1);
  return values.map((v) => (v === 0 ? ' ' : SPARK[Math.min(7, Math.floor((v / max) * 7.999))]!)).join('');
}

export function bar(value: number, max: number, width = 24): string {
  const cells = max > 0 ? (value / max) * width : 0;
  const full = Math.floor(cells);
  const part = ' ▏▎▍▌▋▊▉'[Math.floor((cells - full) * 8)]!.trim();
  return '█'.repeat(full) + part;
}

/** 左ラベル + 棒 + 右の数値 */
export function chart(rows: [string, number][], width = 24): string {
  const max = Math.max(...rows.map(([, v]) => v), 1);
  const lw = Math.max(...rows.map(([l]) => l.length), 0);
  const vw = Math.max(...rows.map(([, v]) => num(v).length), 0);
  return rows.map(([l, v]) => `  ${pc.dim(l.padEnd(lw))} ${pc.cyan(bar(v, max, width).padEnd(width))} ${num(v).padStart(vw)}`).join('\n');
}

const KIND_COLOR: Record<string, (s: string) => string> = { post: pc.green, reply: pc.blue, repost: pc.magenta, quote: pc.yellow };

export function summary(r: ConvertResult): string {
  const lines: string[] = [];
  lines.push(`${pc.bold(num(r.total))} posts${r.username ? ` by ${pc.cyan('@' + r.username)}` : ''}${r.range ? pc.dim(`  ${r.range[0]} → ${r.range[1]}`) : ''}`);
  lines.push(
    (Object.entries(r.kinds) as [string, number][])
      .filter(([, n]) => n > 0)
      .map(([k, n]) => `${KIND_COLOR[k]!('●')} ${k} ${pc.bold(num(n))}`).join('   '),
  );
  if (r.skipped) lines.push(pc.dim(`${num(r.skipped)} posts filtered out`));
  if (r.likes) lines.push(`♥ ${num(r.likes)} likes saved`);
  if (r.years.length) lines.push('', pc.bold('By year'), chart(r.years));
  if (r.months.length > 1) lines.push('', pc.bold('By month'), `  ${pc.cyan(sparkline(r.months.map(([, n]) => n)))}`);
  return lines.join('\n');
}

export function statsReport(s: Stats): string {
  const section = (t: string, rows: [string, number][]) => (rows.length ? ['', pc.bold(t), chart(rows, 20)] : []);
  const hours = s.byHour.map((v, h) => [String(h).padStart(2, '0'), v] as [string, number]);
  const peak = hours.reduce((a, b) => (b[1] > a[1] ? b : a), hours[0]!);
  return [
    `${pc.bold(num(s.total))} posts over ${pc.bold(num(s.activeDays))} active days${s.range ? pc.dim(`  ${s.range[0]} → ${s.range[1]}`) : ''}`,
    ...section('By kind', Object.entries(s.byKind)),
    ...section('By year', s.byYear),
    '', pc.bold('By hour of day'), `  ${pc.cyan(sparkline(s.byHour))}  ${pc.dim(`00 → 23, peak ${peak[0]}:00`)}`,
    ...section('Top hashtags', s.topHashtags),
    ...section('Top mentions', s.topMentions),
    ...section('Top link domains', s.topDomains),
    ...(s.topLiked.length ? ['', pc.bold('Most liked'), ...s.topLiked.map((p) => `  ♥ ${String(p.likes).padStart(5)}  ${oneLine(p.text, 70)}  ${pc.dim(p.url)}`)] : []),
  ].join('\n');
}

export function oneLine(text: string, max: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

export function highlight(text: string, query?: string, regex?: boolean): string {
  if (!query) return text;
  try {
    const re = new RegExp(regex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    return text.replace(re, (m) => pc.black(pc.bgYellow(m)));
  } catch { return text; }
}

export function hit(r: PostRow, o: { query?: string; regex?: boolean; full?: boolean; width: number }): string {
  const k = KIND_COLOR[r.kind]!;
  const head = `${pc.dim(r.localTime.slice(0, 16))} ${k(r.kind.padEnd(6))}`;
  const body = o.full ? r.text : oneLine(r.text, Math.max(40, o.width - 28));
  return `${head} ${highlight(body, o.query, o.regex)}\n${' '.repeat(24)}${pc.dim(r.url)}`;
}

const STAGE_LABEL = { read: 'Reading the archive', parse: 'Reading posts', write: 'Writing monthly files' } as const;

/** スピナーの文言に使う進捗表示。例: Reading posts ━━━━━──── 56%  1,340 / 2,400 */
export function progressText(e: { stage: keyof typeof STAGE_LABEL; done: number; total: number }, width = 20): string {
  const label = STAGE_LABEL[e.stage];
  if (e.total <= 0) return `${label}…`;
  const ratio = Math.min(1, e.done / e.total);
  const filled = Math.round(ratio * width);
  return `${label} ${pc.cyan('━'.repeat(filled))}${pc.dim('─'.repeat(width - filled))} ${String(Math.round(ratio * 100)).padStart(3)}%  ${pc.dim(`${num(e.done)} / ${num(e.total)}`)}`;
}

/** 段階ごとの所要時間を測る。onProgress に渡して使う */
export function stageTimer() {
  const start = Date.now();
  const at: Partial<Record<'read' | 'parse' | 'write', number>> = {};
  return {
    onProgress(e: { stage: 'read' | 'parse' | 'write' }) { at[e.stage] ??= Date.now(); },
    /** 完了後に各段階の件数と時間を行にして返す */
    lines(r: { total: number; skipped: number; months: unknown[] }): string[] {
      const end = Date.now();
      const t = [at.read ?? start, at.parse ?? start, at.write ?? start, end];
      const sec = (a: number, b: number) => pc.dim(`${((b - a) / 1000).toFixed(2)}s`);
      return [
        `${pc.green('✔')} Opened the archive  ${sec(t[0]!, t[1]!)}`,
        `${pc.green('✔')} Read ${pc.bold(num(r.total + r.skipped))} posts${r.skipped ? pc.dim(` (${num(r.skipped)} skipped)`) : ''}  ${sec(t[1]!, t[2]!)}`,
        `${pc.green('✔')} Wrote ${pc.bold(num(r.months.length))} monthly files  ${sec(t[2]!, t[3]!)}`,
      ];
    },
  };
}
