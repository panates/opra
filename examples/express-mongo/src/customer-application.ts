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
    app.document = await CustomerApiDocument.create(app);
    app.express = express();
    // `$openapi`/`apiUi` are published by the adapter itself now (see
    // `ExpressAdapter._initRouter`) — no more manually mounting
    // `expressApiUi` on `app.express` ourselves beforehand.
    app.adapter = new ExpressAdapter(app.express, app.document, {
      scope: 'api',
      openapi: true,
      apiUi: {
        path: '/ui',
        pageTitle: 'Customer Application',
        // `db`-scoped fields (soft-delete/audit columns writable instead
        // of readonly, `Customer.dbField`, the whole `Config` type — see
        // `examples/_lib/customer-mongo/src/models`) are invisible under
        // the `api` scope the adapter itself runs requests under. This
        // lets backend readers switch the *docs* to `db` and see them too.
        scopes: ['api', 'db'],
      },
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
