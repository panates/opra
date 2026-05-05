import {
  ApiDocument,
  MQ_CONTROLLER_METADATA,
  MQApi,
  MQController,
  MQOperation,
  OpraException,
  OpraSchema,
} from '@opra/common';
import { kAssetCache, PlatformAdapter } from '@opra/core';
import {
  Admin,
  type BaseOptions,
  type ConsumeOptions,
  Consumer,
  type ConsumerOptions as _ConsumerOptions,
  type Message as _Message,
  type MessagesStream,
  stringDeserializers,
} from '@platformatic/kafka';
import type { StrictOmit } from 'ts-gems';
import { type Validator, vg } from 'valgen';
import {
  KAFKA_DEFAULT_GROUP,
  KAFKA_OPERATION_METADATA,
  KAFKA_OPERATION_METADATA_RESOLVER,
} from './constants.js';
import { KafkaContext } from './kafka-context.js';
import { parseRegExp } from './parse-regexp.js';

const globalErrorTypes = ['unhandledRejection', 'uncaughtException'];
const noOp = () => undefined;

export type OperationArguments = {
  consumer: KafkaAdapter.ConsumerOptions;
  selfConsumer?: boolean;
} & Required<{
  subscribe: KafkaAdapter.OperationOptions['subscribe'];
}>;

interface HandlerArguments {
  consumer: Consumer;
  controller: MQController;
  instance: any;
  operation: MQOperation;
  operationConfig: OperationArguments;
  handler: KafkaAdapter.MessageHandler;
  stream?: MessagesStream<any, any, any, any>;
  topics: (string | RegExp)[];
}

/**
 * Adapter for integrating Kafka into the Opra platform.
 * It manages Kafka consumers, handles message routing to controllers,
 * and provides integration with the Opra execution context.
 */
export class KafkaAdapter extends PlatformAdapter<KafkaAdapter.Events> {
  static readonly PlatformName = 'kafka';
  protected _config: KafkaAdapter.Config;
  protected _controllerInstances = new Map<MQController, any>();
  protected _consumers = new Map<string, Consumer<any, any, any, any>>();
  protected _handlerArgs: HandlerArguments[] = [];
  // declare protected _kafka: Kafka;
  protected _status: KafkaAdapter.Status = 'idle';
  readonly transform: OpraSchema.Transport = 'mq';
  readonly platform = KafkaAdapter.PlatformName;
  readonly interceptors: (
    | KafkaAdapter.InterceptorFunction
    | KafkaAdapter.IKafkaInterceptor
  )[];

  /**
   * Initializes a new instance of the KafkaAdapter.
   *
   * @param document - The API document that defines the Kafka services and controllers.
   * @param config - The configuration options for the Kafka adapter.
   * @throws {@link TypeError} Throws if the document does not expose a Kafka API.
   */
  constructor(document: ApiDocument, config: KafkaAdapter.Config) {
    super(config);
    this._document = document;
    this._config = config;
    if (
      !(
        this.document.api instanceof MQApi &&
        this.document.api.platform === KafkaAdapter.PlatformName
      )
    ) {
      throw new TypeError(`The document doesn't expose a Kafka Api`);
    }
    // this._config = config;
    this.interceptors = [...(config.interceptors || [])];
    globalErrorTypes.forEach(type => {
      process.on(type, e => {
        this._emitError(e);
        return this.close();
      });
    });
  }

  /**
   * Gets the MQ API defined in the document.
   */
  get api(): MQApi {
    return this.document.getMqApi();
  }
  //
  // /**
  //  * Gets the Kafka client instance.
  //  */
  // get kafka(): Kafka {
  //   return this._kafka;
  // }

  /**
   * Gets the configuration scope for the adapter.
   */
  get scope(): string | undefined {
    return this._config.scope;
  }

  /**
   * Gets the current status of the adapter.
   */
  get status(): KafkaAdapter.Status {
    return this._status;
  }

  /**
   * Initializes the Kafka client and all defined consumers.
   * This method is called automatically by {@link start} if not already initialized.
   */
  async initialize() {
    if (this._consumers.size) return;
    await this._createAllConsumers();
  }

