import {
  ArrayExpression,
  BooleanLiteral,
  ComparisonExpression,
  type ComparisonOperator,
  DateLiteral,
  DateTimeLiteral,
  type Expression,
  LogicalExpression,
  type LogicalOperator,
  NegativeExpression,
  NullLiteral,
  NumberLiteral,
  ParenthesizedExpression,
  QualifiedIdentifier,
  StringLiteral,
  TimeLiteral,
} from './ast/index.js';
import { ExternalConstant } from './ast/terms/external-constant.js';
import { FilterParseError, SyntaxError } from './errors.js';
import { unquoteFilterString } from './utils.js';

/*
 * A hand-written lexer and recursive-descent parser for the filter language.
 * It follows the former ANTLR grammar (OpraFilter.g4) token for token:
 * - The lexer takes the longest match. On a tie, a literal (keyword or symbol)
 *   wins over an identifier, and a date, date-time or time wins over a string.
 * - "and" and "or" have the same precedence and associate to the left.
 * - "not" and "!" have the lowest precedence: they negate everything to their
 *   right up to the closing parenthesis or the end of the input.
 */

type TokenType =
  | 'literal'
  | 'identifier'
  | 'number'
  | 'string'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'eof';

interface Token {
  type: TokenType;
  text: string;
  line: number;
  column: number;
}

/** Keywords and symbols, longest first */
const LITERALS = [
  'Infinity',
  'infinity',
  '!ilike',
  '!like',
  'false',
  'ilike',
  'like',
  'null',
  'true',
  '!in',
  'and',
  'not',
  '!=',
  '&&',
  '<=',
  '>=',
  'in',
  'or',
  '||',
  '!',
  '(',
  ')',
  '*',
  '+',
  ',',
  '-',
  '.',
  '/',
  '<',
  '=',
  '>',
  '@',
  '[',
  ']',
];

const COMPARISON_OPERATORS = new Set([
  '<=',
  '<',
  '>',
  '>=',
  '=',
  '!=',
  'in',
  '!in',
  'like',
  '!like',
  'ilike',
  '!ilike',
]);
const LOGICAL_OPERATORS = new Set(['and', 'or', '&&', '||']);

const IDENTIFIER_PATTERN = /[A-Za-z$_][A-Za-z0-9_$]*/y;
const DECIMAL_PATTERN = /[+-]?\d+(?:\.\d*)?(?:E[-+]?\d+)?/y;
const HEX_PATTERN = /0x[0-9a-fA-F]+/y;
const WHITESPACE_PATTERN = /[ \r\n\t]+/y;

const DATE = String.raw`\d{4}-(?:0[1-9]|1[012])-(?:[123]0|[012][1-9]|31)`;
const TIME = String.raw`(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?`;
const ZONE = String.raw`(?:Z|[+-](?:[01]?\d|2[0-3])(?::[0-5]\d)?)`;
const DATE_PATTERN = new RegExp(`^(['"])${DATE}\\1$`);
const TIME_PATTERN = new RegExp(`^(['"])${TIME}\\1$`);
/* The grammar recognizes double-quoted date-times only */
const DATE_TIME_PATTERN = new RegExp(`^"${DATE}[T ]${TIME}${ZONE}?"$`);

/**
 * Parses a filter expression into its AST.
 *
 * @param text - The filter text, such as `name = 'John' and age > 18`.
 * @returns The root expression.
 * @throws SyntaxError when the text is not a valid filter.
 * @throws FilterValidationError when a literal has an invalid value.
 */
export function parse(text: string): any {
  const parser = new Parser(text);
  return parser.parse();
}

/* Parse tree nodes. Literal values are validated after the whole text parses */
type Node =
  | { kind: 'comparison'; op: string; left: Node; right: Node }
  | { kind: 'logical'; op: string; left: Node; right: Node }
  | { kind: 'negative'; expression: Node }
  | { kind: 'parenthesized'; expression: Node }
  | { kind: 'identifier'; name: string }
  | { kind: 'external'; name: string }
  | { kind: 'array'; items: Token[] }
  | { kind: 'value'; token: Token };

class Parser {
  private readonly text: string;
  private pos = 0;
  private line = 1;
  private lineStart = 0;
  private token: Token;

  constructor(text: string) {
    this.text = text;
    this.token = this.nextToken();
  }

