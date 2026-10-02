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

@ComplexType({ description: 'A customer (source text)' })
class Customer {
  @ApiField({ description: 'Name (source text)' })
  declare name: string;

  // A field literally called `description` is what makes the container
  // names in the key ("fields") load-bearing rather than cosmetic.
  @ApiField({ description: 'Notes (source text)' })
  declare description: string;

  @ApiField({ deprecated: 'Use name (source text)' })
  declare fullName: string;

  @ApiField({ deprecated: true })
  declare legacy: string;
}

@HttpController({ path: 'Customers', description: 'Customers (source text)' })
class CustomersController {
  @(HttpOperation.GET({
    description: 'Get a customer (source text)',
    title: 'Get customer',
  })
    .PathParam('customerId', { description: 'Id (source text)' })
    .QueryParam(/^x-\w+/, { docKey: 'xprefixed', description: 'X (source)' })
    .Response(200, { description: 'OK (source text)' })
    .Response(422, { description: 'Invalid (source text)' }))
  get() {
    //
  }
}

const enTranslations = {
  info: { title: 'Test API (en)', description: 'Doc description (en)' },
  types: {
    Customer: {
      description: 'A customer (en)',
      fields: {
        name: { description: 'Name (en)' },
        description: { description: 'Notes (en)' },
        fullName: { deprecated: 'Use name (en)' },
        legacy: { deprecated: 'should be ignored' },
      },
    },
  },
  api: {
    controllers: {
      Customers: {
        description: 'Customers (en)',
        operations: {
          get: {
            title: 'Get customer (en)',
            description: 'Get a customer (en)',
            parameters: {
              customerId: { description: 'Id (en)' },
              xprefixed: { description: 'X (en)' },
            },
            responses: {
              '200': { description: 'OK (en)' },
              '422': { description: 'Invalid (en)' },
            },
          },
        },
      },
    },
  },
};

const trTranslations = {
  types: { Customer: { fields: { name: { description: 'Ad (tr)' } } } },
};

async function createDocument(
  init?: Record<string, any>,
): Promise<ApiDocument> {
  return ApiDocumentFactory.createDocument({
    spec: OpraSchema.SpecVersion,
    info: { title: 'Test API (source)', version: 'v1' },
    types: [Customer],
    api: {
      transport: 'http',
      name: 'TestApi',
      controllers: [CustomersController],
      servers: [{ url: 'http://x.test', description: 'Server (source)' }],
      sections: [{ name: 'Customers', description: 'Section (source)' }],
    },
    ...init,
  } as any);
}