  /**
   * Starts the Kafka adapter, connecting all consumers and subscribing to topics.
   *
   * @throws {@link Error} Throws if a consumer fails to connect or subscribe.
   */
  async start() {
    if (this.status !== 'idle') return;
    await this.initialize();
    this._status = 'starting';

    try {
      /* Subscribe to channels */
      for (const args of this._handlerArgs) {
        const { consumer, operationConfig } = args;
        if (!operationConfig.subscribe?.topics?.length) continue;
        args.stream = await consumer.consume(operationConfig.subscribe!);
        const topicMap = new Map<string, HandlerArguments[]>();
        args.stream.on('data', message => {
          this.emitSafe('message', message);
          Promise.resolve()
            .then(async () => {
              const { topic } = message;
              const topicCacheKey = consumer.groupId + ':' + topic;
              let handlerArgsArray = topicMap.get(topicCacheKey);
              if (!handlerArgsArray) {
                handlerArgsArray = this._handlerArgs.filter(
                  hargs =>
                    hargs.consumer === consumer &&
                    hargs.operationConfig.subscribe?.topics.includes(topic),
                );
                /* istanbul ignore next */
                if (!handlerArgsArray) {
                  throw new Error(`Unhandled topic (${topic})`);
                }
                topicMap.set(topicCacheKey, handlerArgsArray);
              }
              /* Iterate and call all matching handlers */
              for (const hargs of handlerArgsArray) {
                await hargs.handler(message);
              }
            })
            .catch(e => this._emitError(e));
        });

        this.logger?.info?.(
          `Subscribed to topic${args.topics.length > 1 ? 's' : ''} "${args.topics}"`,
        );
      }
      this._status = 'started';
    } catch (e) {
      await this.close();
      throw e;
    }
  }

  /**
   * Closes all active Kafka consumers and clears internal caches.
   * This effectively stops the service and returns it to the idle state.
   */
  async close(force?: boolean) {
    this._status = 'closing';
    await Promise.allSettled(
      Array.from(this._consumers.values()).map(c => c.close(force)),
    );
    this._consumers.clear();
    this._controllerInstances.clear();
    this._status = 'idle';
  }

  /**
   * Retrieves a controller instance by its path.
   *
   * @param controllerPath - The unique path of the controller.
   * @returns The controller instance or undefined if not found.
   */
  getControllerInstance<T>(controllerPath: string): T | undefined {
    const controller = this.api.findController(controllerPath);
    return controller && this._controllerInstances.get(controller);
  }

  /**
   * Resolves the configuration for a specific MQ operation.
   *
   * @param controller - The MQ controller containing the operation.
   * @param instance - The actual instance of the controller class.
   * @param operation - The MQ operation being configured.
   * @param availableTopics - List of available topics (Retrieved from Kafka admin client).
   * @returns A promise that resolves to the operation configuration or undefined if not applicable.
   * @protected
   */
  protected async _getOperationArguments(
    controller: MQController,
    instance: any,
    operation: MQOperation,
    availableTopics: string[],
  ): Promise<OperationArguments | undefined> {
    if (typeof instance[operation.name] !== 'function') return;
    const proto = controller.ctor?.prototype || Object.getPrototypeOf(instance);
    if (Reflect.hasMetadata(MQ_CONTROLLER_METADATA, proto, operation.name))
      return;
    const operationConfig: OperationArguments = {
      consumer: {
        clientId: '',
        groupId: KAFKA_DEFAULT_GROUP,
        bootstrapBrokers: [],
      },
      subscribe: { topics: [] },
    };
    if (this._config.defaults) {
      if (this._config.defaults.subscribe) {
        Object.assign(
          operationConfig.subscribe!,
          this._config.defaults.subscribe,
        );
      }
      if (this._config.defaults.consumer) {
        Object.assign(operationConfig.consumer, this._config.defaults.consumer);
      }
    }

    let kafkaMetadata = Reflect.getMetadata(
      KAFKA_OPERATION_METADATA,
      proto,
      operation.name,
    ) as KafkaAdapter.OperationOptions;
    if (!kafkaMetadata) {
      const configResolver = Reflect.getMetadata(
        KAFKA_OPERATION_METADATA_RESOLVER,
        proto,
        operation.name,
      );
      if (configResolver) {
        kafkaMetadata = await configResolver();
      }
    }
    if (kafkaMetadata) {
      if (kafkaMetadata.subscribe) {
        Object.assign(operationConfig.subscribe!, kafkaMetadata.subscribe);
      }
      if (kafkaMetadata.consumer) {
        if (typeof kafkaMetadata.consumer === 'object') {
          Object.assign(operationConfig.consumer, kafkaMetadata.consumer);
          operationConfig.selfConsumer = true;
        } else {
          const x = this._config.consumers?.[kafkaMetadata.consumer];
          if (x) {
            operationConfig.consumer.groupId = kafkaMetadata.consumer;
            Object.assign(operationConfig.consumer, x);
          }
        }
      }
    }
    Object.assign(operationConfig.consumer, this._config.client);
    const selectedTopics: string[] = [];
    const topics = Array.isArray(operation.channel)
      ? operation.channel
      : [operation.channel];
    for (let topic of topics) {
      if (!topic) continue;
      if (typeof topic === 'string' && topic.startsWith('/'))
        topic = parseRegExp(topic);
      else if (typeof topic === 'string' && topic.startsWith('^'))
        topic = parseRegExp('/' + topic + '/');
      if (topic instanceof RegExp) {
        const matchedTopics = availableTopics
          .filter(t => (topic.test(t) ? t : undefined))
          .filter(t => !!t);
        selectedTopics.push(...matchedTopics);
      } else {
        selectedTopics.push(String(topic));
      }
    }
    operationConfig.subscribe!.topics = selectedTopics;
    return operationConfig;
  }

