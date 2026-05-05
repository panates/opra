import { MQController, MQOperation } from '@opra/common';
import { ExecutionContext } from '@opra/core';
import type { AsyncEventEmitter } from 'node-events-async';
import type { KafkaAdapter } from './kafka-adapter.js';

/**
 * KafkaContext class provides the context for handling Kafka messages.
 * It extends the ExecutionContext and implements the AsyncEventEmitter.
 */
export class KafkaContext
  extends ExecutionContext
  implements AsyncEventEmitter
{
  declare readonly __contDef: MQController;
  declare readonly __oprDef: MQOperation;
  declare readonly __controller: any;
  declare readonly __handler?: Function;
  declare readonly __adapter: KafkaAdapter;
  readonly topic: string;
  readonly key: any;
  readonly payload: any;
  readonly partition: number;
  readonly headers: Record<string, any>;
  readonly rawMessage: KafkaAdapter.Message;

  /**
   * Initializes a new instance of the KafkaContext.
   *
   * @param init - The initialization options for the context.
   */
  constructor(init: KafkaContext.Initiator) {
    super({
      ...init,
      __docNode:
        init.__oprDef?.node ||
        init.__contDef?.node ||
        init.__adapter.document.node,
      transport: 'mq',
      platform: 'kafka',
    });
    if (init.__contDef) this.__contDef = init.__contDef;
    if (init.__oprDef) this.__oprDef = init.__oprDef;
    if (init.__controller) this.__controller = init.__controller;
    if (init.__handler) this.__handler = init.__handler;
    this.partition = init.partition;
    this.headers = init.headers || {};
    this.topic = init.topic;
    this.key = init.key;
    this.payload = init.payload;
    this.rawMessage = init.rawMessage;
  }
}

export namespace KafkaContext {
  export interface Initiator extends Omit<
    ExecutionContext.Initiator,
    '__adapter' | 'transport' | 'platform' | '__docNode'
  > {
    __adapter: KafkaAdapter;
    __contDef?: MQController;
    __controller?: any;
    __oprDef?: MQOperation;
    __handler?: Function;
    topic: string;
    partition: number;
    key: any;
    payload: any;
    headers: Record<string, any>;
    rawMessage: KafkaAdapter.Message;
    commit(): void | Promise<void>;
  }
}
