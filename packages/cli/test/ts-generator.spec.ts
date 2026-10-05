import 'reflect-metadata';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  type ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  HttpController,
  HttpOperation,
  OpraSchema,
} from '@opra/common';
import { expect } from 'expect';
import { TsGenerator } from '../src/index.js';

@ComplexType({ description: 'A cat' })
class Cat {
  @ApiField({ required: true })
  declare name: string;
}

@HttpController({ path: 'Cats' })
class CatsController {
  @HttpOperation.GET()
  findMany() {
    //
  }
}

describe('cli:TsGenerator', () => {
  let document: ApiDocument;

  before(async () => {
    document = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Cat],
      api: {
        transport: 'http',
        name: 'TestApi',
        controllers: [CatsController],
      },
    });
  });

  describe('generateFiles()', () => {
    it('Should generate files in memory, with no serviceUrl/network access', async () => {
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(document);
      expect(files.length).toBeGreaterThan(0);
      expect(
        files.every(
          f => typeof f.filename === 'string' && typeof f.content === 'string',
        ),
      ).toBe(true);
    });

    it('Should include a data type it was given', async () => {
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(document);
      const catFile = files.find(f => /\bCat\b/.test(f.content));
      expect(catFile).toBeDefined();
    });

    it('Should memoize across repeated calls instead of regenerating', async () => {
      const generator = new TsGenerator({ outDir: '/unused' });
      const first = await generator.generateFiles(document);
      const second = await generator.generateFiles(document);
      expect(second).toBe(first);
    });

    it('Should throw a clear error when neither serviceUrl nor a document is given', async () => {
      const generator = new TsGenerator({ outDir: '/unused' });
      await expect(generator.generateFiles()).rejects.toThrow(
        /serviceUrl.*ApiDocument/,
      );
    });

    it('Should include a README.md describing the generated package', async () => {
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(document);
      const readme = files.find(f => f.filename === '/README.md');
      expect(readme).toBeDefined();
      expect(readme!.content).toContain('TestApi');
      expect(readme!.content).toContain('v1');
    });

    it('Should convert Docusaurus admonition blocks in the description to plain blockquotes', async () => {
      const docWithAdmonition = await ApiDocumentFactory.createDocument({
        spec: OpraSchema.SpecVersion,
        info: {
          title: 'TestApi',
          version: 'v1',
          description:
            'Intro text.\n\n:::tip\nSwitch scopes from the picker.\n:::',
        },
        types: [Cat],
      });
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(docWithAdmonition);
      const readme = files.find(f => f.filename === '/README.md');
      expect(readme!.content).not.toContain(':::');
      expect(readme!.content).toContain('> **Tip**');
      expect(readme!.content).toContain('> Switch scopes from the picker.');
    });

    it('Should not include a LICENSE file when the document declares no license', async () => {
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(document);
      expect(files.find(f => f.filename === '/LICENSE')).toBeUndefined();
    });

    it("Should include a LICENSE file with the license's own full text when the document provides one", async () => {
      const licensedDoc = await ApiDocumentFactory.createDocument({
        spec: OpraSchema.SpecVersion,
        info: {
          title: 'TestApi',
          version: 'v1',
          license: {
            name: 'MIT',
            url: 'https://x.test/mit',
            content: 'MIT license text',
          },
        },
        types: [Cat],
      });
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(licensedDoc);
      const license = files.find(f => f.filename === '/LICENSE');
      expect(license).toBeDefined();
      expect(license!.content).toBe('MIT license text');
    });

    it('Should fall back to a name/url stub when the license has no full text', async () => {
      const licensedDoc = await ApiDocumentFactory.createDocument({
        spec: OpraSchema.SpecVersion,
        info: {
          title: 'TestApi',
          version: 'v1',
          license: { name: 'MIT', url: 'https://x.test/mit' },
        },
        types: [Cat],
      });
      const generator = new TsGenerator({ outDir: '/unused' });
      const files = await generator.generateFiles(licensedDoc);
      const license = files.find(f => f.filename === '/LICENSE');
      expect(license!.content).toContain('MIT');
      expect(license!.content).toContain('https://x.test/mit');
    });
  });

  describe('generate()', () => {
    let outDir: string;

    beforeEach(() => {
      outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opra-cli-test-'));
    });
    afterEach(() => {
      fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('Should write the same files generateFiles() produces to disk', async () => {
      const memGenerator = new TsGenerator({ outDir: '/unused' });
      const files = await memGenerator.generateFiles(document);

      const generator = new TsGenerator({ outDir });
      await generator.generate(document);

      for (const file of files) {
        const fullPath = path.join(outDir, file.filename);
        expect(fs.existsSync(fullPath)).toBe(true);
        expect(fs.readFileSync(fullPath, 'utf-8')).toStrictEqual(file.content);
      }
    });
  });
});
