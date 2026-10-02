import 'reflect-metadata';
import fs from 'node:fs';
import path from 'node:path';
import {
  type TranslationBundle,
  TranslationFileStore,
  TranslationStore,
} from '@opra/common';
import { expect } from 'expect';
import { extractDocumentTranslations } from '../src/docs-extractor/extract-command.js';

/* Written inside the package rather than in `os.tmpdir()`: `loadDocument`
 * imports the module for real, so it has to sit where this repository's own
 * TypeScript loader and decorator settings apply. */
const ROOT = path.join(import.meta.dirname, '.tmp-extract');

/** A module declaring one document, with whichever store the test needs. */
function writeModule(dir: string, store: string): string {
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'doc.ts');
  fs.writeFileSync(
    file,
    `import path from 'node:path';
import {
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  OpraSchema,
  TranslationFileStore,
} from '@opra/common';

@ComplexType({ description: 'A note' })
class Note {
  @ApiField({ description: 'Note body' })
  declare text: string;
}

export const doc = await ApiDocumentFactory.createDocument({
  spec: OpraSchema.SpecVersion,
  info: { title: 'TestApi' },
  types: [Note],
  ${store}
});
`,
    'utf-8',
  );
  return `${file}#doc`;
}

const FILE_STORE =
  "translationStore: new TranslationFileStore(path.join(import.meta.dirname, './docs')),";

describe('cli:docs:extract', () => {
  let n = 0;
  let dir: string;
  let docs: string;

  beforeEach(() => {
    // A fresh directory per test, because `loadDocument` imports by url and
    // Node caches a module graph for the lifetime of the process.
    dir = path.join(ROOT, `case-${++n}`);
    docs = path.join(dir, 'docs');
  });

  after(() => fs.rmSync(ROOT, { force: true, recursive: true }));

  it("Should write through the document's own store when no file is named", async () => {
    await extractDocumentTranslations(writeModule(dir, FILE_STORE));
    /* The store decides where. A path named on a command line is a guess
     * about how a document keeps its translations, and a wrong guess is
     * silent: the file appears, the texts look extracted, and the page keeps
     * rendering whatever the source declared. */
    const written = JSON.parse(
      fs.readFileSync(path.join(docs, 'en.json'), 'utf-8'),
    );
    expect(written.types.Note.description).toStrictEqual('A note');
    expect(written.types.Note.fields.text.description).toStrictEqual(
      'Note body',
    );
  });

  it('Should keep what the store already carries', async () => {
    fs.mkdirSync(docs, { recursive: true });
    fs.writeFileSync(
      path.join(docs, 'en.json'),
      JSON.stringify(
        { types: { Note: { description: 'A note (written by hand)' } } },
        null,
        2,
      ) + '\n',
      'utf-8',
    );
    await extractDocumentTranslations(writeModule(dir, FILE_STORE));
    const written = JSON.parse(
      fs.readFileSync(path.join(docs, 'en.json'), 'utf-8'),
    );
    expect(written.types.Note.description).toStrictEqual(
      'A note (written by hand)',
    );
    // The keys it didn't have are filled in from the source.
    expect(written.types.Note.fields.text.description).toStrictEqual(
      'Note body',
    );
  });

  it('Should refuse a document with nowhere to write', async () => {
    await expect(
      extractDocumentTranslations(writeModule(dir, '')),
    ).rejects.toThrow(/no translation store/);
  });

  it('Should dump to a file when one is named, leaving the store alone', async () => {
    const out = path.join(dir, 'dump.json');
    await extractDocumentTranslations(writeModule(dir, FILE_STORE), out);
    expect(fs.existsSync(out)).toBe(true);
    expect(fs.existsSync(path.join(docs, 'en.json'))).toBe(false);
    // Byte for byte what the store would have written, so the one can be
    // moved to the other.
    const dumped = fs.readFileSync(out, 'utf-8');
    await new TranslationFileStore(docs).save('en', JSON.parse(dumped));
    expect(fs.readFileSync(path.join(docs, 'en.json'), 'utf-8')).toStrictEqual(
      dumped,
    );
  });

  it('Should treat a store that cannot save as nowhere to write', () => {
    // `save` is optional on purpose: a document reading its bundles from
    // somewhere unwritable has no extraction target either.
    class ReadOnlyStore extends TranslationStore {
      async listLanguages(): Promise<string[]> {
        return ['en'];
      }
      async load(): Promise<TranslationBundle | undefined> {
        return undefined;
      }
    }
    expect(new ReadOnlyStore().save).toBeUndefined();
  });
});
