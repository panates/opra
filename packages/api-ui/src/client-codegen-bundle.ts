import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ClientCodegenFile {
  contents: Uint8Array;
  contentType: string;
}

let cached: Promise<Map<string, ClientCodegenFile>> | undefined;

/**
 * Bundles `codegen-bundle/browser-entry.ts` — this package's own
 * browser-side TypeScript-client generator (`@opra/cli`'s `TsGenerator`
 * plus `@opra/common`'s `ApiDocumentFactory`, packed together with
 * `esbuild`) — into a set of static, in-memory JS chunks, lazily on the
 * first call and cached in memory for the lifetime of the process
 * afterwards.
 *
 * Why a whole bundler, here, in a package whose own main asset
 * (`assets/app.js`) is deliberately plain, unbundled browser JS: unlike
 * that hand-written file, this one pulls in real npm dependencies
 * (`@opra/cli`, `@opra/common`, `fflate`) that only exist as CommonJS/
 * ESM packages, not drop-in `<script>`-ready globals — there's no
 * equivalent of vendoring a single UMD file (see `assets/vendor/
 * minisearch.js`) available here. Node-only code paths reachable from
 * `browser-entry.ts` (disk-writing, fetching-by-URL — neither of which
 * that entry point ever actually uses, since it's always given an
 * already-fetched schema) are still resolved by tiny local shims (see
 * `codegen-bundle/node-shims/`) and small browser polyfills, so the
 * build *succeeds* even though those particular chunks (kept in their
 * own code-split files by `splitting: true` — see `generate()`'s own
 * dynamic `import('./write-to-disk.js')`) are never actually fetched by
 * a browser that only ever calls `generateFiles()`, which is all this
 * feature needs.
 *
 * Requires the optional `esbuild` and `@opra/cli` packages to be
 * installed — callers should catch and handle that absence themselves,
 * the same way `openapi`/`apiUi` do elsewhere in `express-api-ui.ts`.
 */
export function buildClientCodegenBundle(): Promise<
  Map<string, ClientCodegenFile>
> {
  if (cached) return cached;
  cached = (async () => {
    const esbuild = await import('esbuild');
    const dir = path.dirname(fileURLToPath(import.meta.url));
    // `codegen-bundle/` sits outside `src/`, a sibling of `assets/`/
    // `test/` — kept out of both the normal `src` → `build` TS compile
    // and `ts-cleanup`'s reach, the same reasoning `html-template.ts`'s
    // own comment gives for why `assets/*` lives there too.
    const codegenDir = path.join(dir, '..', 'codegen-bundle');
    const entry = path.join(codegenDir, 'browser-entry.ts');
    const shimsDir = path.join(codegenDir, 'node-shims');

    const result = await esbuild.build({
      entryPoints: [entry],
      bundle: true,
      platform: 'browser',
      format: 'esm',
      splitting: true,
      write: false,
      outdir: 'out',
      logLevel: 'silent',
      // A couple of Node-oriented transitive dependencies (e.g.
      // `putil-promisify`, reachable via `resolveThunk` — see
      // `@opra/common`'s `function-utils.ts`) reference the bare Node
      // global `global` at runtime, not just at build time — unlike the
      // `alias` entries below, this isn't a module to swap out, just a
      // missing global to provide, the same fix esbuild's own docs give
      // for this exact situation.
      define: {
        global: 'globalThis',
      },
      // A bare, unimported `process` reference (`process.env...`,
      // `process.nextTick(...)`) isn't something `alias` can redirect —
      // there's no import site to alias, only a free identifier — so it's
      // provided the way esbuild's own docs recommend for this exact case:
      // injecting a file whose export becomes that global. See
      // `node-shims/process-inject.ts`.
      inject: [path.join(shimsDir, 'process-inject.ts')],
      alias: {
        'node:events': 'events',
        'node:path': 'path-browserify',
        'node:process': 'process',
        'node:fs': path.join(shimsDir, 'fs.ts'),
        'node:stream': path.join(shimsDir, 'stream.ts'),
        fs: path.join(shimsDir, 'fs.ts'),
      },
    });

    const files = new Map<string, ClientCodegenFile>();
    for (const file of result.outputFiles) {
      files.set(path.basename(file.path), {
        contents: file.contents,
        contentType: 'text/javascript',
      });
    }
    return files;
  })();
  return cached;
}
