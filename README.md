# x-archive-parser

Converts an X (Twitter) archive into per-month Markdown, JSONL and CSV that coding agents can grep, then lets you search and summarise the result from the terminal.

## Install

```bash
pnpm add -g @lapius/x-archive-parser
```

Requires Node 20 or later.

## Usage

Run it with no arguments for an interactive wizard (it looks for archives in the current folder and Downloads).

```bash
x-archive-parser                                  # interactive
x-archive-parser twitter-archive.zip              # convert a zip or an extracted folder
x-archive-parser search "keyword" ./x-posts       # search converted posts
x-archive-parser stats ./x-posts                  # activity summary
```

### convert

| Option | Description |
|---|---|
| `-o, --out <dir>` | Output folder (default `./x-posts`) |
| `--tz <zone>` | IANA timezone (default: system) |
| `-f, --format <list>` | `md`, `jsonl`, `csv` (default `md,jsonl`) |
| `--since / --until <date>` | `YYYY-MM-DD`, inclusive, in the chosen timezone |
| `--exclude <kinds>` | `reply`, `repost`, `quote` |
| `--likes` | Also write `likes.jsonl` |
| `--json` / `-q` | Machine-readable result / no output |

Output:

```
x-posts/
  index.md              entry point for agents: totals, range, per-month counts
  likes.jsonl           with --likes
  2024/2024-01.md       readable posts with permalinks and media
  2024/2024-01.jsonl    one JSON object per post
  2024/2024-01.csv      with -f csv
```

Each JSONL row has `id, localTime, createdAt, kind, text, url, replyToUser, quotedUrl, urls, hashtags, mentions, media, likes, reposts`.

### search

```bash
x-archive-parser search "ramen" --since 2023-01-01 -k post,reply
x-archive-parser search -E "^(good|bad) morning" --hashtag daily --media -n 0
```

Options: `-E` regex, `-k` kinds, `--since/--until`, `--hashtag`, `--mention`, `--media`, `--min-likes`, `-n` limit (default 20, `0` = all), `--full`, `--json`. Exits with 1 when nothing matches.

### stats

Posts by kind, year and hour of day, top hashtags, mentions and link domains, and the most liked posts. `--json` for raw numbers.

## What it does

- Reads `data/tweets*.js` and `data/account.js` from a zip or folder. No runtime dependency on a zip library.
- Expands t.co links, decodes HTML entities, drops duplicate ids, classifies posts as `post`, `reply`, `repost` or `quote`.
- Re-running into the same folder replaces the previous output. A non-empty folder without `index.md` is refused.
- Works offline.

## Library

```ts
import { convert, search, computeStats } from '@lapius/x-archive-parser';
const result = convert({ input: 'archive.zip', out: './x-posts', tz: 'Asia/Tokyo' });
```

## Limitations

Only `tweets*.js`, `account.js` and `like.js` are read. Media files are linked, not copied. DMs and long-post bodies from `note-tweet.js` are not included.

## License

MIT
