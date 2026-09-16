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
  OpraSchema,
} from '@opra/common';
import { expect } from 'expect';
import { BundleFile } from '../src/docs-studio/bundle-file.js';

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

describe('cli:BundleFile', () => {
  let document: ApiDocument;
  let dir: string;

  before(async () => {
    document = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Note],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [NotesController],
      },
    });
  });

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-studio-test-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('Should create the bundle from the document when there is none yet', () => {
    const file = BundleFile.open(dir, 'en', document);
    expect(fs.existsSync(file.filename)).toBe(true);
    expect(file.get(['types', 'Note'], 'description')).toStrictEqual('A note');
  });

  it('Should write exactly what docs:extract would write', () => {
    // A studio session must not turn the next extraction into a diff — so
    // the serialization, down to the trailing newline, has to match.
    BundleFile.open(dir, 'en', document);
    const written = fs.readFileSync(path.join(dir, 'en.json'), 'utf-8');
    const expected =
      JSON.stringify(extractTranslations(document).bundle, null, 2) + '\n';
    expect(written).toStrictEqual(expected);
  });

  it('Should set a text at its key without disturbing the rest', () => {
    const file = BundleFile.open(dir, 'en', document);
    const before = fs.readFileSync(file.filename, 'utf-8');
    file.set(
      ['api', 'controllers', 'Notes', 'operations', 'findMany'],
      'title',
      'Every note',
    );
    file.write();
    const after = fs.readFileSync(file.filename, 'utf-8');
    expect(after).toStrictEqual(before.replace('"List notes"', '"Every note"'));
  });

  it('Should keep key order, so re-extracting stays a no-op', () => {
    // `mergeExisting` starts from the parsed file, so order is whatever the
    // file had — rebuilding the object instead of mutating it in place would
    // reorder keys and rewrite the whole file for a one-word edit.
    const file = BundleFile.open(dir, 'en', document);
    file.set(['types', 'Note'], 'description', 'A note (edited)');
    file.write();
    const saved = fs.readFileSync(file.filename, 'utf-8');
    const reExtracted =
      JSON.stringify(
        extractTranslations(document, JSON.parse(saved)).bundle,
        null,
        2,
      ) + '\n';
    expect(reExtracted).toStrictEqual(saved);
  });

  it('Should create a missing path rather than dropping the edit', () => {
    // The source may never have declared the text at all — that is the whole
    // point of writing it here.
    const file = BundleFile.open(dir, 'en', document);
    file.set(['api', 'controllers', 'Notes'], 'title', 'Notes');
    file.write();
    const reopened = BundleFile.open(dir, 'en', document);
    expect(
      reopened.get(['api', 'controllers', 'Notes'], 'title'),
    ).toStrictEqual('Notes');
  });

  it('Should create a new translation empty, not full of the source language', () => {
    // A fresh `de.json` holding English is not a translation, but it counts
    // as written everywhere that asks — so nothing would ever list it as
    // outstanding and the studio's checklist would open at 100%.
    const file = BundleFile.open(dir, 'de', document, { blank: true });
    expect(file.get(['types', 'Note'], 'description')).toStrictEqual('');
    expect(
      file.get(
        ['api', 'controllers', 'Notes', 'operations', 'findMany'],
        'title',
      ),
    ).toStrictEqual('');
    // Same shape as the source bundle, so a later docs:extract merges onto it
    // rather than rewriting it.
    const shape = (bundle: any): any =>
      typeof bundle === 'string'
        ? ''
        : Object.fromEntries(
            Object.entries(bundle).map(([k, v]) => [k, shape(v)]),
          );
    BundleFile.open(dir, 'en', document);
    const source = JSON.parse(
      fs.readFileSync(path.join(dir, 'en.json'), 'utf-8'),
    );
    expect(shape(file.bundle)).toStrictEqual(shape(source));
  });

  it('Should reuse an existing file rather than renaming it by case', () => {
    // A document keys its bundles lower-case in memory, but `zh-Hant.json` on
    // disk should stay `zh-Hant.json`.
    fs.writeFileSync(path.join(dir, 'zh-Hant.json'), '{}\n', 'utf-8');
    const file = BundleFile.open(dir, 'zh-hant', document);
    expect(path.basename(file.filename)).toStrictEqual('zh-Hant.json');
  });
});
