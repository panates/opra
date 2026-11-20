import { OpraFilter } from '@opra/common';
import { expect } from 'expect';

describe('common:Parse Filter', () => {
  it('Should parse NumberLiteral', () => {
    let x = OpraFilter.parse('a=1');
    expect(x.right.kind).toStrictEqual('NumberLiteral');
    expect(x.right.value).toStrictEqual(1);
    x = OpraFilter.parse('a=-1');
    expect(x.right.kind).toStrictEqual('NumberLiteral');
    expect(x.right.value).toStrictEqual(-1);
  });

  it('Should parse StringLiteral', () => {
    const x = OpraFilter.parse('a="1"');
    expect(x.right.kind).toStrictEqual('StringLiteral');
    expect(x.right.value).toStrictEqual('1');
  });

  it('Should parse BooleanLiteral', () => {
    const x = OpraFilter.parse('a=true');
    expect(x.right.kind).toStrictEqual('BooleanLiteral');
    expect(x.right.value).toStrictEqual(true);
  });

  it('Should parse DateLiteral', () => {
    const x = OpraFilter.parse('a="2020-01-01"');
    expect(x.right.kind).toStrictEqual('DateLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01');
  });

  it('Should parse DateTimeLiteral', () => {
    let x = OpraFilter.parse('a="2020-01-01T10:30:00"');
    expect(x.right.kind).toStrictEqual('DateTimeLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01T10:30:00');
    x = OpraFilter.parse('a="2020-01-01T10:30"');
    expect(x.right.kind).toStrictEqual('DateTimeLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01T10:30');
    x = OpraFilter.parse('a="2020-01-01T10:30+03:00"');
    expect(x.right.kind).toStrictEqual('DateTimeLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01T10:30+03:00');
    x = OpraFilter.parse('a="2020-01-01 10:30:00"');
    expect(x.right.kind).toStrictEqual('DateTimeLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01 10:30:00');
    x = OpraFilter.parse('a="2020-01-01 10:30"');
    expect(x.right.kind).toStrictEqual('DateTimeLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01 10:30');
    x = OpraFilter.parse('a="2020-01-01 10:30+03:00"');
    expect(x.right.kind).toStrictEqual('DateTimeLiteral');
    expect(x.right.value).toStrictEqual('2020-01-01 10:30+03:00');
  });

  it('Should parse Infinity', () => {
    let x = OpraFilter.parse('a=Infinity');
    expect(x.right.kind).toStrictEqual('NumberLiteral');
    expect(x.right.value).toStrictEqual(Infinity);
    x = OpraFilter.parse('a=infinity');
    expect(x.right.kind).toStrictEqual('NumberLiteral');
    expect(x.right.value).toStrictEqual(Infinity);
  });

  it('Should parse NullLiteral', () => {
    const x = OpraFilter.parse('a=null');
    expect(x.right.kind).toStrictEqual('NullLiteral');
    expect(x.right.value).toStrictEqual(null);
  });

  it('Should parse ArrayExpression', () => {
    const x = OpraFilter.parse('a=["1", 2]');
    expect(x.right.kind).toStrictEqual('ArrayExpression');
    expect(x.right.items.length).toStrictEqual(2);
    expect(x.right.items[0].kind).toEqual('StringLiteral');
    expect(x.right.items[0].value).toEqual('1');
    expect(x.right.items[1].kind).toEqual('NumberLiteral');
    expect(x.right.items[1].value).toEqual(2);
    expect('' + x).toStrictEqual(`a=['1',2]`);
  });

  it('Should parse (=) ComparisonExpression', () => {
    const x = OpraFilter.parse('a=1');
    expect(x.kind).toStrictEqual('ComparisonExpression');
    expect(x.op).toStrictEqual('=');
    expect(x.left.kind).toStrictEqual('QualifiedIdentifier');
    expect(x.left.value).toStrictEqual('a');
    expect(x.right.kind).toStrictEqual('NumberLiteral');
    expect(x.right.value).toStrictEqual(1);
    expect('' + x).toStrictEqual('a=1');
  });

  it('Should parse (>) ComparisonExpression', () => {
    const x = OpraFilter.parse('a>1');
    expect(x.kind).toStrictEqual('ComparisonExpression');
    expect(x.op).toStrictEqual('>');
  });

  it('Should parse (<) ComparisonExpression', () => {
    const x = OpraFilter.parse('a<1');
    expect(x.kind).toStrictEqual('ComparisonExpression');
    expect(x.op).toStrictEqual('<');
  });

  it('Should parse (>=) ComparisonExpression', () => {
    const x = OpraFilter.parse('a>=1');
    expect(x.kind).toStrictEqual('ComparisonExpression');
    expect(x.op).toStrictEqual('>=');
  });

  it('Should parse (<=) ComparisonExpression', () => {
    const x = OpraFilter.parse('a<=1');
    expect(x.kind).toStrictEqual('ComparisonExpression');
    expect(x.op).toStrictEqual('<=');
  });

  it('Should parse (in) ComparisonExpression', () => {
    const x = OpraFilter.parse('a in [1,2]');
    expect(x.kind).toStrictEqual('ComparisonExpression');
    expect(x.op).toStrictEqual('in');
  });

  it('Should parse every comparison operator', () => {
    for (const op of ['<=', '<', '>', '>=', '=', '!=']) {
      const x = OpraFilter.parse(`a${op}1`);
      expect(x.op).toStrictEqual(op);
    }
    for (const op of ['in', '!in', 'like', '!like', 'ilike', '!ilike']) {
      const x = OpraFilter.parse(`a ${op} 'x'`);
      expect(x.op).toStrictEqual(op);
      expect(x.right.value).toStrictEqual('x');
    }
  });

  it('Should parse numbers', () => {
    const value = (s: string) => OpraFilter.parse('a=' + s).right.value;
    expect(value('12')).toStrictEqual(12);
    expect(value('-12')).toStrictEqual(-12);
    expect(value('1.5')).toStrictEqual(1.5);
    expect(value('1.')).toStrictEqual(1);
    expect(value('-1.5E-3')).toStrictEqual(-0.0015);
    expect(value('+1')).toStrictEqual(1n);
    expect(value('0x1F')).toStrictEqual(31n);
    expect(value('12345678901234567890')).toStrictEqual(12345678901234567890n);
    expect(() => OpraFilter.parse('a=1E5')).toThrow('Invalid number literal');
    expect(() => OpraFilter.parse('a=1e5')).toThrow(/at column: 3/);
  });

  it('Should parse strings with escapes and both quote types', () => {
    const value = (s: string) => OpraFilter.parse('a=' + s).right;
    expect(value(`'it\\'s'`).value).toStrictEqual(`it's`);
    expect(value(`"say \\"hi\\""`).value).toStrictEqual(`say "hi"`);
    expect(value(`'a\\\\b'`).value).toStrictEqual('a\\b');
    expect(value(`'x"y'`).value).toStrictEqual('x"y');
    expect(value(`''`).value).toStrictEqual('');
    expect(value(`'and'`).kind).toStrictEqual('StringLiteral');
  });

  it('Should tell dates, times and date-times from strings', () => {
    const kind = (s: string) => OpraFilter.parse('a=' + s).right.kind;
    expect(kind(`'2020-01-01'`)).toStrictEqual('DateLiteral');
    expect(kind(`'10:30'`)).toStrictEqual('TimeLiteral');
    expect(kind(`"10:30:15.123"`)).toStrictEqual('TimeLiteral');
    expect(kind(`"2020-01-01T10:30:00Z"`)).toStrictEqual('DateTimeLiteral');
    expect(kind(`"2020-01-01T10:30-3"`)).toStrictEqual('DateTimeLiteral');
    // The grammar only knows double-quoted date-times
    expect(kind(`'2020-01-01T10:30'`)).toStrictEqual('StringLiteral');
    expect(kind(`"2020-13-01"`)).toStrictEqual('StringLiteral');
    expect(kind(`"24:00"`)).toStrictEqual('StringLiteral');
    expect(kind(`"2020-01-01x"`)).toStrictEqual('StringLiteral');
  });

  it('Should parse identifiers and external constants', () => {
    let x = OpraFilter.parse('address . city = @city');
    expect(x.left.kind).toStrictEqual('QualifiedIdentifier');
    expect(x.left.value).toStrictEqual('address.city');
    expect(x.right.kind).toStrictEqual('ExternalConstant');
    expect(x.right.value).toStrictEqual('city');
    x = OpraFilter.parse('$a_1=b.c');
    expect(x.left.value).toStrictEqual('$a_1');
    expect(x.right.kind).toStrictEqual('QualifiedIdentifier');
    expect(x.right.value).toStrictEqual('b.c');
    // Keywords as a prefix of a longer name are identifiers
    x = OpraFilter.parse('notes=1 and index=2 or nullable=true');
    expect('' + x).toStrictEqual('notes=1 and index=2 or nullable=true');
  });

  it('Should parse logical expressions left to right with equal precedence', () => {
    let x = OpraFilter.parse('a=1 and b=2 and c=3');
    expect(x.kind).toStrictEqual('LogicalExpression');
    expect(x.op).toStrictEqual('and');
    expect(x.items.length).toStrictEqual(3);
    x = OpraFilter.parse('a=1 or b=2 and c=3');
    expect(x.op).toStrictEqual('and');
    expect(x.items[0].op).toStrictEqual('or');
    expect(x.items[0].items.length).toStrictEqual(2);
    x = OpraFilter.parse('a=1 || b=2 or c=3');
    expect(x.op).toStrictEqual('or');
    expect(x.items.length).toStrictEqual(2);
    expect(x.items[0].op).toStrictEqual('or');
    x = OpraFilter.parse('a=1&&b=2&&c=3');
    expect(x.op).toStrictEqual('and');
    expect(x.items.length).toStrictEqual(3);
  });

  it('Should parse negation with the lowest precedence', () => {
    let x = OpraFilter.parse('not a=1 and b=2');
    expect(x.kind).toStrictEqual('NegativeExpression');
    expect(x.expression.kind).toStrictEqual('LogicalExpression');
    x = OpraFilter.parse('a=1 and !b=2');
    expect(x.kind).toStrictEqual('LogicalExpression');
    expect(x.items[1].kind).toStrictEqual('NegativeExpression');
    x = OpraFilter.parse('!(a=1) or b=2');
    expect(x.kind).toStrictEqual('NegativeExpression');
  });

  it('Should parse parentheses', () => {
    const x = OpraFilter.parse('(a=1 or b=2) and (c=3)');
    expect(x.op).toStrictEqual('and');
    expect(x.items[0].kind).toStrictEqual('ParenthesizedExpression');
    expect(x.items[0].expression.op).toStrictEqual('or');
    expect('' + x).toStrictEqual('(a=1 or b=2) and (c=3)');
    expect('' + OpraFilter.parse('((a=1))')).toStrictEqual('((a=1))');
  });

  it('Should ignore whitespace and new lines', () => {
    const x = OpraFilter.parse(' a\t=\r\n1\nand b in [ 1 , "x" ] ');
    expect('' + x).toStrictEqual(`a=1 and b in [1,'x']`);
  });

  it('Should throw SyntaxError with the column of the error', () => {
    const column = (s: string) => {
      try {
        OpraFilter.parse(s);
      } catch (e: any) {
        expect(e.constructor.name).toStrictEqual('SyntaxError');
        return Number(/at column: (\d+)/.exec(e.message)?.[1]);
      }
      throw new Error(`"${s}" did not throw`);
    };
    expect(column('')).toStrictEqual(0);
    expect(column('a')).toStrictEqual(1);
    expect(column('a=')).toStrictEqual(2);
    expect(column('a=1 b=2')).toStrictEqual(4);
    expect(column('(a=1')).toStrictEqual(4);
    expect(column('a=1)')).toStrictEqual(3);
    expect(column('null=1')).toStrictEqual(0);
    expect(column('a=b=1')).toStrictEqual(3);
    expect(column('a in []')).toStrictEqual(6);
    expect(column('a in [1,b]')).toStrictEqual(8);
    expect(column('a=- 1')).toStrictEqual(2);
    expect(column('a="x')).toStrictEqual(2);
    expect(column('a=#')).toStrictEqual(2);
    expect(column('!inStock=true')).toStrictEqual(0);
  });

  it('Should report line and column in multi-line input', () => {
    expect(() => OpraFilter.parse('a=1\nand\nb')).toThrow(
      /at line: 3 column: 1/,
    );
  });
});
