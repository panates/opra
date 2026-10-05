/* eslint-disable import-x/no-extraneous-dependencies */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);

const pkgJson = require('./package.json');

const dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.resolve(dirname, 'build');
const noExternal = [];
const external = [
  ...Object.keys(pkgJson.dependencies || {}),
  ...Object.keys(pkgJson.peerDependencies || {}),
  ...Object.keys(pkgJson.devDependencies || {}),
  'mime-db',
].filter(x => !noExternal.includes(x));

await esbuild.build({
  entryPoints: [path.resolve(targetPath, 'index.js')],
  outfile: path.join(targetPath, './browser.js'),
  format: 'esm',
  tsconfig: './tsconfig-build.json',
  bundle: true,
  logLevel: 'info',
  minify: true,
  keepNames: true,
  platform: 'browser',
  target: ['es2020', 'chrome80'],
  /* **Every shim needs both spellings.** esbuild matches an alias against the specifier as
   * written, so `fs` does not cover `node:fs` - which is what `stream`/`node:stream` and
   * `path`/`node:path` below already say twice each. `translation-store.ts` does
   * `await import('node:fs')`, added 2026-09-15, and the bundle has failed since with
   * `Could not resolve "node:fs"`; nothing noticed because CI lints and runs mocha through swc on
   * `dev` and never builds, and no release has been cut since. */
  alias: {
    fs: '@browsery/fs',
    'node:fs': '@browsery/fs',
    highland: '@browsery/highland',
    'http-parser-js': '@browsery/http-parser',
    i18next: '@browsery/i18next',
    stream: '@browsery/stream',
    'node:stream': '@browsery/stream',
    path: 'path-browserify',
    'node:path': 'path-browserify',
    crypto: 'crypto-browserify',
  },
  external,
  // legalComments: 'external',
  banner: {
    js: `/****************************************
* All rights reserved Panates® 2022-${new Date().getFullYear()}
* http://www.panates.com
*****************************************/
`,
  },
});
