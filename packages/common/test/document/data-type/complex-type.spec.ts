import { ApiDocument, parseFieldsProjection } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../_support/test-http-api/index.js';

describe('common:ComplexType', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should findField(name) return field instance', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    const f = dt!.findField('countryCode');
    expect(f).toBeDefined();
    expect(f!.name).toStrictEqual('countryCode');
  });

  it('Should findField(name) do case-insensitive search', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    const f = dt!.findField('countrycode');
    expect(f).toBeDefined();
    expect(f!.name).toStrictEqual('countryCode');
  });

  it('Should findField(name, scope) return field instance', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    const f = dt!.findField('dbField', 'db');
    expect(f).toBeDefined();
    expect(f!.name).toStrictEqual('dbField');
  });

  it('Should findField(name, scope) not return out of scope field instance', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    const f = dt!.findField('dbField', 'api');
    expect(f).not.toBeDefined();
  });

  it('Should findField(name, scope) return override field instance', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    let f = dt!.getField('createdAt');
    expect(f.readonly).toEqual(true);
    f = dt!.getField('createdAt', 'db');
    expect(f!.readonly).toEqual(false);
  });

  it('Should findField(path) return nested fields', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    const f = dt!.findField('country.phonecode');
    expect(f).toBeDefined();
    expect(f!.owner!.name).toStrictEqual('Country');
    expect(f!.name).toStrictEqual('phoneCode');
  });

  it('Should findField(path) return "undefined" if field not found', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    expect(dt!.findField('nofield')).not.toBeDefined();
  });

  it('Should getField(path) throw if field not found', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    expect(() => dt!.getField('nofield')).toThrow('does not exist');
  });

  it('Should getField(path) throw if given path is not valid', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    expect(() => dt!.getField('givenName.code')).toThrow('field is not');
  });

  it('Should getField(name, scope) return field instance', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    const f = dt!.getField('dbField', 'db');
    expect(f).toBeDefined();
    expect(f!.name).toStrictEqual('dbField');
  });

  it('Should normalizeFieldPath() return normalized field name array', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    let x: any = dt!.normalizeFieldPath('countrycode');
    expect(x).toBeDefined();
    expect(x).toStrictEqual('countryCode');
    expect(dt).toBeDefined();
    x = dt!.normalizeFieldPath('address.countrycode');
    expect(x).toBeDefined();
    expect(x).toStrictEqual('address.countryCode');
  });

  it('Should toJSON() return schema', async () => {
    const dt = doc.node.getComplexType('country');
    expect(dt).toBeDefined();
    const x = dt!.toJSON();
    expect(x).toBeDefined();
    expect(x).toStrictEqual({
      kind: 'ComplexType',
      description: 'Country information',
      fields: {
        code: {
          type: 'string',
        },
        name: {
          type: 'string',
        },
        phoneCode: {
          type: 'string',
        },
      },
    });
  });

  it('Should toJSON(scope) return schema', async () => {
    const dt = doc.node.getComplexType('customer');
    expect(dt).toBeDefined();
    let x = dt!.toJSON();
    expect(x).toBeDefined();
    expect(x.fields!.dbField).not.toBeDefined();
    x = dt!.toJSON({ scope: 'db' });
    expect(x).toBeDefined();
    expect(x.fields!.dbField).toBeDefined();
  });

  describe('_generateSchema()', () => {
    it('Should _generate ValGen schema', async () => {
      const dt = doc.node.getComplexType('Customer');
      const x: any = (dt as any)._generateSchema('decode', {});
      expect(x).toBeDefined();
      const o = Object.keys(x).reduce((a, k) => {
        a[k] = x[k].name;
        return a;
      }, {});
      expect(o).toStrictEqual({
        _id: 'optional',
        deleted: 'optional',
        createdAt: 'optional',
        date2: 'optional',
        updatedAt: 'optional',
        givenName: 'optional',
        familyName: 'optional',
        gender: 'optional',
        birthDate: 'optional',
        uid: 'optional',
        active: 'optional',
        countryCode: 'optional',
        rate: 'required',
        address: 'isUndefined',
        notes: 'isUndefined',
        phoneNumbers: 'isUndefined',
        country: 'isUndefined',
        hasBranch: 'optional',
        tags: 'optional',
        dbField: 'isUndefined',
      });
    });

    it('Should _generate ValGen schema for given scope', async () => {
      const dt = doc.node.getComplexType('Customer');
      const x: any = (dt as any)._generateSchema('decode', { scope: 'db' });
      expect(x).toBeDefined();
      const o = Object.keys(x).reduce((a, k) => {
        a[k] = x[k].name;
        return a;
      }, {});
      expect(o).toStrictEqual({
        _id: 'optional',
        deleted: 'optional',
        createdAt: 'optional',
        updatedAt: 'optional',
        date2: 'optional',
        givenName: 'optional',
        familyName: 'optional',
        gender: 'optional',
        birthDate: 'optional',
        uid: 'optional',
        active: 'optional',
        countryCode: 'optional',
        rate: 'required',
        address: 'isUndefined',
        notes: 'isUndefined',
        phoneNumbers: 'isUndefined',
        country: 'isUndefined',
        tags: 'optional',
        dbField: 'optional',
        hasBranch: 'optional',
      });
    });

    it('Should ignore exclusive fields by default', async () => {
      const dt = doc.node.getComplexType('Note');
      const x: any = (dt as any)._generateSchema('decode', {});
      expect(x).toBeDefined();
      expect(x.title(1)).toStrictEqual('1');
      expect(x.largeContent(1)).toStrictEqual(undefined);
      expect(x.text(1)).toStrictEqual('1');
      expect(x.rank(1)).toStrictEqual(1);
    });

    it('Should pick fields using projection', async () => {
      const dt = doc.node.getComplexType('Note');
      const x: any = (dt as any)._generateSchema('decode', {
        projection: parseFieldsProjection(['title', 'largecontent']),
      });
      expect(x).toBeDefined();
      expect(x.title(1)).toStrictEqual('1');
      expect(x.largeContent(1)).toStrictEqual('1');
      expect(x.text(1)).toStrictEqual(undefined);
      expect(x.rank(1)).toStrictEqual(undefined);
    });

    it('Should omit fields using projection', async () => {
      const dt = doc.node.getComplexType('Note');
      const x: any = (dt as any)._generateSchema('decode', {
        projection: parseFieldsProjection(['-title']),
      });
      expect(x).toBeDefined();
      expect(x.title(1)).toStrictEqual(undefined);
      expect(x.largeContent(1)).toStrictEqual(undefined);
      expect(x.text(1)).toStrictEqual('1');
      expect(x.rank(1)).toStrictEqual(1);
    });

    it('Should include exclusive fields using projection', async () => {
      const dt = doc.node.getComplexType('Note');
      const x: any = (dt as any)._generateSchema('decode', {
        projection: parseFieldsProjection(['+largecontent']),
      });
      expect(x).toBeDefined();
      expect(x.title(1)).toStrictEqual('1');
      expect(x.largeContent(1)).toStrictEqual('1');
      expect(x.text(1)).toStrictEqual('1');
      expect(x.rank(1)).toStrictEqual(1);
    });

    it('Should generate decoder', async () => {
      const dt = doc.node.getComplexType('Customer');
      const fn = dt.generateCodec('decode', {
        projection: ['+address'],
      });
      const x = fn({
        givenName: 'John',
        familyName: 'Doe',
        gender: 'M',
        birthDate: '1980-03-22',
        date2: '1980-03-22 09:21:48',
        uid: '1234567890',
        active: true,
        countryCode: 'US',
        address: {
          street: '123 Main St',
        },
      });
      expect(x).toBeDefined();
      expect(x.givenName).toStrictEqual('John');
      expect(x.birthDate).toStrictEqual(new Date('1980-03-22T00:00:00'));
      expect(x.date2).toStrictEqual('1980-03-22 09:21:48');
      expect(x.rate).toStrictEqual(1);
      expect(x.address).toEqual({ street: '123 Main St' });
    });
  });
});
