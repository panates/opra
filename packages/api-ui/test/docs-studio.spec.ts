import 'reflect-metadata';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  OpraSchema,
  TranslationFileStore,
} from '@opra/common';
import { expect } from 'expect';
import { DocsStudio } from '../src/studio/docs-studio.js';

@ComplexType({ description: 'A shared thing' })
class Shared {
  @ApiField({ description: 'Its id' })
  declare id: string;
}

@ComplexType({ description: 'An unstored thing' })
class Unstored {
  @ApiField()
  declare id: string;
}

@ComplexType({ description: 'A holder' })
class Holder {
  @ApiField({ type: Shared })
  declare shared: Shared;

  @ApiField({ type: Unstored })
  declare unstored: Unstored;
}

function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'opra-studio-'));
}

function read(dir: string, lang: string): any {
  return JSON.parse(fs.readFileSync(path.join(dir, `${lang}.json`), 'utf-8'));
}

describe('api-ui:DocsStudio', () => {
  let rootDir: string;
  let refDir: string;
  let dirs: string[];
  let root: ApiDocument;
  let reference: ApiDocument;
  let unstored: ApiDocument;
  let studio: DocsStudio;

  beforeEach(async () => {
    rootDir = tempDir();
    refDir = tempDir();
    dirs = [rootDir, refDir];
    reference = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Shared models' },
      types: [Shared],
      translationStore: new TranslationFileStore(refDir),
    });
    // Brings no store at all, so nothing here can be written — its texts are
    // read from whatever the source declares and that is the end of it.
    unstored = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Unstored models' },
      types: [Unstored],
    });
    root = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Root' },
      references: { sh: reference, un: unstored },
      types: [Holder],
      translationStore: new TranslationFileStore(rootDir),
    });
    studio = new DocsStudio(root);
  });

  afterEach(() => {
    for (const dir of dirs) fs.rmSync(dir, { force: true, recursive: true });
  });

  it('Should refuse a document whose texts it cannot write', () => {
    // Not a flag: there is no `save` on that document's store, so the write
    // cannot be expressed at all.
    expect(() => new DocsStudio(unstored)).toThrow(/no translation store/);
  });

  it('Should take in every document that brought a writable store', () => {
    expect(studio.documents.map(d => d.ns)).toStrictEqual([undefined, 'sh']);
    expect(studio.root.id).toStrictEqual(root.id);
    // `un` has no store, and `opra` is the framework's own builtin document.
    expect(studio.documents.some(d => d.id === unstored.id)).toBe(false);
  });

  it("Should write a reference's text through that reference's own store", async () => {
    await studio.save({
      owner: reference.id,
      key: ['types', 'Shared'],
      field: 'description',
      value: 'A shared thing (edited)',
      lang: 'en',
    });
    // Where it is read back from - and nowhere else. Writing it into the
    // root's bundle would produce a key `findTexts` never looks at.
    expect(read(refDir, 'en').types.Shared.description).toStrictEqual(
      'A shared thing (edited)',
    );
    expect(fs.existsSync(path.join(rootDir, 'en.json'))).toBe(false);
  });

  it('Should refuse a text belonging to a document it cannot write', async () => {
    await expect(
      studio.save({
        owner: unstored.id,
        key: ['types', 'Unstored'],
        field: 'description',
        value: 'x',
        lang: 'en',
      }),
    ).rejects.toThrow(/cannot write to/);
  });

  it('Should refuse an edit in a language there is no bundle for', async () => {
    await expect(
      studio.save({
        owner: root.id,
        key: ['info'],
        field: 'title',
        value: 'x',
        lang: 'de',
      }),
    ).rejects.toThrow(/No bundle for language/);
  });

  it('Should fall back to the language it was opened with', async () => {
    // Trusting the query would quietly edit a bundle the caller never named.
    expect(await studio.langFor('/?lang=zz')).toStrictEqual('en');
    expect(await studio.langFor('/')).toStrictEqual('en');
    await studio.addLanguage({ lang: 'de' });
    expect(await studio.langFor('/?lang=DE')).toStrictEqual('de');
  });

  it('Should start a new language empty, and only when asked', async () => {
    expect(await studio.languages()).toStrictEqual(['en']);
    expect(await studio.addLanguage({ lang: 'de' })).toStrictEqual({
      lang: 'de',
    });
    // Empty: a fresh `de.json` full of English counts as written everywhere
    // that asks, so nothing would ever list it as outstanding.
    expect(read(rootDir, 'de').info.title).toStrictEqual('');
    expect(await studio.languages()).toStrictEqual(['de', 'en']);
  });

  it('Should refuse a language tag that is not one', async () => {
    // It becomes a filename.
    await expect(studio.addLanguage({ lang: '../etc/passwd' })).rejects.toThrow(
      /is not a language tag/,
    );
    await expect(studio.addLanguage({ lang: '' })).rejects.toThrow(
      /is not a language tag/,
    );
    expect(fs.readdirSync(rootDir)).toStrictEqual([]);
  });

  it('Should leave no bundle behind just because a page was rendered', async () => {
    await studio.addLanguage({ lang: 'de' });
    await studio.render('de');
    // The reference is translated into the languages it is translated into.
    expect(fs.existsSync(path.join(refDir, 'de.json'))).toBe(false);
  });

  it("Should embed each document's slots and bundle under its own id", async () => {
    await studio.save({
      owner: reference.id,
      key: ['types', 'Shared'],
      field: 'description',
      value: 'A shared thing (edited)',
      lang: 'en',
    });
    const html = await studio.render('en');
    // `lastIndexOf`: the page has the whole of `studio.js` inlined into it,
    // and that file names both globals in its own source - the first match is
    // the reader, not the data.
    const slots = html.slice(
      html.lastIndexOf('__OPRA_STUDIO_SLOTS__'),
      html.lastIndexOf('__OPRA_STUDIO_BUNDLE__'),
    );
    const bundles = html.slice(html.lastIndexOf('__OPRA_STUDIO_BUNDLE__'));
    for (const fragment of [slots, bundles]) {
      expect(fragment).toContain(root.id);
      expect(fragment).toContain(reference.id);
      expect(fragment).not.toContain(unstored.id);
    }
    expect(bundles).toContain('A shared thing (edited)');
    // And the page is told which of them it may offer to edit.
    expect(html).toContain('"documents"');
    expect(html).toContain('"ns":"sh"');
  });
});
