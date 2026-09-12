import { ApiDocument, ApiDocumentFactory } from '@opra/common';
import { CustomerModelsDocument } from 'example-customer-mongo';
import { Db } from 'mongodb';
import { AuthController } from './api/auth.controller.js';
import { CustomerController } from './api/customer.controller.js';
import {
  CustomerCreateInput,
  CustomersController,
} from './api/customers-controller.js';

export namespace CustomerApiDocument {
  export async function create(db: Db): Promise<ApiDocument> {
    const doc = await ApiDocumentFactory.createDocument({
      info: {
        title: 'Customer Application',
        version: '1.0',
        description: `A sample Opra API that demonstrates how to build a full-featured HTTP resource server with Opra, backed by MongoDB.

This service ties together several patterns you will likely need in a real application: cookie-based authentication, a self-service profile endpoint for the signed-in user, and a full CRUD interface for managing customers together with their notes.

### What's inside

- **Authentication** — \`login\`/\`logout\` endpoints under \`Auth\`, plus a nested \`MyProfile\` resource for the authenticated user's own record.
- **Customers** — full CRUD for the \`Customer\` resource, including a dedicated \`setStatus\` operation for soft-activation/deactivation instead of a hard delete.
- **Notes** — a nested collection under each customer, exercised through its own \`Notes\` controller.
- **Rich schema** — enums, array constraints, regex-validated strings and localized fields, all documented in the \`Customer Models Document\` reference below.

:::tip
Switch to the **Customer Models Document** reference (top-left picker, or the *Reference documents* section below) to browse the full data model independently of the HTTP surface.
:::`,
        termsOfService:
          'By using this sample API you agree that it is provided strictly for demonstration purposes, "as is", without any warranty of availability, accuracy or fitness for a particular purpose, and that no real customer data should ever be submitted to it.',
        contact: [
          { name: 'Eren Aydın', email: 'eren.aydin@panates.com', url: 'https://panates.com' },
          { name: 'Naz Demir', email: 'naz.demir@panates.com', url: 'https://panates.com/team/naz-demir' },
        ],
        license: {
          name: 'MIT',
          url: 'https://opensource.org/licenses/MIT',
          content: `MIT License

Copyright (c) 2020-present Panates

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`,
        },
      },
      types: [CustomerCreateInput],
      references: {
        cm: () => CustomerModelsDocument.create(),
      },
      api: {
        name: 'CustomerApi',
        transport: 'http',
        controllers: [
          new AuthController(db),
          new CustomerController(db),
          new CustomersController(db),
        ],
      },
    });
    return doc;
  }
}
