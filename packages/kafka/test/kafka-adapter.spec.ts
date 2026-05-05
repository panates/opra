import { ApiDocument } from '@opra/common';
import type { ILogger } from '@opra/core';
import { KafkaAdapter } from '@opra/kafka';
import { expect } from 'expect';
import * as sinon from 'sinon';
import { TestMQApiDocument } from './_support/test-api/index.js';

const describeOrSkip =
  process.env.SKIP_KAFKA_TESTS === 'true' ? describe.skip : describe;

describeOrSkip('kafka:KafkaAdapter', () => {
  let document: ApiDocument;
  let adapter: KafkaAdapter;
  const logger: ILogger = {
    log() {},
    error() {},
  };

  before(async () => {
    document = await TestMQApiDocument.create();
  });

  afterEach(async () => adapter?.close());
  afterEach(() => sinon.restore());

  it('Should initialize consumers', async () => {
    adapter = new KafkaAdapter(document, {
      client: { clientId: '', bootstrapBrokers: ['localhost'] },
      logger,
      consumers: {
        'group-1': {
          sessionTimeout: 10000,
        },
      },
    });
    await adapter.initialize();
    expect((adapter as any)._consumers.size).toBeGreaterThan(0);
  });
});
