# x-archive-parser

Converts an X (Twitter) archive into per-month Markdown and JSONL files that coding agents can grep.

## Install

```bash
pnpm add -g @lapius/x-archive-parser
```

## Usage

```bash
x-archive-parser [-o ./x-posts] [--tz Asia/Tokyo] <archive.zip | extracted-dir>
```

Output:

```
x-posts/
  index.md          entry point: totals, timezone, per-month counts
  2024/2024-01.md   readable posts
  2024/2024-01.jsonl one JSON object per post (id, createdAt, localTime, kind, text, urls, likes, reposts)
```

- Reads `data/tweets*.js` from the zip or the extracted folder.
- Expands t.co links, classifies posts as `post` / `reply` / `repost`, removes duplicate ids.
- Re-running into the same folder is safe. A non-empty folder without `index.md` is refused.
- Runs offline with no runtime dependencies. Requires Node 20 or later.

## Limitations

Only `tweets*.js` is read. Media files, likes, DMs and long-post bodies from `note-tweet.js` are not included yet.

## License

MIT
