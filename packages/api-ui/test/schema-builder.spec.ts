import 'reflect-metadata';
import {
  ApiDocument,
  ApiDocumentFactory,
  ApiField,
  ArrayType,
  ComplexType,
  HttpController,
  HttpOperation,
  OpraSchema,
  UnionType,
} from '@opra/common';
import { expect } from 'expect';
import { ApiUiSchemaBuilder } from '../src/schema-builder.js';

@ComplexType({ description: 'A dog' })
class Dog {
  @ApiField({ required: true })
  declare name: string;

  @(ApiField({ readonly: true }).Override('db', { readonly: false }))
  declare id: string;
}

@ComplexType({ description: 'A cat' })
class Cat {
  @ApiField({ required: true })
  declare name: string;
}

@ComplexType({ description: 'A puppy' })
class Puppy extends Dog {
  @ApiField()
  declare birthDate?: Date;
}

@ComplexType({ description: 'A kennel' })
class Kennel {
  // Explicit ArrayType wrapper — as opposed to `@ApiField({ type: Dog })`
  // with a `Dog[]` TS annotation, which sets the deprecated `isArray` flag
  // instead and is deliberately NOT treated as an array by this package.
  @ApiField({ type: ArrayType(Dog) })
  declare dogs?: Dog[];

  @ApiField({ type: UnionType([Dog, Cat]) })
  declare pet?: any;
}

describe('api-ui:ApiUiSchemaBuilder', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Dog, Cat, Puppy, Kennel],
      api: { transport: 'http', name: 'TestApi', controllers: [] },
    });
  });

  it('Should register every reachable named type under "types"', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.types.Dog).toBeDefined();
    expect(schema.types.Cat).toBeDefined();
    expect(schema.types.Kennel).toBeDefined();
  });

  it("Should reference an ArrayType field's item type by name, not inline", () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    const dogsField = schema.types.Kennel.fields.dogs;
    expect(dogsField.type.kind).toStrictEqual('ArrayType');
    expect(dogsField.type.type).toStrictEqual('Dog');
  });

  it('Should map a UnionType field to a "types" array of named references', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    const petField = schema.types.Kennel.fields.pet;
    expect(petField.type.kind).toStrictEqual('UnionType');
    expect(petField.type.types).toEqual(expect.arrayContaining(['Dog', 'Cat']));
  });

  it('Should describe a plain `extends` as "extends" naming the base type', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.types.Puppy.inherits).toStrictEqual({
      kind: 'extends',
      types: ['Dog'],
    });
  });

  it('Should mark an inherited field with "from" naming the base type', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.types.Puppy.fields.name.from).toStrictEqual('Dog');
    expect(schema.types.Puppy.fields.birthDate.from).toBeUndefined();
  });

  it('Should apply a field.Override() for the requested scope, not just its base metadata', () => {
    const noScope: any = ApiUiSchemaBuilder.build(doc);
    expect(noScope.types.Dog.fields.id.readonly).toStrictEqual(true);
    const dbScope: any = ApiUiSchemaBuilder.build(doc, { scope: 'db' });
    expect(dbScope.types.Dog.fields.id.readonly).toBeUndefined();
  });
});

describe('api-ui:ApiUiSchemaBuilder (sections/title)', () => {
  @HttpController({ path: 'Dogs' })
  class DogsController {
    @HttpOperation.GET({ title: 'List dogs', sections: ['Pets'] })
    findMany() {
      //
    }
  }

  let doc: ApiDocument;

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      api: {
        transport: 'http',
        name: 'TestApi',
        sections: [{ name: 'Pets', description: 'Pet management', icon: '🐶' }],
        controllers: [DogsController],
      },
    });
  });

  it('Should expose HttpApi#sections under "api.sections"', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    expect(schema.api.sections).toStrictEqual([
      { name: 'Pets', description: 'Pet management', icon: '🐶' },
    ]);
  });

  it("Should expose an operation's #title and #sections", () => {
    const schema: any = ApiUiSchemaBuilder.build(doc);
    const op = schema.api.controllers.Dogs.operations.findMany;
    expect(op.title).toStrictEqual('List dogs');
    expect(op.sections).toStrictEqual(['Pets']);
  });
});

