/* eslint-disable import-x/no-extraneous-dependencies */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);

const pkgJson = require('./package.json');

const dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.resolve(dirname, 'build');
/* What a consumer's own install will have, and therefore the only thing
 * this bundle may leave as a bare import; everything else is inlined.
 *
 * devDependencies used to be listed here too, which published a
 * `browser.js` importing `@browsery/fs` and `path-browserify` - packages
 * that stand in for `node:fs`/`node:path` in this build only (see `alias`
 * below) and that nobody downstream installs. Every consumer's bundler
 * stopped on them: "Rollup failed to resolve import "@browsery/fs"". */
const external = [
  ...Object.keys(pkgJson.dependencies || {}),
  ...Object.keys(pkgJson.peerDependencies || {}),
];

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
