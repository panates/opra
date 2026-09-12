import { ApiDocument, ApiDocumentFactory, OpraSchema } from '@opra/common';
import { AddressType } from './enums/address-type.js';
import { Gender } from './enums/gender.js';
import { Address } from './types/address.js';
import { Config } from './types/config.js';
import { Country, CountryCodeType } from './types/country.js';
import { Customer } from './types/customer.js';
import { Note } from './types/note.js';
import { Person, PersonNameType } from './types/person.js';
import { PhoneNumber, PhoneNumberType } from './types/phone-number.js';
import { Profile } from './types/profile.js';
import { Record } from './types/record.js';

export * from './enums/address-type.js';
export * from './enums/gender.js';
export * from './types/address.js';
export * from './types/config.js';
export * from './types/country.js';
export * from './types/customer.js';
export * from './types/note.js';
export * from './types/person.js';
export * from './types/phone-number.js';
export * from './types/profile.js';
export * from './types/record.js';

export namespace CustomerModelsDocument {
  let document: ApiDocument | undefined;
  export const schema: ApiDocumentFactory.InitArguments = {
    spec: OpraSchema.SpecVersion,
    info: {
      title: 'Customer Models Document',
      version: 'v1',
      description: `The complete data model shared by the customer-facing sample applications (\`express-mongo\`, \`express-elastic\`, \`express-sqb\` and the NestJS variant).

Every type here is storage-agnostic — the same \`Customer\`, \`Person\`, \`Address\`, \`Note\` and enum definitions are reused across MongoDB, Elasticsearch and SQL-backed examples; only the persistence layer changes underneath. Browse the **Models** section below for a breakdown by kind, or open any type from the sidebar to see its fields, constraints and examples.`,
      termsOfService:
        'These type definitions are published purely as a reference for the Opra example applications; they carry no warranty and must not be treated as a stable, versioned public schema.',
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
    types: [
      AddressType,
      Gender,
      Address,
      Config,
      Country,
      CountryCodeType,
      Customer,
      Note,
      Person,
      PersonNameType,
      PhoneNumber,
      PhoneNumberType,
      Profile,
      Record,
    ],
  };

  export async function create(): Promise<ApiDocument> {
    return ApiDocumentFactory.createDocument(schema);
  }

  export async function init(): Promise<ApiDocument> {
    if (!document) document = await create();
    return document;
  }
}