  /**
   * Creates and prepares all consumers defined in the API document.
   * @protected
   */
  protected async _createAllConsumers() {
    const admin = new Admin({
      ...this._config.client,
    });
    const availableTopics = await admin.listTopics({
      includeInternals: false,
    });
    await admin.close();

    for (const controller of this.document.getMqApi().controllers.values()) {
      let instance = controller.instance;
      if (!instance && controller.ctor) instance = new controller.ctor();
      if (!instance) continue;
      this._controllerInstances.set(controller, instance);

      /* Build HandlerData array */
      for (const operation of controller.operations.values()) {
        const operationConfig = await this._getOperationArguments(
          controller,
          instance,
          operation,
          availableTopics,
        );
        if (!operationConfig) continue;
        const args: HandlerArguments = {
          consumer: null as any,
          controller,
          instance,
          operation,
          operationConfig,
          handler: null as any,
          topics: null as any,
        };
        this._createHandler(args);
        this._handlerArgs.push(args);
      }
    }

    /* Initialize consumers */
    for (const args of this._handlerArgs) {
      await this._createConsumer(args);
    }
  }

  /**
   * Creates a Rabbitmq consumer for the given handler arguments if it doesn't already exist.
   *
   * @param args - The handler arguments containing configuration and state.
   * @throws {@link Error} Throws if a self-consumer for the group ID already exists.
   * @protected
   */
  protected async _createConsumer(args: HandlerArguments) {
    const { operationConfig } = args;
    let consumer = this._consumers.get(operationConfig.consumer.groupId);
    if (consumer && operationConfig.selfConsumer) {
      throw new Error(
        `Operation consumer for groupId (${operationConfig.consumer.groupId}) already exists`,
      );
    }
    /* Create consumers */
    if (!consumer) {
      consumer = new Consumer({
        ...operationConfig.consumer,
        deserializers: stringDeserializers,
      });
      // consumer[kGroupId] = operationConfig.consumer.groupId;
      this._consumers.set(operationConfig.consumer.groupId, consumer);
    }
    args.consumer = consumer;
  }

  /**
   * Creates a message handler for a specific MQ operation.
   * This handler processes incoming Kafka messages, decodes them, and executes the operation.
   *
   * @param args - The handler arguments for the operation.
   * @protected
   */
  protected _createHandler(args: HandlerArguments) {
    const { controller, instance, operation } = args;
    /* Prepare parsers */
    /* Prepare decoders */
    const decodeKey = operation.generateKeyCodec('decode', {
      scope: this.scope,
      ignoreReadonlyFields: true,
    });
    const decodePayload = operation.generateCodec('decode', {
      scope: this.scope,
      ignoreReadonlyFields: true,
    });
    operation.headers.forEach(header => {
      let decode = this[kAssetCache].get<Validator>(header, 'decode');
      if (!decode) {
        decode = header.generateCodec('decode', {
          scope: this.scope,
          ignoreReadonlyFields: true,
        });
        this[kAssetCache].set(header, 'decode', decode);
      }
    });

    args.handler = async (message: KafkaAdapter.Message) => {
      const operationHandler = instance[operation.name] as Function;
      let key: any;
      let payload: any;
      const headers: any = {};
      try {
        /* Parse and decode `key` */
        if (message.key) {
          key = decodeKey(message.key);
        }
        /* Parse and decode `payload` */
        if (message.value != null) {
          payload = decodePayload(message.value);
        }
        /* Parse and decode `headers` */
        if (message.headers) {
          for (const [k, v] of message.headers.entries()) {
            const header = operation.findHeader(k);
            const decode =
              this[kAssetCache].get<Validator>(header, 'decode') || vg.isAny();
            headers[k] = decode(v);
          }
        }
      } catch (e) {
        this._emitError(e);
        return;
      }
      /* Create context */
      const context = new KafkaContext({
        __adapter: this,
        __contDef: controller,
        __controller: instance,
        __oprDef: operation,
        __handler: operationHandler,
        topic: message.topic,
        partition: message.partition,
        payload,
        key,
        headers,
        rawMessage: message,
        commit: () => message.commit(),
      });

      await this.emitAsync('execute', context);
      try {
        /* Call operation handler */
        const result = await operationHandler.call(instance, context);
        await this.emitAsync('finish', context, result);
      } catch (e: any) {
        this._emitError(e, context);
      }
    };
  }

