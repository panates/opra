import {
  ApiField,
  ArrayType,
  ComplexType,
  MixinType,
  StringType,
  UnionType,
} from '@opra/common';
import { type PartialDTO } from 'ts-gems';
import { Address } from './address.js';
import { Country } from './country.js';
import { Note } from './note.js';
import { Person } from './person.js';
import { PhoneNumber } from './phone-number.js';
import { Record } from './record.js';

@ComplexType({
  description: `
The **central entity** of this API — everything else (addresses, notes,
phone numbers) hangs off a \`Customer\`.

A customer record is a *mix* of three things:

1. Standard [Record](#/model/Record) bookkeeping — id, timestamps, soft-delete.
2. Personal details, via the shared [Person](#/model/Person) shape (name,
   gender, birth date).
3. Fields declared directly here — account status, contact info, and the
   collections of related records (addresses, notes, phone numbers).

:::info
Customers are **never hard-deleted**. Setting \`deleted: true\` (soft
delete) is the only supported removal path — this keeps historical
orders, notes, and audit trails intact.
:::

Most fields are self-explanatory, but a few are worth calling out:

- \`rate\` drives pricing/loyalty calculations elsewhere in the system.
- \`country\` is **read-only** — it's resolved server-side from \`countryCode\`,
  not something a client can set directly.
- \`tags\` is a free-form label list with no fixed vocabulary; use it for
  ad-hoc segmentation.
`,
})
export class Customer extends MixinType([Record, Person]) {
  constructor(init?: PartialDTO<Customer>) {
    super(init);
  }

  @ApiField({
    description: `
An **external, user-facing** identifier for the customer — think of it as
the "public" id you'd put in a URL or show in a support ticket, as opposed
to the internal \`_id\`.

Unlike \`_id\`, this is *not* guaranteed to be a number, and it's safe to
expose in client-facing contexts. Usually a short alphanumeric code such
as \`CUST-4821\`.
`,
    examples: ['CUST-4821', 'CUST-9273'],
  })
  declare uid?: string;

  @ApiField({
    description: `
Whether the customer account is **active**.

An inactive customer:

- cannot place new orders
- is excluded from marketing/notification jobs
- still appears in historical reports (their past orders aren't affected)

Toggling this is the recommended way to temporarily suspend an account
without deleting any data — see \`setStatus\` on the \`Customer\` controller
for a higher-level operation that manages this alongside related state.
`,
  })
  declare active: boolean;

  @ApiField({
    description: 'ISO 3166-1 alpha-2 country code of the customer',
    examples: ['US', 'TR'],
  })
  declare countryCode: string;

  @ApiField({
    description: `
The **loyalty/pricing rate** applied to this customer, used by the billing
and discount engines elsewhere in the system.

Defaults to \`1\` (standard rate). Values *below* 1 represent a discount
(e.g. \`0.9\` = 10% off), values *above* 1 represent a surcharge. This field
is intentionally a plain number rather than an enum of tiers, so pricing
rules can evolve without a schema change.
`,
    default: 1,
    examples: [1, 0.9, 1.2],
  })
  declare rate: number;

  @ApiField({
    description: 'Postal address of the customer',
    exclusive: true,
  })
  declare address?: Address;

  @ApiField({
    description: 'Notes attached to the customer',
    type: ArrayType(Note),
    exclusive: true,
    isNestedEntity: true,
  })
  declare notes?: Note[];

  @ApiField({
    description: 'Phone numbers of the customer',
    type: ArrayType(PhoneNumber),
    exclusive: true,
  })
  declare phoneNumbers?: PhoneNumber[];

  @ApiField({
    description: `
The customer's **country**, resolved server-side from \`countryCode\`.

This field is **read-only** — you cannot set it directly through the API.
To change a customer's country, update \`countryCode\` instead; \`country\`
will be re-resolved automatically on the next read.
`,
    exclusive: true,
    readonly: true,
  })
  declare readonly country?: Country;

  @ApiField({
    description: 'Free-form labels attached to the customer',
    type: ArrayType(
      new StringType({
        pattern: /^\w+$/,
      }),
      {
        maxOccurs: 10,
      },
    ),
    examples: [['vip', 'wholesale']],
  })
  declare tags?: string[];

  @ApiField({
    description: 'Internal field only visible in the "db" scope',
    scopePattern: 'db',
  })
  dbField?: string;

  @ApiField({
    description:
      'Whether the customer has a branch — either a flag or a branch count',
    type: UnionType([Boolean, Number]),
  })
  declare hasBranch: boolean | number;
}
