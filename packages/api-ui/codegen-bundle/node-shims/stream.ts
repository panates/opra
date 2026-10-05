/**
 * A deliberately non-functional stand-in for `node:stream`, used only
 * so esbuild can successfully bundle `@opra/client`'s multipart-bundle
 * code path as its own separate, code-split chunk (dynamically imported
 * inside `generate-document.ts`'s "fetch by serviceUrl" branch — see
 * there) — the same reasoning as `./fs.ts`. `browser-entry.ts` always
 * passes an already-built `ApiDocument` to `generateFiles()`, so that
 * branch (and everything reachable only from it) is never actually
 * fetched by a browser at runtime; this only needs to exist so the
 * *build* succeeds.
 */
function unsupported(name: string): never {
  throw new Error(
    `stream.${name} is not available in the browser codegen bundle`,
  );
}

export class Readable {
  static from(): never {
    return unsupported('Readable.from');
  }

  pipe(): never {
    return unsupported('Readable#pipe');
  }
}

export class PassThrough {
  pipe(): never {
    return unsupported('PassThrough#pipe');
  }
}

export class Duplex {
  pipe(): never {
    return unsupported('Duplex#pipe');
  }
}

export class Stream {}

export default { Readable, PassThrough, Duplex, Stream };
