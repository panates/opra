import http from 'node:http';
import colors from 'ansi-colors';
import { loadDocument } from '../docs-extractor/load-document.js';
import type { ILogger } from '../interfaces/logger.interface.js';

/** What `oprimp docs:studio` itself takes. Not `DocsStudioOptions` — that
 *  name belongs to the studio in `@opra/api-ui`, and these are the command's
 *  own concerns: where to load a document from, which port to listen on,
 *  where to write the log. */
export interface DocsStudioCommandOptions {
  /** Which bundle to edit. Defaults to the document's own `defaultLanguage`. */
  lang?: string;
  port?: number;
  /** Scope to render, for a document that exposes more than one. */
  scope?: string;
  logger?: ILogger;
}

/**
 * Serves `@opra/api-ui`'s documentation studio on loopback.
 *
 * The studio itself lives in `api-ui` (`DocsStudio`), which is where the page
 * it renders already lived. What is here is the part `api-ui` deliberately
 * does not have: a process, a server, and a document — `DocsStudio` only
 * answers requests somebody hands it, and inside an application that
 * somebody is the application.
 *
 * Which is the point of the command. An adapter's `enableStudio` needs an
 * application that runs: its database, its configuration, a write route in
 * its own router. This needs none of that — a module path and a port — so a
 * package that is only types has a way to document itself, and a team that
 * will not ship a write endpoint at all still has a way to write.
 *
 * Bound to 127.0.0.1 and started by hand: a command you run in a terminal
 * cannot be left on by accident.
 */
export async function startDocsStudio(
  moduleRef: string,
  options: DocsStudioCommandOptions,
): Promise<http.Server> {
  const logger = options.logger;
  const document = await loadDocument(moduleRef);

  /* `@opra/api-ui` is reached dynamically: it already carries `@opra/cli` as
   * an optional peer (for the browser-side client generator), so a static
   * import here would close a package-level cycle. Same seam `api-ui` itself
   * uses, and the one `dpdm`'s circular check skips. */
  let DocsStudio: typeof import('@opra/api-ui').DocsStudio;
  try {
    ({ DocsStudio } = await import('@opra/api-ui'));
  } catch {
    throw new Error(
      'docs:studio requires the optional "@opra/api-ui" package. ' +
        'Install it and try again.',
    );
  }

  /* No way to tell it where to write. The document says where its texts
   * live, and a directory named on a command line is a guess about how that
   * document stores them - one that is silently wrong for a store backed by
   * anything other than a folder of json, and that puts the tool and the
   * document back on two different answers to the same question. There is
   * exactly one answer, and the document owns it. */
  const studio = new DocsStudio(document, {
    lang: options.lang,
    scope: options.scope,
    onSaved: e =>
      logger?.log?.(
        colors.greenBright(
          `saved ${e.ns ? e.ns + ':' : ''}${[...e.key, e.field].join('.')} (${e.lang})`,
        ),
      ),
    onLanguageCreated: e =>
      logger?.log?.(colors.greenBright(`created ${e.file || e.lang}`)),
    onError: e => logger?.error?.(colors.red(e.message)),
  });

  const server = http.createServer((req, res) => studio.handle(req, res));
  const wantedPort = options.port ?? 7300;
  await new Promise<void>((resolve, reject) => {
    /* A tool you start and stop all day long hits an occupied port sooner or
     * later; without this, Node's own unhandled 'error' event ends the
     * process in a stack trace rather than a sentence. */
    server.once('error', (e: NodeJS.ErrnoException) =>
      reject(
        e.code === 'EADDRINUSE'
          ? new Error(
              `Port ${wantedPort} is already in use — another studio may ` +
                'still be running. Stop it, or pass --port.',
            )
          : e,
      ),
    );
    server.listen(wantedPort, '127.0.0.1', resolve);
  });

  const { port } = server.address() as { port: number };
  const lang = studio.initialLang;
  logger?.log?.(
    colors.greenBright(
      `Documentation studio for "${document.info.title || moduleRef}"`,
    ),
  );
  logger?.log?.(`  editing  ${await studio.root.filename(lang)} (${lang})`);
  const others = (await studio.languages()).filter(
    l => l.toLowerCase() !== lang.toLowerCase(),
  );
  if (others.length) logger?.log?.(`  also     ${others.join(', ')}`);
  for (const doc of studio.documents.slice(1)) {
    logger?.log?.(
      `  ${colors.cyan(doc.ns + ':')}      ${await doc.filename(lang)}`,
    );
  }
  logger?.log?.(`  open     http://127.0.0.1:${port}`);
  return server;
}
