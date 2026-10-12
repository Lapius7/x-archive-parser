export type Lang = 'en' | 'ja';

/** XAP_LANG → LC_ALL → LC_MESSAGES → LANG の順に見て、ja で始まれば日本語、それ以外は英語 */
export function detectLang(env: NodeJS.ProcessEnv = process.env): Lang {
  const v = env.XAP_LANG || env.LC_ALL || env.LC_MESSAGES || env.LANG || '';
  return /^ja/i.test(v) ? 'ja' : 'en';
}

export function parseLang(v: string): Lang | undefined {
  const s = v.toLowerCase();
  return s === 'ja' || s === 'jp' || s.startsWith('ja-') ? 'ja' : s === 'en' || s.startsWith('en-') ? 'en' : undefined;
}

let current: Lang = detectLang();
export const setLang = (l: Lang) => { current = l; };
export const getLang = (): Lang => current;

const en = {
  // errors
  badTz: (tz: string) => `Unknown timezone: ${tz}`,
  badDate: (d: string) => `Use YYYY-MM-DD for dates: ${d}`,
  notEmpty: (p: string) => `The folder is not empty and has no index.md: ${p}`,
  noTweets: () => 'data/tweets*.js not found. Is this an X archive?',
  noResults: (p: string) => `No converted results found in ${p}. Convert an archive first.`,
  zipEnd: () => 'The zip end record was not found',
  zipDir: () => 'The zip central directory is broken',
  zipMethod: (m: number) => `Unsupported zip compression method: ${m}`,
  oneArchive: () => 'Specify one archive (zip or extracted folder). Run with --help for usage.',
  unknownKind: (k: string, allowed: string) => `Unknown kind "${k}" (allowed: ${allowed})`,
  unknownFormat: (f: string) => `Unknown format "${f}" (allowed: md, jsonl, csv)`,
  unknownSearchFormat: (f: string) => `Unknown format "${f}" (allowed: text, json, jsonl, csv)`,
  unknownLang: (l: string) => `Unknown language "${l}" (allowed: en, ja)`,
  errorLabel: () => 'error:',
  // progress
  stageRead: () => 'Reading the archive',
  stageParse: () => 'Reading posts',
  stageWrite: () => 'Writing monthly files',
  stepOpened: () => 'Opened the archive',
  stepRead: (n: string) => `Read ${n} posts`,
  stepSkipped: (n: string) => ` (${n} skipped)`,
  stepWrote: (n: string) => `Wrote ${n} monthly files`,
  // result
  wrote: (p: string) => `Wrote ${p}`,
  savedTo: () => 'Saved to:',
  next: () => 'Next:',
  postsBy: (n: string) => `${n} posts`,
  byUser: (u: string) => ` by ${u}`,
  filteredOut: (n: string) => `${n} posts filtered out`,
  likesSaved: (n: string) => `♥ ${n} likes saved`,
  byYear: () => 'By year',
  byMonth: () => 'By month',
  byKind: () => 'By kind',
  byHour: () => 'By hour of day',
  kind: (k: string) => k,
  // stats
  statsHead: (n: string, d: string) => `${n} posts over ${d} active days`,
  peak: (h: string) => `00 → 23, peak ${h}:00`,
  topHashtags: () => 'Top hashtags',
  topMentions: () => 'Top mentions',
  topDomains: () => 'Top link domains',
  mostLiked: () => 'Most liked',
  // search
  using: (p: string) => `Using ${p}`,
  savedHits: (n: string, total: string, p: string) => `${n} of ${total} hits saved to ${p}`,
  hits: (n: string, shown: number, total: number) => `${n} hit${total === 1 ? '' : 's'}${shown < total ? ` (showing latest ${shown}, use -n 0 for all)` : ''}`,
  // interactive
  qArchive: () => 'Which X archive do you want to convert?',
  qOtherPath: () => 'Choose another path…',
  qPath: () => 'Path to the archive (.zip or extracted folder)',
  notFound: () => 'Not found. Check the path.',
  qOut: () => 'Parent folder for the results (a new subfolder is created on every run)',
  qTz: () => 'Timezone for dates and monthly grouping',
  badTzHint: () => 'Unknown timezone. Example: Asia/Tokyo',
  qFormats: () => 'Which file formats do you need? (space to toggle)',
  fmtMd: () => 'easy to read',
  fmtJsonl: () => 'for grep and jq, used by search and stats',
  fmtCsv: () => 'for spreadsheets',
  qSkip: () => 'Skip any post types? (space to toggle, enter with none selected keeps everything)',
  skipRepost: () => 'Reposts',
  skipRepostHint: () => 'posts that start with "RT @"',
  skipReply: () => 'Replies',
  skipReplyHint: () => 'replies to other posts',
  skipQuote: () => 'Quote posts',
  skipQuoteHint: () => 'posts that quote another post',
  qLikes: () => 'Also save the posts you liked? (likes.jsonl)',
  cancelled: () => 'Cancelled.',
  failed: () => 'Failed',
  done: () => 'Done.',
  resultTitle: () => 'Result',
  nextTry: (c: string) => `Next, try: ${c}`,
} as const;

