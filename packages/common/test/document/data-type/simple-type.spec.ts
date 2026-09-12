import { ApiDocument } from '@opra/common';
import { expect } from 'expect';
import { TestHttpApiDocument } from '../../_support/test-http-api/index.js';

describe('common:SimpleType', () => {
  let doc: ApiDocument;

  before(async () => {
    doc = await TestHttpApiDocument.create();
  });

  it('Should exportSchema() return schema', async () => {
    const dt = doc.node.getSimpleType('string');
    expect(dt).toBeDefined();
    const x = dt!.toJSON();
    expect(x).toBeDefined();
    expect(x).toStrictEqual({
      kind: 'SimpleType',
      description: 'A sequence of characters',
      nameMappings: {
        js: 'string',
        json: 'string',
      },
      attributes: {
        maxLength: {
          format: 'number',
          description: 'Maximum number of characters',
        },
        minLength: {
          format: 'number',
          description: 'Minimum number of characters',
        },
        pattern: {
          format: 'string',
          description: 'Regex pattern to be used for validation',
        },
        patternName: {
          description: 'Name of the pattern',
          format: 'string',
        },
      },
    });
  });
});
