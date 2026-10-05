import 'reflect-metadata';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  extractTranslations,
  HttpController,
  HttpOperation,
  isWritableStore,
  OpraSchema,
  TranslationFileStore,
  TranslationStore,
} from '@opra/common';
import { expect } from 'expect';
import { StudioDocument } from '../src/studio/studio-document.js';

@ComplexType({ description: 'A note' })
class Note {
  @ApiField({ description: 'Note body' })
  declare text: string;
}

@HttpController({ path: 'Notes', description: 'Notes' })
class NotesController {
  @HttpOperation.GET({ title: 'List notes', description: 'Lists notes' })
  findMany() {
    //
  }
}

describe('api-ui:StudioDocument', () => {
  let document: ApiDocument;
  let dir: string;
  let studio: StudioDocument;

  beforeEach(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-studio-test-'));
    // A fresh document per test: bundles are materialized onto the document
    // and kept there, so one built once would carry the previous test's.
    document = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Note],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [NotesController],
      },
      translationStore: new TranslationFileStore(dir),
    });
    studio = new StudioDocument(
      document,
      document.translationStore as TranslationFileStore,
    );
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('Should admit only a store that can be written to', () => {
    class ReadOnlyStore extends TranslationStore {
      async listLanguages() {
        return [];
      }
      async load() {
        return undefined;
      }
    }
    // The whole admission rule: a document whose bundles came from somewhere
    // unwritable is read-only because the write cannot be expressed.
    expect(isWritableStore(document.translationStore)).toBe(true);
    expect(isWritableStore(new ReadOnlyStore())).toBe(false);
    expect(isWritableStore(undefined)).toBe(false);
  });

  it('Should create the bundle from the document when there is none yet', async () => {
    const bundle: any = await studio.bundle('en');
    expect(bundle.types.Note.description).toStrictEqual('A note');
    expect(fs.existsSync(path.join(dir, 'en.json'))).toBe(true);
  });

  it('Should write exactly what docs:extract would write', async () => {
    // A studio session must not turn the next extraction into a diff — so
    // the serialization, down to the trailing newline, has to match.
    await studio.bundle('en');
    expect(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).toStrictEqual(
      JSON.stringify(extractTranslations(document).bundle, null, 2) + '\n',
    );
  });

  it('Should set a text at its key without disturbing the rest', async () => {
    await studio.bundle('en');
    const before = fs.readFileSync(path.join(dir, 'en.json'), 'utf-8');
    await studio.set(
      'en',
      ['api', 'controllers', 'Notes', 'operations', 'findMany'],
      'title',
      'Every note',
    );
    expect(fs.readFileSync(path.join(dir, 'en.json'), 'utf-8')).toStrictEqual(
      before.replace('"List notes"', '"Every note"'),
    );
  });

  it('Should keep key order, so re-extracting stays a no-op', async () => {
    // `mergeExisting` starts from the parsed file, so order is whatever the
    // file had — rebuilding the object instead of mutating it in place would
    // reorder keys and rewrite the whole file for a one-word edit.
    await studio.set('en', ['types', 'Note'], 'description', 'A note (edited)');
    const saved = fs.readFileSync(path.join(dir, 'en.json'), 'utf-8');
    expect(
      JSON.stringify(
        extractTranslations(document, JSON.parse(saved)).bundle,
        null,
        2,
      ) + '\n',
    ).toStrictEqual(saved);
  });

  it('Should create a missing path rather than dropping the edit', async () => {
    // The source may never have declared the text at all — that is the whole
    // point of writing it here.
    await studio.set('en', ['api', 'controllers', 'Notes'], 'title', 'Notes');
    const reloaded: any = await studio.store.load('en');
    expect(reloaded.api.controllers.Notes.title).toStrictEqual('Notes');
  });

  it('Should create a new translation empty, not full of the source language', async () => {
    // A fresh `de.json` holding English is not a translation, but it counts
    // as written everywhere that asks — so nothing would ever list it as
    // outstanding and the studio's checklist would open at 100%.
    const de: any = await studio.bundle('de');
    expect(de.types.Note.description).toStrictEqual('');
    expect(de.api.controllers.Notes.operations.findMany.title).toStrictEqual(
      '',
    );
    // Same shape as the source bundle, so a later docs:extract merges onto it
    // rather than rewriting it.
    const shape = (bundle: any): any =>
      typeof bundle === 'string'
        ? ''
        : Object.fromEntries(
            Object.entries(bundle).map(([k, v]) => [k, shape(v)]),
          );
    expect(shape(de)).toStrictEqual(shape(await studio.bundle('en')));
  });

  it('Should not create anything just to render a page', async () => {
    // Rendering in a language a document has never been translated into must
    // not leave a blank bundle behind — a reference is translated into the
    // languages it is translated into.
    expect(studio.peek('fr')).toEqual({});
    expect(fs.existsSync(path.join(dir, 'fr.json'))).toBe(false);
  });

  it('Should report the file a language is written to', async () => {
    // A document keys its bundles lower-case in memory, but `zh-Hant.json` on
    // disk should stay `zh-Hant.json`.
    fs.writeFileSync(path.join(dir, 'zh-Hant.json'), '{}\n', 'utf-8');
    expect(path.basename((await studio.filename('zh-hant'))!)).toStrictEqual(
      'zh-Hant.json',
    );
  });

  it('Should carry the owning document id and namespace', () => {
    // What a block of prose stamps as `_docOwner`, and what a save is routed
    // by: the page renders nodes from several documents at once.
    const reference = new StudioDocument(document, studio.store, 'cm');
    expect(reference.id).toStrictEqual(document.id);
    expect(reference.ns).toStrictEqual('cm');
    expect(studio.ns).toBeUndefined();
  });

  it('Should list the keys the document declares', () => {
    expect(studio.slots()).toContain('["types","Note","description"]');
    expect(studio.slots()).toContain(
      '["api","controllers","Notes","operations","findMany","title"]',
    );
  });
});