describe('api-ui:ApiUiSchemaBuilder (translations)', () => {
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

    @(HttpOperation.POST({
      requestBody: { description: 'The note to create' },
    }).RequestContent({ contentType: 'application/json', type: Note }))
    create() {
      //
    }

    @(HttpOperation.POST({ requestBody: { description: 'Anything' } })
      .RequestContent({ contentType: 'application/json', type: Note })
      .RequestContent({ contentType: 'text/plain', type: 'string' }))
    upload() {
      //
    }
  }

  let doc: ApiDocument;
  let create: unknown;
  let upload: unknown;

  const bodyKey = (op: string) => [
    'api',
    'controllers',
    'Notes',
    'operations',
    op,
    'requestBody',
  ];

  before(async () => {
    doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'TestApi', version: 'v1' },
      types: [Note],
      api: {
        transport: 'http',
        name: 'TestApi',
        servers: [{ url: 'http://x', description: 'Prod', docKey: 'prod' }],
        sections: [{ name: 'Pets', description: 'Pet management' }],
        controllers: [NotesController],
      },
      translations: {
        tr: {
          api: {
            servers: { prod: { description: 'Üretim' } },
            sections: { Pets: { description: 'Evcil hayvan yönetimi' } },
            controllers: {
              Notes: {
                operations: { findMany: { title: 'Notları listele' } },
              },
            },
          },
        },
      },
    } as any);
    const authored: any = ApiUiSchemaBuilder.build(doc, { authoring: true });
    create = authored.api.controllers.Notes.operations.create;
    upload = authored.api.controllers.Notes.operations.upload;
  });

  it('Should translate a server/section description, which used to pass through raw', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc, { lang: 'tr' });
    expect(schema.api.servers[0].description).toStrictEqual('Üretim');
    expect(schema.api.sections[0].description).toStrictEqual(
      'Evcil hayvan yönetimi',
    );
  });

  it('Should never ship docKey, which is an authoring aid', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc, { lang: 'tr' });
    expect(schema.api.servers[0].docKey).toBeUndefined();
    expect(JSON.stringify(schema)).not.toContain('docKey');
  });

  it('Should add nothing at all to the payload unless authoring is on', () => {
    // The overwhelmingly common case is a page nobody is editing; it should
    // not pay a byte for the studio's benefit.
    const plain = ApiUiSchemaBuilder.build(doc, { lang: 'tr' });
    expect(JSON.stringify(plain)).not.toContain('_doc');
  });

  it('Should key every translatable node by where its text actually lives', () => {
    const schema: any = ApiUiSchemaBuilder.build(doc, {
      lang: 'tr',
      authoring: true,
    });
    const op = schema.api.controllers.Notes.operations.findMany;
    expect(op._docKey).toStrictEqual([
      'api',
      'controllers',
      'Notes',
      'operations',
      'findMany',
    ]);
    expect(op._docFields).toStrictEqual(['title', 'description']);
    expect(schema.api.controllers.Notes._docKey).toStrictEqual([
      'api',
      'controllers',
      'Notes',
    ]);
    expect(schema.types.Note._docKey).toStrictEqual(['types', 'Note']);
    expect(schema.types.Note.fields.text._docKey).toStrictEqual([
      'types',
      'Note',
      'fields',
      'text',
    ]);
    // `info` is the one place translation doesn't go through
    // `applyTranslations`, so its key is stamped by hand.
    expect(schema.info._docKey).toStrictEqual(['info']);
    // A server keys off its `docKey` rather than its environment-dependent url.
    expect(schema.api.servers[0]._docKey).toStrictEqual([
      'api',
      'servers',
      'prod',
    ]);
    expect(schema.api.sections[0]._docKey).toStrictEqual([
      'api',
      'sections',
      'Pets',
    ]);
  });

  it('Should flag a server with no docKey as an unstable key', () => {
    // A url is environment-dependent; documentation keyed by it detaches the
    // moment the url changes.
    expect(
      (ApiUiSchemaBuilder.build(doc, { authoring: true }) as any).api.servers[0]
        ._docKeyUnstable,
    ).toBeUndefined();
  });

  it('Should not resolve one text into two nodes when a body has a single content', () => {
    // A lone media type shares its body's documentation key (it adds no level
    // of its own — `HttpMediaType#docKeySegment`), so both used to resolve
    // `…requestBody.description`: the same sentence printed twice, and two
    // places to edit one bundle entry.
    const body = (create as any).requestBody;
    expect(body.description).toStrictEqual('The note to create');
    expect(body.content).toHaveLength(1);
    expect(body.content[0].description).toBeUndefined();
    expect(body.content[0]._docKey).toBeUndefined();
  });

  it('Should still key a media type of its own when the body declares several', () => {
    const body = (upload as any).requestBody;
    expect(body.content).toHaveLength(2);
    expect(body.content.map((c: any) => c._docKey)).toStrictEqual([
      [...bodyKey('upload'), 'content', 'application/json'],
      [...bodyKey('upload'), 'content', 'text/plain'],
    ]);
  });
});
