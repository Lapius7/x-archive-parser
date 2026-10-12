# x-archive-parser

[English](README.md) | 日本語

X（旧Twitter）のアーカイブを、月ごとの Markdown・JSONL・CSV に変換する CLI です。変換後のファイルは、コーディングエージェントや `grep` で調べやすい構成になっています。変換した投稿の検索と集計も、同じコマンドで行えます。完全にオフラインで動作し、実行時の依存パッケージは `@clack/prompts` と `picocolors` の2つだけです。

## 目次

- [クイックスタート](#クイックスタート)
- [インストール](#インストール)
  - [lapacks で入れる](#lapacks-で入れる)
- [アーカイブの入手](#アーカイブの入手)
- [対話モード](#対話モード)
- [convert](#convert)
- [出力の構成](#出力の構成)
- [ファイル形式](#ファイル形式)
- [search](#search)
- [stats](#stats)
- [表示言語](#表示言語)
- [grep・jq・コーディングエージェントでの使い方](#grepjqコーディングエージェントでの使い方)
- [ライブラリとして使う](#ライブラリとして使う)
- [仕組み](#仕組み)
- [環境変数と終了コード](#環境変数と終了コード)
- [トラブルシューティング](#トラブルシューティング)
- [制限事項](#制限事項)
- [開発](#開発)
- [ライセンス](#ライセンス)

## クイックスタート

```bash
pnpm add -g @lapius/x-archive-parser     # または: lapacks install x-archive-parser

x-archive-parser                                   # 対話モード
x-archive-parser twitter-2026-10-05-xxxx.zip       # 直接変換
x-archive-parser search "ラーメン" ./x-posts       # 最新の実行結果から検索
x-archive-parser stats ./x-posts                   # 投稿の集計
```

変換が終わると、最後の行に作成したフォルダの絶対パスを表示します。

```
保存先: /home/me/x-posts/lapius7_20261013-153012_a1b2c3d4
```

## インストール

次のいずれかで入れられます。

```bash
# pnpm（推奨）
pnpm add -g @lapius/x-archive-parser

# npm
npm i -g @lapius/x-archive-parser

# インストールせずに1回だけ実行する場合
pnpm dlx @lapius/x-archive-parser --help
```

### lapacks で入れる

このパッケージは、`@lapius` のパッケージ管理 CLI である [lapacks](https://github.com/Lapius7/lapacks) に登録されています。lapacks を使っている場合は、次のコマンドで管理できます。

```bash
lapacks install x-archive-parser     # インストール
lapacks update x-archive-parser      # 更新
lapacks remove x-archive-parser      # 削除
lapacks info x-archive-parser        # 詳細の表示
```

引数なしで `lapacks` を起動すると、TUI から同じ操作ができます。lapacks 自体は `pnpm add -g @lapius/lapacks` で入れます。

Node.js 20 以上が必要です。グローバルへのインストールは pnpm と npm のどちらか一方だけにしてください。両方で入れると、コマンドが二重に表示されます。

## アーカイブの入手

1. X の設定から「アカウント」、「データのアーカイブをダウンロード」の順に開きます。
2. アーカイブをリクエストし、準備ができた通知を待ちます。1日以上かかることもあります。
3. zip をダウンロードします。zip のまま渡すことも、展開してフォルダを渡すこともできます。

読み込むのは `data/tweets*.js`（必須）、`data/account.js`（ユーザー名）、`data/like.js`（`--likes` を付けたときのみ）です。アーカイブ内のそれ以外のファイルは使いません。X のメニューの表記は変わることがあります。

## 対話モード

ターミナルで引数なしに実行します。

```bash
x-archive-parser
```

アーカイブは次の場所から探します。

- カレントディレクトリ
- `~/Downloads`
- WSL では、Windows 側の全ユーザーの `Downloads`（`/mnt/c/Users/*/Downloads`）

名前が `twitter-…` や `x-archive…` で始まる zip と展開済みフォルダを候補として表示します。表示は `twitter-2026-10-05 (zip)` のような短い形で、フルパスはヒントに出ます。見つからない場合は、パスを入力できます。

| 質問 | 内容 |
|---|---|
| どのアーカイブか | 候補から選ぶか、パスを入力します |
| 親フォルダ | 既定は `./x-posts` です。実行のたびに新しいサブフォルダを作ります |
| タイムゾーン | 日付と月ごとの分類に使います。既定はシステムの設定です |
| ファイル形式 | Markdown、JSONL、CSV（複数選択可）。`search` と `stats` には JSONL が必要です |
| 除外する投稿の種類 | リポスト、リプライ、引用ポスト。何も選ばなければすべて含めます |
| いいねした投稿 | `likes.jsonl` に保存します |

変換中は、スピナーに現在の段階と進捗バー、件数を表示します。終わると、各段階にかかった時間、概要（合計、種別、年別・月別の件数）、次に試すコマンドの例を表示し、最後に新しいフォルダのフルパスを出します。

端末が対話式でない場合（パイプや CI など）は、引数なしで実行してもヘルプを表示するだけです。

## convert

```bash
x-archive-parser [convert] <archive> [options]
```

`<archive>` は zip ファイルか、展開済みのフォルダです。`convert` は省略できます。

| オプション | 説明 |
|---|---|
| `-o, --out <dir>` | 親フォルダ（既定 `./x-posts`）。実行のたびに、この中へ新しいサブフォルダを作ります |
| `--here` | サブフォルダを作らず、`--out` に直接書き出します。そのフォルダの以前の出力は置き換えます |
| `--tz <zone>` | `Asia/Tokyo` などの IANA タイムゾーン（既定: システムの設定） |
| `-f, --format <list>` | `md`、`jsonl`、`csv` をカンマ区切りで指定（既定 `md,jsonl`） |
| `--since <date>` / `--until <date>` | `YYYY-MM-DD`。両端を含み、選んだタイムゾーンで判定します |
| `--exclude <kinds>` | `reply`、`repost`、`quote` をカンマ区切りで指定 |
| `--likes` | `likes.jsonl` も書き出す |
| `--json` | 人が読む概要の代わりに、結果を JSON で出力する |
| `-q, --quiet` | 保存先のパスだけを出力する（エラーは標準エラーに出ます） |
| `-l, --lang <en\|ja>` | 表示言語。[表示言語](#表示言語)を参照 |

例:

```bash
# 日本時間で、すべての投稿といいねを保存
x-archive-parser archive.zip --tz Asia/Tokyo --likes

# 2023年の投稿とリプライだけを、3形式で保存
x-archive-parser archive.zip --since 2023-01-01 --until 2023-12-31 --exclude repost,quote -f md,jsonl,csv

# 毎回上書きする固定フォルダ（サブフォルダなし）
x-archive-parser archive.zip -o ./site-data --here

# スクリプトで、作成したフォルダのパスを受け取る
OUT=$(x-archive-parser archive.zip -q)
x-archive-parser search "ラーメン" "$OUT"
```

### 再実行したとき

`--here` を付けない場合、実行のたびに `<ユーザー>_<日付>_<時刻>_<ランダムID>` という名前のフォルダを作ります。2回目の実行が1回目の結果を上書きすることはありません。`--here` を付けた場合、フォルダは空であるか、以前の `index.md` を含んでいる必要があります。そうでなければ、関係のないファイルを消さないよう、処理を止めます。

### `--json` の出力

結果のオブジェクトには、`username`、`tz`、`total`、`skipped`、`months`、`years`、`kinds`、`range`、`likes`、`out`（絶対パス）、`runId`、`createdAt` が入ります。

## 出力の構成

```
x-posts/
  lapius7_20261013-153012_a1b2c3d4/   1回の実行につき1フォルダ
    README.md           この実行の説明（投稿数、種別、期間、作成日時、元データ、絞り込み）
    meta.json           同じ内容を JSON にしたもの
    index.md            入口（合計、期間、月別の件数、検索のしかた）
    likes.jsonl         --likes を付けたときだけ作成
    2024/2024-01.md     リンクとメディア付きの読みやすい投稿
    2024/2024-01.jsonl  1投稿1行の JSON
    2024/2024-01.csv    -f csv のときだけ作成
```

`account.js` がない場合、フォルダ名のユーザー部分は `x` になります。

### 各実行の README.md と meta.json

あとから「いつ、何から、どんな条件で作ったか」を区別できるよう、次の内容を記録します。

- 実行 ID、作成日時（ローカルと UTC）、ツールのバージョン
- 元データのパスと、zip かフォルダかの別、サイズ
- アカウント名、タイムゾーン、形式、絞り込み（期間、除外した種別）、除外した投稿の件数
- 種別ごとの投稿数、対象の期間、月ごとの投稿数

`README.md` は表示言語に従います。`meta.json` は常に同じ機械可読のデータです。

## ファイル形式

### 月別 Markdown

```markdown
# 2024-01 (1 posts, Asia/Tokyo)

### 2024-01-10 21:00:00 · [link](https://x.com/i/status/1)

> hello

♥ 1 · ↻ 0
```

投稿ごとに、ローカル時刻、パーマリンク、種別（`reply`、`repost`、`quote`。通常の投稿にはタグなし）を見出しに入れ、リプライでは `to @user` も付けます。その下に、引用ブロックの本文、画像（写真は画像、そのほかのメディアはリンク）、引用ポストの URL、いいね数とリポスト数が続きます。

### JSONL

1行に1つの JSON オブジェクトです。項目は次のとおりです。

| 項目 | 内容 |
|---|---|
| `id` | 投稿 ID（文字列） |
| `localTime` | 選んだタイムゾーンでの時刻（`YYYY-MM-DD HH:mm:ss`） |
| `createdAt` | UTC の時刻（ISO 8601） |
| `kind` | `post`、`reply`、`repost`、`quote`。複数に当てはまる場合の優先順は repost、reply、quote、post |
| `text` | t.co リンクを展開し、HTML エンティティを戻した本文 |
| `url` | パーマリンク `https://x.com/<user>/status/<id>`（ユーザー不明のときは `i`） |
| `replyToUser` | リプライの相手 |
| `quotedUrl` | 引用した投稿の URL |
| `urls` | 本文中の展開済みリンク |
| `hashtags`、`mentions` | `#` と `@` を除いた一覧 |
| `media` | 画像と動画の `{ type, url }` の一覧 |
| `likes`、`reposts` | エクスポート時点の件数 |

### CSV

表計算ソフト向けです。列は `id,local_time,created_at,kind,text,url,likes,reposts,hashtags,mentions` です。ハッシュタグとメンションは、スペース区切りで1つのセルに入れます。本文にカンマ、引用符、改行が含まれる場合は、引用符で囲みます。

### likes.jsonl

`like.js` から読み取ったいいね済みの投稿です。`--likes` を付けたときのみ作成します。

## search

```bash
x-archive-parser search [query] [dir] [options]
```

`query` は、`-E` を付けない限り大文字小文字を区別しない部分一致です。`dir` は実行フォルダか、その親フォルダです（既定 `./x-posts`）。親フォルダを渡すと、最新の実行結果を使い、`使用するフォルダ: …` と表示します。引数が1つだけで、それが変換済みのフォルダである場合は、フォルダとみなして全件を対象にします。

| オプション | 説明 |
|---|---|
| `-E, --regex` | クエリを正規表現として扱う |
| `-k, --kind <list>` | `post`、`reply`、`repost`、`quote` で絞り込む |
| `--since <date>` / `--until <date>` | 日付（`YYYY-MM-DD`）で絞り込む |
| `--hashtag <tag>` / `--mention <user>` | ハッシュタグかメンションで絞り込む |
| `--media` | 画像か動画のある投稿だけ |
| `--min-likes <n>` | いいね数の下限 |
| `-n, --limit <n>` | 表示件数（既定 20、新しい順。`0` で全件） |
| `--full` | 1行に省略せず本文を全部表示する |
| `-f, --format <fmt>` | `text`（既定）、`json`、`jsonl`、`csv` |
| `-o, --output <file>` | 画面に出さずファイルに保存する（形式の既定は `jsonl`） |
| `--json` | `-f json` と同じ |
| `-l, --lang <en\|ja>` | 表示言語 |

```bash
x-archive-parser search "ラーメン" --since 2023-01-01 -k post,reply
x-archive-parser search -E "^(おはよう|こんにちは)" --hashtag daily --media -n 0
x-archive-parser search "ラーメン" -f json                    # JSON 配列を標準出力へ
x-archive-parser search "ラーメン" -n 0 -f csv -o ramen.csv   # 全件をファイルへ
x-archive-parser search --min-likes 100 -n 0                  # いいね100以上の全投稿（クエリなし）
```

`text` 形式では、一致した部分を強調し、各件に時刻、種別、本文、パーマリンクを表示します。機械可読の形式では標準出力にデータだけを出し、ヒット件数などのメッセージは標準エラーに出すため、パイプに混ざりません。`-o` で保存したときは、保存先の絶対パスを標準エラーに表示します。

## stats

```bash
x-archive-parser stats [dir] [--json]
```

次の内容を表示します。

- 投稿の合計と、投稿のあった日数
- 種別、年、時間帯ごとの件数（スパークライン付き）
- よく使うハッシュタグ、メンション、リンク先ドメイン
- いいねの多い投稿

`--json` を付けると、数値をそのまま出力します。

## 表示言語

表示は英語と日本語に対応しています。

| 方法 | 例 |
|---|---|
| オプション（サブコマンドの前後どちらでも可） | `x-archive-parser -l ja archive.zip` / `x-archive-parser stats --lang en` |
| 環境変数 | `XAP_LANG=ja` |
| ロケール（どちらも未指定のとき） | `LC_ALL`、`LC_MESSAGES`、`LANG` の順に見て、`ja` で始まれば日本語 |

対話モード、進捗表示、概要、ヘルプ、エラーメッセージ、生成される `README.md` と `index.md` に適用されます。月別の Markdown、JSONL、CSV は grep しやすいよう英語のままです。未対応の値を指定すると、エラーで止まります。

## grep・jq・コーディングエージェントでの使い方

エージェントには実行フォルダを渡し、まず `index.md` を読むよう伝えます。合計、期間、検索のしかたが書いてあります。

```bash
# 該当しそうな月を探す
grep -ril "ラーメン" 2023/ --include=*.jsonl

# jq で条件を絞る
jq -r 'select(.kind=="post" and (.hashtags|index("daily"))) | .url' 2023/2023-*.jsonl

# ある月のいいね上位
jq -s 'sort_by(-.likes)[:5][] | {likes, text, url}' 2024/2024-01.jsonl
```

## ライブラリとして使う

```ts
import { convert, search, computeStats, resolveOutDir, setLang } from '@lapius/x-archive-parser';

setLang('ja');
const result = convert({
  input: 'archive.zip',
  out: './x-posts',
  tz: 'Asia/Tokyo',
  formats: ['md', 'jsonl'],
  onProgress: ({ stage, done, total }) => console.log(stage, done, total),
});
console.log(result.out); // 作成したフォルダの絶対パス

const dir = resolveOutDir('./x-posts');          // 最新の実行結果
const hits = search(dir, { query: 'ラーメン', since: '2023-01-01' });
const stats = computeStats(dir);
```

ほかに、`toPost`、`toLike`、`iterRows`、`systemTz`、`validateTz`、`parseLang`、`detectLang`、`getLang` と、型 `Post`、`PostRow`、`LikeRow`、`PostKind`、`Format`、`ConvertOptions`、`ConvertResult`、`ProgressEvent`、`SearchOptions`、`Stats`、`Lang` を公開しています。

`ConvertOptions` には `input`、`out`、`here`、`tz`、`formats`、`exclude`、`since`、`until`、`likes`、`lang`、`onProgress` を指定できます。エラーは、現在の言語のメッセージを持つ `Error` として投げます。

## 仕組み

1. **開く**: zip は、内蔵の小さなリーダー（`node:zlib` による stored と deflate の展開）で読みます。フォルダはそのまま読みます。zip ライブラリは使いません。
2. **読み取る**: `data/tweets*.js` は `window.YTD.tweets.part0 = [...]` で始まるため、この前置きを除いた残りを JSON として解析します。重複した ID は除きます。
3. **整える**: t.co リンクを展開し、メディアの t.co リンクを本文から除き、HTML エンティティを戻します。各投稿は `post`、`reply`、`repost`、`quote` のどれかに分類します。
4. **絞り込んで分ける**: `--since`、`--until`、`--exclude` を適用し、選んだタイムゾーンで月ごとに分けます。
5. **書き出す**: 月別ファイル、`index.md`、`README.md`、`meta.json` を書き出します。

## 環境変数と終了コード

| 名前 | 内容 |
|---|---|
| `XAP_LANG` | 表示言語（`en` か `ja`） |
| `LC_ALL`、`LC_MESSAGES`、`LANG` | 表示言語を決める予備の設定 |
| `NO_COLOR` | 色を無効にする（picocolors が処理します） |

| 終了コード | 意味 |
|---|---|
| `0` | 成功 |
| `1` | エラー、または `search` で該当なし |
| `130` | 対話モードで中止 |

## トラブルシューティング

| メッセージや症状 | 原因と対処 |
|---|---|
| `data/tweets*.js が見つかりません` | X のアーカイブではないか、展開したフォルダの親を指しています。`data/` を含むフォルダを渡してください |
| `出力先が空ではなく index.md もありません` | 他のファイルがあるフォルダに `--here` を使っています。空のフォルダを使うか、`--here` を外してください |
| `変換結果が見つかりません` | `search` か `stats` に、変換結果のないフォルダを渡しています。先に変換するか、正しい実行フォルダかその親を指定してください |
| `不正なタイムゾーンです` | `Asia/Tokyo` や `UTC` のような IANA 名で指定してください |
| `日付は YYYY-MM-DD で指定してください` | `--since` と `--until` はこの形式のみ受け付けます |
| 期待した月が `search` に出てこない | `-f md` だけで変換した可能性があります。`search` と `stats` は JSONL を読むため、`jsonl` を含めてください |
| 対話モードがアーカイブを候補に出さない | 候補にするのは `twitter…` や `x-archive…` で始まる名前だけです。「別のパス」を選んで入力してください |
| 進捗バーが一瞬で消える | 小さなアーカイブは1秒未満で終わります。終了後に出る段階ごとの行で、件数と時間を確認できます |
| `pnpm add -g` したのにコマンドが見つからない | `pnpm setup` を実行してシェルを再起動し、グローバルの bin ディレクトリを `PATH` に入れてください |

## 制限事項

- 読み込むのは `tweets*.js`、`account.js`、`like.js` のみです。
- 画像と動画のファイルはコピーしません。URL を記録します。
- DM と、`note-tweet.js` にある長文の本文は含みません。
- アーカイブの形式は公式に文書化された仕様ではなく、変わる可能性があります。`like.js` と `account.js` は、想定外の形でも落ちにくいように読んでいます。

## 開発

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build      # tsup: dist/index.js、dist/cli.js、型定義
```

コードは TypeScript（ESM）で、テストには vitest を使っています。

## ライセンス

MIT
