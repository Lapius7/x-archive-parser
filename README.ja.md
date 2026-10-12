# x-archive-parser

[English](README.md) | 日本語

X（旧Twitter）のアーカイブを、月ごとの Markdown・JSONL・CSV に変換する CLI です。変換後のファイルは、コーディングエージェントが grep で調べやすい構成になっています。変換した投稿の検索と集計も、同じコマンドで行えます。

## インストール

```bash
pnpm add -g @lapius/x-archive-parser
```

Node 20 以上が必要です。

## 使い方

引数なしで起動すると、質問に答えるだけで変換できる対話モードが始まります。

```bash
x-archive-parser                              # 対話モード
x-archive-parser twitter-archive.zip          # zip または展開済みフォルダを変換
x-archive-parser search "ラーメン" ./x-posts   # 変換した投稿を検索
x-archive-parser stats ./x-posts              # 投稿の傾向を集計
```

### 対話モード

アーカイブは次の場所から自動で探します。

- カレントディレクトリ
- `~/Downloads`
- WSL では、Windows 側の全ユーザーの `Downloads`（`/mnt/c/Users/*/Downloads`）

名前が `twitter-…` や `x-archive…` で始まる zip と、展開済みフォルダが候補に出ます。見つからなければパスを入力できます。変換中は、読み込んだ投稿数に応じた進捗バーが表示されます。

質問の内容は次のとおりです。

| 質問 | 内容 |
|---|---|
| 変換するアーカイブ | 候補から選ぶか、パスを入力します |
| 親フォルダ | 既定は `./x-posts` です。実行のたびに、この中へ新しいサブフォルダを作ります |
| タイムゾーン | 日付と月ごとの分類に使います。既定はシステムの設定です |
| ファイル形式 | Markdown、JSONL、CSV から選びます（複数可） |
| 除外する投稿 | リポスト、リプライ、引用ポストから選びます。何も選ばなければすべて含めます |
| いいねの保存 | いいねした投稿を `likes.jsonl` に保存します |

### convert

| オプション | 説明 |
|---|---|
| `-o, --out <dir>` | 親フォルダ（既定 `./x-posts`）。実行のたびに、この中へ新しいサブフォルダを作ります |
| `--here` | サブフォルダを作らず、`--out` へ直接書き出す。そのフォルダにある前回の出力は置き換えます |
| `--tz <zone>` | IANA タイムゾーン名（既定はシステムの設定） |
| `-f, --format <list>` | `md`、`jsonl`、`csv` をカンマ区切りで指定（既定 `md,jsonl`） |
| `--since <date>` / `--until <date>` | 期間。`YYYY-MM-DD` 形式で、両端の日を含みます。日付は指定したタイムゾーンで判定します |
| `--exclude <kinds>` | 除外する種別。`reply`、`repost`、`quote` をカンマ区切りで指定 |
| `--likes` | `likes.jsonl` も書き出す |
| `--json` | 結果を JSON で標準出力に出す |
| `-q, --quiet` | エラー以外は何も出さない |

実行ごとに `ユーザー名_日付_時刻_ランダムID` という名前のフォルダを作るため、2回目の実行が1回目の結果を上書きすることはありません。

出力の構成は次のとおりです。

```
x-posts/
  lapius7_20261013-153012_a1b2c3d4/   実行ごとのフォルダ
    README.md           この実行の詳細。投稿数、種別、期間、作成日時、元データ、絞り込み条件
    meta.json           同じ内容を JSON にしたもの
    index.md              入口。合計、期間、月ごとの件数、検索のしかた
    likes.jsonl         --likes を付けたときだけ作成
    2024/2024-01.md     読みやすい形式の投稿（リンクとメディア付き）
    2024/2024-01.jsonl  1投稿1行の JSON
    2024/2024-01.csv    -f csv を付けたときだけ作成
```

JSONL の各行には、次の項目があります。

`id`、`localTime`、`createdAt`、`kind`、`text`、`url`、`replyToUser`、`quotedUrl`、`urls`、`hashtags`、`mentions`、`media`、`likes`、`reposts`

各実行フォルダの `README.md` には、いつ・何から・どんな条件で作ったかを記録します。元データのパスとサイズ、アカウント、タイムゾーン、絞り込み条件、種別ごとの投稿数、期間、月ごとの件数です。実行結果が増えても、あとから見分けられます。

`search` と `stats` には、実行フォルダ本体と、その親フォルダのどちらも指定できます。親フォルダを指定すると最新の実行結果を使い、使ったフォルダを `Using …` と表示します。

### search

```bash
x-archive-parser search "ラーメン" --since 2023-01-01 -k post,reply
x-archive-parser search -E "^(おはよう|おやすみ)" --hashtag daily --media -n 0
```

| オプション | 説明 |
|---|---|
| `-E, --regex` | 検索語を正規表現として扱う |
| `-k, --kind <list>` | 種別で絞り込む（`post`、`reply`、`repost`、`quote`） |
| `--since` / `--until` | 期間で絞り込む |
| `--hashtag <tag>` / `--mention <user>` | ハッシュタグ、メンションで絞り込む |
| `--media` | 画像や動画のある投稿だけにする |
| `--min-likes <n>` | いいね数の下限 |
| `-n, --limit <n>` | 表示件数（既定 20、新しい順。`0` で全件） |
| `--full` | 本文を省略せずに表示する |
| `-f, --format <fmt>` | `text`（既定）、`json`、`jsonl`、`csv` |
| `-o, --output <file>` | 画面に出さずファイルに保存する（形式の既定は `jsonl`） |
| `--json` | `-f json` と同じ |

該当する投稿がないときは、終了コード 1 で終わります。フォルダを省略すると `./x-posts`（最新の実行結果）を使います。

## 表示言語

表示は英語と日本語に対応しています。`-l, --lang <en|ja>`（サブコマンドの前後どちらでも可）か環境変数 `XAP_LANG` で選びます。どちらも指定しない場合は `LC_ALL`、`LC_MESSAGES`、`LANG` の順に見て決まります。生成される `README.md` と `index.md` も同じ言語になります。月別の Markdown、JSONL、CSV は grep しやすいよう英語のままです。

変換が終わると、最後の行に作成したフォルダの絶対パスを `保存先: ...` として表示します。`-q` を付けた場合は、そのパスだけを出力します。

### stats

次の内容を集計して表示します。`--json` を付けると数値をそのまま取得できます。

- 種別、年、時間帯ごとの投稿数
- よく使うハッシュタグ、メンション、リンク先ドメイン
- いいね数の多い投稿

## 仕組み

- zip または展開済みフォルダの `data/tweets*.js` と `data/account.js` を読みます。zip の読み込みに外部ライブラリは使いません。
- t.co の短縮 URL を元の URL に戻し、HTML エンティティを復号します。重複する ID は取り除き、投稿を `post`、`reply`、`repost`、`quote` に分類します。
- すべてローカルで動作し、ネットワーク通信はしません。

## ライブラリとして使う

```ts
import { convert, search, computeStats } from '@lapius/x-archive-parser';

const result = convert({ input: 'archive.zip', out: './x-posts', tz: 'Asia/Tokyo' });
```

## 制限事項

- 読み込むのは `tweets*.js`、`account.js`、`like.js` だけです。
- 画像や動画のファイルはコピーせず、URL を記録します。
- DM と、`note-tweet.js` にある長文ポストの本文は含まれません。

## ライセンス

MIT
