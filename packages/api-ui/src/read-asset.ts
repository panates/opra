import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * `assets/*` live at the package root, deliberately outside `src/`: a `.js`
 * file living inside `src/` would otherwise get deleted by this package's
 * own `clean:src` script (`ts-cleanup -s src --all` treats any `.js` file
 * without a matching `.ts` as stale build output — a static asset like
 * `app.js` looks exactly like one to it).
 *
 * That puts it one directory *up* from `src/` in dev/test, but the
 * `postbuild` script copies it *alongside* the compiled modules (so it ships
 * with the published package, which is `build/`'s contents) — check the
 * sibling path first, since that's the one that exists once built.
 *
 * `name` may be a sub-path (`'vendor/minisearch.js'`, `'i18n/tr.json'`);
 * `postbuild`'s `cp -R` copies the whole tree, so nested assets need no
 * packaging step of their own.
 */
export function readAsset(name: string): string {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const sibling = path.join(dir, 'assets', name);
  const p = fs.existsSync(sibling)
    ? sibling
    : path.join(dir, '..', 'assets', name);
  return fs.readFileSync(p, 'utf8');
}