type Dict = { [K in keyof typeof en]: (typeof en)[K] };

const ja: Dict = {
  badTz: (tz) => `不正なタイムゾーンです: ${tz}`,
  badDate: (d) => `日付は YYYY-MM-DD で指定してください: ${d}`,
  notEmpty: (p) => `出力先が空ではなく index.md もありません: ${p}`,
  noTweets: () => 'data/tweets*.js が見つかりません。X のアーカイブですか？',
  noResults: (p) => `変換結果が見つかりません: ${p}（先にアーカイブを変換してください）`,
  zipEnd: () => 'zip の終端レコードが見つかりません',
  zipDir: () => 'zip の中央ディレクトリが壊れています',
  zipMethod: (m) => `未対応の zip 圧縮方式です: ${m}`,
  oneArchive: () => 'アーカイブ（zip または展開済みフォルダ）を1つ指定してください。使い方は --help で確認できます。',
  unknownKind: (k, allowed) => `不明な種別「${k}」です（指定できる値: ${allowed}）`,
  unknownFormat: (f) => `不明な形式「${f}」です（指定できる値: md, jsonl, csv）`,
  unknownSearchFormat: (f) => `不明な形式「${f}」です（指定できる値: text, json, jsonl, csv）`,
  unknownLang: (l) => `不明な言語「${l}」です（指定できる値: en, ja）`,
  errorLabel: () => 'エラー:',
  stageRead: () => 'アーカイブを読み込み中',
  stageParse: () => '投稿を読み込み中',
  stageWrite: () => '月別ファイルを書き出し中',
  stepOpened: () => 'アーカイブを開きました',
  stepRead: (n) => `${n} 件の投稿を読み込みました`,
  stepSkipped: (n) => `（${n} 件を除外）`,
  stepWrote: (n) => `月別ファイルを ${n} 個書き出しました`,
  wrote: (p) => `書き出しました: ${p}`,
  savedTo: () => '保存先:',
  next: () => '次は:',
  postsBy: (n) => `${n} 件の投稿`,
  byUser: (u) => `（${u}）`,
  filteredOut: (n) => `${n} 件を除外しました`,
  likesSaved: (n) => `♥ いいね ${n} 件を保存しました`,
  byYear: () => '年別',
  byMonth: () => '月別',
  byKind: () => '種別',
  byHour: () => '時間帯別',
  kind: (k) => ({ post: '投稿', reply: 'リプライ', repost: 'リポスト', quote: '引用' })[k] ?? k,
  statsHead: (n, d) => `${n} 件の投稿（投稿のあった日: ${d} 日）`,
  peak: (h) => `00 → 23 時、ピークは ${h} 時台`,
  topHashtags: () => 'よく使うハッシュタグ',
  topMentions: () => 'よくメンションした相手',
  topDomains: () => 'よく貼ったリンク先',
  mostLiked: () => 'いいねの多い投稿',
  using: (p) => `使用するフォルダ: ${p}`,
  savedHits: (n, total, p) => `${total} 件中 ${n} 件を保存しました: ${p}`,
  hits: (n, shown, total) => `${n} 件ヒット${shown < total ? `（新しい順に ${shown} 件を表示。全件は -n 0）` : ''}`,
  qArchive: () => '変換する X のアーカイブを選んでください',
  qOtherPath: () => '別のパスを入力…',
  qPath: () => 'アーカイブのパス（zip または展開済みフォルダ）',
  notFound: () => '見つかりません。パスを確認してください。',
  qOut: () => '結果を置く親フォルダ（実行のたびに新しいサブフォルダを作ります）',
  qTz: () => '日付と月ごとの分類に使うタイムゾーン',
  badTzHint: () => '不明なタイムゾーンです。例: Asia/Tokyo',
  qFormats: () => '必要なファイル形式を選んでください（スペースで切り替え）',
  fmtMd: () => '読みやすい形式',
  fmtJsonl: () => 'grep や jq 用。search と stats でも使います',
  fmtCsv: () => '表計算ソフト用',
  qSkip: () => '除外する投稿の種類はありますか？（スペースで切り替え。何も選ばず Enter ですべて含めます）',
  skipRepost: () => 'リポスト',
  skipRepostHint: () => '「RT @」で始まる投稿',
  skipReply: () => 'リプライ',
  skipReplyHint: () => '他の投稿への返信',
  skipQuote: () => '引用ポスト',
  skipQuoteHint: () => '他の投稿を引用した投稿',
  qLikes: () => 'いいねした投稿も保存しますか？（likes.jsonl）',
  cancelled: () => '中止しました。',
  failed: () => '失敗しました',
  done: () => '完了しました。',
  resultTitle: () => '結果',
  nextTry: (c) => `次はこれを試してください: ${c}`,
};

const dicts: Record<Lang, Dict> = { en, ja };

export function t<K extends keyof Dict>(key: K, ...args: Parameters<Dict[K]>): string {
  return (dicts[current][key] as (...a: unknown[]) => string)(...args);
}
