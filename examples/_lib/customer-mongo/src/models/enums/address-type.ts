import { EnumType } from '@opra/common';

export enum AddressType {
  HOME = 'home',
  WORK = 'work',
  BILLING = 'billing',
  SHIPPING = 'shipping',
  MAILING = 'mailing',
  OTHER = 'other',
}

EnumType(AddressType, {
  name: 'AddressType',
  description: `
Classifies the **purpose** of an address associated with a customer.

A customer may have several addresses on file at the same time (a home
address for correspondence, a separate billing address for invoices, a
shipping address for deliveries, and so on) — this type tells the API
consumer which one it is looking at.

Recommended usage:

- \`home\` — the customer's primary residence
- \`work\` — a business or office address
- \`billing\` — where invoices and payment correspondence are sent
- \`shipping\` — where physical goods should be delivered
- \`mailing\` — a general postal address, used when it differs from the home address
- \`other\` — anything that doesn't fit the categories above

> A customer can have more than one address of the same type over time.
> Only the most recently created one for a given type should be treated
> as active; older ones are kept for historical/audit purposes.

See the [Customer](#/model/Customer) model for how addresses attach to a customer.
`,
  meanings: {
    HOME: `The customer's **primary residence**. This is the default address
used when no other type applies, and is typically the one shown on
the customer's profile. *Most customers have exactly one* \`home\`
address at a time.`,
    WORK: `A **business or office address** — where the customer can be
reached during working hours. Useful for B2B customers or contacts
who prefer deliveries and correspondence at their workplace rather
than at home.`,
    BILLING: `Where **invoices, receipts, and payment correspondence** are
sent. This does *not* have to match the shipping or home address —
a customer might be billed at their accounting department while
goods ship elsewhere. Required for customers on invoiced payment terms.`,
    SHIPPING: `Where **physical goods should be delivered**. Carriers use this
address for fulfillment, so it should include any delivery notes
(building access codes, floor number, etc.) in the \`street\` field.
*A customer may have several* \`shipping\` *addresses — always use the
most recently created one.*`,
    MAILING: `A general **postal address**, used only when it differs from the
customer's \`home\` address (for example, a PO box). If this type is
absent, correspondence falls back to the \`home\` address.`,
    OTHER: `A catch-all for anything that doesn't fit the categories above.
*Prefer one of the specific types when possible* — \`other\` should be
the exception, not the default.`,
  },
});
