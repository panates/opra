import { faker } from '@faker-js/faker';
import { ResourceNotAvailableError } from '@opra/common';
import { SqbCollectionService } from '@opra/sqb';
import { sql } from '@sqb/builder';
import { TempCustomer } from 'example-customer-sqb';
import { CustomerApplication } from 'example-express-sqb';
import { expect } from 'expect';
import * as sinon from 'sinon';
import { createContext } from '../_support/create-context.js';

const describeOrSkip =
  process.env.SKIP_SQB_TESTS === 'true' ? describe.skip : describe;

describeOrSkip('sqb:SqbCollectionService', () => {
  let app: CustomerApplication;
  let service1: SqbCollectionService<any>;
  let service2: SqbCollectionService<any>;
  const tempRecords: any[] = [];
  const interceptorFn = fn => fn();

  before(async () => {
    app = await CustomerApplication.create();
    service1 = new SqbCollectionService<any>(TempCustomer, {
      db: app.db,
    });
    service2 = new SqbCollectionService<any>(TempCustomer, {
      db: app.db,
    });

    const customerRepository = app.db.getRepository(TempCustomer);
    await customerRepository.deleteMany();

    for (let i = 1; i <= 20; i++) {
      const record: any = {
        _id: i,
        uid: faker.string.uuid(),
        active: faker.datatype.boolean(),
        countryCode: faker.location.countryCode(),
        rate: i,
        givenName: faker.person.firstName(),
        familyName: faker.person.lastName(),
        address: {
          city: faker.location.city(),
        },
      };
      tempRecords.push(record);
      await customerRepository.create(record);
    }
  });

  after(() => app?.close());
  afterEach(() => sinon.restore());

  describe('sqb:withTransaction()', () => {
    it('Should service work in transaction', async () => {
      const context = createContext(app.adapter);
      const svc = service1.for(context);
      const c1 = await svc.count();
      const doc = tempRecords[0];
      await svc.withTransaction(async connection => {
        const r = await svc.delete(doc._id);
        expect(r).toBeGreaterThan(0);
        const c2 = await svc.count();
        expect(c2).toBeLessThan(c1);
        await connection.rollback();
      });
      const c3 = await svc.count();
      expect(c3).toEqual(c1);
    });

    it('Should use transaction in context', async () => {
      const context = createContext(app.adapter);
      const svc = service1.for(context);
      const c1 = await svc.count();
      const doc = tempRecords[0];
      await svc.withTransaction(async connection => {
        const svc2 = service2.for(svc);
        const r = await svc2.delete(doc._id);
        expect(r).toBeGreaterThan(0);
        const c2 = await svc2.count();
        expect(c2).toBeLessThan(c1);
        await connection.rollback();
      });
      const c3 = await service1.for(context).count();
      expect(c3).toEqual(c1);
    });
  });

  describe('sqb:assert()', () => {
    it('Should not throw if document exists', async () => {
      const ctx = createContext(app.adapter);
      await service1.for(ctx).assert(1);
    });

    it('Should throw error if not found', async () => {
      const ctx = createContext(app.adapter);
      await expect(() => service1.for(ctx).assert(9999)).rejects.toThrow(
        ResourceNotAvailableError,
      );
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      await expect(() =>
        service1.for(ctx, { commonFilter: () => '_id=2' }).assert(1),
      ).rejects.toThrow(ResourceNotAvailableError);
    });
  });

  describe('sqb:count()', () => {
    it('Should count number of documents', async () => {
      const ctx = createContext(app.adapter);
      const result = await service1.for(ctx).count();
      expect(result).toBeGreaterThan(0);
    });

    it('Should apply filter', async () => {
      const ctx = createContext(app.adapter);
      const result1 = await service1.for(ctx).count();
      const result2 = await service1.for(ctx).count({ filter: 'rate>5' });
      expect(result1).toBeGreaterThan(result2);
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { commonFilter: '_id=2' })
        .count();
      expect(result).toEqual(1);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const result = await service1.for(ctx, { interceptor: mockFn }).count();
      expect(result).toBeGreaterThan(0);
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:findById()', () => {
    it('Should return single object', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findById(1);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        _id: 1,
        rate: expect.any(Number),
      });
    });

    it('Should omit exclusive fields by default', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findById(1);
      expect(result).toBeDefined();
      expect(result.address).not.toBeDefined();
    });

    it('Should return undefined if not found', async () => {
      const ctx = createContext(app.adapter);
      const r = await service1.for(ctx).findById(9999);
      expect(r).not.toBeDefined();
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { commonFilter: '_id=2' })
        .findById(1);
      expect(result).not.toBeDefined();
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { interceptor: mockFn })
        .findById(1);
      expect(result).toBeDefined();
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:findOne()', () => {
    it('Should return single document', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findOne();
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        _id: 1,
        rate: expect.any(Number),
      });
      expect(result.address).not.toBeDefined();
    });

    it('Should return "undefined" if not found', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx)
        .findOne({ filter: { _id: 9999 } });
      expect(result).not.toBeDefined();
    });

    it('Should apply filter', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findOne({ filter: 'rate>5' });
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        _id: expect.any(Number),
        rate: expect.any(Number),
      });
      expect(result.address).not.toBeDefined();
      expect(result.rate).toBeGreaterThan(5);
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { commonFilter: '_id=2' })
        .findOne();
      expect(result._id).toEqual(2);
    });

    it('Should include exclusive fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findOne({
        projection: ['+address'],
      });
      expect(result).toBeDefined();
      expect(result.givenName).toBeDefined();
      expect(result.address).toBeDefined();
      expect(result.rate).toBeGreaterThan(0);
    });

    it('Should pick fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findOne({
        projection: ['rate'],
      });
      expect(result).toBeDefined();
      expect(result.givenName).not.toBeDefined();
      expect(result.address).not.toBeDefined();
      expect(result.rate).toBeGreaterThan(0);
    });

    it('Should omit fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findOne({
        projection: ['-rate'],
      });
      expect(result).toBeDefined();
      expect(result.givenName).toBeDefined();
      expect(result.address).not.toBeDefined();
      expect(result.rate).not.toBeDefined();
    });

    it('Should return sorted', async () => {
      const ctx = createContext(app.adapter);
      const result1: any = await service1.for(ctx).findOne({ sort: ['_id'] });
      const result2: any = await service1.for(ctx).findOne({ sort: ['-_id'] });
      expect(result1._id).toBeLessThan(result2._id);
    });

    it('Should skip records', async () => {
      const ctx = createContext(app.adapter);
      const result1: any = await service1
        .for(ctx)
        .findOne({ skip: 1, sort: ['_id'] });
      const result2: any = await service1
        .for(ctx)
        .findOne({ skip: 2, sort: ['_id'] });
      expect(result1._id).toBeLessThan(result2._id);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { interceptor: mockFn })
        .findOne();
      expect(result).toBeDefined();
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:findMany()', () => {
    it('Should return documents', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany();
      expect(result).toBeDefined();
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            _id: expect.any(Number),
            rate: expect.any(Number),
          }),
        ]),
      );
      expect(result.length).toBeGreaterThan(0);
    });

    it('Should return every matching record when no limit is given', async () => {
      // More rows than the 100 the service used to cut at, silently.
      const repo = app.db.getRepository(TempCustomer);
      for (let i = 1001; i <= 1110; i++) {
        await repo.create({
          ...tempRecords[0],
          _id: i,
          uid: faker.string.uuid(),
        });
      }
      try {
        const ctx = createContext(app.adapter);
        const svc = service1.for(ctx);
        const count = await svc.count();
        expect(count).toBeGreaterThan(100);
        expect((await svc.findMany()).length).toEqual(count);
        expect((await svc.findMany({ limit: 0 })).length).toEqual(count);
        const r = await svc.findManyWithCount();
        expect(r.count).toEqual(count);
        expect(r.items.length).toEqual(count);
      } finally {
        await repo.deleteMany({ filter: sql.Gt('_id', 1000) });
      }
    });

    it('Should apply defaultLimit when set and no limit is given', async () => {
      const ctx = createContext(app.adapter);
      const svc = new SqbCollectionService<any>(TempCustomer, {
        db: app.db,
        defaultLimit: 5,
      }).for(ctx);
      expect((await svc.findMany()).length).toEqual(5);
      expect((await svc.findMany({ limit: 7 })).length).toEqual(7);
    });

    it('Should apply filter', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx)
        .findMany({ filter: 'rate>5' });
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      for (const r of result) expect(r.rate).toBeGreaterThan(5);
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { commonFilter: '_id=2' })
        .findMany();
      expect(result.length).toEqual(1);
      expect(result[0]._id).toEqual(2);
    });

    it('Should include exclusive fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        projection: ['+address'],
      });
      expect(result.length).toBeGreaterThan(0);
      for (const r of result) {
        expect(r).toBeDefined();
        expect(r.givenName).toBeDefined();
        expect(r.address).toBeDefined();
        expect(r.rate).toBeGreaterThan(0);
      }
    });

    it('Should pick fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        projection: ['rate'],
      });
      for (const r of result) {
        expect(r).toBeDefined();
        expect(r.givenName).not.toBeDefined();
        expect(r.address).not.toBeDefined();
        expect(r.rate).toBeGreaterThan(0);
      }
    });

    it('Should omit fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        projection: ['-rate'],
      });
      for (const r of result) {
        expect(r).toBeDefined();
        expect(r.givenName).toBeDefined();
        expect(r.address).not.toBeDefined();
        expect(r.rate).not.toBeDefined();
      }
    });

    it('Should include exclusive fields', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        projection: ['+address'],
      });
      for (const r of result) {
        expect(r).toBeDefined();
        expect(r.givenName).toBeDefined();
        expect(r.address).toBeDefined();
        expect(r.rate).toBeGreaterThan(0);
      }
    });

    it('Should sort items', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        sort: ['-rate'],
      });
      expect(result).toBeDefined();
      const original = result.map(x => x.rate);
      const sorted = [...original].sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));
      expect(original).toEqual(sorted);
    });

    it('Should limit retuning items', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        limit: 2,
      });
      expect(result).toBeDefined();
      expect(result.length).toEqual(2);
    });

    it('Should skip items', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).findMany({
        skip: 5,
        sort: ['_id'],
      });
      expect(result).toBeDefined();
      expect(result[0]._id).toBeGreaterThan(5);
    });

    it('Should count total matches', async () => {
      const ctx = createContext(app.adapter);
      const result = await service1.for(ctx).findManyWithCount({
        filter: 'rate>5',
        limit: 5,
      });
      expect(result).toBeDefined();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.items.length).toBeLessThanOrEqual(5);
      expect(result.count).toBeGreaterThan(5);
      expect(result.count).toBeLessThan(20);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { interceptor: mockFn })
        .findMany();
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:get()', () => {
    it('Should return single document', async () => {
      const ctx = createContext(app.adapter);
      const result: any = await service1.for(ctx).get(1);
      expect(result).toBeDefined();
      expect(result).toMatchObject({
        _id: 1,
        rate: expect.any(Number),
      });
      expect(result.address).not.toBeDefined();
    });

    it('Should throw error if not found', async () => {
      const ctx = createContext(app.adapter);
      await expect(() => service1.for(ctx).get(9999)).rejects.toThrow(
        ResourceNotAvailableError,
      );
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      await expect(() =>
        service1.for(ctx, { commonFilter: '_id=999' }).get(1),
      ).rejects.toThrow(ResourceNotAvailableError);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const result: any = await service1
        .for(ctx, { interceptor: mockFn })
        .get(1);
      expect(result).toBeDefined();
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:updateOnly()', () => {
    it('Should update object in the array field', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const srcDoc = tempRecords[5];
      const r = await service1.for(ctx).updateOnly(srcDoc._id, doc);
      expect(r).toEqual(1);
    });

    it('Should return "0" if parent record not found', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const r = await service1.for(ctx).updateOnly(9999, doc);
      expect(r).toEqual(0);
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const r = await service1
        .for(ctx, { commonFilter: '_id=999' })
        .updateOnly(2, doc);
      expect(r).toEqual(0);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const srcDoc = tempRecords[5];
      const r = await service1
        .for(ctx, { interceptor: mockFn })
        .updateOnly(srcDoc._id, doc);
      expect(r).toEqual(1);
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:update()', () => {
    it('Should update object in the array field', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const srcDoc = tempRecords[5];
      const result: any = await service1.for(ctx).update(srcDoc._id, doc);
      expect(result).toBeDefined();
      const r = await service1.for(ctx).findById(srcDoc._id);
      expect(result).toEqual(r);
    });

    it('Should return "undefined" if parent record not found', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const r = await service1.for(ctx).update(9999, doc);
      expect(r).not.toBeDefined();
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const result = await service1
        .for(ctx, { commonFilter: '_id=999' })
        .update(2, doc);
      expect(result).not.toBeDefined();
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const srcDoc = tempRecords[5];
      const result: any = await service1
        .for(ctx, { interceptor: mockFn })
        .update(srcDoc._id, doc);
      expect(result).toBeDefined();
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:updateMany()', () => {
    it('Should update multiple records', async () => {
      const ctx = createContext(app.adapter);
      const update = { uid: faker.string.uuid() };
      const r = await service1.for(ctx).updateMany(update);
      expect(r).toBeGreaterThan(0);
      const result = await service1.for(ctx).findMany();
      expect(result).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            uid: update.uid,
          }),
        ]),
      );
    });

    it('Should apply filter', async () => {
      const ctx = createContext(app.adapter);
      const update = { uid: faker.string.uuid() };
      const r = await service1
        .for(ctx)
        .updateMany(update, { filter: 'rate>5' });
      expect(r).toBeGreaterThan(0);
      const recs = await service1.for(ctx).findMany();
      expect(recs).toBeDefined();
      for (const x of recs!) {
        if (x.rate <= 5) expect(x.uid).not.toEqual(update.uid);
        else expect(x.uid).toEqual(update.uid);
      }
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const doc = { uid: faker.string.uuid() };
      const r = await service1
        .for(ctx, { commonFilter: '_id=2' })
        .updateMany(doc);
      expect(r).toEqual(1);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const update = { uid: faker.string.uuid() };
      const r = await service1
        .for(ctx, { interceptor: mockFn })
        .updateMany(update);
      expect(r).toBeGreaterThan(0);
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:create()', () => {
    it('Should insert document', async () => {
      const ctx = createContext(app.adapter);
      const doc = { _id: 100, uid: faker.string.uuid() };
      const result: any = await service1.for(ctx).create(doc);
      expect(result).toBeDefined();
      const r = await service1.for(ctx).get(100);
      expect(result).toEqual(r);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const doc = { _id: 101, uid: faker.string.uuid() };
      const result: any = await service1
        .for(ctx, { interceptor: mockFn })
        .create(doc);
      expect(result).toBeDefined();
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:delete()', () => {
    it('Should delete document', async () => {
      const ctx = createContext(app.adapter);
      const doc = tempRecords[0];
      let x = await service1.for(ctx).findById(doc._id);
      expect(x).toBeDefined();

      const r = await service1.for(ctx).delete(doc._id);
      expect(r).toEqual(1);

      x = await service1.for(ctx).findById(doc._id);
      expect(x).not.toBeDefined();
    });

    it('Should return "0" if parent record not found', async () => {
      const ctx = createContext(app.adapter);
      const r = await service1.for(ctx).delete(9999);
      expect(r).toEqual(0);
    });

    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const r = await service1.for(ctx, { commonFilter: '_id=999' }).delete(3);
      expect(r).toEqual(0);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const doc = tempRecords[2];
      const r = await service1
        .for(ctx, { interceptor: mockFn })
        .delete(doc._id);
      expect(r).toEqual(1);
      expect(mockFn.callCount).toEqual(1);
    });
  });

  describe('sqb:deleteMany()', () => {
    it('Should apply filter returned by commonFilter', async () => {
      const ctx = createContext(app.adapter);
      const r = await service1
        .for(ctx, { commonFilter: '_id=999' })
        .deleteMany();
      expect(r).toEqual(0);
    });

    it('Should apply filter', async () => {
      const ctx = createContext(app.adapter);
      const r = await service1.for(ctx).deleteMany({ filter: 'rate>5' });
      expect(r).toBeGreaterThan(0);
      const c = await service1.for(ctx).count();
      expect(c).toBeGreaterThan(0);
    });

    it('Should delete all object from the array field', async () => {
      const ctx = createContext(app.adapter);
      const r = await service1.for(ctx).deleteMany();
      expect(r).toBeGreaterThan(0);
      const c = await service1.for(ctx).count();
      expect(c).toEqual(0);
    });

    it('Should run in interceptor', async () => {
      const mockFn = sinon.spy(interceptorFn);
      const ctx = createContext(app.adapter);
      const r = await service1.for(ctx, { interceptor: mockFn }).deleteMany();
      expect(r).toBeGreaterThanOrEqual(0);
      expect(mockFn.callCount).toEqual(1);
    });

    it('Should call onError when operation fails', async () => {
      const ctx = createContext(app.adapter);
      const onErrorSpy = sinon.spy();

      await expect(
        service1.for(ctx, { onError: onErrorSpy }).create({}),
      ).rejects.toThrow();

      expect(onErrorSpy.callCount).toEqual(1);
      const [error, command] = onErrorSpy.firstCall.args;
      expect(error).toBeInstanceOf(Error);
      expect(command.crud).toBe('create');
    });
  });
});
