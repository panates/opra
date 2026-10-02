import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ApiDocumentFactory,
  OpraSchema,
  type TranslationBundle,
  TranslationFileStore,
  TranslationStore,
} from '@opra/common';
import { expect } from 'expect';

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'opra-store-'));
}

describe('common:TranslationFileStore', () => {
  const dirs: string[] = [];

  function makeDir(): string {
    const dir = tempDir();
    dirs.push(dir);
    return dir;
  }

  after(() => {
    for (const dir of dirs) fs.rmSync(dir, { force: true, recursive: true });
  });

  it('Should write the exact bytes an extraction writes', async () => {
    const dir = makeDir();
    const bundle: TranslationBundle = {
      types: { Customer: { description: 'Bir müşteri' } },
    };
    await new TranslationFileStore(dir).save('tr', bundle);
    // Two-space indent and a trailing newline, so that running
    // `oprimp docs:extract` after an editing session is a no-op and not a
    // whole-file diff.
    expect(fs.readFileSync(path.join(dir, 'tr.json'), 'utf-8')).toStrictEqual(
      JSON.stringify(bundle, null, 2) + '\n',
    );
  });

  it('Should create the directory it writes into', async () => {
    const dir = path.join(makeDir(), 'nested', 'docs');
    await new TranslationFileStore(dir).save('en', { a: 'b' });
    expect(fs.existsSync(path.join(dir, 'en.json'))).toBe(true);
  });

  it('Should read back what it wrote', async () => {
    const dir = makeDir();
    const store = new TranslationFileStore(dir);
    await store.save('en', {
      types: { Customer: { description: 'A customer' } },
    });
    expect(await store.load('en')).toEqual({
      types: { Customer: { description: 'A customer' } },
    });
    expect(await store.listLanguages()).toStrictEqual(['en']);
  });

  it('Should write back to the file a language already has', async () => {
    const dir = makeDir();
    const store = new TranslationFileStore(dir);
    // Bundles are keyed lower-case in memory, but the file keeps the casing
    // it was created with - rebuilding the name from the tag would leave a
    // second bundle beside the first and write to the wrong one.
    fs.writeFileSync(path.join(dir, 'zh-Hant.json'), '{}\n', 'utf-8');
    await store.save('zh-hant', { a: 'b' });
    expect(fs.readdirSync(dir)).toStrictEqual(['zh-Hant.json']);
    expect(await store.filenameFor('ZH-HANT')).toStrictEqual(
      path.join(dir, 'zh-Hant.json'),
    );
  });

  it('Should leave `save` undefined on a store that cannot write', async () => {
    // The whole safety model for authoring: a studio can only offer to edit
    // a document whose store implements `save`, so a read-only source is
    // uneditable because the write cannot be expressed.
    class ReadOnlyStore extends TranslationStore {
      async listLanguages() {
        return ['en'];
      }
      async load() {
        return { a: 'b' };
      }
    }
    expect(new ReadOnlyStore().save).toBeUndefined();
  });

  it('Should keep the store on the document it loaded', async () => {
    const dir = makeDir();
    const store = new TranslationFileStore(dir);
    await store.save('tr', { info: { title: 'Başlık' } });
    const document = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Doc' },
      translationStore: store,
    });
    // Kept rather than consumed: whatever writes this document's prose has
    // to write it where the document read it from.
    expect(document.translationStore).toBe(store);
    expect(document.translations.get('tr')).toEqual({
      info: { title: 'Başlık' },
    });
  });

  it('Should leave the store undefined when texts were handed over directly', async () => {
    const document = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Doc' },
      translations: { tr: { info: { title: 'Başlık' } } },
    });
    expect(document.translationStore).toBeUndefined();
  });
});