  parse(): Expression {
    const node = this.parseExpression();
    if (this.token.type !== 'eof') this.fail('end of input');
    return build(node);
  }

  /* expression: unary (logicalOperator unary)* */
  private parseExpression(): Node {
    let left = this.parseUnary();
    while (this.isLiteral(LOGICAL_OPERATORS)) {
      const op = this.consume().text;
      const right = this.parseUnary();
      left = { kind: 'logical', op, left, right };
    }
    return left;
  }

  /* unary: ('not' | '!') expression | '(' expression ')' | comparison */
  private parseUnary(): Node {
    if (this.isLiteral('not') || this.isLiteral('!')) {
      this.consume();
      return { kind: 'negative', expression: this.parseExpression() };
    }
    if (this.isLiteral('(')) {
      this.consume();
      const expression = this.parseExpression();
      this.expectLiteral(')');
      return { kind: 'parenthesized', expression };
    }
    if (!this.isIdentifier()) this.fail("'(', 'not', '!' or a field name");
    const left = this.parseQualifiedIdentifier();
    if (!this.isLiteral(COMPARISON_OPERATORS))
      this.fail('a comparison operator');
    const op = this.consume().text;
    const right = this.parseComparisonRight();
    return { kind: 'comparison', op, left, right };
  }

  /* comparisonRight: value | qualifiedIdentifier | '@' identifier | arrayValue */
  private parseComparisonRight(): Node {
    if (this.isIdentifier()) return this.parseQualifiedIdentifier();
    if (this.isLiteral('@')) {
      this.consume();
      if (!this.isIdentifier()) this.fail('a name');
      return { kind: 'external', name: this.consume().text };
    }
    if (this.isLiteral('[')) {
      this.consume();
      const items = [this.parseValue()];
      while (this.isLiteral(',')) {
        this.consume();
        items.push(this.parseValue());
      }
      this.expectLiteral(']');
      return { kind: 'array', items };
    }
    if (!this.isValue()) this.fail('a value, a field name, @name or an array');
    return { kind: 'value', token: this.consume() };
  }

  /* qualifiedIdentifier: (identifier '.')* identifier */
  private parseQualifiedIdentifier(): Node {
    let name = this.consume().text;
    while (this.isLiteral('.')) {
      this.consume();
      if (!this.isIdentifier()) this.fail('a field name');
      name += '.' + this.consume().text;
    }
    return { kind: 'identifier', name };
  }

  private parseValue(): Token {
    if (!this.isValue()) this.fail('a value');
    return this.consume();
  }

  private isValue(): boolean {
    const { type, text } = this.token;
    if (type === 'literal') {
      return (
        text === 'true' ||
        text === 'false' ||
        text === 'null' ||
        text === 'Infinity' ||
        text === 'infinity'
      );
    }
    return type !== 'identifier' && type !== 'eof';
  }

  private isIdentifier(): boolean {
    return this.token.type === 'identifier';
  }

  private isLiteral(match: string | Set<string>): boolean {
    if (this.token.type !== 'literal') return false;
    return typeof match === 'string'
      ? this.token.text === match
      : match.has(this.token.text);
  }

  private expectLiteral(text: string) {
    if (!this.isLiteral(text)) this.fail(`'${text}'`);
    this.consume();
  }

  private consume(): Token {
    const token = this.token;
    this.token = this.nextToken();
    return token;
  }

  private fail(expected: string): never {
    const { type, text } = this.token;
    const found = type === 'eof' ? 'end of input' : `'${text}'`;
    this.error(`Unexpected ${found}, expecting ${expected}`, this.token);
  }

  private error(message: string, at: { line: number; column: number }): never {
    const fullMessage =
      message +
      (this.text.includes('\n')
        ? ' at line: ' + at.line + ' column: ' + at.column
        : ' at column: ' + at.column);
    const e = new SyntaxError(fullMessage);
    (e as any).errors = [
      new FilterParseError(message, { line: at.line, column: at.column }),
    ];
    throw e;
  }

