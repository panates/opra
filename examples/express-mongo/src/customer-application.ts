import { expressApiUi } from '@opra/api-ui';
import { ApiDocument } from '@opra/common';
import { ExpressAdapter, HttpAdapter } from '@opra/http';
import express from 'express';
import { Db, MongoClient } from 'mongodb';
import { CustomerApiDocument } from './api-document.js';

export class CustomerApplication {
  declare adapter: ExpressAdapter;
  declare document: ApiDocument;
  declare dbClient: MongoClient;
  declare express: express.Express;
  declare db: Db;

  static async create(
    options?: HttpAdapter.Options,
  ): Promise<CustomerApplication> {
    const app = new CustomerApplication();
    try {
      const host =
        process.env.MONGO_HOST ||
        'mongodb://127.0.0.1:27017/?directConnection=true';
      app.dbClient = new MongoClient(host);
      app.db = app.dbClient.db(process.env.MONGO_DATABASE || 'customer_app');
    } catch (e) {
      await app.close();
      throw e;
    }
    app.document = await CustomerApiDocument.create(app.db);
    app.express = express();
    // Mounted before ExpressAdapter — its router is mounted at "/" and
    // would otherwise swallow "/ui" with a "no endpoint found" error.
    app.express.use(
      '/ui',
      expressApiUi(app.document, {
        pageTitle: 'Customer Application',
        scope: 'api',
      }),
    );
    app.adapter = new ExpressAdapter(app.express, app.document, {
      scope: 'api',
      ...options,
    });
    return app;
  }

  protected constructor() {}

  async close() {
    await this.dbClient?.close();
    await this.adapter?.close();
  }
}
