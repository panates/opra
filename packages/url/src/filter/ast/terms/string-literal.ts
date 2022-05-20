import {quoteString} from '../../../utils/string-utils';
import {Literal} from '../abstract/literal';

export class StringLiteral extends Literal {

  constructor(value: string) {
    super('' + value);
  }

  toString(): string {
    return quoteString(this.value);
  }

}
