import {
  ApiDocumentFactory,
  ApiField,
  ComplexType,
  SimpleType,
  StringType,
} from '@opra/common';
import { expect } from 'expect';

describe('common:DataTypeFactory - SimpleType (Class)', () => {
  it('Should import SimpleType', async () => {
    @SimpleType()
    class Type1 {}

    const doc = await ApiDocumentFactory.createDocument({
      types: [Type1],
    });
    expect(doc).toBeDefined();
    const t = doc.node.getSimpleType('type1');
    expect(t).toBeDefined();
    expect(t.kind).toStrictEqual('SimpleType');
    expect(t.name).toStrictEqual('type1');
  });

  it('Should extend SimpleType', async () => {
    @SimpleType()
    class Type1 extends StringType {}

    const doc = await ApiDocumentFactory.createDocument({
      types: [Type1],
    });
    expect(doc).toBeDefined();
    const t = doc.node.getSimpleType('type1');
    expect(t).toBeDefined();
    expect(t.kind).toStrictEqual('SimpleType');
    expect(t.name).toStrictEqual('type1');
    expect(t.base).toBeDefined();
    expect(t.base?.name).toStrictEqual('string');
  });

  it('Should import SimpleType from an instance of a named subclass', async () => {
    // A named SimpleType subclass — as opposed to an unnamed/embedded one —
    // used via a live instance (`new Type2()`) rather than the bare class
    // reference. The instance's own base should resolve to `string` (its
    // real superclass), not to `type2` (its own name), which isn't itself
    // declared anywhere and would otherwise fail to resolve.
    @SimpleType({ name: 'type2' })
    class Type2 extends StringType {
      constructor() {
        super({ pattern: /^[A-Z]+$/ });
      }
    }

    @ComplexType()
    class Owner {
      @ApiField({ type: new Type2() })
      declare value: string;
    }

    const doc = await ApiDocumentFactory.createDocument({
      types: [Owner],
    });
    expect(doc).toBeDefined();
    const owner = doc.node.getComplexType('owner');
    expect(owner).toBeDefined();
    const field = owner.getField('value');
    expect(field).toBeDefined();
    expect(field.type.kind).toStrictEqual('SimpleType');
    const fieldType = field.type as SimpleType;
    expect(fieldType.base).toBeDefined();
    expect(fieldType.base?.name).toStrictEqual('string');
  });
});
