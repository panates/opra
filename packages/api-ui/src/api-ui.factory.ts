import type { ApiDocument } from '@opra/common';
import { renderApiUiHtml } from './html-template.js';
import { ApiUiSchemaBuilder } from './schema-builder.js';
import type { ApiUiOptions } from './types.js';

export namespace ApiUiFactory {
  /**
   * Renders a self-contained HTML page presenting an interactive reference
   * for the given `ApiDocument`, built directly on Opra's own native schema
   * — there is no OpenAPI conversion involved.
   *
   * Every document reachable from `document.references` (already fully
   * constructed `ApiDocument` instances — `ApiDocumentFactory` resolves them
   * eagerly, before this function ever sees the root document) is flattened
   * and embedded alongside the root document, so the document switcher in
   * the page can move between them with no further network round-trip.
   */
  export function render(
    document: ApiDocument,
    options?: ApiUiOptions,
  ): string {
    const root = ApiUiSchemaBuilder.build(document, {
      scope: options?.scope,
      lang: options?.lang,
      authoring: !!options?.authoring,
    });
    const refs: Record<string, object> = {};
    // `ResponsiveMap.entries()` yields its case-*normalized* internal key,
    // not the namespace as registered — `.keys()` preserves the original
    // casing, and (being backed by the same insertion-ordered store) lines
    // up positionally with `.values()`.
    const namespaces = Array.from(document.references.keys());
    const refDocuments = Array.from(document.references.values());
    namespaces.forEach((ns, i) => {
      if (ns === 'opra') return; // the framework's own builtin reference
      // A reference is stamped for authoring like the root is. It brings its
      // own translation store, and an edit to one of its texts is written
      // through that store rather than into the root's bundle — which is
      // what `_docOwner` on every node is for. Whether the affordance is
      // actually offered is then a question about that document's store
      // (`authoring.documents`), not about which tree the node is in.
      refs[ns] = ApiUiSchemaBuilder.build(refDocuments[i], {
        scope: options?.scope,
        lang: options?.lang,
        authoring: !!options?.authoring,
      });
    });
    return renderApiUiHtml(
      { root, refs },
      {
        pageTitle: document.info.title,
        ...options,
      },
    );
  }
}
