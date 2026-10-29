import { MQController, MQOperation } from '@opra/common';
import { KafkaContext } from '@opra/kafka';
import { SendMailDto } from '../dto/send-mail.dto.js';

@(MQController({
  description: 'Test controller',
  name: 'Test',
}).Header('access-token', 'string'))
export class TestController {
  /**
   * The operations each message key reached, by key. Kafka delivers at least once - a producer
   * retry or a consumer group rejoin can hand a message over again, seconds later - so a test
   * looks only at its own key, and a repeat delivery of it counts once.
   */
  static received = new Map<string, Set<string>>();

  static operationsReceived(key: string): string[] {
    return Array.from(TestController.received.get(key) || []).sort();
  }

  private static _record(operation: string, ctx: KafkaContext) {
    const key = String(ctx.key);
    let operations = TestController.received.get(key);
    if (!operations) TestController.received.set(key, (operations = new Set()));
    operations.add(operation);
  }

  /**
   *
   */
  @(MQOperation(SendMailDto, {
    channel: 'email-channel-1',
  })
    .Kafka({
      consumer: 'group-1',
    })
    .Header('header2', 'integer')
    .Response('string', {
      channel: 'test-send-email-response',
    }))
  mailChannel1(ctx: KafkaContext) {
    TestController._record('mailChannel1', ctx);
    return 'OK:' + ctx.rawMessage.timestamp;
  }

  /**
   *
   */
  @(MQOperation(SendMailDto, {
    channel: 'email-channel-1',
  })
    .Kafka(() => ({
      consumer: 'group-2',
    }))
    .Header('header2', 'integer'))
  mailChannel2(ctx: KafkaContext) {
    TestController._record('mailChannel2', ctx);
    return 'OK:' + ctx.rawMessage.timestamp;
  }

  /**
   *
   */
  @(MQOperation(SendMailDto, {
    channel: 'sms-channel-1',
  }).Kafka({
    consumer: 'group-1',
  }))
  smsChannel1(ctx: KafkaContext) {
    TestController._record('smsChannel1', ctx);
    return 'OK:' + ctx.rawMessage.timestamp;
  }

  /**
   *
   */
  @(MQOperation(SendMailDto, {
    channel: /^sms-channel-.*$/,
  }).Kafka({
    consumer: 'group-2',
  }))
  smsChannel2(ctx: KafkaContext) {
    TestController._record('smsChannel2', ctx);
    return 'OK:' + ctx.rawMessage.timestamp;
  }
}
