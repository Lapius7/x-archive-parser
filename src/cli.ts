import { parseArgs } from 'node:util';
import { convert } from './index.js';

const HELP = `Usage: x-archive-parser [options] <archive.zip | extracted-dir>

Options:
  -o, --out <dir>   output directory (default: ./x-posts)
      --tz <zone>   IANA timezone (default: system)
  -h, --help        show this help
`;

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o', default: './x-posts' },
      tz: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  if (values.help || positionals.length !== 1) {
    process.stdout.write(HELP);
    process.exit(values.help ? 0 : 1);
  }
  const r = convert({ input: positionals[0]!, out: values.out!, tz: values.tz });
  console.log(`${r.total} posts, ${r.months} months -> ${values.out}/index.md`);
} catch (e) {
  console.error(`error: ${(e as Error).message}`);
  process.exit(1);
}
