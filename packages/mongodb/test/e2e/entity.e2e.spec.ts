import '@opra/mongodb';
import { OpraTestClient } from '@opra/testing';
import { CustomerApplication as CustomerApplication2 } from 'example-express-elastic';
import { CustomerApplication } from 'example-express-mongo';
import { entityTests } from '../../../http/test/e2e/tests/index.js';

const describeOrSkip =
  process.env.SKIP_MONGO_TESTS === 'true' ? describe.skip : describe;

describeOrSkip('mongodb:e2e', function () {
  let app: CustomerApplication;
  let client: OpraTestClient;
  const testArgs: any = {};

  before(async () => {
    await CustomerApplication2.create({ basePath: '/api/v1' });
    app = await CustomerApplication.create({ basePath: '/api/v1' });
    client = new OpraTestClient(app.adapter.app, {
      document: app.document,
      basePath: '/api/v1',
    });
    testArgs.app = app;
    testArgs.client = client;
  });

  after(async () => {
    await app?.close();
  });

  // @ts-ignore
  entityTests.call(this, testArgs);
});
