export class SyntaxError extends TypeError {}

export class FilterValidationError extends TypeError {
  constructor(message?: string | { message?: string }) {
    super(typeof message === 'string' ? message : message?.message);
    if (typeof message === 'object') Object.assign(this, message);
  }
}

export class FilterParseError extends Error {
  declare line: number;
  declare column: number;

  constructor(
    message: string,
    args: {
      line: number;
      column: number;
    },
  ) {
    super(message);
    Object.assign(this, args);
  }
}
