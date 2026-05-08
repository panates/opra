import { ServiceBase } from '@opra/core';
import { SqbClient, SqbConnection } from '@sqb/connect';

const transactionKey = Symbol.for('transaction');

/**
 * Namespace for SqbServiceBase types and options.
 */
export namespace SqbServiceBase {
  /**
   * Options for initializing SqbServiceBase.
   */
  export interface Options extends ServiceBase.Options {
    /**
     * The SQB client or connection used by this service.
     */
    db?: SqbServiceBase['db'];
  }
}

/**
 * Base class for services using SQB (SQL Builder) for database operations.
 */
export class SqbServiceBase extends ServiceBase {
  /**
   * The SQB client or connection used by this service.
   */
  db?:
    | (SqbClient | SqbConnection)
    | ((_this: this) => SqbClient | SqbConnection);

  /**
   * Constructs a new instance.
   *
   * @param options - Options for the service.
   */
  constructor(options?: SqbServiceBase.Options) {
    super(options);
    this.db = options?.db;
  }

  /**
   * Executes the provided callback within a database transaction.
   * If a transaction is already active in the current context, the callback
   * joins it rather than starting a new one.
   *
   * @param callback - The function to execute within the transaction.
   */
  async withTransaction<U = any>(
    callback: (connection: SqbConnection, _this: this) => U,
  ): Promise<U> {
    const ctx = this.context;
    let closeSessionOnFinish = false;

    let connection: SqbConnection | undefined = ctx[transactionKey];
    if (!connection) {
      /* Determine the SqbClient or SqbConnection instance */
      const db = await this.getConnection();
      if (db instanceof SqbConnection) {
        connection = db;
      } else {
        /* Acquire a connection. New connection should be at the end */
        connection = await db.acquire({ autoCommit: false });
        closeSessionOnFinish = true;
      }
      /* Store transaction connection in current context */
      ctx[transactionKey] = connection;
    }

    const oldInTransaction = connection.inTransaction;
    connection.retain();
    try {
      if (!oldInTransaction) await connection.startTransaction();
      const out = await callback(connection, this);
      if (!oldInTransaction && connection.inTransaction)
        await connection.commit();
      return out;
    } catch (e) {
      if (!oldInTransaction && connection.inTransaction)
        await connection.rollback();
      throw e;
    } finally {
      delete ctx[transactionKey];
      /* Release connection */
      if (closeSessionOnFinish) {
        await connection.close();
      } else connection.release();
    }
  }

  /**
   * Returns the active database connection for the current context.
   *
   * @throws If no database connection is configured.
   */
  getConnection():
    | SqbConnection
    | SqbClient
    | Promise<SqbConnection | SqbClient> {
    const ctx = this.context;
    let db = ctx[transactionKey];
    if (db) return db;
    db = typeof this.db === 'function' ? this.db(this) : this.db;
    if (db) return db;
    throw new Error(`Database not set!`);
  }
}