  private nextToken(): Token {
    const { text } = this;
    this.skipWhitespace();
    const start = this.pos;
    const line = this.line;
    const column = start - this.lineStart;
    if (start >= text.length) return { type: 'eof', text: '', line, column };

    let type: TokenType | undefined;
    let length = 0;
    const take = (t: TokenType, len: number) => {
      if (len > length) {
        type = t;
        length = len;
      }
    };
    /* Candidates in the order the grammar defines them, so ties go to the first */
    const literal = LITERALS.find(x => text.startsWith(x, start));
    if (literal) take('literal', literal.length);
    take('identifier', matchLength(IDENTIFIER_PATTERN, text, start));
    take(
      'number',
      Math.max(
        matchLength(DECIMAL_PATTERN, text, start),
        matchLength(HEX_PATTERN, text, start),
      ),
    );
    const quote = text[start];
    if (quote === "'" || quote === '"') {
      const len = quotedLength(text, start);
      if (!len) {
        this.error('Unterminated string', { line, column });
      }
      const s = text.substring(start, start + len);
      if (DATE_PATTERN.test(s)) take('date', len);
      else if (DATE_TIME_PATTERN.test(s)) take('dateTime', len);
      else if (TIME_PATTERN.test(s)) take('time', len);
      else take('string', len);
    }
    if (!type) {
      this.error(`Unexpected character '${text[start]}'`, { line, column });
    }
    this.advance(length);
    return { type, text: text.substring(start, start + length), line, column };
  }

  private skipWhitespace() {
    this.advance(matchLength(WHITESPACE_PATTERN, this.text, this.pos));
  }

  /* Moves forward, keeping track of lines (strings may span lines too) */
  private advance(length: number) {
    const end = this.pos + length;
    for (let i = this.pos; i < end; i++) {
      if (this.text[i] === '\n') {
        this.line++;
        this.lineStart = i + 1;
      }
    }
    this.pos = end;
  }
}

function matchLength(pattern: RegExp, text: string, pos: number): number {
  pattern.lastIndex = pos;
  const m = pattern.exec(text);
  return m ? m[0].length : 0;
}

/**
 * Returns the length of the longest quoted string at `start`, or 0 when it is
 * not closed. Any character but the quote may appear inside, and a backslash
 * may also escape the quote, as the grammar's STRING rule allows.
 */
function quotedLength(text: string, start: number): number {
  const quote = text[start];
  let longest = 0;
  /* reachable[i]: the string content can reach position i */
  const reachable = new Uint8Array(text.length + 2);
  reachable[start + 1] = 1;
  for (let i = start + 1; i < text.length; i++) {
    if (!reachable[i]) continue;
    const c = text[i];
    if (c === quote) {
      longest = i + 1 - start;
      continue;
    }
    reachable[i + 1] = 1;
    if (c === '\\') reachable[i + 2] = 1;
  }
  return longest;
}

/* Builds the AST the same way the former ANTLR visitor did */
function build(node: Node): any {
  switch (node.kind) {
    case 'comparison':
      return new ComparisonExpression({
        op: node.op as ComparisonOperator,
        left: build(node.left),
        right: build(node.right),
      });
    case 'logical': {
      /* Flattens nested expressions with the same operator text */
      const items: Expression[] = [];
      const collect = (n: Node) => {
        if (n.kind === 'logical' && n.op === node.op) {
          collect(n.left);
          collect(n.right);
        } else items.push(build(n));
      };
      collect(node.left);
      collect(node.right);
      return new LogicalExpression({
        op: node.op as LogicalOperator,
        items,
      });
    }
    case 'negative':
      return new NegativeExpression(build(node.expression));
    case 'parenthesized':
      return new ParenthesizedExpression(build(node.expression));
    case 'identifier':
      return new QualifiedIdentifier(node.name);
    case 'external':
      return new ExternalConstant(node.name);
    case 'array':
      return new ArrayExpression(node.items.map(buildValue));
    case 'value':
      return buildValue(node.token);
  }
}

function buildValue(token: Token): Expression {
  const { text } = token;
  switch (token.type) {
    case 'number':
      return new NumberLiteral(text);
    case 'string':
      return new StringLiteral(unquoteFilterString(text));
    case 'date':
      return new DateLiteral(unquoteFilterString(text));
    case 'dateTime':
      return new DateTimeLiteral(unquoteFilterString(text));
    case 'time':
      return new TimeLiteral(unquoteFilterString(text));
    default:
      if (text === 'null') return new NullLiteral();
      if (text === 'true' || text === 'false') {
        return new BooleanLiteral(text === 'true');
      }
      return new NumberLiteral(Infinity);
  }
}
