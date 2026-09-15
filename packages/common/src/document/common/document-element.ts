import { asMutable } from 'ts-gems';
import { uid } from 'uid';
import { DocumentNode } from './document-node.js';

interface DocumentElementConstructor {
  new (owner?: DocumentElement): DocumentElement;

  prototype: DocumentElement;
}

/**
 * @class DocumentElement
 */
export interface DocumentElement extends DocumentElementClass {}

/**
 *
 * @constructor DocumentElement
 */
export const DocumentElement = function (
  this: DocumentElement,
  owner?: DocumentElement,
) {
  if (!this)
    throw new TypeError('"this" should be passed to call class constructor');
  const _this = asMutable(this);
  _this.id = uid(16);
  Object.defineProperty(_this, 'node', {
    value: new DocumentNode(this, owner?.node),
    enumerable: false,
    writable: true,
  });
  if (owner) {
    Object.defineProperty(_this, 'owner', {
      value: owner,
      enumerable: false,
      writable: true,
    });
  }
} as Function as DocumentElementConstructor;

/**
 * @class DocumentElement
 */
abstract class DocumentElementClass {
  declare readonly id: string;
  declare readonly owner?: DocumentElement;
  declare readonly node: DocumentNode;

  /**
   * An authoring-time override for this element's own segment in the
   * documentation key (see `docKeySegment`). Never exported to the schema —
   * it exists purely so a translation key can stay stable across renames,
   * and so elements with no derivable identity of their own (a
   * regexp-named parameter, a `contentType`-less media type, an example)
   * can be addressed at all.
   */
  declare docKey?: string;

  /**
   * This element's own contribution to its documentation key — the
   * container name plus its identity (e.g. `['operations', 'delete']`),
   * `undefined` for an element that adds no level of its own. Subclasses
   * override this; nothing else needs to know how any particular element
   * identifies itself.
   */
  protected get docKeySegment(): string | string[] | undefined {
    return undefined;
  }

  /** Whether this element's own key segment had to be derived from
   *  something that isn't a stable identifier — a RegExp-named parameter,
   *  a content type that was never declared. `extractTranslations()`
   *  reports these so a `docKey` can be added before the key silently
   *  changes under someone. */
  get docKeyUnstable(): boolean {
    return false;
  }

  /**
   * The full documentation key as an ordered segment list, built by walking
   * up the `owner` chain. Deliberately never joined into a single string
   * for lookup purposes: a segment containing a dot (a regexp source, a
   * media type, a version-ish name) would otherwise be re-split into the
   * wrong path. Join it only to show a human (a warning, an extraction
   * report).
   */
  get docKeySegments(): string[] {
    const parent = this.owner ? this.owner.docKeySegments : [];
    const own = this.docKeySegment;
    if (own == null) return parent;
    return parent.concat(own);
  }
}

DocumentElement.prototype = DocumentElementClass.prototype;
