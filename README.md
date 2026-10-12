# x-archive-parser

English | [日本語](README.ja.md)

A CLI that converts an X (Twitter) archive into per-month Markdown, JSONL and CSV. The output is laid out so coding agents and `grep` can search it. The same command also searches and summarises the converted posts. It runs fully offline and has only two runtime dependencies (`@clack/prompts`, `picocolors`).

## Contents

- [Quick start](#quick-start)
- [Install](#install)
- [Getting your archive](#getting-your-archive)
- [Interactive mode](#interactive-mode)
- [convert](#convert)
- [Output layout](#output-layout)
- [File formats](#file-formats)
- [search](#search)
- [stats](#stats)
- [Language](#language)
- [Use with grep, jq and coding agents](#use-with-grep-jq-and-coding-agents)
- [Use as a library](#use-as-a-library)
- [How it works](#how-it-works)
- [Environment variables and exit codes](#environment-variables-and-exit-codes)
- [Troubleshooting](#troubleshooting)
- [Limitations](#limitations)
- [Development](#development)
- [License](#license)

## Quick start

```bash
pnpm add -g @lapius/x-archive-parser

x-archive-parser                                   # interactive wizard
x-archive-parser twitter-2026-10-05-xxxx.zip       # convert directly
x-archive-parser search "ramen" ./x-posts          # search the newest run
x-archive-parser stats ./x-posts                   # activity summary
```

A conversion ends with the absolute path of the folder it created:

```
Saved to: /home/me/x-posts/lapius7_20261013-153012_a1b2c3d4
```

## Install

```bash
pnpm add -g @lapius/x-archive-parser
# or run once without installing
pnpm dlx @lapius/x-archive-parser --help
```

Requires Node.js 20 or later. `npm i -g @lapius/x-archive-parser` works as well.

## Getting your archive

1. In X, open Settings, then "Your account", then "Download an archive of your data".
2. Request the archive and wait for the notification that it is ready. It can take a day or more.
3. Download the zip. You can pass the zip as it is, or extract it and pass the folder.

The tool reads `data/tweets*.js` (required), `data/account.js` (user name) and `data/like.js` (only with `--likes`). Other files in the archive are ignored. The menu wording in X may change over time.

## Interactive mode

Run the command with no arguments in a terminal.

```bash
x-archive-parser
```

The wizard looks for your archive in these places:

- the current directory
- `~/Downloads`
- on WSL, the `Downloads` folder of every Windows user (`/mnt/c/Users/*/Downloads`)

Zip files and extracted folders whose names start with `twitter-…` or `x-archive…` are offered as choices, shown in a short form such as `twitter-2026-10-05 (zip)` with the full path as a hint. If none is found, you can type a path.

| Question | Meaning |
|---|---|
| Which archive | Pick a candidate or enter a path |
| Parent folder | Default `./x-posts`. A new subfolder is created on every run |
| Timezone | Used for dates and monthly grouping. Defaults to the system timezone |
| File formats | Markdown, JSONL, CSV (multiple allowed). JSONL is needed by `search` and `stats` |
| Post types to skip | Reposts, replies, quote posts. Select none to keep everything |
| Liked posts | Save the posts you liked to `likes.jsonl` |

While converting, a spinner shows the current stage with a progress bar and counts. When it finishes, the wizard prints the time spent on each stage, a summary (totals, kinds, posts per year and month), a hint for the next command, and last of all the full path of the new folder.

If the terminal is not interactive (for example in a pipe or CI), running with no arguments prints the help instead.

## convert

```bash
x-archive-parser [convert] <archive> [options]
```

`<archive>` is a zip file or an extracted folder. The word `convert` is optional.

| Option | Description |
|---|---|
| `-o, --out <dir>` | Parent folder (default `./x-posts`). Every run creates a new subfolder in it |
| `--here` | Write straight into `--out` instead of a subfolder. Replaces the old output in that folder |
| `--tz <zone>` | IANA timezone such as `Asia/Tokyo` (default: system) |
| `-f, --format <list>` | Comma-separated `md`, `jsonl`, `csv` (default `md,jsonl`) |
| `--since <date>` / `--until <date>` | `YYYY-MM-DD`, both ends inclusive, judged in the chosen timezone |
| `--exclude <kinds>` | Comma-separated `reply`, `repost`, `quote` |
| `--likes` | Also write `likes.jsonl` |
| `--json` | Print the result as JSON instead of the human-readable summary |
| `-q, --quiet` | Print only the saved path (errors still go to stderr) |
| `-l, --lang <en\|ja>` | Display language. See [Language](#language) |

Examples:

```bash
# Japan time, everything, plus likes
x-archive-parser archive.zip --tz Asia/Tokyo --likes

# Only your own posts and replies from 2023, all three formats
x-archive-parser archive.zip --since 2023-01-01 --until 2023-12-31 --exclude repost,quote -f md,jsonl,csv

# A fixed folder that is overwritten each time (no subfolder)
x-archive-parser archive.zip -o ./site-data --here

# For scripts: capture the new folder path
OUT=$(x-archive-parser archive.zip -q)
x-archive-parser search "ramen" "$OUT"
```

### Re-running

Without `--here`, each run creates its own folder named `<user>_<date>_<time>_<random id>`, so a second run never overwrites the first. With `--here`, the folder must be empty or contain a previous `index.md`; otherwise the command stops instead of deleting unrelated files.

### What `--json` prints

The result object has these fields: `username`, `tz`, `total`, `skipped`, `months`, `years`, `kinds`, `range`, `likes`, `out` (absolute path), `runId`, `createdAt`.

## Output layout

```
x-posts/
  lapius7_20261013-153012_a1b2c3d4/   one folder per run
    README.md           what this run is: posts, kinds, period, created time, source, filters
    meta.json           the same details as JSON
    index.md            entry point: totals, date range, per-month counts, how to search
    likes.jsonl         only with --likes
    2024/2024-01.md     readable posts with links and media
    2024/2024-01.jsonl  one JSON object per post
    2024/2024-01.csv    only with -f csv
```

When `account.js` is missing, the user part of the folder name is `x`.

### README.md and meta.json in each run

They record when and from what the folder was made, so you can still tell runs apart months later:

- run id, creation time (local and UTC) and the tool version
- source path, whether it was a zip or a folder, and its size
- account name, timezone, formats, filters (period, excluded kinds) and how many posts were left out
- post counts by kind, the period covered, and the number of posts in each month

`README.md` follows the display language; `meta.json` is always the same machine-readable data.

## File formats

### Monthly Markdown

```markdown
# 2024-01 (1 posts, Asia/Tokyo)

### 2024-01-10 21:00:00 · [link](https://x.com/i/status/1)

> hello

♥ 1 · ↻ 0
```

Each post has a heading with its local time, a permalink, and the kind (`reply`, `repost`, `quote`; plain posts have no tag) plus `to @user` for replies. Below it come the text as a block quote, photos as images and other media as links, the quoted post URL for quotes, and like/repost counts.

### JSONL

One JSON object per line. Fields:

| Field | Meaning |
|---|---|
| `id` | Post id (string) |
| `localTime` | Time in the chosen timezone, `YYYY-MM-DD HH:mm:ss` |
| `createdAt` | UTC time in ISO 8601 |
| `kind` | `post`, `reply`, `repost` or `quote` (priority in this order when several apply: repost, reply, quote, post) |
| `text` | Text with t.co links expanded and HTML entities decoded |
| `url` | Permalink, `https://x.com/<user>/status/<id>` (`i` when the user is unknown) |
| `replyToUser` | The user replied to, for replies |
| `quotedUrl` | The quoted post, for quotes |
| `urls` | Expanded links in the post |
| `hashtags`, `mentions` | Lists without the `#` / `@` |
| `media` | List of `{ type, url }` for images and video |
| `likes`, `reposts` | Counts at the time of the export |

### CSV

For spreadsheets. Columns: `id,local_time,created_at,kind,text,url,likes,reposts,hashtags,mentions`. Hashtags and mentions are joined with a space in one cell; text is quoted when it has commas, quotes or line breaks.

### likes.jsonl

Liked posts, read defensively from `like.js`. Only available with `--likes`.

## search

```bash
x-archive-parser search [query] [dir] [options]
```

`query` is a case-insensitive substring unless `-E` is given. `dir` is a run folder or its parent (default `./x-posts`). With a parent, the newest run is used and printed as `Using …`. If you pass only one argument and it is a converted folder, it is treated as the folder and everything is listed.

| Option | Description |
|---|---|
| `-E, --regex` | Treat the query as a regular expression |
| `-k, --kind <list>` | Filter by `post`, `reply`, `repost`, `quote` |
| `--since <date>` / `--until <date>` | Filter by date (`YYYY-MM-DD`) |
| `--hashtag <tag>` / `--mention <user>` | Filter by hashtag or mention |
| `--media` | Only posts with images or video |
| `--min-likes <n>` | Minimum like count |
| `-n, --limit <n>` | Number of hits to show (default 20, newest first; `0` for all) |
| `--full` | Show the whole text instead of one line |
| `-f, --format <fmt>` | `text` (default), `json`, `jsonl` or `csv` |
| `-o, --output <file>` | Save the results to a file instead of printing (format defaults to `jsonl`) |
| `--json` | Same as `-f json` |
| `-l, --lang <en\|ja>` | Display language |

```bash
x-archive-parser search "ramen" --since 2023-01-01 -k post,reply
x-archive-parser search -E "^(good|bad) morning" --hashtag daily --media -n 0
x-archive-parser search "ramen" -f json                      # JSON array on stdout
x-archive-parser search "ramen" -n 0 -f csv -o ramen.csv     # all hits to a file
x-archive-parser search --min-likes 100 -n 0                 # every post with 100+ likes, no query
```

In `text` format, matches are highlighted and each hit shows the time, kind, text and permalink. Machine-readable formats print only data on stdout; messages such as the hit count go to stderr, so pipes stay clean. When saving with `-o`, the absolute path is printed on stderr.

## stats

```bash
x-archive-parser stats [dir] [--json]
```

Prints:

- total posts and the number of active days
- post counts by kind, year and hour of day (with a sparkline)
- top hashtags, mentions and link domains
- the most liked posts

`--json` prints the raw numbers.

## Language

Output is in English or Japanese.

| How | Example |
|---|---|
| Option (before or after the subcommand) | `x-archive-parser -l ja archive.zip` / `x-archive-parser stats --lang en` |
| Environment variable | `XAP_LANG=ja` |
| Locale (used when neither is set) | `LC_ALL`, `LC_MESSAGES`, then `LANG`; anything starting with `ja` selects Japanese |

It affects the wizard, progress text, summaries, help, error messages, and the generated `README.md` and `index.md`. The monthly Markdown, JSONL and CSV stay in English so they are easy to grep. An unsupported value stops with an error.

## Use with grep, jq and coding agents

Point your agent at the run folder and tell it to start from `index.md`. It lists the totals, the date range and how to search.

```bash
# find candidate months
grep -ril "ramen" 2023/ --include=*.jsonl

# structured filters with jq
jq -r 'select(.kind=="post" and (.hashtags|index("daily"))) | .url' 2023/2023-*.jsonl

# top liked posts of one month
jq -s 'sort_by(-.likes)[:5][] | {likes, text, url}' 2024/2024-01.jsonl
```

## Use as a library

```ts
import { convert, search, computeStats, resolveOutDir, setLang } from '@lapius/x-archive-parser';

setLang('en');
const result = convert({
  input: 'archive.zip',
  out: './x-posts',
  tz: 'Asia/Tokyo',
  formats: ['md', 'jsonl'],
  onProgress: ({ stage, done, total }) => console.log(stage, done, total),
});
console.log(result.out); // absolute path of the new folder

const dir = resolveOutDir('./x-posts');          // newest run
const hits = search(dir, { query: 'ramen', since: '2023-01-01' });
const stats = computeStats(dir);
```

Other exports: `toPost`, `toLike`, `iterRows`, `systemTz`, `validateTz`, `parseLang`, `detectLang`, `getLang`, and the types `Post`, `PostRow`, `LikeRow`, `PostKind`, `Format`, `ConvertOptions`, `ConvertResult`, `ProgressEvent`, `SearchOptions`, `Stats`, `Lang`.

`ConvertOptions` accepts `input`, `out`, `here`, `tz`, `formats`, `exclude`, `since`, `until`, `likes`, `lang` and `onProgress`. Errors are thrown as `Error` with messages in the current language.

## How it works

1. **Open.** A zip is read with a small built-in reader (stored and deflate entries, via `node:zlib`). A folder is read directly. No zip library is used.
2. **Parse.** `data/tweets*.js` files start with `window.YTD.tweets.part0 = [...]`; the prefix is cut and the rest is parsed as JSON. Duplicate ids are dropped.
3. **Normalise.** t.co links are expanded, media t.co links are removed from the text, HTML entities are decoded, and each post is classified as `post`, `reply`, `repost` or `quote`.
4. **Filter and group.** `--since`, `--until` and `--exclude` are applied, and posts are grouped by month in the chosen timezone.
5. **Write.** Monthly files, `index.md`, `README.md` and `meta.json` are written.

## Environment variables and exit codes

| Name | Meaning |
|---|---|
| `XAP_LANG` | Display language, `en` or `ja` |
| `LC_ALL`, `LC_MESSAGES`, `LANG` | Fallback for the display language |
| `NO_COLOR` | Turns colours off (handled by picocolors) |

| Exit code | Meaning |
|---|---|
| `0` | Success |
| `1` | Error, or `search` found nothing |
| `130` | Cancelled in the wizard |

## Troubleshooting

| Message or symptom | Cause and fix |
|---|---|
| `data/tweets*.js not found` | The path is not an X archive, or it points to a parent of the extracted folder. Pass the folder that contains `data/` |
| `The folder is not empty and has no index.md` | You used `--here` on a folder with other files. Use an empty folder or drop `--here` |
| `No converted results found` | `search` or `stats` was given a folder without converted output. Convert first, or pass the right run folder or its parent |
| `Unknown timezone` | Use an IANA name such as `Asia/Tokyo` or `UTC` |
| `Use YYYY-MM-DD for dates` | `--since` and `--until` need that exact format |
| `search` finds nothing in a month you expect | The run may have been made with `-f md` only. `search` and `stats` read JSONL, so include `jsonl` |
| The wizard does not list my archive | Only names starting with `twitter…` or `x-archive…` are suggested. Choose "another path" and type it |
| The progress bar flashes by | Small archives finish in under a second. The per-stage lines printed afterwards show the counts and times |
| `pnpm add -g` cannot find the command | Run `pnpm setup` and restart the shell so the global bin directory is on `PATH` |

## Limitations

- Only `tweets*.js`, `account.js` and `like.js` are read.
- Image and video files are not copied. Their URLs are recorded.
- DMs and long-post bodies from `note-tweet.js` are not included.
- The archive format is not an official, documented interface and may change; `like.js` and `account.js` are read defensively.

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build      # tsup: dist/index.js, dist/cli.js, types
```

The code is TypeScript (ESM) and tests use vitest.

## License

MIT