describe('common:translations', () => {
  it("Should translate a license's own text, but not its name or url", async () => {
    const doc = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: {
        title: 'T',
        version: '1',
        license: { name: 'MIT', url: 'https://x.test', content: 'EN text' },
      },
      translations: {
        tr: { info: { license: { content: 'TR metni' } } },
      },
    } as any);
    const info: any = (doc.export({ lang: 'tr' }) as any).info;
    expect(info.license.content).toStrictEqual('TR metni');
    expect(info.license.name).toStrictEqual('MIT');
    expect(info.license.url).toStrictEqual('https://x.test');
  });

  it('Should export the source texts as-is when no language is requested', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const schema: any = doc.export();
    expect(schema.info.title).toStrictEqual('Test API (source)');
    expect(schema.types.Customer.description).toStrictEqual(
      'A customer (source text)',
    );
  });

  it('Should resolve texts from the requested language bundle', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const schema: any = doc.export({ lang: 'en' });
    expect(schema.info.title).toStrictEqual('Test API (en)');
    expect(schema.info.description).toStrictEqual('Doc description (en)');
    expect(schema.types.Customer.description).toStrictEqual('A customer (en)');
    expect(schema.api.controllers.Customers.description).toStrictEqual(
      'Customers (en)',
    );
    const op = schema.api.controllers.Customers.operations.get;
    expect(op.description).toStrictEqual('Get a customer (en)');
    expect(op.title).toStrictEqual('Get customer (en)');
  });

  it('Should keep a field named "description" separate from its own type\'s', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const schema: any = doc.export({ lang: 'en' });
    expect(schema.types.Customer.description).toStrictEqual('A customer (en)');
    expect(schema.types.Customer.fields.description.description).toStrictEqual(
      'Notes (en)',
    );
    expect(schema.types.Customer.fields.name.description).toStrictEqual(
      'Name (en)',
    );
  });

  it('Should key array members by their own identity, not their index', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const op: any = (doc.export({ lang: 'en' }) as any).api.controllers
      .Customers.operations.get;
    const byName = (name: string) =>
      op.parameters.find((p: any) => String(p.name) === name);
    expect(byName('customerId').description).toStrictEqual('Id (en)');
    const r200 = op.responses.find((r: any) => r.statusCode === 200);
    const r422 = op.responses.find((r: any) => r.statusCode === 422);
    expect(r200.description).toStrictEqual('OK (en)');
    expect(r422.description).toStrictEqual('Invalid (en)');
  });

  it('Should address a RegExp-named parameter through its docKey', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const op: any = (doc.export({ lang: 'en' }) as any).api.controllers
      .Customers.operations.get;
    const prm = op.parameters.find((p: any) => p.name instanceof RegExp);
    expect(prm).toBeDefined();
    expect(prm.description).toStrictEqual('X (en)');
  });

  it('Should never export docKey itself', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const json = JSON.stringify(doc.export({ lang: 'en' }));
    expect(json).not.toContain('docKey');
    expect(json).not.toContain('xprefixed');
  });

  it('Should translate "deprecated" only where it already is a reason', async () => {
    const doc = await createDocument({ translations: { en: enTranslations } });
    const fields: any = (doc.export({ lang: 'en' }) as any).types.Customer
      .fields;
    expect(fields.fullName.deprecated).toStrictEqual('Use name (en)');
    // `deprecated: true` is a flag, not prose — a translation must not turn
    // it into text.
    expect(fields.legacy.deprecated).toStrictEqual(true);
  });

  it('Should translate servers and sections through their own keys', async () => {
    const doc = await createDocument({
      translations: {
        en: {
          api: {
            servers: { 'http://x.test': { description: 'Server (en)' } },
            sections: { Customers: { description: 'Section (en)' } },
          },
        },
      },
    });
    const api: any = (doc.export({ lang: 'en' }) as any).api;
    expect(api.servers[0].description).toStrictEqual('Server (en)');
    expect(api.sections[0].description).toStrictEqual('Section (en)');
  });

  it('Should fall back tr-TR -> tr -> default -> first available', async () => {
    const doc = await createDocument({
      translations: { en: enTranslations, tr: trTranslations },
    });
    // tr-TR has no bundle of its own; the base language answers.
    expect(doc.resolveLanguage('tr-TR')).toStrictEqual('tr');
    // An unknown language falls back to the default one.
    expect(doc.resolveLanguage('zz')).toStrictEqual('en');
    const schema: any = doc.export({ lang: 'tr-TR' });
    expect(schema.types.Customer.fields.name.description).toStrictEqual(
      'Ad (tr)',
    );
    // A key the tr bundle does not define keeps the source text rather than
    // silently borrowing another language's.
    expect(schema.types.Customer.description).toStrictEqual(
      'A customer (source text)',
    );
  });

  it('Should fall back to the first language when neither the requested nor the default exists', async () => {
    const doc = await createDocument({
      translations: { tr: trTranslations, de: {} },
      defaultLanguage: 'en',
    });
    expect(doc.resolveLanguage('zz')).toStrictEqual('de');
  });

  it('Should extract a skeleton shaped like the schema, pre-filled from the source', async () => {
    const doc = await createDocument();
    const { bundle } = extractTranslations(doc);
    const b: any = bundle;
    expect(b.info.title).toStrictEqual('Test API (source)');
    expect(b.types.Customer.description).toStrictEqual(
      'A customer (source text)',
    );
    expect(b.types.Customer.fields.description.description).toStrictEqual(
      'Notes (source text)',
    );
    expect(
      b.api.controllers.Customers.operations.get.responses['200'].description,
    ).toStrictEqual('OK (source text)');
    // Every translatable slot is listed, empty when the source says
    // nothing — that is what a translator needs to see, and what keeps
    // re-extraction from dropping a key once the text has moved out of the
    // source entirely.
    expect(b.types.Customer.fields.legacy).toStrictEqual({ description: '' });
    // ...except `deprecated`, which a bundle may only reword, never invent.
    expect(b.types.Customer.fields.legacy.deprecated).toBeUndefined();
  });

  it("Should not let a reference's own info leak into the extracted bundle", async () => {
    const reference = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Reference doc', version: '1', description: 'Ref desc' },
    } as any);
    const doc = await createDocument({ references: { ref: reference } });
    const b: any = extractTranslations(doc).bundle;
    // The reference is extracted from its own document, into its own file.
    expect(b.info.title).toStrictEqual('Test API (source)');
    expect(b.info.description).toStrictEqual('');
  });

  it("Should not extract a reference's types into the importing bundle", async () => {
    // Same rule the `info` above follows, and the one `findTexts` enforces on
    // the way back: a node's texts live in the bundle of the document that
    // declares it. Collecting an imported type here produced a key nobody
    // reads - the author translates it and the page keeps showing the source.
    @ComplexType({ description: 'A shared thing (source)' })
    class Shared {
      @ApiField({ description: 'Its name (source)' })
      declare name: string;
    }
    const reference = await ApiDocumentFactory.createDocument({
      spec: OpraSchema.SpecVersion,
      info: { title: 'Reference doc', version: '1' },
      types: [Shared],
    } as any);
    const doc = await createDocument({ references: { ref: reference } });

    const b: any = extractTranslations(doc).bundle;
    expect(b.types.Shared).toBeUndefined();
    expect(b.types.Customer).toBeDefined();

    // It is extractable - from the document that owns it.
    const own: any = extractTranslations(reference).bundle;
    expect(own.types.Shared.description).toStrictEqual(
      'A shared thing (source)',
    );
  });

  it('Should report keys that have no stable identifier behind them', async () => {
    const doc = await createDocument();
    const { unstable } = extractTranslations(doc);
    // The server's url is environment-dependent; the regexp-named parameter
    // was given a docKey, so it is not reported.
    expect(unstable).toContain('api.servers.http://x.test');
    expect(unstable.some(k => k.includes('xprefixed'))).toBe(false);
  });

  it('Should keep existing translations and report the ones no longer asked for', async () => {
    const doc = await createDocument();
    const { bundle, orphans } = extractTranslations(doc, {
      types: {
        Customer: {
          description: 'Bir müşteri (tr)',
          fields: { gone: { description: 'Artık yok' } },
        },
      },
    });
    const b: any = bundle;
    expect(b.types.Customer.description).toStrictEqual('Bir müşteri (tr)');
    // Untranslated keys fall back to the source text rather than going missing.
    expect(b.types.Customer.fields.name.description).toStrictEqual(
      'Name (source text)',
    );
    expect(orphans).toContain('types.Customer.fields.gone');
  });

  it('Should keep the document id independent of its translations', async () => {
    const plain = await createDocument();
    const translated = await createDocument({
      translations: { en: enTranslations },
    });
    expect(translated.id).toStrictEqual(plain.id);
  });
});
