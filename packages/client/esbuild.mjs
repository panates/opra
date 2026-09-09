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
const external = [
  ...Object.keys(pkgJson.dependencies || {}),
  ...Object.keys(pkgJson.peerDependencies || {}),
  ...Object.keys(pkgJson.devDependencies || {}),
];
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
