import {Recognizer} from 'antlr4ts';
import {RecognitionException} from 'antlr4ts/RecognitionException';

export class SyntaxError extends Error {
}

export class ValidationError extends Error {

}

export class FilterParseError extends Error {
  recognizer!: Recognizer<any, any>;
  offendingSymbol: any | undefined;
  line!: number;
  charPositionInLine!: number;
  e: RecognitionException | undefined;

  constructor(message: string, args: {
    recognizer: Recognizer<any, any>;
    offendingSymbol: any | undefined;
    line: number;
    charPositionInLine: number;
    e: RecognitionException | undefined;
  }) {
    super(message);
    Object.assign(this, args);
  }
}
