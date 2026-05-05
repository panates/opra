import { Admin } from '@platformatic/kafka';
import { initDatabase as initElasticDb } from '../../examples/_lib/customer-elastic/src/init-database.js';
import { initDatabase as initMongoDb } from '../../examples/_lib/customer-mongo/src/init-database.js';
import { initDatabase as initSqb } from '../../examples/_lib/customer-sqb/src/init-database.js';
import { countriesData } from '../../examples/_lib/data/countries-data.js';
import { customersData } from '../../examples/_lib/data/customers-data.js';

const kafkaBrokerHost = process.env.KAFKA_BROKER || 'localhost:9092';

export async function mochaGlobalSetup() {
  if (
    process.env.INIT_ELASTIC === 'true' &&
    process.env.SKIP_ELASTIC_TESTS !== 'true'
  ) {
    await initElasticDb({
      // recreate: true,
      countries: countriesData,
      customers: customersData.map(
        (x: any) => ({ ...x, id: x._id, _id: undefined }) as any,
      ),
    });
  }
  if (
    process.env.INIT_KAFKA === 'true' &&
    process.env.SKIP_KAFKA_TESTS !== 'true'
  ) {
    const admin = new Admin({
      clientId: 'opra-test',
      bootstrapBrokers: [kafkaBrokerHost],
      retries: 0,
    });
    await admin
      .deleteTopics({
        topics: [
          'email-channel-1',
          'email-channel-2',
          'sms-channel-1',
          'sms-channel-2',
          'feed-cat',
          'feed-dog',
        ],
      })
      .catch(() => {});
    await admin
      .createTopics({
        topics: [
          'email-channel-1',
          'email-channel-2',
          'sms-channel-1',
          'sms-channel-2',
          'feed-cat',
          'feed-dog',
        ],
      })
      .finally(() => admin.close());
  }
  if (
    process.env.INIT_MONGODB === 'true' &&
    process.env.SKIP_MONGO_TESTS !== 'true'
  ) {
    await initMongoDb({
      countries: countriesData,
      customers: customersData,
    });
  }
  if (
    process.env.INIT_SQB === 'true' &&
    process.env.SKIP_SQB_TESTS !== 'true'
  ) {
    await initSqb({
      countries: countriesData,
      customers: customersData,
    });
  }
}