  /**
   * Emits an error event and logs the error.
   *
   * @param error - The error that occurred.
   * @param context - The optional Kafka execution context.
   * @protected
   */
  protected _emitError(error: any, context?: KafkaContext) {
    Promise.resolve()
      .then(async () => {
        const logger = this.logger;
        if (context) {
          if (!context.errors.length) context.errors.push(error);
          context.errors = this._wrapExceptions(context.errors);
          if (context.listenerCount('error')) {
            await context
              .emitAsync('error', context.errors[0], context)
              .catch(noOp);
          }
          if (logger?.error) {
            context.errors.forEach(err => logger.error(err));
          }
        } else logger?.error(error);
        if (this.listenerCount('error')) this._emitError(error);
      })
      .catch(noOp);
  }

  /**
   * Wraps multiple exceptions into an array of {@link OpraException}.
   *
   * @param exceptions - The array of exceptions to wrap.
   * @returns An array of wrapped exceptions.
   * @protected
   */
  protected _wrapExceptions(exceptions: any[]): OpraException[] {
    const wrappedErrors = exceptions.map(e =>
      e instanceof OpraException ? e : new OpraException(e),
    );
    if (!wrappedErrors.length)
      wrappedErrors.push(new OpraException('Internal Server Error'));
    return wrappedErrors;
  }
}

/**
 * Namespace for KafkaAdapter related types and interfaces.
 */
export namespace KafkaAdapter {
  /**
   * Callback function for the next middleware in the interceptor chain.
   */
  export type NextCallback = () => Promise<any>;

  /**
   * Represents the operational status of the Kafka adapter.
   */
  export type Status = 'idle' | 'starting' | 'started' | 'closing';

  export type ClientOptions = BaseOptions;

  export type ConsumerOptions = _ConsumerOptions<any, any, any, any>;

  export type SubscribeOptions = ConsumeOptions<any, any, any, any>;

  export type Message = _Message<any, any, any, any>;

  export type MessageHandler = (message: Message) => Promise<void>;

  /**
   * Configuration options for the Kafka adapter.
   */
  export interface Config extends PlatformAdapter.Options {
    /* Kafka client configuration */
    client: ClientOptions;
    /* Map of consumer group IDs to their configurations */
    consumers?: Record<
      string,
      StrictOmit<ConsumerOptions, 'groupId' | keyof ClientOptions>
    >;
    /* Default configurations for consumers and subscriptions */
    defaults?: {
      consumer?: ConsumerOptions;
      subscribe?: SubscribeOptions;
    };
    /* Scope for decoding and encoding */
    scope?: string;
    /* Interceptors to wrap the execution of operations */
    interceptors?: (InterceptorFunction | IKafkaInterceptor)[];
    /* Whether to log additional information from KafkaJS */
    logExtra?: boolean;
  }

  /**
   * Options for a specific Kafka operation.
   */
  export interface OperationOptions {
    /**
     * Group ID or consumer configuration.
     */
    consumer?: string | ConsumerOptions;
    /**
     * Subscription options for the topic.
     */
    subscribe?: SubscribeOptions;
  }

  /**
   * Type definition for a Kafka interceptor function.
   */
  export type InterceptorFunction = IKafkaInterceptor['intercept'];

  /**
   * Interface for a Kafka interceptor class.
   */
  export interface IKafkaInterceptor {
    /**
     * Intercepts the execution of a Kafka operation.
     *
     * @param context - The Kafka execution context.
     * @param next - The next function in the chain.
     * @returns A promise that resolves to the result of the operation.
     */
    intercept(context: KafkaContext, next: NextCallback): Promise<any>;
  }

  /**
   * Event definitions for the Kafka adapter.
   */
  export interface Events {
    /* Emitted when an error occurs */
    error: [error: Error, context: KafkaContext | undefined];
    /* Emitted when an operation finishes successfully */
    finish: [context: KafkaContext, result: any];
    /* Emitted when an operation starts execution */
    execute: [context: KafkaContext];
    /* Emitted when a message is received from Kafka */
    message: [message: Message];
  }
}
