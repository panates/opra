import fs from 'node:fs';
import { register } from 'node:module';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { ApiDocument } from '@opra/common';

/**
 * TypeScript loaders, in the order they are tried.
 *
 * Node strips types on its own now, but only types — a document is built out
 * of decorators (`@ComplexType`, `@ApiField`), and those are a *syntax* it
 * refuses outright (`SyntaxError: Invalid or unexpected token`, measured on
 * v24). So importing an OPRA document straight from its source needs a real
 * loader.
 *
 * Where that loader is *installed* does not matter — it compiles whatever it
 * is handed. Which `tsconfig.json` it reads does, and measured, it reads the
 * one it finds from the **working directory**, not from the file being
 * compiled: run from a monorepo root whose own `tsconfig.json` is a
 * solution-style list of references, the same decorated file that compiles
 * from its package fails with `Expression expected`. `tsconfigFor` below is
 * what takes that away.
 */
const TS_LOADERS = [
  '@swc-node/register/esm',
  'tsx/esm',
  'ts-node/esm',
] as const;

/**
 * Registers a TypeScript loader, so that pointing this command at a `.ts`
 * source works on its own — without the `node --import <loader>` prefix,
 * which nobody discovers from `oprimp --help` and which cannot be written
 * into a global install at all.
 *
 * **The documented project's own loader is tried first**, so a project that
 * standardized on `tsx` keeps compiling through `tsx`. Only if it has none
 * does this fall back to the copy `@opra/cli` carries itself (an optional
 * dependency — present on a normal install, absent under `--omit=optional`
 * or on a platform swc has no binary for), which is what makes `oprimp` work
 * in a repository that installed nothing but `oprimp`.
 *
 * Returns the specifier that took, or `undefined` when neither had one — in
 * which case the import is still attempted, since a document written without
 * decorators loads on Node's own type stripping.
 */
/**
 * The nearest `tsconfig.json` at or above `from`, which is the one that
 * describes the file being loaded — as opposed to whatever sits in the
 * directory the command happened to be run from.
 */
function tsconfigFor(from: string): string | undefined {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, 'tsconfig.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function registerTypeScriptLoader(from: string): string | undefined {
  /* Pointed at the documented project's own config before any loader starts,
   * because every one of them resolves it from the working directory
   * otherwise. Never overrides a value the caller set: somebody who exported
   * it meant it. */
  const tsconfig = tsconfigFor(from);
  if (
    tsconfig &&
    !process.env.SWC_NODE_PROJECT &&
    !process.env.TS_NODE_PROJECT
  ) {
    process.env.SWC_NODE_PROJECT = tsconfig;
    process.env.TS_NODE_PROJECT = tsconfig;
  }
  const parents = [
    pathToFileURL(from.endsWith(path.sep) ? from : from + path.sep),
    /* This file's own location, so the resolution walks `@opra/cli`'s
     * `node_modules` rather than the documented project's. */
    new URL('./', import.meta.url),
  ];
  for (const parent of parents) {
    for (const specifier of TS_LOADERS) {
      try {
        register(specifier, parent);
        return specifier;
      } catch {
        /* Not installed here; try the next. */
      }
    }
  }
  return undefined;
}

/**
 * Loads an `ApiDocument` from a local module.
 *
 * Deliberately a *local module* rather than a service url: `docKey` is an
 * authoring-time property that never reaches the published schema, so a
 * document rebuilt from a served `$schema` would produce unstable keys
 * exactly where a `docKey` was declared to prevent them.
 *
 * Shared by `docs:extract` and `docs:studio` so the two can never disagree
 * about which document they are looking at — the same reason
 * `extractTranslations()` runs the runtime's own `export()` walk rather than
 * re-implementing it.
 *
 * @param moduleRef - Module path, optionally with the export to use after a
 *   `#` (`./dist/api-document.js#CustomerApiDocument`). The export may be
 *   an `ApiDocument`, a function returning one, or a namespace with a
 *   `create()`.
 */
export async function loadDocument(moduleRef: string): Promise<ApiDocument> {
  const hashIndex = moduleRef.lastIndexOf('#');
  const modulePath =
    hashIndex > 0 ? moduleRef.substring(0, hashIndex) : moduleRef;
  const exportName =
    hashIndex > 0 ? moduleRef.substring(hashIndex + 1) : undefined;
  const filename = path.resolve(process.cwd(), modulePath);
  const url = pathToFileURL(filename).href;
  /* Registered before the first attempt rather than after a failure: a module
   * url that has already failed to load is not reliably loadable again in the
   * same process, and registering a loader nothing needs costs nothing. */
  const loader = /\.[cm]?ts$/.test(modulePath)
    ? registerTypeScriptLoader(path.dirname(filename))
    : undefined;
  let module: Record<string, any>;
  try {
    module = await import(url);
  } catch (e: any) {
    if (/\.[cm]?ts$/.test(modulePath)) {
      throw new TypeError(
        `Could not import "${modulePath}".` +
          (loader
            ? ` Its TypeScript loader (${loader}) could not read it — check ` +
              "that the project's tsconfig.json enables the syntax it uses " +
              '(`experimentalDecorators`, `emitDecoratorMetadata`).'
            : ' Importing TypeScript sources needs a loader, and neither ' +
              'this project nor this installation of @opra/cli has one of ' +
              TS_LOADERS.join(', ') +
              '. Add one as a devDependency, or point at the compiled .js ' +
              'instead.'),
        { cause: e },
      );
    }
    throw e;
  }
  const candidates = exportName
    ? [module[exportName]]
    : [module.default, ...Object.values(module)];
  for (const candidate of candidates) {
    const document = await resolveDocument(candidate);
    if (document) return document;
  }
  throw new TypeError(
    `No ApiDocument found in "${moduleRef}". Export one (or a function/` +
      'namespace with `create()` returning one), or name the export after a `#`.',
  );
}

async function resolveDocument(value: any): Promise<ApiDocument | undefined> {
  if (value instanceof ApiDocument) return value;
  if (typeof value === 'function') {
    const out = await value();
    return out instanceof ApiDocument ? out : undefined;
  }
  if (value && typeof value.create === 'function') {
    const out = await value.create();
    return out instanceof ApiDocument ? out : undefined;
  }
}
