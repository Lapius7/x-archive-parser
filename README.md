# x-archive-parser

English | [日本語](README.ja.md)

A CLI that converts an X (Twitter) archive into per-month Markdown, JSONL and CSV. The output is laid out so coding agents can grep it. The same command also searches and summarises the converted posts.

## Install

```bash
pnpm add -g @lapius/x-archive-parser
```

Requires Node 20 or later.

## Usage

Run it with no arguments to start an interactive wizard.

```bash
x-archive-parser                               # interactive
x-archive-parser twitter-archive.zip           # convert a zip or an extracted folder
x-archive-parser search "ramen" ./x-posts      # search converted posts
x-archive-parser stats ./x-posts               # activity summary
```

### Interactive mode

The wizard looks for your archive in these places:

- the current directory
- `~/Downloads`
- on WSL, the `Downloads` folder of every Windows user (`/mnt/c/Users/*/Downloads`)

Zip files and extracted folders whose names start with `twitter-…` or `x-archive…` are offered as choices. If none is found, you can type a path. While converting, a progress bar follows the number of posts read.

| Question | Meaning |
|---|---|
| Which archive | Pick a candidate or enter a path |
| Output folder | Default `./x-posts` |
| Timezone | Used for dates and monthly grouping. Defaults to the system timezone |
| File formats | Markdown, JSONL, CSV (multiple allowed) |
| Post types to skip | Reposts, replies, quote posts. Select none to keep everything |
| Liked posts | Save the posts you liked to `likes.jsonl` |

### convert

| Option | Description |
|---|---|
| `-o, --out <dir>` | Output folder (default `./x-posts`) |
| `--tz <zone>` | IANA timezone (default: system) |
| `-f, --format <list>` | Comma-separated `md`, `jsonl`, `csv` (default `md,jsonl`) |
| `--since <date>` / `--until <date>` | `YYYY-MM-DD`, both ends inclusive, judged in the chosen timezone |
| `--exclude <kinds>` | Comma-separated `reply`, `repost`, `quote` |
| `--likes` | Also write `likes.jsonl` |
| `--json` | Print the result as JSON |
| `-q, --quiet` | Print nothing except errors |

Output layout:

```
x-posts/
  index.md              entry point: totals, date range, per-month counts, how to search
  likes.jsonl           only with --likes
  2024/2024-01.md       readable posts with links and media
  2024/2024-01.jsonl    one JSON object per post
  2024/2024-01.csv      only with -f csv
```

Each JSONL row has these fields:

`id`, `localTime`, `createdAt`, `kind`, `text`, `url`, `replyToUser`, `quotedUrl`, `urls`, `hashtags`, `mentions`, `media`, `likes`, `reposts`

Running again into the same folder replaces the previous output. A non-empty folder without `index.md` is refused so nothing is overwritten by mistake.

### search

```bash
x-archive-parser search "ramen" --since 2023-01-01 -k post,reply
x-archive-parser search -E "^(good|bad) morning" --hashtag daily --media -n 0
```

| Option | Description |
|---|---|
| `-E, --regex` | Treat the query as a regular expression |
| `-k, --kind <list>` | Filter by `post`, `reply`, `repost`, `quote` |
| `--since` / `--until` | Filter by date |
| `--hashtag <tag>` / `--mention <user>` | Filter by hashtag or mention |
| `--media` | Only posts with images or video |
| `--min-likes <n>` | Minimum like count |
| `-n, --limit <n>` | Number of hits to show (default 20, newest first; `0` for all) |
| `--full` | Show the whole text instead of one line |
| `--json` | Output JSON |

Exits with code 1 when nothing matches. The directory defaults to `./x-posts`.

### stats

Prints the following. Add `--json` for the raw numbers.

- post counts by kind, year and hour of day
- top hashtags, mentions and link domains
- the most liked posts

## How it works

- Reads `data/tweets*.js` and `data/account.js` from a zip or an extracted folder. No zip library is used.
- Expands t.co links, decodes HTML entities, drops duplicate ids and classifies posts as `post`, `reply`, `repost` or `quote`.
- Runs entirely offline.

## Use as a library

```ts
import { convert, search, computeStats } from '@lapius/x-archive-parser';

const result = convert({ input: 'archive.zip', out: './x-posts', tz: 'Asia/Tokyo' });
```

## Limitations

- Only `tweets*.js`, `account.js` and `like.js` are read.
- Image and video files are not copied. Their URLs are recorded.
- DMs and long-post bodies from `note-tweet.js` are not included.

## License

MIT
