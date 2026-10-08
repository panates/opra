import { ApiDocument } from '@opra/common';
import { ExpressAdapter } from '@opra/http';
import { OpraTestClient } from '@opra/testing';
import { expect } from 'expect';
import express, { type Express } from 'express';
import supertest from 'supertest';
import { FilesController } from '../_support/test-api/api/files.controller.js';
import { createTestApi } from '../_support/test-api/index.js';

describe('http:e2e:Storage', () => {
  let document: ApiDocument;
  let app: Express;
  let adapter: ExpressAdapter;
  const testArgs: any = {};

  before(async () => {
    document = await createTestApi();
    app = express();
    adapter = new ExpressAdapter(app, document);
    testArgs.app = app;
    testArgs.client = new OpraTestClient(app, { document });
  });

  after(async () => adapter.close());

  it('Should execute "post" operation', async () => {
    const resp = await supertest(adapter.app)
      .post('/Files')
      .set('content-type', 'multipart/form-data; boundary=AaB03x')
      .send(
        Buffer.from(
          '--AaB03x\r\n' +
            'content-disposition: form-data; name="notes"\r\n' +
            '\r\n' +
            'Joe Blow\r\nalmost tricked you!\r\n' +
            '--AaB03x\r\n' +
            'content-disposition: form-data; name="file1"; filename="file1.txt"\r\n' +
            'Content-Type: text/plain\r\n' +
            '\r\n' +
            '... contents of file1.txt ...\r\r\n' +
            '--AaB03x--\r\n',
        ),
      );
    expect(FilesController.lastPost).toBeDefined();
    expect(Array.isArray(FilesController.lastPost)).toBeTruthy();
    expect(FilesController.lastPost[0].field).toStrictEqual('notes');
    expect(FilesController.lastPost[1].field).toStrictEqual('file1');
    expect(resp.type).toStrictEqual('application/json');
    expect(resp.body).toBeDefined();
    expect(resp.statusCode).toStrictEqual(200);
    expect(resp.body.title).toStrictEqual('title');
    expect(resp.body.text).toStrictEqual('notes');
  });

  it('Should answer 400 when a required part is missing', async () => {
    // The client's mistake, not the server's: this used to come back as
    // `500 RESPONSE_VALIDATION`, because the reader threw valgen's own
    // `ValidationError` and the adapter's catch block reads any
    // `ValidationError` reaching it as a failure to encode the response.
    const resp = await supertest(adapter.app)
      .post('/Files')
      .set('content-type', 'multipart/form-data; boundary=AaB03x')
      .send(
        Buffer.from(
          '--AaB03x\r\n' +
            'content-disposition: form-data; name="notes2"\r\n' +
            '\r\n' +
            'only the optional one\r\n' +
            '--AaB03x--\r\n',
        ),
      );
    expect(resp.statusCode).toStrictEqual(400);
    expect(resp.body.errors).toBeDefined();
    expect(resp.body.errors[0]).toMatchObject({
      code: 'REQUEST_VALIDATION',
      message: 'Multi part field "notes" is required',
    });
  });
});
