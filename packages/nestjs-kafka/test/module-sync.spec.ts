import { faker } from '@faker-js/faker';
import type { INestApplication } from '@nestjs/common';
import { APP_GUARD, ModuleRef } from '@nestjs/core';
import { APP_INTERCEPTOR } from '@nestjs/core/constants.js';
import { Test } from '@nestjs/testing';
import { KafkaAdapter } from '@opra/kafka';
import { Producer, stringSerializers } from '@platformatic/kafka';
import { expect } from 'expect';
import { waitForMessage } from '../../kafka/test/_support/wait-for-message.js';
import { OpraKafkaModule } from '../src/index.js';
import {
  Cat,
  CatsService,
  Dog,
  DogsService,
  GlobalInterceptor,
  KafkaCatsController,
  KafkaDogsController,
  TestGlobalGuard,
} from './_support/test-app/index.js';

const kafkaBrokerHost = process.env.KAFKA_BROKER || 'localhost:9092';

const describeOrSkip =
  process.env.SKIP_KAFKA_TESTS === 'true' ? describe.skip : describe;

describeOrSkip('nestjs-kafka:OpraKafkaModule - sync', () => {
  let nestApplication: INestApplication;
  let moduleRef: ModuleRef;
  let adapter: KafkaAdapter;
  let producer: Producer<string, string, string, string>;

  before(async () => {
    CatsService.instanceCounter = 0;
    DogsService.instanceCounter = 0;
    producer = new Producer({
      clientId: 'opra-test',
      bootstrapBrokers: [kafkaBrokerHost],
      serializers: stringSerializers,
      autocreateTopics: true,
      retries: 0,
    });
  });

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [
        OpraKafkaModule.forRoot({
          client: {
            clientId: 'opra-test',
            bootstrapBrokers: [kafkaBrokerHost],
          },
          name: 'test',
          controllers: [KafkaCatsController, KafkaDogsController],
          providers: [CatsService, DogsService],
          types: [Cat, Dog],
        }),
      ],
      providers: [
        {
          provide: APP_GUARD,
          useExisting: TestGlobalGuard,
        },
        TestGlobalGuard,
        {
          provide: APP_INTERCEPTOR,
          useExisting: GlobalInterceptor,
        },
        GlobalInterceptor,
      ],
    }).compile();

    nestApplication = module.createNestApplication();
    await nestApplication.init();
    moduleRef = nestApplication.get(ModuleRef);
    adapter = moduleRef.get(KafkaAdapter, { strict: false });
  });

  beforeEach(() => {
    CatsService.counters = {
      getCat: 0,
      getCats: 0,
      feedCat: 0,
    };
    DogsService.counters = {
      getDog: 0,
      getDogs: 0,
      feedDog: 0,
    };
  });

  after(async () => {
    producer.close(true);
    await nestApplication?.close().catch(() => undefined);
  });

  it('Should register adapter', async () => {
    expect(adapter).toBeDefined();
    expect(adapter.document).toBeDefined();
    expect(adapter.document.api).toBeDefined();
    expect(Array.from(adapter.document.getMqApi().controllers.keys())).toEqual([
      'Cats',
      'Dogs',
    ]);
  });

  it('Should call DEFAULT scoped api', async () => {
    const key = faker.string.alpha(5);
    const payload: Cat = {
      id: faker.number.int(),
      name: faker.animal.cat(),
      age: faker.number.int({ max: 12 }),
    };
    const [ctx] = await Promise.all([
      waitForMessage(adapter, 'feedCat', key),
      new Promise((resolve, reject) => {
        setTimeout(() => {
          producer
            .send({
              messages: [
                {
                  topic: 'feed-cat',
                  key,
                  value: JSON.stringify(payload),
                },
              ],
            })
            .then(resolve)
            .catch(reject);
        }, 250);
      }),
    ]);
    expect(ctx).toBeDefined();
    expect(ctx?.key).toStrictEqual(key);
    expect(ctx?.payload).toEqual(payload);
    expect(CatsService.counters).toEqual({
      getCat: 0,
      getCats: 0,
      feedCat: 1,
    });
    expect(CatsService.instanceCounter).toEqual(1);
  }).slow(800);

  // it('Should call REQUEST scoped api', async () => {
  //   const key = faker.string.alpha(5);
  //   const payload: Dog = {
  //     id: faker.number.int(),
  //     name: faker.animal.dog(),
  //     age: faker.number.int({ max: 12 }),
  //   };
  //   await producer.send({
  //     topic: 'feed-dog',
  //     messages: [
  //       {
  //         key,
  //         value: JSON.stringify(payload),
  //       },
  //     ],
  //   });
  //   const ctx = await waitForMessage(adapter.adapter, 'feedDog', key);
  //   expect(ctx).toBeDefined();
  //   expect(ctx?.key).toStrictEqual(key);
  //   expect(ctx?.payload).toEqual(payload);
  //   expect(DogsService.counters).toEqual({
  //     getDog: 0,
  //     getDogs: 0,
  //     feedDog: 1,
  //   });
  //   expect(DogsService.instanceCounter).toEqual(1);
  // });

  // it('Should use router guards', async () => {
  //   const callCounter = AuthGuard.callCounter;
  //   const r = await request(server).get('/api/v1/cats').set('Authorization', 'reject-auth');
  //   expect(r.status).toStrictEqual(401);
  //   expect(AuthGuard.callCounter).toEqual(callCounter + 1);
  //   expect(AuthGuard.instanceCounter).toEqual(1);
  //   expect(HttpCatsController.instanceCounter).toEqual(1);
  // });
  //
  // it('Should use global guards', async () => {
  //   const callCounter = TestGlobalGuard.callCounter;
  //   const r = await request(server).get('/api/v1/cats').set('Authorization', 'reject-auth');
  //   expect(r.status).toStrictEqual(401);
  //   expect(TestGlobalGuard.callCounter).toEqual(callCounter + 1);
  //   expect(TestGlobalGuard.instanceCounter).toEqual(1);
  // });
  //
  // it('Should use global NextJS interceptors', async () => {
  //   const callCounter = GlobalInterceptor.callCounter;
  //   const r = await request(server).get('/api/v1/cats');
  //   expect(r.status).toStrictEqual(200);
  //   expect(GlobalInterceptor.callCounter).toEqual(callCounter + 1);
  //   expect(GlobalInterceptor.instanceCounter).toEqual(1);
  // });
  //
  // it('Should use router NextJS interceptors', async () => {
  //   const callCounter = TestInterceptor.callCounter;
  //   const r = await request(server).get('/api/v1/cats');
  //   expect(r.status).toStrictEqual(200);
  //   expect(TestInterceptor.callCounter).toEqual(callCounter + 1);
  //   expect(TestInterceptor.instanceCounter).toEqual(1);
  // });
  //
  // it('Should be able to disable guards for $schema route', async () => {
  //   const publicCounter = TestGlobalGuard.publicCounter;
  //   const r = await request(server).get('/api/v1/$schema');
  //   expect(r.status).toStrictEqual(200);
  //   expect(TestGlobalGuard.publicCounter).toEqual(publicCounter + 1);
  // });
});
