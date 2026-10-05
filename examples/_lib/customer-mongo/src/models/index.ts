import path from 'node:path';
import {
  ApiDocument,
  ApiDocumentFactory,
  OpraSchema,
  TranslationFileStore,
} from '@opra/common';
import { AddressType } from './enums/address-type.js';
import { Gender } from './enums/gender.js';
import { Address } from './types/address.js';
import { Config } from './types/config.js';
import { Country, CountryCodeType } from './types/country.js';
import { Customer } from './types/customer.js';
import {
  DriversLicense,
  NationalId,
  Passport,
} from './types/identity-document.js';
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
export * from './types/identity-document.js';
export * from './types/note.js';
export * from './types/person.js';
export * from './types/phone-number.js';
export * from './types/profile.js';
export * from './types/record.js';

export namespace CustomerModelsDocument {
  let document: ApiDocument | undefined;
  export const schema: ApiDocumentFactory.InitArguments = {
    spec: OpraSchema.SpecVersion,
    // This document publishes its own documentation. Its types are imported by
    // the sample applications, but a node's texts are only ever looked up in
    // the bundle of the document that declares it - so the translations for
    // `Customer`, `Note`, `Profile` and the rest live here, next to them,
    // rather than in whichever application happens to reference them.
    //
    // `src/docs`, reached relative to this module: the same `../docs` then
    // resolves both from the sources and from a build output, where `src/`
    // is gone and this file is `models/index.js` at the package root.
    translationStore: new TranslationFileStore(
      path.join(import.meta.dirname, '../docs'),
    ),
    info: {
      title: 'Customer Models Document',
      version: '1.1',
      contact: [
        {
          name: 'Eren Aydın',
          email: 'eren.aydin@example.com',
          url: 'https://example.com',
        },
        {
          name: 'Naz Demir',
          email: 'naz.demir@example.com',
          url: 'https://example.com/team/naz-demir',
        },
      ],
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT',
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
      DriversLicense,
      NationalId,
      Note,
      Passport,
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
