/* eslint-disable import-x/no-extraneous-dependencies */
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const require = createRequire(import.meta.url);

const pkgJson = require('./package.json');

const dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.resolve(dirname, 'build');
const entryPoint = path.resolve(targetPath, 'index.js');
/* What a consumer's own install will have, and therefore the only thing
 * this bundle may leave as a bare import; everything else is inlined. A
 * devDependency is not that - listing them here is how `@browsery/type-is`
 * came to be imported by a published `browser.js` without being installed
 * with it. */
const external = [
  ...Object.keys(pkgJson.dependencies || {}),
  ...Object.keys(pkgJson.peerDependencies || {}),
];
/* Bundled rather than imported, even though it is a real dependency: its
 * `multipasta/node` entry is resolved against this build's own aliases
 * (see below), which a consumer's bundler would not apply. */
external.splice(external.indexOf('multipasta'), 1);

await esbuild.build({
  format: 'esm',
  outfile: path.join(targetPath, './browser.js'),
  tsconfig: './tsconfig-build.json',
  entryPoints: [entryPoint],
  bundle: true,
  platform: 'browser',
  target: ['es2020', 'chrome110'],
  logLevel: 'info',
  minify: true,
  keepNames: true,
  alias: {
    fs: '@browsery/fs',
    highland: '@browsery/highland',
    'http-parser-js': '@browsery/http-parser',
    stream: '@browsery/stream',
    'node:stream': '@browsery/stream',
    path: 'path-browserify',
    crypto: 'crypto-browserify',
    buffer: 'buffer',
  },
  external,
  banner: {
    js: `/****************************************
* All rights reserved Panates® 2022-${new Date().getFullYear()}
* http://www.panates.com
*****************************************/
`,
  },
});
