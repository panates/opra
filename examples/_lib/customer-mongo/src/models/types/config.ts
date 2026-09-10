import { ComplexType } from '@opra/common';
import { Record } from './record.js';

@ComplexType({
  description: 'Internal application configuration, not exposed over the API',
  additionalFields: true,
  scopePattern: 'db',
})
export class Config extends Record {}
