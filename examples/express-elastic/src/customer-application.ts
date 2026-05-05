import { Client } from '@elastic/elasticsearch';
import { ApiDocument } from '@opra/common';
import { ExpressAdapter, HttpAdapter } from '@opra/http';
import express from 'express';
import { CustomerApiDocument } from './api-document.js';

export class CustomerApplication {
  declare adapter: ExpressAdapter;
  declare document: ApiDocument;
  declare dbClient: Client;
  declare express: express.Express;

  static async create(
    options?: HttpAdapter.Options,
  ): Promise<CustomerApplication> {
    const app = new CustomerApplication();
    try {
      const host = process.env.MONGO_HOST || 'http://127.0.0.1:9200';
      app.dbClient = new Client({ node: host });
      app.document = await CustomerApiDocument.create(app.dbClient);
      app.express = express();
      app.adapter = new ExpressAdapter(app.express, app.document, options);
    } catch (e) {
      await app.close();
      throw e;
    }
    return app;
  }

  protected constructor() {}

  async close() {
    await this.dbClient?.close();
    await this.adapter?.close();
  }
}
