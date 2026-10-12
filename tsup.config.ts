import { defineConfig } from 'tsup';
export default defineConfig([
  { entry: ['src/index.ts'], format: ['esm'], dts: true, clean: true },
  { entry: ['src/cli.ts'], format: ['esm'], target: 'node20', banner: { js: '#!/usr/bin/env node' } },
]);
