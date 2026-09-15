(function () {
  'use strict';

  var embedded = window.__OPRA_DOCS__ || { root: {}, refs: {} };

  /** Every document is already fully flattened server-side (see
   *  `ApiUiSchemaBuilder` — it walks the real `ApiDocument` runtime graph,
   *  which has already resolved base/mixin/pick-omit-partial merges, rather
   *  than the raw `.export()` JSON) and embedded at render time, keyed by
   *  'root' or a reference namespace — no fetch is ever needed here. */
  var docs = Object.assign({ root: embedded.root }, embedded.refs);

  var state = {
    docKey: 'root',
  };

  // A user's explicit theme choice (via the header toggle) overrides
  // whatever the server rendered into `data-theme` — applied as early as
  // possible, before anything else runs, to avoid a flash of the
  // server's default theme on a later visit. Wrapped in try/catch since
  // `localStorage` can throw (private browsing, disabled site data) —
  // falling back to the server-rendered theme either way is fine.
  try {
    var storedTheme = localStorage.getItem('opra-ui-theme');
    if (storedTheme === 'dark' || storedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', storedTheme);
    }
  } catch (e) {
    // ignore
  }

  // A user's Group By choice, same persistence pattern as the theme above —
  // it would otherwise silently reset to 'structure' on every reload, since
  // `state` itself is in-memory only.
  try {
    var storedGroupBy = localStorage.getItem('opra-ui-groupby');
    if (storedGroupBy === 'structure' || storedGroupBy === 'sections') {
      state.groupBy = storedGroupBy;
    }
  } catch (e) {
    // ignore
  }

  // Which sidebar folders/sections the user has collapsed — same
  // persistence pattern again, saved by `saveCollapsedState` (see
  // `buildSidebar`/`init`) after every toggle, or the whole tree would
  // silently snap back open on every reload despite `collapsedNav`/
  // `collapsedGroups` otherwise persisting for the rest of the page's
  // life. Not scoped per-document — `collapsedNav`/`collapsedGroups`
  // themselves already aren't (a route string is only ever unique within
  // whichever document built it), so this just carries that same
  // existing sharing behavior into storage rather than introducing a new
  // one.
  try {
    var storedCollapsed = JSON.parse(localStorage.getItem('opra-ui-collapsed') || 'null');
    if (storedCollapsed && typeof storedCollapsed === 'object') {
      state.collapsedNav = storedCollapsed.nav || {};
      state.collapsedGroups = storedCollapsed.groups || {};
    }
  } catch (e) {
    // ignore
  }

  /** Persists `state.collapsedNav`/`state.collapsedGroups` as one blob —
   *  called after every mutation of either (see `buildSidebar`'s own
   *  toggle handlers, and `setAllNavCollapsed`), same "try/catch, storage
   *  can throw or be unavailable" shrug as the theme/Group By persistence
   *  above. */
  function saveCollapsedState() {
    try {
      localStorage.setItem(
        'opra-ui-collapsed',
        JSON.stringify({ nav: state.collapsedNav || {}, groups: state.collapsedGroups || {} }),
      );
    } catch (e) {
      // ignore
    }
  }

  // ---------- interface texts ----------

  /** This page's own chrome texts, embedded by `renderApiUiHtml` already
   *  resolved to one language and merged over English, so every key this
   *  file asks for is guaranteed present — there is deliberately no
   *  client-side fallback chain here, and a reader never sees a raw key.
   *  (These are the *interface's* texts, shipped in `assets/i18n/*.json`
   *  with the package; the documented API's own prose is a separate,
   *  author-owned set of translations.) */
  var MESSAGES = window.__OPRA_I18N__ || {};

  /** The interface language and writing direction the server settled on —
   *  read off `<html>` rather than `window.__OPRA_UI__.lang`, which carries
   *  the *document's* language and is absent whenever the document has no
   *  translations of its own. */
  var UI_LANG = document.documentElement.getAttribute('lang') || 'en';
  var IS_RTL = document.documentElement.getAttribute('dir') === 'rtl';

  function lookupMessage(key) {
    var node = MESSAGES;
    var parts = key.split('.');
    for (var i = 0; i < parts.length; i++) {
      if (!node || typeof node !== 'object') return undefined;
      node = node[parts[i]];
    }
    return typeof node === 'string' ? node : undefined;
  }

  function interpolate(template, vars) {
    if (!vars) return template;
    return template.replace(/\{(\w+)\}/g, function (whole, name) {
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole;
    });
  }

  /** `t('sidebar.overview')`, `t('overview.server', { url: … })`. Falls back
   *  to the key itself, which only happens if a caller mistypes one — the
   *  served dictionary is always complete. */
  function t(key, vars) {
    var str = lookupMessage(key);
    return interpolate(str === undefined ? key : str, vars);
  }

  var pluralRules;
  /** Plural form of `key` for `count`, looked up as `<key>_<category>` with
   *  `_other` as the backstop. `Intl.PluralRules` rather than a hardcoded
   *  one/other split: the interface ships in languages with up to six forms
   *  (Arabic) and several with three or four (Russian, Polish, Ukrainian). */
  function tp(key, count, vars) {
    var category = 'other';
    try {
      if (!pluralRules) pluralRules = new Intl.PluralRules(UI_LANG);
      category = pluralRules.select(count);
    } catch (e) {
      category = count === 1 ? 'one' : 'other';
    }
    var str = lookupMessage(key + '_' + category);
    if (str === undefined) str = lookupMessage(key + '_other');
    var vals = { count: count };
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        vals[k] = vars[k];
      });
    }
    return interpolate(str === undefined ? key : str, vals);
  }

  /** `t()` for messages whose placeholders are DOM nodes rather than plain
   *  values (a type chip, a link) — returns a children array ready for
   *  `el()`. This is what lets a translation put the node wherever its own
   *  grammar needs it, instead of the English assumption that a label is
   *  always a prefix ("Part of X" vs. "X içinde"). */
  function tNodes(key, nodes) {
    var str = lookupMessage(key);
    if (str === undefined) str = key;
    var out = [];
    var re = /\{(\w+)\}/g;
    var last = 0;
    var m;
    while ((m = re.exec(str))) {
      if (m.index > last) out.push(str.slice(last, m.index));
      out.push(nodes[m[1]] === undefined ? m[0] : nodes[m[1]]);
      last = m.index + m[0].length;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  }

  // ---------- small DOM helpers ----------

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.indexOf('on') === 0 && typeof attrs[k] === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
        } else if (attrs[k] !== undefined && attrs[k] !== null) {
          node.setAttribute(k, attrs[k]);
        }
      });
    }
    (children || []).forEach(function (c) {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function text(str) {
    return document.createTextNode(str == null ? '' : String(str));
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function svg(markup, cls) {
    var span = el('span', { class: 'icon' + (cls ? ' ' + cls : ''), html: markup });
    return span;
  }

  function copyIconSvg(size) {
    return (
      '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M4.5 13.5h-1a1 1 0 0 1 -1-1v-9a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v1"/></svg>'
    );
  }
  function checkIconSvg(size) {
    return (
      '<svg viewBox="0 0 20 20" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l3.5 3.5L16 5.5"/></svg>'
    );
  }

  /** A "copy to clipboard" icon button for a raw example value — swaps to
   *  a checkmark for ~1.2s after a successful click, then reverts.
   *  `size` (icon side length in px, default 12) lets a larger caller —
   *  e.g. the whole-block button in `renderExampleBlock` — ask for a more
   *  prominent icon than the one used inline in an `exampleChip`. */
  function copyButton(value, size) {
    size = size || 12;
    var str = typeof value === 'string' ? value : JSON.stringify(value);
    var btn = el('button', {
      class: 'copy-btn',
      type: 'button',
      title: t('common.copyToClipboard'),
      html: copyIconSvg(size),
      onclick: function (ev) {
        ev.stopPropagation();
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(str).catch(function () {});
        }
        btn.innerHTML = checkIconSvg(size);
        btn.classList.add('copied');
        setTimeout(function () {
          btn.innerHTML = copyIconSvg(size);
          btn.classList.remove('copied');
        }, 1200);
      },
    });
    return btn;
  }

  // ---------- minimal markdown renderer (no external dependency) ----------

  /** Escapes text before any markdown-driven HTML is generated from it. */
  function mdEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Matches this app's own `#/model/Name` (optionally `#/ref/<ns>/model/Name`)
   *  links — used to turn a cross-reference to another type into a chip
   *  carrying that type's own icon, instead of a bare text link. */
  var MODEL_LINK_RE = /^#\/(?:ref\/[^/]+\/)?model\/([^/?#]+)/;

  /** Inline markdown: `code`, **bold**, *italic*, [text](https://url) and
   *  [text](#/model/Name) — the latter navigates within the reference UI
   *  itself, so descriptions can cross-link to other models/operations. A
   *  `#/model/Name` link renders as a small icon+label chip (colored by the
   *  target type's own kind, GitHub-style) rather than a plain text link. */
  function mdInline(doc, raw) {
    var s = mdEscape(raw);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((#[^)\s]+|https?:\/\/[^)\s]+)\)/g, function (m, label, href) {
      var isHash = href.charAt(0) === '#';
      var modelMatch = isHash ? MODEL_LINK_RE.exec(href) : null;
      if (modelMatch) {
        var typeName = decodeURIComponent(modelMatch[1]);
        var typeDef = doc && doc.types && doc.types[typeName];
        var iconKind = typeDef ? dataTypeIconKind(typeDef.kind) : 'cube';
        return (
          '<a class="type-chip c-' +
          iconKind +
          '" href="' +
          href +
          '">' +
          iconHtmlFor(iconKind) +
          label +
          '</a>'
        );
      }
      return (
        '<a href="' +
        href +
        '"' +
        (isHash ? '' : ' target="_blank" rel="noopener noreferrer"') +
        '>' +
        label +
        '</a>'
      );
    });
    return s;
  }

  /** One icon per admonition type (see `mdToHtml`'s `:::type` handling),
   *  Docusaurus's own five: note/tip/info/warning/danger. */
  var ADMONITION_ICONS = {
    note:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5V6.2A2.2 2.2 0 0 1 6.2 4h7.6L20 9.5V19.5A1.5 1.5 0 0 1 18.5 21h-13A1.5 1.5 0 0 1 4 19.5Z"/><path d="M13.8 4v4.3a1.2 1.2 0 0 0 1.2 1.2H20"/></svg>',
    tip:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.4.3.7.8.7 1.3V16h5.6v-.8c0-.5.3-1 .7-1.3A6 6 0 0 0 12 3Z"/></svg>',
    info:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/></svg>',
    warning:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5 21 20H3L12 3.5Z"/><path d="M12 9.5v5M12 17.5h.01" stroke-linecap="round"/></svg>',
    danger:
      '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M8.6 3h6.8L21 8.6v6.8L15.4 21H8.6L3 15.4V8.6L8.6 3Z"/><path d="M12 8v5M12 16h.01" stroke-linecap="round"/></svg>',
  };

  /** A small, safe subset of markdown: headings, paragraphs, blockquotes,
   *  ordered/unordered lists, admonitions (Docusaurus's `:::tip ... :::`
   *  fenced callouts), and the inline styles above. Good enough for
   *  API/model descriptions without pulling in a markdown dependency. */
  function mdToHtml(doc, src) {
    if (!src) return '';
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var html = '';
    var i = 0;
    while (i < lines.length) {
      var line = lines[i];
      if (!line.trim()) {
        i++;
        continue;
      }
      var h = /^(#{1,4})\s+(.*)$/.exec(line);
      if (h) {
        var level = h[1].length + 2;
        html += '<h' + level + '>' + mdInline(doc, h[2]) + '</h' + level + '>';
        i++;
        continue;
      }
      var adm = /^:::(note|tip|info|warning|danger)\s*(.*)$/i.exec(line);
      if (adm) {
        var admType = adm[1].toLowerCase();
        var admTitle = adm[2] && adm[2].trim() ? adm[2].trim() : t('admonition.' + admType);
        i++;
        var admLines = [];
        while (i < lines.length && lines[i].trim() !== ':::') {
          admLines.push(lines[i]);
          i++;
        }
        i++; // skip the closing ':::' (or just end of input if unclosed)
        html +=
          '<div class="admonition admonition-' + admType + '">' +
          '<div class="admonition-heading">' +
          '<span class="admonition-icon">' + ADMONITION_ICONS[admType] + '</span>' +
          '<span class="admonition-title">' + mdEscape(admTitle) + '</span>' +
          '</div>' +
          '<div class="admonition-content">' + mdToHtml(doc, admLines.join('\n')) + '</div>' +
          '</div>';
        continue;
      }
      if (/^>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + mdInline(doc, quoteLines.join(' ')) + '</blockquote>';
        continue;
      }
      if (/^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line)) {
        var ordered = /^\d+\.\s+/.test(line);
        var itemRe = ordered ? /^\d+\.\s+/ : /^[-*]\s+/;
        var items = [];
        while (i < lines.length && itemRe.test(lines[i])) {
          // A list item's text can wrap onto plain continuation lines —
          // anything non-blank that doesn't itself start a new block —
          // before the next item or a blank line ends it.
          var itemLines = [lines[i].replace(itemRe, '')];
          i++;
          while (
            i < lines.length &&
            lines[i].trim() &&
            !/^[-*]\s+/.test(lines[i]) &&
            !/^\d+\.\s+/.test(lines[i]) &&
            !/^(#{1,4})\s+/.test(lines[i]) &&
            !/^>\s?/.test(lines[i])
          ) {
            itemLines.push(lines[i].trim());
            i++;
          }
          items.push('<li>' + mdInline(doc, itemLines.join(' ')) + '</li>');
        }
        html += (ordered ? '<ol>' : '<ul>') + items.join('') + (ordered ? '</ol>' : '</ul>');
        continue;
      }
      var para = [];
      while (
        i < lines.length &&
        lines[i].trim() &&
        !/^(#{1,4})\s+/.test(lines[i]) &&
        !/^[-*]\s+/.test(lines[i]) &&
        !/^\d+\.\s+/.test(lines[i]) &&
        !/^>\s?/.test(lines[i])
      ) {
        para.push(lines[i]);
        i++;
      }
      html += '<p>' + mdInline(doc, para.join(' ')) + '</p>';
    }
    return html;
  }

  /** Renders a markdown description as a block-level element, or `null` when
   *  empty. `doc` is needed to resolve `#/model/Name` links to their icon
   *  and to power their hover tooltip. */
  function mdBlock(doc, description, cls) {
    if (!description) return null;
    var node = el('div', {
      class: 'markdown' + (cls ? ' ' + cls : ''),
      // The API author's prose, not the interface's: let the browser infer
      // its direction from the text itself rather than inheriting the page's
      // (see the "Right-to-left" section in styles.css).
      dir: 'auto',
      html: mdToHtml(doc, description),
    });
    node.querySelectorAll('.type-chip').forEach(function (chip) {
      var m = MODEL_LINK_RE.exec(chip.getAttribute('href') || '');
      if (m) attachTypeHover(chip, doc, decodeURIComponent(m[1]));
    });
    return node;
  }

  // ---------- icons (inline SVG, no external dependency) ----------

  var ICONS = {
    folder:
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"><path d="M1.5 4.2c0-.6.5-1.1 1.1-1.1h3l1.3 1.6h6.5c.6 0 1.1.5 1.1 1.1V12c0 .6-.5 1-1.1 1H2.6c-.6 0-1.1-.4-1.1-1V4.2Z"/></svg>',
    operation:
      '<svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor"><path d="M4 2.3v11.4c0 .5.5.8.9.5l8.6-5.7c.4-.2.4-.8 0-1L4.9 1.8c-.4-.3-.9 0-.9.5Z"/></svg>',
    cube:
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M8 1.4 14 4.9v6.2L8 14.6l-6-3.5V4.9L8 1.4Z"/><path d="M8 1.4v6.2m0 0-6-3.5m6 3.5 6-3.5m-6 6.9V7.6"/></svg>',
    list:
      '<svg viewBox="0 0 512 512" width="14" height="14" fill="currentColor"><path d="m510.173 180.77-53.6 98.448c-2.83 5.22-8.48 8.261-14.4 7.781-5.92-.49-10.99-4.42-12.94-10.031l-8.26-23.762c-11.1 7.081-25.03 17.511-38.67 31.953-11.97 12.671-29.38 34.843-45 60.255l.13-158.883c18.75-15.231 36.57-26.012 51.31-33.493l-8.82-27.872c-1.83-5.781 0-12.091 4.63-16.001 4.63-3.9 11.15-4.64 16.54-1.86l102.78 52.964c3.59 1.85 6.28 5.06 7.47 8.921 1.18 3.859.76 8.04-1.17 11.58z"/><path d="m331.992 111.964h-24.5l-.18 215.958c-18.932-52.992-48.357-101.187-85.38-138.711-5.66-5.77-11.48-11.311-17.44-16.601v-60.645h-24.5c-12.69.42-19.95-16.161-11-25.202l76-82.007c5.63-6.34 16.37-6.34 22 0l76 82.007c8.95 9.03 1.7 25.621-11 25.201z"/><path d="m275.125 327.532c-17.107-43.666-41.951-84.044-74.601-117.3-27.871-28.442-55.831-46.314-77.281-57.195l8.82-27.872c4.315-12.211-9.856-24.181-21.17-17.861l-102.772 52.964c-7.358 3.597-10.361 13.396-6.3 20.502l53.591 98.448c5.666 11.3 23.595 9.814 27.34-2.25l8.26-23.762c11.1 7.081 25.02 17.511 38.66 31.953 45.464 48.154 66.719 115.522 73.551 184.015.86 8.751 1.27 17.852 1.27 27.822 0 8.281 6.72 15.001 15 15.001h72.691c8.219.173 15.416-7.236 14.99-15.451-1.899-62.705-12.679-119.56-32.049-169.014z"/></svg>',
    book:
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M2 2.6h4.4c1 0 1.6.6 1.6 1.6v9.2c0-.8-.6-1.4-1.6-1.4H2V2.6ZM14 2.6H9.6C8.6 2.6 8 3.2 8 4.2v9.2c0-.8.6-1.4 1.6-1.4H14V2.6Z"/></svg>',
    chevronDown:
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6 8 10.5 12.5 6"/></svg>',
    chevronRight:
      '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
    simple:
      '<svg viewBox="0 0 32 32" width="14" height="14" fill="currentColor"><path d="m16 2a14 14 0 1 0 14 14 14.01538 14.01538 0 0 0 -14-14zm-3.78 20.89a1.00292 1.00292 0 0 1 1-1h1.78v-3.15h-4.6a1 1 0 1 1 0-2h11.2a1 1 0 0 1 0 2h-4.6v3.15h1.67a1 1 0 0 1 0 2h-5.45a1.003 1.003 0 0 1 -1-1zm10.64-10.75a1 1 0 0 1 -2 0v-2.03h-3.86v4.25a1 1 0 0 1 -2 0v-4.25h-3.86v2.03a1 1 0 0 1 -2 0v-3.03a1.003 1.003 0 0 1 1-1h11.72a1.003 1.003 0 0 1 1 4.03z"/></svg>',
    mixin:
      '<svg viewBox="0 0 511.999 511.999" width="14" height="14" fill="currentColor"><path d="M149.818,200.117c-12.93-0.001-25.484,1.647-37.462,4.742c2.791,9.314,6.51,18.424,11.151,27.216c15.061,28.532,38.357,50.953,66.856,64.765c8.415-27.175,23.117-51.61,42.393-71.609C208.992,209.375,180.468,200.117,149.818,200.117z"/><path d="M362.18,200.117c-30.649,0-59.174,9.258-82.938,25.114c19.269,19.991,33.967,44.415,42.384,71.577c1.446-0.705,2.886-1.426,4.314-2.18c35.39-18.682,61.387-50.026,73.201-88.261c0.156-0.506,0.299-1.015,0.45-1.522C387.629,201.76,375.093,200.117,362.18,200.117z"/><path d="M388.492,92.195c-18.681-35.39-50.025-61.387-88.261-73.202c-14.606-4.514-29.55-6.751-44.415-6.751c-24.047,0-47.886,5.854-69.757,17.399c-35.39,18.682-61.387,50.026-73.201,88.261c-5.836,18.887-7.86,38.339-6.168,57.454c13.823-3.414,28.266-5.24,43.129-5.24c39.687,0,76.404,12.933,106.181,34.792c29.776-21.859,66.494-34.792,106.181-34.792c14.851,0,29.282,1.822,43.094,5.233C407.858,146.822,402.18,118.125,388.492,92.195z"/><path d="M256,244.346c-17.235,17.33-30.261,38.842-37.421,62.86c24.843,6.437,50.463,6.385,74.855,0.044C286.277,283.214,273.245,261.687,256,244.346z"/><path d="M427.79,215.268c-14.187,45.871-45.382,83.475-87.846,105.89c-3.877,2.047-7.811,3.926-11.785,5.674c0.975,7.566,1.48,15.277,1.48,23.104c0,48.379-19.211,92.351-50.397,124.705c23.764,15.857,52.288,25.115,82.938,25.115c82.61,0,149.819-67.209,149.819-149.82C512,290.844,477.607,239.638,427.79,215.268z"/><path d="M182.36,349.937c0-7.821,0.505-15.525,1.478-23.085c-37.216-16.219-67.632-44.344-86.861-80.772c-5.259-9.962-9.52-20.267-12.801-30.794C34.378,239.661,0,290.857,0,349.937c0,82.611,67.209,149.82,149.819,149.82c30.65,0,59.174-9.258,82.938-25.115C201.571,442.288,182.36,398.316,182.36,349.937z"/><path d="M299.057,336.797c-14.041,3.488-28.409,5.245-42.836,5.245c-14.453,0-28.962-1.762-43.272-5.31c-0.382,4.352-0.589,8.754-0.589,13.204c0,41.156,16.684,78.486,43.64,105.591c26.956-27.105,43.64-64.435,43.64-105.591C299.64,345.508,299.435,341.128,299.057,336.797z"/></svg>',
    mapped:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="m22 5.15v3.7c0 2.25-.9 3.15-3.15 3.15h-2.7c-2.25 0-3.15-.9-3.15-3.15v-3.7c0-2.25.9-3.15 3.15-3.15h2.7c2.25 0 3.15.9 3.15 3.15zm-14.15 6.85h-2.7c-2.25 0-3.15.9-3.15 3.15v3.7c0 2.25.9 3.15 3.15 3.15h2.7c2.25 0 3.15-.9 3.15-3.15v-3.7c0-2.25-.9-3.15-3.15-3.15zm13.4 2.02539a.7502.7502 0 0 0 -.75.75 5.73444 5.73444 0 0 1 -4.292 5.543l.18164-.30176a.75031.75031 0 1 0 -1.28711-.77148l-.9707 1.61914a.75027.75027 0 0 0 .64356 1.13571 7.23313 7.23313 0 0 0 7.22461-7.22461.7502.7502 0 0 0 -.75-.75zm-18.5-4.05078a.7502.7502 0 0 0 .75-.75 5.73444 5.73444 0 0 1 4.292-5.543l-.18164.30176a.75031.75031 0 1 0 1.28711.77148l.9707-1.61914a.75027.75027 0 0 0 -.64356-1.13571 7.23313 7.23313 0 0 0 -7.22461 7.22461.7502.7502 0 0 0 .75.75z"/></svg>',
    mail:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
    globe:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14a5 5 0 0 0 7.07 0l2-2a5 5 0 0 0-7.07-7.07l-1 1"/><path d="M14 10a5 5 0 0 0-7.07 0l-2 2a5 5 0 0 0 7.07 7.07l1-1"/></svg>',
    scale:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M6 21h12"/><path d="M12 5.5 5 8l3.2 6.4a3.6 3.6 0 0 0 6.4 0L12 5.5Z"/><path d="M12 5.5 19 8l-3.2 6.4a3.6 3.6 0 0 1-6.4 0"/></svg>',
    users:
      '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0 1 11 0"/><path d="M16 8.5a3 3 0 1 1 3.5 4.4"/><path d="M20.5 20a5 5 0 0 0-3.8-6.4"/></svg>',
    menu:
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11"/></svg>',
    close:
      '<svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>',
    check:
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-7"/></svg>',
    tag:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12.59 2H4a2 2 0 0 0-2 2v8.59a2 2 0 0 0 .59 1.41l9.59 9.59a2 2 0 0 0 2.82 0l6.18-6.18a2 2 0 0 0 0-2.82L11.99 2h.6Z"/><circle cx="7.5" cy="7.5" r="1.1" fill="currentColor" stroke="none"/></svg>',
    download:
      '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12m0 0-4-4m4 4 4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>',
    eye:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    filter:
      '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>',
  };

  var TEXT_ICONS = {
    array: '[ ]',
    union: '∪',
  };

  /** Icons that point somewhere along the reading direction and so have to
   *  be mirrored in an RTL page — a right-pointing caret beside an operation
   *  reads as "backwards" next to Arabic. Everything else here (folder,
   *  book, globe…) is a picture, not a direction, and mirroring it would
   *  just make it look wrong. Flipped in CSS via `[dir='rtl'] .icon-mirror`
   *  rather than by swapping the SVG path. */
  var MIRRORED_ICONS = { operation: 1, chevronRight: 1 };

  function iconFor(kind, cls) {
    if (MIRRORED_ICONS[kind]) cls = (cls ? cls + ' ' : '') + 'icon-mirror';
    if (ICONS[kind]) return svg(ICONS[kind], cls);
    var label = TEXT_ICONS[kind] || '?';
    return el('span', { class: 'icon text-icon ' + (cls || '') }, [label]);
  }

  /** String-returning counterpart of `iconFor`, for building HTML inside
   *  markdown (e.g. the type-chip in `mdInline`) where a DOM node can't be
   *  used directly. Falls back to the plain-glyph `TEXT_ICONS` the same way
   *  `iconFor` does, so kinds like SimpleType/ArrayType/UnionType still get
   *  a visible marker instead of an empty chip. */
  function iconHtmlFor(kind) {
    if (ICONS[kind]) {
      return (
        '<span class="icon' + (MIRRORED_ICONS[kind] ? ' icon-mirror' : '') + '">' + ICONS[kind] + '</span>'
      );
    }
    var label = TEXT_ICONS[kind] || '?';
    return '<span class="icon text-icon">' + mdEscape(label) + '</span>';
  }

  function dataTypeIconKind(kind) {
    switch (kind) {
      case 'ComplexType':
        return 'cube';
      case 'SimpleType':
        return 'simple';
      case 'EnumType':
        return 'list';
      case 'ArrayType':
        return 'array';
      case 'UnionType':
        return 'union';
      case 'MixinType':
        return 'mixin';
      case 'MappedType':
        return 'mapped';
      default:
        return 'cube';
    }
  }

  var TYPE_GROUP_KEYS = {
    ComplexType: 'complex',
    SimpleType: 'simple',
    EnumType: 'enum',
    ArrayType: 'array',
    UnionType: 'union',
    MixinType: 'mixin',
    MappedType: 'mapped',
  };

  /** The human label for a group of data types. `count` selects the plural
   *  form — a heading over one enum should read "Enum", not "Enums", and
   *  which languages distinguish which counts isn't English's business (see
   *  `tp`). Left out, it means "a group in general", i.e. the plural. An
   *  unrecognized kind falls through to the schema's own identifier. */
  function dataTypeGroupLabel(kind, count) {
    var key = TYPE_GROUP_KEYS[kind];
    if (!key) return kind;
    return tp('typeGroups.' + key, count === undefined ? 2 : count);
  }

  var TYPE_GROUP_ORDER = [
    'ComplexType',
    'EnumType',
    'SimpleType',
    'UnionType',
    'MixinType',
    'MappedType',
  ];

  // ---------- path helpers ----------

  function joinPath(base, p) {
    if (!p) return base || '/';
    var b = base && base !== '/' ? base : '';
    var seg = p.charAt(0) === '/' ? p : '/' + p;
    return (b + seg).replace(/\/{2,}/g, '/') || '/';
  }

  function controllerPath(ctrl, parentPath) {
    return joinPath(parentPath, ctrl.path);
  }

  function operationPath(ctrlPath, op) {
    if (!op.path) return ctrlPath;
    return op.mergePath ? ctrlPath + op.path : joinPath(ctrlPath, op.path);
  }

  function routePrefix(docKey) {
    return docKey === 'root' ? '' : 'ref/' + encodeURIComponent(docKey) + '/';
  }

  function hrefFor(docKey, route) {
    return '#/' + routePrefix(docKey) + route;
  }

  // ---------- schema data helpers (all take an explicit `doc`) ----------

  /** Walks the controller tree, calling `onController`/`onOperation` for every node. */
  function walkControllers(controllers, parentPath, parentRoute, onController, onOperation, depth) {
    if (!controllers) return;
    depth = depth || 0;
    Object.keys(controllers).forEach(function (name) {
      var ctrl = controllers[name];
      var path = controllerPath(ctrl, parentPath);
      var route = parentRoute + '/' + encodeURIComponent(name);
      if (onController) onController(ctrl, path, route, name, depth);
      if (ctrl.operations) {
        Object.keys(ctrl.operations).forEach(function (opKey) {
          var op = ctrl.operations[opKey];
          var opRoute = route + '/' + encodeURIComponent(opKey);
          onOperation(ctrl, path, opKey, op, opRoute, depth + 1, name);
        });
      }
      if (ctrl.controllers) {
        walkControllers(ctrl.controllers, path, route, onController, onOperation, depth + 1);
      }
    });
  }

  function findControllerByRoute(doc, route) {
    var found = null;
    walkControllers(
      (doc.api && doc.api.controllers) || {},
      '',
      'ctl',
      function (ctrl, ctrlPath, ctrlRoute, name) {
        if (ctrlRoute === route) found = { ctrl: ctrl, ctrlPath: ctrlPath, name: name };
      },
      function () {},
    );
    return found;
  }

  function findOperationByRoute(doc, route) {
    var found = null;
    walkControllers(
      (doc.api && doc.api.controllers) || {},
      '',
      'ctl',
      null,
      function (ctrl, ctrlPath, opKey, op, opRoute, depth, ctrlName) {
        if (opRoute === route) {
          var ctrlRoute = opRoute.slice(0, opRoute.length - ('/' + encodeURIComponent(opKey)).length);
          found = { ctrl: ctrl, ctrlName: ctrlName, ctrlRoute: ctrlRoute, ctrlPath: ctrlPath, opKey: opKey, op: op };
        }
      },
    );
    return found;
  }

  function resolveType(doc, ref) {
    if (ref == null) return { name: null, def: null };
    if (typeof ref === 'string') {
      var def = doc.types && doc.types[ref];
      return { name: ref, def: def || null };
    }
    return { name: null, def: ref };
  }

  // ---------- shared render bits ----------

  function methodBadge(method) {
    return el('span', { class: 'method-badge method-' + method }, [method]);
  }

  /** Splits `text` into an `el()`-ready children array with every
   *  (case-insensitive) occurrence of `filterValue` wrapped in a `<mark>`
   *  — used to show *why* a sidebar row survived a Quick Filter/search,
   *  right on the label itself, instead of just leaving the reader to
   *  guess which part actually matched. Plain `[text]` (no `<mark>` at
   *  all) whenever there's no filter active, or the filter matched this
   *  row via something OTHER than this particular piece of text (its
   *  method or path, say, for an operation's own name) — that's a normal,
   *  unremarkable case, not a bug: the row still belongs in the filtered
   *  list, this text of its own just isn't where the match came from. */
  function highlightParts(text, filterValue) {
    if (!filterValue) return [text];
    var lower = text.toLowerCase();
    var parts = [];
    var pos = 0;
    var idx;
    while ((idx = lower.indexOf(filterValue, pos)) !== -1) {
      if (idx > pos) parts.push(text.slice(pos, idx));
      parts.push(el('mark', { class: 'match-highlight' }, [text.slice(idx, idx + filterValue.length)]));
      pos = idx + filterValue.length;
    }
    if (!parts.length) return [text];
    if (pos < text.length) parts.push(text.slice(pos));
    return parts;
  }

  /** The controller tree's label for an operation: always the operation's
   *  own key, never its `title`.
   *
   *  That tree mirrors the code — its folders are controller identifiers,
   *  which have no human name of their own — so prose leaves hanging off
   *  identifier branches read as a different kind of thing. And `title` is
   *  optional: a document that sets it on only some operations gets a
   *  half-prose tree, and once the document is translated, a half-translated
   *  one. The key is also what the reader types (`client.customer.update(…)`)
   *  and what the generated TypeScript client exports.
   *
   *  A `title` is never lost by not being shown here — it is the operation
   *  page's own `<h1>`, the search result's label, the "Sections" view's
   *  label (see `opTitleNode`), and this link's tooltip.
   *
   *  `filterValue`, when given, highlights (see `highlightParts`) matching
   *  parts of the key. */
  function opNameNode(op, opKey, cls, filterValue) {
    return el(
      'span',
      { class: (cls ? cls + ' ' : '') + 'name mono', title: op.title || null },
      highlightParts(opKey, filterValue),
    );
  }

  /** The "Sections" list's label for an operation: the author's own human
   *  name for it, since that view is the narrative one. `fallback` (a
   *  `Controller.opKey`, not a bare key) shows when there's no title — that
   *  list is flat, so two controllers' `update` would otherwise appear as
   *  two identical, indistinguishable rows. */
  function opTitleNode(op, fallback, cls, filterValue) {
    var base = cls ? cls + ' ' : '';
    return op.title
      ? el('span', { class: base + 'name' }, highlightParts(op.title, filterValue))
      : el('span', { class: base + 'name mono' }, highlightParts(fallback, filterValue));
  }

  /** Unwraps any number of ArrayType layers, returning the innermost
   *  resolved type plus a TypeScript-style `[]` suffix per layer (so
   *  `string[]`, or `string[][]` for an array of arrays) for display, and
   *  each layer's own `minOccurs`/`maxOccurs` (the array's cardinality —
   *  distinct from, and often present alongside, the item type's own
   *  constraints, e.g. a string pattern). Array-ness is read structurally
   *  from ArrayType — the sibling `isArray` flag some schema nodes carry is
   *  deprecated and never consulted. */
  function unwrapArray(doc, ref) {
    var r = resolveType(doc, ref);
    var suffix = '';
    var arrayConstraints = [];
    while (r.def && r.def.kind === 'ArrayType') {
      suffix += '[]';
      if (r.def.minOccurs != null || r.def.maxOccurs != null) {
        arrayConstraints.push({ minOccurs: r.def.minOccurs, maxOccurs: r.def.maxOccurs });
      }
      r = resolveType(doc, r.def.type);
    }
    return { name: r.name, def: r.def, prefix: '', suffix: suffix, arrayConstraints: arrayConstraints };
  }

  /** A type-chip (icon + name, tinted by kind — same look as a markdown
   *  cross-reference) linking to that model's page, or an inline type's
   *  best label when it has no page of its own. A fields-bearing type with
   *  no name of its own is what OPRA calls "embedded" (a ComplexType et al.
   *  declared `{ embedded: true }`, meant to live only inside a field) —
   *  labeled as such rather than showing the uninformative raw kind name,
   *  since that's also why it isn't a clickable link. */
  function typeRefNode(doc, ref, suffix) {
    var u = unwrapArray(doc, ref);
    var d = u.def;
    var iconKind = d ? dataTypeIconKind(d.kind) : 'cube';

    // An anonymous union — one chip holding all of its member types as
    // smaller pills ("⋃ UnionType | boolean number"), instead of a bare
    // "UnionType" label with the members spelled out in a separate nested
    // block below the field. Hover is scoped to just the "UnionType" label
    // for the union's own tooltip; each member pill is a full recursive
    // `typeRefNode` (own icon, own link if named, own hover), just
    // restyled a shade darker and borderless via `.type-chip-member` so it
    // reads as *part of* the union chip rather than a sibling of it.
    if (d && !u.name && d.kind === 'UnionType' && d.types && d.types.length) {
      var unionLabel = el('span', { class: 'type-chip-union-label' }, [iconFor(iconKind), 'UnionType' + (suffix || '')]);
      attachTypeHover(unionLabel, doc, ref);
      var unionNode = el('span', { class: 'type-chip c-' + iconKind + ' type-chip-union' }, [
        unionLabel,
        el('span', { class: 'type-chip-sep' }, ['|']),
      ]);
      d.types.forEach(function (memberRef) {
        var member = typeRefNode(doc, memberRef);
        member.classList.add('type-chip-member');
        unionNode.appendChild(member);
      });
      return unionNode;
    }

    var embedded = !!(d && !u.name && !d.name && d.fields);
    var name = (u.name || (d && d.name) || (embedded ? t('field.embedded') : d && d.kind) || t('field.unknown')) + (suffix || '');
    // `d.anonymous` (see `mapDataType` in schema-builder.ts) covers both
    // this — an embedded ComplexType/Mixin/Mapped type with no name — and
    // a SimpleType customized inline for one field/parameter (which still
    // *displays* a borrowed name like "string", not "embedded", but is
    // just as much "not a real standalone type"). The dashed border is a
    // quiet visual cue for that; `showTypeTooltip` spells it out.
    var attrs = { class: 'type-chip c-' + iconKind + (d && d.anonymous ? ' type-chip-anonymous' : '') };
    if (u.name) attrs.href = hrefFor(state.docKey, 'model/' + encodeURIComponent(u.name));
    var node = el(u.name ? 'a' : 'span', attrs, [iconFor(iconKind), name]);
    attachTypeHover(node, doc, ref);
    return node;
  }

  // ---------- data-type hover tooltip ----------

  var typeTooltipEl = null;
  var typeTooltipShowTimer = null;
  var typeTooltipHideTimer = null;

  function cancelTypeTooltipHide() {
    if (typeTooltipHideTimer) {
      clearTimeout(typeTooltipHideTimer);
      typeTooltipHideTimer = null;
    }
  }

  function ensureTypeTooltip() {
    if (!typeTooltipEl) {
      typeTooltipEl = el('div', { class: 'type-tooltip' });
      // The tooltip itself is interactive now (copy buttons on its
      // examples), so it needs to survive the pointer traveling from the
      // chip down into it — cancel the pending hide on entry, and only
      // hide once the pointer actually leaves the tooltip too.
      typeTooltipEl.addEventListener('mouseenter', cancelTypeTooltipHide);
      typeTooltipEl.addEventListener('mouseleave', function () {
        typeTooltipHideTimer = setTimeout(function () {
          typeTooltipEl.classList.remove('visible');
        }, 150);
      });
      document.body.appendChild(typeTooltipEl);
    }
    return typeTooltipEl;
  }

  function hideTypeTooltipNow() {
    if (typeTooltipShowTimer) {
      clearTimeout(typeTooltipShowTimer);
      typeTooltipShowTimer = null;
    }
    cancelTypeTooltipHide();
    if (typeTooltipEl) typeTooltipEl.classList.remove('visible');
  }

  /** Strips markdown syntax down to plain text and keeps only the first
   *  paragraph, for a compact one-glance tooltip rather than a full
   *  re-render of the description's markdown. */
  function briefText(md, maxLen) {
    if (!md) return '';
    var s = String(md)
      .replace(/\r\n?/g, '\n')
      .split(/\n\s*\n/)[0]
      .replace(/^#{1,4}\s+/gm, '')
      .replace(/^>\s?/gm, '')
      .replace(/^[-*]\s+/gm, '')
      .replace(/^\d+\.\s+/gm, '')
      .replace(/[`*_]/g, '')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/\s+/g, ' ')
      .trim();
    if (maxLen && s.length > maxLen) s = s.slice(0, maxLen - 1).trim() + '…';
    return s;
  }

  function showTypeTooltip(anchor, doc, ref) {
    var u = unwrapArray(doc, ref);
    var d = u.def;
    if (!d) return;
    var embedded = !u.name && !d.name && !!d.fields;
    var name = u.name || d.name || (embedded ? t('field.embedded') : d.kind);
    var iconKind = dataTypeIconKind(d.kind);
    var tip = ensureTypeTooltip();
    clear(tip);
    tip.appendChild(
      el('div', { class: 'type-tooltip-head' }, [
        iconFor(iconKind, 'c-' + iconKind),
        el('span', { class: 'mono' }, [name]),
        el('span', { class: 'badge kind-badge c-' + iconKind }, [d.kind]),
        // Set by `mapDataType` whenever this instance has no name of its
        // own — an embedded ComplexType/Mixin/Mapped type, or a SimpleType
        // customized inline for this one field/parameter. Either way,
        // `name` above is borrowed (from the base type, or the literal
        // word "embedded"), not this instance's own — flagged here since
        // that's easy to miss otherwise, especially when it still reads
        // as an ordinary type name like "string".
        d.anonymous
          ? el('span', {
              class: 'badge',
              title: t('field.embeddedHint'),
            }, [t('field.embedded')])
          : null,
      ]),
    );
    var brief = briefText(d.description, 220);
    tip.appendChild(
      el('div', { class: 'type-tooltip-desc' + (brief ? '' : ' empty'), dir: 'auto' }, [
        brief || t('field.noDescription'),
      ]),
    );
    // The type's own examples — same copyable chip as everywhere else,
    // but without each one's description (there's no room for it here,
    // and the tooltip is meant to be a quick glance, not the full page).
    if (d.examples && d.examples.length) {
      var exWrap = el('div', { class: 'type-tooltip-examples' });
      d.examples.forEach(function (ex) {
        exWrap.appendChild(exampleChip(ex.value));
      });
      tip.appendChild(exWrap);
    }

    var rect = anchor.getBoundingClientRect();
    // The tooltip grows away from the anchor's *leading* edge, so in an RTL
    // page it hangs from the anchor's right edge and overflows leftwards —
    // mirroring which side is measured, not just which one is set, or it
    // would flip off-screen on the first hover near a margin.
    // A first guess before the tooltip has a measurable width, so it never
    // flashes at wherever the previous hover left it; the frame below
    // corrects it once `offsetWidth` is readable.
    tip.style.left = rect.left + 'px';
    tip.style.top = rect.bottom + 6 + 'px';
    tip.classList.add('visible');
    requestAnimationFrame(function () {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      var left = IS_RTL ? rect.right - tw : rect.left;
      tip.style.left = Math.min(Math.max(8, left), Math.max(8, vw - tw - 8)) + 'px';
      if (rect.bottom + 6 + th > vh - 8) tip.style.top = Math.max(8, rect.top - th - 6) + 'px';
    });
  }

  /** Shows a small info popover (name, kind, description, examples) after
   *  a short hover delay over any element that represents a reference to
   *  a data type — a field's type label, an Extends/Mixin link, a
   *  markdown type-chip. Leaving the chip doesn't close it right away —
   *  there's a short grace period (see `ensureTypeTooltip`) so the
   *  pointer can travel down into the tooltip itself, e.g. to copy an
   *  example, without it vanishing first. */
  function attachTypeHover(node, doc, ref) {
    node.addEventListener('mouseenter', function () {
      cancelTypeTooltipHide();
      typeTooltipShowTimer = setTimeout(function () {
        showTypeTooltip(node, doc, ref);
      }, 450);
    });
    node.addEventListener('mouseleave', function () {
      if (typeTooltipShowTimer) {
        clearTimeout(typeTooltipShowTimer);
        typeTooltipShowTimer = null;
      }
      if (typeTooltipEl) {
        typeTooltipHideTimer = setTimeout(function () {
          typeTooltipEl.classList.remove('visible');
        }, 150);
      }
    });
  }

  /** What each field flag means — shown as its hover tooltip, since the
   *  short badge label alone ("exclusive", "localization"...) isn't
   *  self-explanatory. */
  var FLAG_HINTS = {
    required: t('flagHints.required'),
    deprecated: t('flagHints.deprecated'),
    readonly: t('flagHints.readonly'),
    writeonly: t('flagHints.writeonly'),
    exclusive: t('flagHints.exclusive'),
    localization: t('flagHints.localization'),
  };

  /** A small badge for a boolean field trait (required, readonly, ...),
   *  with a hover tooltip explaining what it means. */
  function flagBadge(key, label) {
    return el('span', { class: 'flag', title: FLAG_HINTS[key] }, [label || lookupMessage('flags.' + key) || key]);
  }

  /** A small "from X" flag shown at the end of an inherited field's line,
   *  naming whichever type actually declared it (rather than the type
   *  being viewed). Styled like the required/deprecated flags next to it —
   *  not as a standalone icon before the field name, which reads as the
   *  field's own identity marker (that's what type-kind icons mean
   *  elsewhere in this UI) rather than a provenance note. */
  function fromFlag(from) {
    var label = typeof from === 'string' ? from : (from && (from.name || from.kind)) || t('field.baseType');
    var title = t('field.inheritedFrom', { type: label });
    if (typeof from === 'string') {
      return el(
        'a',
        { class: 'flag from-flag', title: title, href: hrefFor(state.docKey, 'model/' + encodeURIComponent(from)) },
        [t('field.fromType', { type: label })],
      );
    }
    return el('span', { class: 'flag from-flag', title: title }, [t('field.fromType', { type: label })]);
  }

  /** "Extends X" / "Mixin of (X, Y)" / "Mapped from X" — shown once, above
   *  a model page's title. Deliberately not repeated inline for every
   *  embedded/nested occurrence of a type (see `fromFlag` for the
   *  per-field equivalent), since that reads as noise rather than signal. */
  function renderInherits(doc, inherits) {
    if (!inherits || !inherits.types || !inherits.types.length) return null;
    var chips = [];
    inherits.types.forEach(function (ref, i) {
      if (i > 0) chips.push(text(', '));
      chips.push(typeRefNode(doc, ref));
    });
    // The chips go through `tNodes` as a single fragment rather than being
    // appended after a prefix string: "Extends X" is an English word order,
    // and a translation has to be free to put the type list first.
    var frag = document.createDocumentFragment();
    chips.forEach(function (chip) {
      frag.appendChild(typeof chip === 'string' ? text(chip) : chip);
    });
    var key =
      inherits.kind === 'mixin' ? 'model.mixinOf' : inherits.kind === 'mapped' ? 'model.mappedFrom' : 'model.extends';
    return el('p', { class: 'inherits' }, tNodes(key, { types: frag }));
  }

  /** A field's type: the same tinted icon-chip used everywhere else on the
   *  page (Mixin of / References to this Resource / markdown cross-refs),
   *  with a TypeScript-style `[]` suffix per array layer — `string[]`, or
   *  `string[][]` for an array of arrays — folded into the chip itself
   *  (not sitting next to it as separate muted text), so an array's type
   *  still reads as one clickable/hoverable unit. `extraSuffix` lets a
   *  caller (e.g. a parameter with `arraySeparator`) add its own "[]" the
   *  same way, without the type itself being a real ArrayType. Every named
   *  type — including EnumType — is just a chip here: hovering shows a
   *  quick summary, clicking goes to its own page for the full detail
   *  (e.g. an enum's full value list). */
  function fieldTypeNode(doc, ref, extraSuffix) {
    var u = unwrapArray(doc, ref);
    var suffix = (u.suffix || '') + (extraSuffix || '');
    return typeRefNode(doc, ref, suffix || undefined);
  }

  /** "minValue" -> "Min value" — for labeling a SimpleType property whose
   *  raw key is a camelCase identifier. */
  function humanizePropKey(key) {
    var translated = lookupMessage('props.' + key);
    if (translated) return translated;
    var spaced = key.replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  }

  /** A SimpleType's own constraint properties (e.g. `minValue`/`maxValue`
   *  on a number, `pattern`/`minLength`/`maxLength` on a string) — shown
   *  under the field's description as "Label: value" pairs, a pattern
   *  value set off in `<code>` since it's a regular expression. Returns
   *  `null` when there's nothing set. `descriptions` (from
   *  `SimpleType.attributes`, e.g. `pattern`'s own "Regex pattern to be
   *  used for validation") is a native `title` tooltip here rather than
   *  visible text — this is the dense, inline-under-a-field context (see
   *  `renderSimpleTypePropertyRows` for the type's own spacious page,
   *  where it's shown outright). */
  function renderSimpleTypeProperties(properties, descriptions) {
    var keys = Object.keys(properties || {});
    if (!keys.length) return null;
    var container = el('div', { class: 'field-properties' });
    keys.forEach(function (key) {
      var value = properties[key];
      var desc = descriptions && descriptions[key];
      // `pattern` (a RegExp source) and any non-primitive value (e.g. the
      // builtin filter type's `rules` map) are boxed in `<code>` — a bare
      // `String(value)` on an object/array would otherwise print the
      // useless "[object Object]".
      var isObject = value !== null && typeof value === 'object';
      container.appendChild(
        el('div', { class: 'prop-row' }, [
          el('span', { class: 'prop-key', title: desc || null }, [humanizePropKey(key) + ': ']),
          key === 'pattern' || isObject
            ? el('code', {}, [isObject ? JSON.stringify(value) : String(value)])
            : text(String(value)),
        ]),
      );
    });
    return container;
  }

  /** The array wrapper's *own* cardinality constraints (`minOccurs`/
   *  `maxOccurs` per `[]` layer — see `unwrapArray`) — kept visually and
   *  textually distinct from the item type's own constraints (rendered
   *  separately by `renderSimpleTypeProperties`), since "Max items: 10" and
   *  the item's own "Pattern: ..." answer different questions and
   *  shouldn't be read as one property list. Returns `null` when the field
   *  isn't an array, or carries no cardinality constraints. */
  function renderArrayConstraints(arrayConstraints) {
    if (!arrayConstraints || !arrayConstraints.length) return null;
    var container = el('div', { class: 'field-properties' });
    arrayConstraints.forEach(function (c) {
      if (c.minOccurs != null) {
        container.appendChild(
          el('div', { class: 'prop-row' }, [
            el('span', { class: 'prop-key' }, [t('field.minArrayItems')]),
            text(String(c.minOccurs)),
          ]),
        );
      }
      if (c.maxOccurs != null) {
        container.appendChild(
          el('div', { class: 'prop-row' }, [
            el('span', { class: 'prop-key' }, [t('field.maxArrayItems')]),
            text(String(c.maxOccurs)),
          ]),
        );
      }
    });
    return container;
  }

  /** One example value as a small boxed chip — the value in `<code>` plus
   *  a copy-to-clipboard button — shared between a field's own inline
   *  example list (`renderFieldExamples`) and a named type's dedicated
   *  "Examples" section (`renderTypeExamples`). */
  function exampleChip(value) {
    return el('span', { class: 'example-chip' }, [
      el('code', {}, [typeof value === 'string' ? value : JSON.stringify(value)]),
      copyButton(value),
    ]);
  }

  /** Wraps each token of a pretty-printed JSON string in a `<span>` so CSS
   *  can color keys/strings/numbers/booleans/null separately — a small
   *  hand-rolled tokenizer instead of a dependency, consistent with this
   *  file's "no external dependency" inline-icon/markdown approach. Escapes
   *  `&`/`<`/`>` itself first since the result is used as raw `innerHTML`. */
  function highlightJson(json) {
    var escaped = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return escaped.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
      function (match) {
        var cls = 'json-number';
        if (/^"/.test(match)) cls = /:$/.test(match) ? 'json-key' : 'json-string';
        else if (/true|false/.test(match)) cls = 'json-boolean';
        else if (match === 'null') cls = 'json-null';
        return '<span class="' + cls + '">' + match + '</span>';
      },
    );
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /** None of these are general-purpose tokenizers for their language — same
   *  "hand-rolled, no dependency" spirit as `highlightJson`, just scoped to
   *  exactly the tokens the `format*Snippet` functions themselves ever emit
   *  (we generate this code, so we already know everything that can appear
   *  in it), rather than trying to parse arbitrary input. Each uses one
   *  combined regex with a capture group per token category (mirroring
   *  `highlightJson`'s single-pass style), reusing its color classes
   *  (`.json-string`/`.json-number`/`.json-boolean`/`.json-key`) plus two
   *  new ones (`.code-keyword`, `.code-comment`) for things JSON never had:
   *  command/function names and the `// filename`/`# filename` notes in
   *  generated multipart snippets. */
  function highlightShell(code) {
    var escaped = escapeHtml(code);
    return escaped.replace(/('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|(\b(?:curl|http)\b|-[A-Za-z]\b|--[a-z-]+\b)/g, function (match, str, kw) {
      if (str !== undefined) return '<span class="json-string">' + str + '</span>';
      return '<span class="code-keyword">' + kw + '</span>';
    });
  }

  /** `extraKeywords` lets each JS-family caller (jQuery/XHR alongside the
   *  original Fetch/Axios) highlight its own handful of extra identifiers
   *  (`$`/`ajax`, `XMLHttpRequest`/`open`/`send`, ...) without every caller
   *  needing its own near-duplicate regex. */
  function highlightJs(code, extraKeywords) {
    var keywords = ['const', 'var', 'new', 'require', 'fetch', 'axios', 'JSON', 'stringify', 'FormData'].concat(extraKeywords || []);
    var escaped = escapeHtml(code);
    var re = new RegExp(
      "('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"|//[^\\n]*)|(\\b(?:" +
        keywords.map(escapeRegExp).join('|') +
        ')\\b)|(\\b[A-Za-z_$][A-Za-z0-9_$]*)(?=\\s*:)|(-?\\d+(?:\\.\\d+)?)',
      'g',
    );
    return escaped.replace(re, function (match, str, kw, key, num) {
      if (str !== undefined) {
        if (str.charAt(0) === '/') return '<span class="code-comment">' + str + '</span>';
        return '<span class="json-string">' + str + '</span>';
      }
      if (kw !== undefined) return '<span class="code-keyword">' + kw + '</span>';
      if (key !== undefined) return '<span class="json-key">' + key + '</span>';
      if (num !== undefined) return '<span class="json-number">' + num + '</span>';
      return match;
    });
  }

  function highlightPython(code, extraKeywords) {
    var keywords = ['import', 'open', 'requests', 'response'].concat(extraKeywords || []);
    var escaped = escapeHtml(code);
    var re = new RegExp(
      "('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"|#[^\\n]*)|(\\b(?:" +
        keywords.map(escapeRegExp).join('|') +
        ')\\b)|(\\b(?:True|False|None)\\b)|(\\b[A-Za-z_][A-Za-z0-9_]*)(?=\\=(?!=))|(-?\\d+(?:\\.\\d+)?)',
      'g',
    );
    return escaped.replace(re, function (match, str, kw, boolNull, kwarg, num) {
      if (str !== undefined) {
        if (str.charAt(0) === '#') return '<span class="code-comment">' + str + '</span>';
        return '<span class="json-string">' + str + '</span>';
      }
      if (kw !== undefined) return '<span class="code-keyword">' + kw + '</span>';
      if (boolNull !== undefined) return '<span class="json-boolean">' + boolNull + '</span>';
      if (kwarg !== undefined) return '<span class="json-key">' + kwarg + '</span>';
      if (num !== undefined) return '<span class="json-number">' + num + '</span>';
      return match;
    });
  }

  /** A shared highlighter for the remaining C-like-enough languages (PHP,
   *  Java, Go, C#, Swift) plus Ruby — one `keywords` list per caller instead
   *  of a bespoke regex each, since their token *shapes* (quoted strings,
   *  `//`/`#` comments, a handful of language keywords, numbers) are close
   *  enough to share one pattern; only the keyword list actually varies. */
  function highlightGeneric(code, keywords) {
    var escaped = escapeHtml(code);
    var re = new RegExp(
      "('(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\"|//[^\\n]*|#[^\\n]*)|(\\b(?:" +
        keywords.map(escapeRegExp).join('|') +
        ')\\b)|(\\b[A-Za-z_][A-Za-z0-9_]*)(?=\\s*[:=](?!=))|(-?\\d+(?:\\.\\d+)?)',
      'g',
    );
    return escaped.replace(re, function (match, str, kw, key, num) {
      if (str !== undefined) {
        if (str.charAt(0) === '/' || str.charAt(0) === '#') return '<span class="code-comment">' + str + '</span>';
        return '<span class="json-string">' + str + '</span>';
      }
      if (kw !== undefined) return '<span class="code-keyword">' + kw + '</span>';
      if (key !== undefined) return '<span class="json-key">' + key + '</span>';
      if (num !== undefined) return '<span class="json-number">' + num + '</span>';
      return match;
    });
  }

  /** Splits a URL into the pieces a raw-socket-style client (Node's `http`
   *  module, Python's `http.client`) needs separately rather than as one
   *  string — hostname, port (`''` when default), and path+query. Uses the
   *  browser's own `URL` — this runs client-side, so it's always available,
   *  no polyfill needed. */
  function parseUrlParts(url) {
    try {
      var u = new URL(url);
      return { hostname: u.hostname, port: u.port, path: (u.pathname || '/') + u.search, protocol: u.protocol.replace(':', '') };
    } catch (e) {
      return { hostname: url, port: '', path: '/', protocol: 'http' };
    }
  }

  /** A nested PHP array literal (`'key' => value`) for a JSON-like example
   *  value — mirrors `pyLiteral`'s role for Python, just PHP's own array
   *  syntax instead of a dict/list literal. */
  function phpLiteral(value, indent) {
    indent = indent || '';
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'string') return "'" + value.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
    var nextIndent = indent + '  ';
    if (Array.isArray(value)) {
      var items = value.map(function (v) {
        return nextIndent + phpLiteral(v, nextIndent);
      });
      return '[\n' + items.join(',\n') + '\n' + indent + ']';
    }
    var keys = Object.keys(value);
    var lines = keys.map(function (k) {
      return nextIndent + "'" + k + "' => " + phpLiteral(value[k], nextIndent);
    });
    return '[\n' + lines.join(',\n') + '\n' + indent + ']';
  }

  /** A C# string literal for an already-formatted JSON string — escapes
   *  backslashes/quotes and turns real newlines into literal `\n` escapes,
   *  since the JSON text is embedded in a normal (non-verbatim) C# string. */
  function csharpStringLiteral(str) {
    return '"' + str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n') + '"';
  }

  /** A field's own declared example value(s) (`ApiField.examples` — either
   *  a plain array of values or a name-keyed record of them), shown as a
   *  row of boxed, individually-copyable chips under the field's
   *  description — kept in the same `.field-properties`/`.prop-row` family
   *  as the array/SimpleType constraint rows above it, so it still reads
   *  as part of the same "extra facts about this field" group. Returns
   *  `null` when there's nothing set. */
  function renderFieldExamples(examples) {
    if (!examples) return null;
    var values = Array.isArray(examples) ? examples : Object.keys(examples).map(function (k) {
      return examples[k];
    });
    if (!values.length) return null;
    var container = el('div', { class: 'field-properties' });
    var row = el('div', { class: 'prop-row example-row' }, [
      el('span', { class: 'prop-key' }, [tp('field.example', values.length)]),
    ]);
    values.forEach(function (v) {
      row.appendChild(exampleChip(v));
    });
    container.appendChild(row);
    return container;
  }

  /** One row per field in `fields`, ready to append — shared between the
   *  page's own "Fields" section and an embedded type's inline sub-tree
   *  (see `renderFieldNode`). */
  function renderFieldRows(doc, fields) {
    return Object.keys(fields).map(function (fname) {
      var f = fields[fname];
      return renderFieldNode(doc, fname, f.type, {
        required: f.required,
        deprecated: f.deprecated,
        readonly: f.readonly,
        writeonly: f.writeonly,
        exclusive: f.exclusive,
        localization: f.localization,
        description: f.description,
        from: f.from,
        examples: f.examples,
      });
    });
  }

  /** One field (or anonymous union member) as a single definition-list row:
   *  the name, its type-chip, and — for an inherited field — a "from X"
   *  flag at the end. A *named* type with its own page is never expanded
   *  inline here — following the link/chip is how you see its fields,
   *  which keeps a deep object graph from turning into a wall of nested
   *  fields on every page. An *embedded* type (OPRA's term for a
   *  ComplexType declared `{ embedded: true }` — it has no name of its
   *  own and exists only to be nested inside a field) has no page to link
   *  to, so its fields are walked inline as a sub-tree instead. */
  function renderFieldNode(doc, name, ref2, extra) {
    var u = unwrapArray(doc, ref2);
    var d = u.def;
    var head = el('span', { class: 'field-head' }, [
      name ? el('span', { class: 'key' }, [name]) : null,
      name ? text(': ') : null,
      // A parameter (unlike a field) can accept multiple values through a
      // single string value rather than the type itself being an ArrayType
      // — e.g. a query parameter with `arraySeparator: ','` splits a
      // comma-separated string into several values of its own (non-array)
      // type. Given the same "[]" suffix as a real array, folded into the
      // chip itself (see `fieldTypeNode`) rather than sitting next to it.
      fieldTypeNode(doc, ref2, extra && extra.arraySeparator ? '[]' : null),
    ]);
    if (extra && extra.required) head.appendChild(flagBadge('required'));
    if (extra && extra.deprecated) {
      var deprecatedFlag = flagBadge('deprecated');
      if (typeof extra.deprecated === 'string') deprecatedFlag.title = extra.deprecated;
      head.appendChild(deprecatedFlag);
    }
    if (extra && extra.readonly) head.appendChild(flagBadge('readonly'));
    if (extra && extra.writeonly) head.appendChild(flagBadge('writeonly'));
    if (extra && extra.exclusive) head.appendChild(flagBadge('exclusive'));
    if (extra && extra.localization) head.appendChild(flagBadge('localization'));
    if (extra && extra.from) head.appendChild(fromFlag(extra.from));
    var row = el('div', { class: 'field-row' }, [head]);
    if (extra && extra.description) {
      row.appendChild(mdBlock(doc, extra.description, 'field-description'));
    }
    var arrayConstraintsNode = renderArrayConstraints(u.arrayConstraints);
    if (arrayConstraintsNode) row.appendChild(arrayConstraintsNode);
    var fieldExamplesNode = renderFieldExamples(extra && extra.examples);
    if (fieldExamplesNode) row.appendChild(fieldExamplesNode);

    // Anything unnamed and fields-bearing (embedded ComplexType/MappedType/
    // MixinType) is walked inline — there's nowhere else to point a reader
    // to see it. An anonymous union is fully represented by the chip
    // itself now (see `typeRefNode`'s member pills), so it needs no
    // separate nested block here. Anything named (including EnumType) is
    // just the chip above.
    if (d && !u.name && d.fields) {
      var nestedFields = el('div', { class: 'field-nested' });
      renderFieldRows(doc, d.fields).forEach(function (r) {
        nestedFields.appendChild(r);
      });
      row.appendChild(nestedFields);
    } else if (d && d.kind === 'SimpleType' && d.properties) {
      var propsNode = renderSimpleTypeProperties(d.properties, d.propertyDescriptions);
      if (propsNode) row.appendChild(propsNode);
    }
    return row;
  }

  /** A SimpleType's own constraint properties, shown on *its* model page
   *  (never inline under a field — see `renderSimpleTypeProperties` for
   *  that compact case) — same definition-list rows as Fields/Values, with
   *  the same divider/spacing, keyed by property name instead of a field
   *  name. `descriptions` (from `SimpleType.attributes`, e.g.
   *  `StringType`'s own `pattern`/`minLength`/`maxLength`) prints as a
   *  full description line below the row here, same as a field's own
   *  description — there's room for it on this dedicated page, unlike
   *  the compact inline case. */
  function renderSimpleTypePropertyRows(doc, properties, descriptions) {
    var keys = Object.keys(properties || {});
    return keys.map(function (key) {
      var value = properties[key];
      // Every property's value as a chip (same `exampleChip` as the
      // "Examples" section below it, `.field-head .example-chip`'s own
      // larger font included) — not just `pattern` boxed in a bare
      // `<code>` while `minLength`/`maxLength` sat as plain inline text
      // as if less important than it.
      var row = el('div', { class: 'field-row' }, [
        el('span', { class: 'field-head' }, [
          el('span', { class: 'key' }, [humanizePropKey(key)]),
          text(': '),
          exampleChip(value),
        ]),
      ]);
      var desc = descriptions && descriptions[key];
      if (desc) row.appendChild(mdBlock(doc, desc, 'field-description'));
      return row;
    });
  }

  /** An enum's own value list, shown on *its* model page (never inline
   *  under a field — see `renderFieldNode`). Same definition-list rows as
   *  fields, keyed by value instead of name. */
  function renderEnumValues(doc, d) {
    var values = d.values || {};
    var keys = Object.keys(values);
    if (!keys.length) return el('div', { class: 'empty-note' }, [t('field.noValues')]);
    var list = el('div', { class: 'field-list' });
    keys.forEach(function (val) {
      var meta = values[val] || {};
      // A copy button next to each value — an enum member is exactly the
      // literal string a caller needs to paste into their own code
      // (a filter, a switch case, ...), unlike most other field-list rows
      // where the "key" is just a label, not something meant to be lifted
      // verbatim.
      var valueRow = el('div', { class: 'field-row' }, [
        el('span', { class: 'field-head' }, [el('span', { class: 'key' }, [val]), copyButton(val)]),
      ]);
      if (meta.description) valueRow.appendChild(mdBlock(doc, meta.description, 'field-description'));
      list.appendChild(valueRow);
    });
    return list;
  }

  /** Hides every row past `collapseAfter` and appends a "Show N more
   *  fields" button in their place — used only where a field list sits
   *  inline in the middle of a page competing with everything around it
   *  for space (the request body panel — see `renderTypeTree`'s own
   *  `collapseAfter` param), not on a type's dedicated model page, where
   *  the full list *is* the page's own content and collapsing it would
   *  just make the reader click to see the thing they came for. A plain
   *  field-count threshold rather than measuring rendered height: this
   *  codebase already ran into real bugs asking the DOM "how tall is this
   *  right now" (the request rail's own alignment step, earlier), and a
   *  row count is available before anything is even attached to the page,
   *  no render-order dependency to get wrong. */
  function appendShowMoreFields(container, rows, collapseAfter) {
    var hidden = rows.slice(collapseAfter);
    hidden.forEach(function (r) {
      r.hidden = true;
    });
    var btn = el('button', { class: 'show-more-fields', type: 'button' }, [
      tp('field.showMoreFields', hidden.length),
    ]);
    btn.addEventListener('click', function () {
      hidden.forEach(function (r) {
        r.hidden = false;
      });
      btn.remove();
    });
    container.appendChild(btn);
  }

  /** The page's own "Fields" section: the type's fields/values/members
   *  rendered directly, without a redundant row repeating the type's own
   *  name (the page's `<h1>` and "Fields" heading already say what this
   *  is). Nested field types stop at one level — see `renderFieldNode`.
   *  `collapseAfter`, when given, caps the *top-level* field list at that
   *  many rows (see `appendShowMoreFields`) — omitted everywhere except
   *  the request body panel, where an inline field list otherwise had no
   *  bound at all and could run to a full screen or more on its own. */
  function renderTypeTree(doc, ref, collapseAfter) {
    var container = el('div', { class: 'field-list' });
    var u = unwrapArray(doc, ref);
    var d = u.def;
    if (!d) return container;
    if (d.fields) {
      var rows = renderFieldRows(doc, d.fields);
      rows.forEach(function (r) {
        container.appendChild(r);
      });
      if (!rows.length) return el('div', { class: 'empty-note' }, [t('field.noFields')]);
      if (collapseAfter && rows.length > collapseAfter) appendShowMoreFields(container, rows, collapseAfter);
    } else if (d.kind === 'EnumType') {
      return renderEnumValues(doc, d);
    } else if (d.kind === 'UnionType') {
      (d.types || []).forEach(function (ref) {
        container.appendChild(renderFieldNode(doc, null, ref, null));
      });
    } else if (d.kind === 'SimpleType') {
      var propRows = d.properties && renderSimpleTypePropertyRows(doc, d.properties, d.propertyDescriptions);
      if (propRows && propRows.length) {
        propRows.forEach(function (r) {
          container.appendChild(r);
        });
      } else {
        return el('div', { class: 'empty-note' }, [t('field.noProperties')]);
      }
    } else {
      return el('div', { class: 'empty-note' }, [t('field.noFields')]);
    }
    return container;
  }

  /** Prepends the "Extends X" / "Mixin of (...)" / "Mapped from X"
   *  composition line before a type's field tree, wherever that tree is
   *  shown outside the type's own dedicated model page (a model page
   *  already shows it next to its kind badge, via `renderInherits`) — e.g.
   *  a request/response body whose type is a MappedType or MixinType.
   *  `collapseAfter` just forwards to `renderTypeTree`. */
  function renderTypeTreeWithInherits(doc, ref, collapseAfter) {
    var u = unwrapArray(doc, ref);
    var d = u.def;
    var container = el('div', {});
    if (d && d.inherits) {
      var inheritsBlock = renderInherits(doc, d.inherits);
      if (inheritsBlock) container.appendChild(inheritsBlock);
    }
    container.appendChild(renderTypeTree(doc, ref, collapseAfter));
    return container;
  }

  function formatStatusCode(sc) {
    var list = Array.isArray(sc) ? sc : [sc];
    return list
      .map(function (s) {
        if (s && typeof s === 'object') {
          if (s.end - s.start === 99 && s.start % 100 === 0) return Math.floor(s.start / 100) + 'XX';
          return s.start + '-' + s.end;
        }
        return String(s);
      })
      .join(', ');
  }

  // ---------- pages ----------

  /** "Document Info" — the document's own root page (see the sidebar link
   *  in `buildSidebar`): title, version, server URL, the document's own
   *  description, and a one-line content summary. Goes through the same
   *  `.content-col`/TOC pipeline as every other page (see `render()`), so
   *  its "Description"/"Contents" headings show up in the "On this page"
   *  rail same as anywhere else. */
  /** Total operation count for a controller, including every nested child
   *  controller's own operations — used by the top-level Controllers list
   *  below, which shows only first-level controllers (the sidebar already
   *  covers the full nested tree) but still wants an honest count. */
  function countOperations(ctrl) {
    var n = ctrl.operations ? Object.keys(ctrl.operations).length : 0;
    if (ctrl.controllers) {
      Object.keys(ctrl.controllers).forEach(function (name) {
        n += countOperations(ctrl.controllers[name]);
      });
    }
    return n;
  }

  /** Contact/license/terms-of-service, shown as compact byline rows right
   *  under the title — these already ride through unfiltered as part of
   *  `doc.info` (see `schema-builder.ts`), nothing further to build. Omits
   *  the whole block when the document declares none of them, rather than
   *  showing empty rows. */
  /** `https://...`/`http://...` gets a real link ("View ↗"); anything else
   *  (a plain sentence — some documents put actual terms prose here rather
   *  than a link to a hosted page) is shown as running text instead of a
   *  broken href. */
  function isHttpUrl(s) {
    return typeof s === 'string' && /^https?:\/\//i.test(s);
  }

  /** One "License" / "Contact" / "Terms of Service" block — a small
   *  uppercase label above normal-sized body content, matching the scale
   *  of an "About" sidebar item rather than the dense `.field-properties`
   *  rows used for a type's own constraints (which read as too small and
   *  cramped directly under the page's big h1/h2 titles). */
  function metaItem(label, iconKind, body) {
    return el('div', { class: 'doc-meta-item' }, [
      el('div', { class: 'doc-meta-label' }, [iconFor(iconKind), label]),
      el('div', { class: 'doc-meta-body' }, body),
    ]);
  }

  function renderInfoMeta(main, doc, info) {
    var items = [];

    if (info.license) {
      var lic = info.license;
      var row = el('div', { class: 'doc-meta-license-row' }, [
        lic.url
          ? el('a', { class: 'doc-meta-value', href: lic.url, target: '_blank', rel: 'noopener' }, [lic.name])
          : el('span', { class: 'doc-meta-value' }, [lic.name]),
      ]);
      var body = [row];
      // The license's full text (e.g. the standard MIT text) sits right
      // next to its own name/link — a toggle in the same row expands a
      // block directly beneath it, rather than a disclosure stranded
      // somewhere else on the page.
      if (lic.content) {
        // Rendered as markdown like every other prose block in the page,
        // not as raw preformatted text: a license is normally hard-wrapped
        // at ~80 columns, which reads as ragged half-lines inside this
        // narrow column, and any emphasis in it (`*Example Inc*`) would
        // otherwise show up as literal asterisks.
        var contentPre = mdBlock(doc, lic.content, 'license-content');
        contentPre.hidden = true;
        var toggleBtn = el('button', { class: 'text-toggle-btn', type: 'button' }, [t('overview.viewFullText')]);
        toggleBtn.addEventListener('click', function () {
          contentPre.hidden = !contentPre.hidden;
          toggleBtn.textContent = contentPre.hidden ? t('overview.viewFullText') : t('overview.hideFullText');
        });
        row.appendChild(toggleBtn);
        body.push(contentPre);
      }
      items.push(metaItem(t('overview.license'), 'scale', body));
    }

    if (info.contact && info.contact.length) {
      var cards = info.contact.map(function (c) {
        var card = el('div', { class: 'contact-card' });
        if (c.name) card.appendChild(el('div', { class: 'contact-name' }, [c.name]));
        // The copy button sits *beside* the link, not inside it — nesting
        // it inside the `<a>` would also fire the mailto/website navigation
        // on every copy click, since `copyButton`'s own `stopPropagation`
        // doesn't stop the anchor's default browser action.
        if (c.email) {
          card.appendChild(
            el('div', { class: 'contact-line' }, [
              el('a', { class: 'contact-link', href: 'mailto:' + c.email }, [
                iconFor('mail'),
                el('span', { class: 'label' }, [c.email]),
              ]),
              copyButton(c.email),
            ]),
          );
        }
        if (c.url) {
          card.appendChild(
            el('div', { class: 'contact-line' }, [
              el('a', { class: 'contact-link', href: c.url, target: '_blank', rel: 'noopener' }, [
                iconFor('globe'),
                el('span', { class: 'label' }, [c.url.replace(/^https?:\/\//, '')]),
              ]),
              copyButton(c.url),
            ]),
          );
        }
        return card;
      });
      items.push(
        metaItem(tp('overview.contact', info.contact.length), 'users', [
          el('div', { class: 'contact-cards' }, cards),
        ]),
      );
    }

    if (info.termsOfService) {
      if (isHttpUrl(info.termsOfService)) {
        items.push(
          metaItem(t('overview.termsOfService'), 'book', [
            el('a', { href: info.termsOfService, target: '_blank', rel: 'noopener' }, [t('overview.viewTerms')]),
          ]),
        );
      } else {
        // A long inline terms text is clamped to 3 lines by default, with a
        // "Show more" toggle — added only once the text is confirmed to
        // actually overflow that clamp (measured post-layout), rather than
        // showing a toggle for a one-line blurb that never needed one.
        var textEl = el('div', { class: 'terms-text clamped' }, [info.termsOfService]);
        var moreBtn = el('button', { class: 'text-toggle-btn', type: 'button' }, [t('common.showMore')]);
        moreBtn.hidden = true;
        moreBtn.addEventListener('click', function () {
          var stillClamped = textEl.classList.toggle('clamped');
          moreBtn.textContent = stillClamped ? t('common.showMore') : t('common.showLess');
        });
        items.push(metaItem(t('overview.termsOfService'), 'book', [textEl, moreBtn]));
        requestAnimationFrame(function () {
          if (textEl.scrollHeight > textEl.clientHeight + 1) moreBtn.hidden = false;
        });
      }
    }

    if (items.length) main.appendChild(el('div', { class: 'doc-meta' }, items));
  }

  /** Every other document reachable from here (`ApiDocument.references`,
   *  already flattened alongside the root doc at render time — see
   *  `ApiUiFactory.render`) — one row per reference, linking straight to
   *  that document's own Document Info page. The count is whatever the
   *  application actually declared as a reference, which in practice stays
   *  small (unlike types/controllers), so a plain list needs no capping. */
  function renderReferencesSection(main) {
    var keys = Object.keys(embedded.refs || {});
    if (!keys.length) return;
    var section = el('div', { class: 'section' }, [el('h2', {}, [t('overview.referenceDocuments')])]);
    keys.sort().forEach(function (ns) {
      var rinfo = (embedded.refs[ns] && embedded.refs[ns].info) || {};
      section.appendChild(
        el('a', { class: 'row-link', href: hrefFor(ns, '') }, [
          iconFor('book'),
          el('span', { class: 'mono' }, [rinfo.title || ns]),
          rinfo.version ? el('span', { class: 'row-desc' }, [t('common.versionTag', { version: rinfo.version })]) : null,
        ]),
      );
    });
    main.appendChild(section);
  }

  /** Top-level controllers only — the sidebar already shows the full
   *  nested tree, so repeating it here would just be noise. Kept flat and
   *  capped isn't needed in practice (a document's top-level controller
   *  count stays small even when its operations/models don't), but each
   *  row still reports its own total operation count (including nested
   *  children) so the number means something without expanding anything. */
  function renderControllersSection(main, docKey, doc) {
    var controllers = (doc.api && doc.api.controllers) || {};
    var names = Object.keys(controllers);
    if (!names.length) return;
    var section = el('div', { class: 'section' }, [el('h2', {}, [t('overview.controllers')])]);
    names.sort().forEach(function (name) {
      var ctrl = controllers[name];
      var n = countOperations(ctrl);
      section.appendChild(
        el('a', { class: 'row-link', href: hrefFor(docKey, 'ctl/' + encodeURIComponent(name)) }, [
          el('span', { class: 'mono' }, [name]),
          el('span', { class: 'row-desc' }, [tp('overview.operationCount', n)]),
        ]),
      );
    });
    main.appendChild(section);
  }

  /** A scalable stand-in for "list every model" — which, for a document
   *  with hundreds of types, would either overwhelm the page or need its
   *  own pagination. Grouped counts stay a fixed, small size no matter how
   *  many types the document declares, and the sidebar already lists every
   *  type by name (grouped the same way — see `TYPE_GROUP_ORDER`), so each
   *  chip here links to the first type of its kind rather than duplicating
   *  that list. */
  function renderModelsSection(main, docKey, doc) {
    var types = doc.types || {};
    var declaredNames = doc.declaredTypes || Object.keys(types);
    var byKind = {};
    declaredNames.forEach(function (name) {
      if (!types[name]) return;
      (byKind[types[name].kind] = byKind[types[name].kind] || []).push(name);
    });
    var kinds = Object.keys(byKind);
    if (!kinds.length) return;
    var section = el('div', { class: 'section' }, [el('h2', {}, [t('overview.models')])]);
    var chipRow = el('div', { class: 'stat-chips' });
    TYPE_GROUP_ORDER.concat(kinds.filter(function (k) { return TYPE_GROUP_ORDER.indexOf(k) === -1; })).forEach(
      function (kind) {
        if (!byKind[kind]) return;
        var names = byKind[kind].sort();
        var iconKind = dataTypeIconKind(kind);
        var label = dataTypeGroupLabel(kind, names.length);
        chipRow.appendChild(
          el('a', { class: 'stat-chip c-' + iconKind, href: hrefFor(docKey, 'model/' + encodeURIComponent(names[0])) }, [
            iconFor(iconKind),
            el('span', { class: 'stat-count' }, [String(names.length)]),
            text(label),
          ]),
        );
      },
    );
    section.appendChild(chipRow);
    main.appendChild(section);
  }

  function renderOverviewPage(main, doc) {
    var info = doc.info || {};
    main.appendChild(
      el('h1', { dir: 'auto' }, [
        info.title || t('overview.apiReference'),
        info.version ? el('span', { class: 'badge' }, [t('common.versionTag', { version: info.version })]) : null,
      ]),
    );
    if (doc.api && doc.api.url) {
      main.appendChild(el('p', { class: 'description path' }, [t('overview.server', { url: doc.api.url })]));
    }
    // What the API *is* comes first (description, then what it contains);
    // who owns/licenses it is a footnote, so the license/contact/terms
    // panel goes last, below everything else.
    var descBlock = mdBlock(doc, info.description);
    if (descBlock) {
      main.appendChild(el('div', { class: 'section' }, [el('h2', {}, [t('overview.description')]), descBlock]));
    }

    // `embedded.refs` is always the *root* document's own references (only
    // one level deep — see `ApiUiFactory.render`), so this section only
    // makes sense on the root's own Document Info page; showing it while
    // viewing a reference document itself would misleadingly look like
    // that document references itself/its siblings.
    if (state.docKey === 'root') renderReferencesSection(main);
    renderControllersSection(main, state.docKey, doc);
    renderModelsSection(main, state.docKey, doc);

    renderInfoMeta(main, doc, info);
  }

  /** One table per parameter location (path/query/header/cookie), each
   *  only shown when it actually has entries — shared by a controller's
   *  own page (its directly-declared parameters, e.g. a `customerId`
   *  path parameter) and an operation's page (its own parameters *plus*
   *  every ancestor controller's, already merged server-side — see
   *  `mapHttpOperation` in schema-builder.ts). */
  function renderParametersSections(main, doc, parameters) {
    if (!parameters || !parameters.length) return;
    var PARAMETER_SECTION_KEYS = {
      path: 'operation.parametersPath',
      query: 'operation.parametersQuery',
      header: 'operation.parametersHeader',
      cookie: 'operation.parametersCookie',
    };
    ['path', 'query', 'header', 'cookie'].forEach(function (loc) {
      var params = parameters.filter(function (p) {
        return p.location === loc;
      });
      if (!params.length) return;
      var section = el('div', { class: 'section' }, [
        el('h2', {}, [t(PARAMETER_SECTION_KEYS[loc])]),
      ]);
      // Same `renderFieldNode` used for a model's own Fields — a plain
      // Name/Type/Required/Description table gave a parameter's type only
      // a bare text label, with no link to its own page and no visibility
      // into a SimpleType's own properties (pattern, min/max, examples).
      // Reusing the field renderer gives a parameter's type the same
      // clickable chip, hover tooltip, and inline properties a field gets.
      var list = el('div', { class: 'field-list' });
      params.forEach(function (p) {
        list.appendChild(
          renderFieldNode(doc, p.name, p.type, {
            required: p.required,
            deprecated: p.deprecated,
            description: p.description,
            arraySeparator: p.arraySeparator,
          }),
        );
      });
      section.appendChild(list);
      main.appendChild(section);
    });
  }

  /** A media type's own `example` (a single value) or `examples` (a named
   *  map of values) — shown as copyable chips, same as everywhere else.
   *  The two are mutually exclusive per the schema, so at most one of
   *  these ever produces anything. */
  function renderMediaTypeExamples(media) {
    if (media.example !== undefined) {
      return el('div', { class: 'field-properties' }, [
        el('div', { class: 'prop-row example-row' }, [
          el('span', { class: 'prop-key' }, [t('media.example')]),
          exampleChip(media.example),
        ]),
      ]);
    }
    var names = media.examples ? Object.keys(media.examples) : [];
    if (!names.length) return null;
    return el(
      'div',
      { class: 'field-properties' },
      names.map(function (name) {
        return el('div', { class: 'prop-row example-row' }, [
          el('span', { class: 'prop-key' }, [name + ': ']),
          exampleChip(media.examples[name]),
        ]);
      }),
    );
  }

  /** One entry of a `multipart/form-data` body — structurally just a field
   *  (name, type, required), so it's rendered with the same `renderFieldNode`
   *  every other field uses (chip, hover tooltip, nested properties...),
   *  with two extra badges appended for what a plain field doesn't have:
   *  whether this part is a `field` or an uploaded `file`, and its own
   *  `contentType` when set (e.g. `image/*` on a file part). A part with
   *  no declared `type` at all (common for a raw file upload) falls back
   *  to the generic `any` type rather than showing nothing. */
  function renderMultipartFieldRow(doc, f) {
    var nameLabel = typeof f.fieldName === 'string' ? f.fieldName : '/' + f.fieldName + '/';
    var row = renderFieldNode(doc, nameLabel, f.type || 'any', {
      required: f.required,
      description: f.description,
    });
    var head = row.firstChild;
    head.appendChild(el('span', { class: 'badge' }, [f.fieldType]));
    if (f.contentType) {
      head.appendChild(
        el('span', { class: 'flag' }, [Array.isArray(f.contentType) ? f.contentType.join(', ') : f.contentType]),
      );
    }
    // Size limits declared on *this specific part* (as opposed to the
    // container-level ones already shown at the top of the panel) —
    // e.g. a per-file `maxPartSize` distinct from the whole body's
    // `maxTotalSize`.
    var limitRows = [];
    if (f.maxPartSize != null) limitRows.push([t('media.maxSize'), text(formatBytes(f.maxPartSize))]);
    if (f.maxFieldSize != null) limitRows.push([t('media.maxSize'), text(formatBytes(f.maxFieldSize))]);
    if (limitRows.length) {
      row.appendChild(
        el(
          'div',
          { class: 'field-properties' },
          limitRows.map(function (r) {
            return el('div', { class: 'prop-row' }, [el('span', { class: 'prop-key' }, [r[0] + ': ']), r[1]]);
          }),
        ),
      );
    }
    var exNode = renderMediaTypeExamples(f);
    if (exNode) row.appendChild(exNode);
    return row;
  }

  /** "5242880" -> "5 MB" — the size-limit properties (`maxPartSize`,
   *  `maxTotalSize`, ...) are declared in bytes; shown in whichever unit
   *  reads as a single reasonable number instead of a long digit string. */
  function formatBytes(n) {
    if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(n % (1024 * 1024) ? 1 : 0) + ' MB';
    if (n >= 1024) return (n / 1024).toFixed(n % 1024 ? 1 : 0) + ' KB';
    return n + ' B';
  }

  /** A `HttpMediaType`'s own properties (content type, encoding, multipart
   *  size limits) as a plain labeled list — same `.field-properties`/
   *  `.prop-row` look used for a SimpleType's own constraints elsewhere,
   *  rather than a row of inline badges competing for attention with the
   *  content-type itself. Only present properties get a row. */
  function renderMediaTypeProps(media) {
    var rows = [];
    var contentTypeLabel = Array.isArray(media.contentType)
      ? media.contentType.join(', ')
      : media.contentType || 'application/json';
    rows.push(['Content-Type', el('code', {}, [contentTypeLabel])]);
    if (media.contentEncoding) rows.push([t('media.encoding'), text(media.contentEncoding)]);
    if (media.maxParts != null) rows.push([t('media.maxParts'), text(String(media.maxParts))]);
    if (media.maxPartSize != null) rows.push([t('media.maxPartSize'), text(formatBytes(media.maxPartSize))]);
    if (media.maxFieldSize != null) rows.push([t('media.maxFieldSize'), text(formatBytes(media.maxFieldSize))]);
    if (media.maxTotalSize != null) rows.push([t('media.maxTotalSize'), text(formatBytes(media.maxTotalSize))]);
    return el(
      'div',
      { class: 'field-properties' },
      rows.map(function (r) {
        return el('div', { class: 'prop-row' }, [el('span', { class: 'prop-key' }, [r[0] + ': ']), r[1]]);
      }),
    );
  }

  /** How many top-level fields the request body panel shows before
   *  collapsing the rest behind a "Show N more fields" button — see
   *  `renderTypeTree`'s `collapseAfter` param. Arbitrary but generous
   *  enough that most request bodies never hit it at all. */
  var REQUEST_BODY_FIELD_COLLAPSE_AFTER = 8;

  /** One alternative representation of a request body — a single
   *  `HttpMediaType` entry. Its own properties (content type, encoding,
   *  size limits) come first as a labeled list, then its description,
   *  then whichever of a typed schema (`type`), example value(s), or
   *  multipart fields it actually declares — falling back to a plain "no
   *  schema" note when it's a bare `contentType` with none of those (e.g.
   *  a raw upload with no further structure). */
  function renderMediaTypePanel(doc, media) {
    var panel = el('div', { class: 'media-type-panel' });
    panel.appendChild(renderMediaTypeProps(media));

    var descBlock = mdBlock(doc, media.description);
    if (descBlock) panel.appendChild(descBlock);

    var hasContent = false;
    if (media.type) {
      panel.appendChild(renderTypeTreeWithInherits(doc, media.type, REQUEST_BODY_FIELD_COLLAPSE_AFTER));
      hasContent = true;
    }
    var exNode = renderMediaTypeExamples(media);
    if (exNode) {
      panel.appendChild(exNode);
      hasContent = true;
    }
    if (media.multipartFields && media.multipartFields.length) {
      var mpList = el('div', { class: 'field-list' });
      media.multipartFields.forEach(function (f) {
        mpList.appendChild(renderMultipartFieldRow(doc, f));
      });
      panel.appendChild(mpList);
      hasContent = true;
    }

    if (!hasContent) {
      panel.appendChild(el('div', { class: 'empty-note' }, [t('operation.rawBody')]));
    }
    return panel;
  }

  /** An alternative's `contentType` isn't always one MIME type — it can
   *  list several serializations of the *same* schema (e.g. `application/
   *  json, text/yaml, application/yaml, text/toml, application/toml`, all
   *  describing one JSON-shaped body), arriving here as an array or a
   *  single comma-joined string (see the PHP/Node snippet formatters for
   *  the same parsing). This reduces that list down to the distinct
   *  *formats* the "Body" view actually knows how to render — `yaml`/
   *  `toml` collapse their two MIME spellings (`text/x` and
   *  `application/x`) into one entry apiece — in the order they were
   *  declared, so the dropdown's default matches whichever the operation
   *  listed first. A media with no `type` at all (multipart, raw upload)
   *  has no body value to serialize in any format, so it reports none. */
  function mediaBodyFormats(media) {
    if (!media || !media.type) return [];
    var raw = media.contentType;
    var list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : ['application/json'];
    var formats = [];
    list.forEach(function (entry) {
      entry = String(entry).trim().toLowerCase();
      var fmt = /json/.test(entry) ? 'json' : /yaml/.test(entry) ? 'yaml' : /toml/.test(entry) ? 'toml' : null;
      if (fmt && formats.indexOf(fmt) === -1) formats.push(fmt);
    });
    if (!formats.length) formats.push('json');
    return formats;
  }

  var BODY_FORMAT_LABELS = { json: 'JSON', yaml: 'YAML', toml: 'TOML' };

  /** The request rail's "Body" dropdown entry for the given (possibly
   *  `null`) currently-selected alternative — a flat `{key:'body', ...}`
   *  item, matching every other single-choice entry in
   *  `REQUEST_SNIPPET_KINDS`, when there's only one format to show (the
   *  common case: a plain `application/json` body, or no schema at all),
   *  or a `{group:'Body', items:[...]}` of `body-json`/`body-yaml`/
   *  `body-toml` when the alternative itself offers more than one
   *  serialization — see `mediaBodyFormats`. Recomputed on every call
   *  rather than cached, since which case applies can change from one
   *  content-type tab to the next (see `renderRequestSection`'s
   *  `refreshSelect`). */
  function bodyKindEntry(media) {
    var formats = mediaBodyFormats(media);
    if (formats.length <= 1) return { key: 'body', label: t('operation.body') };
    return {
      group: t('operation.body'),
      items: formats.map(function (f) {
        return { key: 'body-' + f, label: BODY_FORMAT_LABELS[f] };
      }),
    };
  }

  /** Maps every `<select>` value the "Body" entry can ever produce (the
   *  flat `body` from the single-format case, or `body-json`/`body-yaml`/
   *  `body-toml` from the grouped one) to which serialization to render —
   *  the one place `renderRequestSection` needs to know that `body` itself
   *  just means "json". */
  var BODY_KIND_FORMAT = { body: 'json', 'body-json': 'json', 'body-yaml': 'yaml', 'body-toml': 'toml' };

  /** A fixed, made-up boundary token — real `multipart/form-data` requests
   *  each pick a fresh random one so it can't collide with the body's own
   *  content, but for a documentation example a stable value is actually
   *  better: the snippet reads the same on every visit instead of churning
   *  on every render for no reason. */
  var MULTIPART_EXAMPLE_BOUNDARY = 'OpraFormBoundary7MA4YWxkTrZu0gW';

  /** The literal `multipart/form-data` body as it goes over the wire —
   *  boundary-delimited parts, each with its own `Content-Disposition`
   *  (and, for a `file` field, `Content-Type`) header, a blank line, then
   *  the part's own content — closed by a final `--boundary--` delimiter.
   *  Deliberately NOT rendered as a JSON/YAML/TOML object the way a typed
   *  body is (see `requestBodyExample`): that would claim a shape this
   *  request never actually has on the wire. A file part's own bytes obviously
   *  can't be synthesized, so it gets a bracketed placeholder describing
   *  what would be there instead of pretending to have real file content. */
  function multipartBodyPreview(doc, media) {
    var boundary = MULTIPART_EXAMPLE_BOUNDARY;
    var parts = media.multipartFields.map(function (f) {
      var name = typeof f.fieldName === 'string' ? f.fieldName : String(f.fieldName);
      var value = multipartFieldExampleValue(doc, f);
      var lines = ['--' + boundary];
      if (f.fieldType === 'file') {
        var contentType = (Array.isArray(f.contentType) ? f.contentType.join(',') : f.contentType || 'application/octet-stream')
          .split(',')[0]
          .trim();
        lines.push('Content-Disposition: form-data; name="' + name + '"; filename="' + value + '"');
        lines.push('Content-Type: ' + contentType);
        lines.push('');
        lines.push('(binary contents of ' + value + ')');
      } else {
        lines.push('Content-Disposition: form-data; name="' + name + '"');
        lines.push('');
        lines.push(String(value));
      }
      return lines.join('\n');
    });
    parts.push('--' + boundary + '--');
    return parts.join('\n');
  }

  /** `Content-Disposition`/`Content-Type` header names, the boundary
   *  delimiter lines, and the bracketed binary-content placeholder — the
   *  only tokens `multipartBodyPreview` itself ever emits, reusing
   *  `.json-key`/`.code-comment`, same "hand-rolled, scoped to what we
   *  generate" spirit as `highlightJson` and the format*Snippet
   *  highlighters. */
  function highlightMultipartBodyPreview(code) {
    var escaped = escapeHtml(code);
    return escaped.replace(
      /^(--[^\n]+)$|^(Content-Disposition|Content-Type)(:)|(\(binary contents of [^)\n]*\))/gm,
      function (match, delim, header, colon, placeholder) {
        if (delim !== undefined) return '<span class="code-comment">' + delim + '</span>';
        if (header !== undefined) return '<span class="json-key">' + header + '</span>' + colon;
        if (placeholder !== undefined) return '<span class="code-comment">' + placeholder + '</span>';
        return match;
      },
    );
  }

  /** A typed alternative's synthesized whole-object example, serialized as
   *  JSON, YAML, or TOML (`format`, one of `BODY_KIND_FORMAT`'s values) —
   *  same idea as a model's own "Example" section, just rendered into the
   *  page's side rail — see `render()` — instead of the reading column, so
   *  it's the thing that stays in view while the field descriptions scroll
   *  underneath it. A `multipartFields` alternative (no `type` of its own)
   *  gets `multipartBodyPreview` instead — `format` doesn't apply to it,
   *  there being exactly one honest way to show it. `null` only for a bare
   *  `contentType` with neither a `type` nor multipart fields declared — a
   *  raw upload with no schema at all, where there truly is nothing to
   *  show. */
  function requestBodyExample(doc, media, format) {
    var text, highlighted;
    if (media.multipartFields && media.multipartFields.length) {
      text = multipartBodyPreview(doc, media);
      highlighted = highlightMultipartBodyPreview(text);
    } else if (media.type) {
      var value = buildExampleValue(doc, media.type);
      if (format === 'yaml') {
        text = toYaml(value, 0);
        highlighted = highlightYaml(text);
      } else if (format === 'toml') {
        text = toToml(value);
        highlighted = highlightToml(text);
      } else {
        text = JSON.stringify(value, null, 2);
        highlighted = highlightJson(text);
      }
    } else {
      return null;
    }
    var copyBtn = copyButton(text, 15);
    copyBtn.classList.add('copy-btn-lg');
    return {
      content: el('pre', { class: 'example-json' }, [el('code', { html: highlighted })]),
      copyBtn: copyBtn,
    };
  }

  /** A YAML scalar is always single-quoted here rather than left bare —
   *  simpler and safe than deciding case-by-case whether a given string
   *  (a date-time with colons, an empty string, one that looks like a
   *  number or `null`/`true`) would need it; a quoted plain string is
   *  always valid YAML even when it wouldn't have strictly needed
   *  quoting. */
  function yamlScalar(v) {
    if (v === null || v === undefined) return 'null';
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    return "'" + String(v).replace(/'/g, "''") + "'";
  }

  /** Renders `value` as a YAML block at `indent` levels deep (2 spaces
   *  each) — recursing into nested objects/arrays as further-indented
   *  mappings/sequences, exactly the shape `buildExampleValue` produces
   *  for a record/array-typed field. A sequence item that's itself an
   *  object gets its first key folded onto the same line as the `- `
   *  marker (`- id: 1`), matching how YAML is conventionally written by
   *  hand, rather than a `- ` line followed by an indented mapping. */
  function toYaml(value, indent) {
    indent = indent || 0;
    var pad = '  '.repeat(indent);
    if (Array.isArray(value)) {
      if (!value.length) return pad + '[]';
      return value
        .map(function (v) {
          if (v !== null && typeof v === 'object') {
            var nested = toYaml(v, indent + 1).split('\n');
            var first = nested[0].replace(/^\s+/, '');
            return pad + '- ' + first + (nested.length > 1 ? '\n' + nested.slice(1).join('\n') : '');
          }
          return pad + '- ' + yamlScalar(v);
        })
        .join('\n');
    }
    if (value !== null && typeof value === 'object') {
      var keys = Object.keys(value);
      if (!keys.length) return pad + '{}';
      return keys
        .map(function (k) {
          var v = value[k];
          if ((Array.isArray(v) && v.length) || (v !== null && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length)) {
            return pad + k + ':\n' + toYaml(v, indent + 1);
          }
          if (Array.isArray(v)) return pad + k + ': []';
          if (v !== null && typeof v === 'object') return pad + k + ': {}';
          return pad + k + ': ' + yamlScalar(v);
        })
        .join('\n');
    }
    return pad + yamlScalar(value);
  }

  /** TOML has no native `null`, so a null-valued key is simply omitted
   *  rather than emitted as something that would parse back as a string
   *  or crash a strict reader. Nested objects/arrays use TOML's *inline*
   *  table/array syntax (`{ k = v }` / `[ v, v ]`) instead of `[section]`
   *  headers — valid TOML, and far simpler to generate correctly for an
   *  arbitrarily-nested example than tracking table paths would be. */
  function tomlKey(k) {
    return /^[A-Za-z0-9_-]+$/.test(k) ? k : '"' + k.replace(/"/g, '\\"') + '"';
  }
  function tomlValue(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === 'boolean' || typeof v === 'number') return String(v);
    if (typeof v === 'string') return '"' + v.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    if (Array.isArray(v)) {
      var items = v.map(tomlValue).filter(function (x) {
        return x !== null;
      });
      return '[' + items.join(', ') + ']';
    }
    var parts = Object.keys(v)
      .map(function (k) {
        var val = tomlValue(v[k]);
        return val === null ? null : tomlKey(k) + ' = ' + val;
      })
      .filter(function (x) {
        return x !== null;
      });
    return '{ ' + parts.join(', ') + ' }';
  }
  function toToml(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return tomlKey('value') + ' = ' + tomlValue(value);
    }
    return Object.keys(value)
      .map(function (k) {
        var val = tomlValue(value[k]);
        return val === null ? null : tomlKey(k) + ' = ' + val;
      })
      .filter(function (x) {
        return x !== null;
      })
      .join('\n');
  }

  /** `key:`/`key =` before a value, quoted strings, and comments — the
   *  only tokens `toYaml`/`toToml` themselves ever emit, same "hand-rolled,
   *  scoped to what we generate" spirit as `highlightJson` and the
   *  `format*Snippet` highlighters. Reuses `highlightJson`'s color classes
   *  (`.json-key`/`.json-string`/`.json-number`/`.json-boolean`) so a
   *  YAML/TOML body reads consistently with the JSON one instead of
   *  introducing a third palette. */
  function highlightYaml(code) {
    var escaped = escapeHtml(code);
    return escaped.replace(
      /^(\s*(?:-\s+)?[\w"'.-]+)(:)|('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")|\b(true|false)\b|\bnull\b|(-?\d+(?:\.\d+)?)/gm,
      function (match, key, colon, str, bool, num) {
        if (key !== undefined) return '<span class="json-key">' + key + '</span>' + colon;
        if (str !== undefined) return '<span class="json-string">' + str + '</span>';
        if (bool !== undefined) return '<span class="json-boolean">' + match + '</span>';
        if (match === 'null') return '<span class="json-null">null</span>';
        if (num !== undefined) return '<span class="json-number">' + num + '</span>';
        return match;
      },
    );
  }
  function highlightToml(code) {
    var escaped = escapeHtml(code);
    return escaped.replace(
      /^([\w".-]+)(\s*=)|("(?:[^"\\]|\\.)*")|\b(true|false)\b|(-?\d+(?:\.\d+)?)/gm,
      function (match, key, eq, str, bool, num) {
        if (key !== undefined) return '<span class="json-key">' + key + '</span>' + eq;
        if (str !== undefined) return '<span class="json-string">' + str + '</span>';
        if (bool !== undefined) return '<span class="json-boolean">' + match + '</span>';
        if (num !== undefined) return '<span class="json-number">' + num + '</span>';
        return match;
      },
    );
  }

  /** Base URL for generated request snippets (cURL/Fetch/Axios/Python) — the
   *  document's own first declared server (`OpraSchema.HttpServer`, exposed
   *  client-side as `doc.api.servers`), falling back to this page's own
   *  origin when no server is declared at all, since this reference UI is
   *  typically served from the same host as the API it documents. A
   *  declared `url` that's relative (`"/api"`, say — no scheme/host of its
   *  own) is resolved against that same origin rather than used as-is:
   *  every snippet here needs a *complete* URL up front (unlike a real
   *  in-browser fetch, a pasted `curl` command has no "current page" to
   *  resolve a bare path against). `new URL(url, origin)` handles both
   *  cases in one call — it passes an already-absolute `url` through
   *  unchanged, and joins a relative one onto `origin` — and stripping any
   *  trailing slash keeps `baseUrl + fullPath` (see `buildRequestModel`)
   *  from ever doubling up into `//`. */
  function apiBaseUrl(doc) {
    var servers = doc.api && doc.api.servers;
    var url = servers && servers.length && servers[0].url;
    if (!url) return window.location.origin;
    return new URL(url, window.location.origin).href.replace(/\/+$/, '');
  }

  /** Substitutes every `:paramName` token in `path` with that path
   *  parameter's own example value — path parameter tokens are
   *  colon-prefixed (e.g. `Customers@:customerId`, from `.KeyParam()`) and
   *  survive verbatim into the real registered Express route
   *  (`currentPath + operation.path`, registered as-is), so a real request
   *  must send the substituted value in exactly that position, `@`
   *  included — nothing about `@` needs special handling here. */
  function interpolatePath(doc, path, params) {
    var pathParams = (params || []).filter(function (p) {
      return p.location === 'path';
    });
    return path.replace(/:([A-Za-z_$][A-Za-z0-9_$]*)/g, function (m, name) {
      var p = null;
      for (var i = 0; i < pathParams.length; i++) {
        if (pathParams[i].name === name) {
          p = pathParams[i];
          break;
        }
      }
      if (!p) return m;
      var val = p.default !== undefined ? p.default : buildExampleValue(doc, p.type);
      return encodeURIComponent(String(val));
    });
  }

  /** A representative value for one multipart field — a plain 'field's own
   *  example, or a plausible placeholder filename for a 'file' field (there
   *  is no real file to point at in a synthesized example). */
  function multipartFieldExampleValue(doc, f) {
    if (f.fieldType === 'file') return firstFieldExampleValue(f.examples) || 'example.png';
    return buildExampleValue(doc, f.type);
  }

  /** A plain, transport-agnostic description of one request — method, full
   *  URL, query/header entries, and body — that every `format*Snippet`
   *  function below renders into its own language. Kept separate from the
   *  formatters so adding a new client only ever means adding one new
   *  `format*Snippet(model)` over this exact same shape. */
  function buildRequestModel(doc, ctrlPath, op, media) {
    var fullPath = interpolatePath(doc, operationPath(ctrlPath, op), op.parameters);
    var query = (op.parameters || [])
      .filter(function (p) {
        return p.location === 'query' && p.required;
      })
      .map(function (p) {
        return { name: p.name, value: p.default !== undefined ? p.default : buildExampleValue(doc, p.type) };
      });
    var headers = (op.parameters || [])
      .filter(function (p) {
        return p.location === 'header';
      })
      .map(function (p) {
        return { name: p.name, value: p.default !== undefined ? p.default : buildExampleValue(doc, p.type) };
      });
    var body = null;
    if (media) {
      if (media.multipartFields && media.multipartFields.length) {
        body = {
          kind: 'multipart',
          fields: media.multipartFields.map(function (f) {
            return { name: f.fieldName, type: f.fieldType, value: multipartFieldExampleValue(doc, f) };
          }),
        };
      } else if (media.type) {
        // `media.contentType` is already a single comma-joined string by the
        // time it reaches the client (see `mapHttpMediaType` in
        // schema-builder.ts) even when the alternative accepts several
        // content types — fine as a multi-value *label* elsewhere on this
        // page, but a real request only ever sends one, so a generated
        // snippet picks just the first.
        var contentTypeList = (Array.isArray(media.contentType) ? media.contentType.join(',') : media.contentType || 'application/json').split(',');
        headers.push({ name: 'Content-Type', value: contentTypeList[0].trim() });
        body = { kind: 'json', value: buildExampleValue(doc, media.type) };
      }
    }
    var baseUrl = apiBaseUrl(doc);
    return {
      method: op.method,
      baseUrl: baseUrl,
      // Relative path without the host — what OPRA's own client (an
      // `OpraHttpClient` constructed once against `baseUrl`) actually
      // takes per call, unlike every other snippet here which needs the
      // full URL up front (see `formatOpraClientSnippet`).
      path: fullPath.charAt(0) === '/' ? fullPath.slice(1) : fullPath,
      url: baseUrl + fullPath,
      query: query,
      headers: headers,
      body: body,
    };
  }

  function urlWithQuery(url, query) {
    if (!query || !query.length) return url;
    var qs = query
      .map(function (q) {
        return encodeURIComponent(q.name) + '=' + encodeURIComponent(String(q.value));
      })
      .join('&');
    return url + (url.indexOf('?') === -1 ? '?' : '&') + qs;
  }

  /** OPRA's own client (`@opra/client`'s `OpraHttpClient`) — shown first
   *  since it's the one library that actually understands this exact
   *  document, not a generic HTTP call. Verified against
   *  `packages/client/src/http-client-base.ts`'s real verb-shortcut API
   *  (`.get`/`.post`/`.put`/`.patch`/`.delete`, falling back to the
   *  low-level `.request(path, {method, body})` for anything else) and
   *  `packages/client/test/client.spec.ts`'s real usage: a body object is
   *  auto-JSON-encoded (own `Content-Type`, no manual `JSON.stringify`)
   *  and a `FormData` body is sent as-is (the runtime sets its own
   *  multipart boundary) — see `fetch-backend.ts:216-227` — so unlike
   *  every other snippet here, this one never sets `Content-Type` itself.
   *  Query/header parameters are the client's own `.param()`/`.header()`
   *  fluent modifiers, chained onto the call before resolving with
   *  `.getBody()`. */
  function formatOpraClientSnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    var methodLower = model.method.toLowerCase();
    var hasShortcut = ['get', 'delete', 'post', 'put', 'patch'].indexOf(methodLower) !== -1;
    var takesBodyArg = ['post', 'put', 'patch'].indexOf(methodLower) !== -1;

    var pre = ["import { OpraHttpClient } from '@opra/client';", '', "const client = new OpraHttpClient('" + model.baseUrl + "');", ''];
    var bodyExpr = null;
    if (isMultipart) {
      pre.push('const form = new FormData();');
      model.body.fields.forEach(function (f) {
        if (f.type === 'file') pre.push("form.append('" + f.name + "', fileInput.files[0]); // " + f.value);
        else pre.push("form.append('" + f.name + "', '" + f.value + "');");
      });
      pre.push('');
      bodyExpr = 'form';
    } else if (model.body && model.body.kind === 'json') {
      bodyExpr = JSON.stringify(model.body.value, null, 2);
    }

    var otherHeaders = model.headers.filter(function (h) {
      return h.name !== 'Content-Type';
    });

    var callArgs = ["'" + model.path + "'"];
    var callMethodName = hasShortcut ? methodLower : 'request';
    if (hasShortcut) {
      if (takesBodyArg) callArgs.push(bodyExpr !== null ? bodyExpr : '{}');
    } else {
      var optLines = ["  method: '" + model.method + "'"];
      if (bodyExpr !== null) optLines.push('  body: ' + bodyExpr);
      callArgs.push('{\n' + optLines.join(',\n') + '\n}');
    }

    var chain = 'client.' + callMethodName + '(' + callArgs.join(', ') + ')';
    if (model.query.length) {
      var queryObj = {};
      model.query.forEach(function (q) {
        queryObj[q.name] = q.value;
      });
      chain += '\n  .param(' + JSON.stringify(queryObj, null, 2) + ')';
    }
    if (otherHeaders.length) {
      var headerObj = {};
      otherHeaders.forEach(function (h) {
        headerObj[h.name] = h.value;
      });
      chain += '\n  .header(' + JSON.stringify(headerObj, null, 2) + ')';
    }
    chain += '\n  .getBody();';

    return pre.concat(['const result = await ' + chain]).join('\n');
  }

  function formatCurlSnippet(model) {
    var lines = ['curl -X ' + model.method + " '" + urlWithQuery(model.url, model.query) + "'"];
    model.headers.forEach(function (h) {
      lines.push("  -H '" + h.name + ': ' + h.value + "'");
    });
    if (model.body) {
      if (model.body.kind === 'json') {
        lines.push("  -d '" + JSON.stringify(model.body.value, null, 2) + "'");
      } else if (model.body.kind === 'multipart') {
        model.body.fields.forEach(function (f) {
          var val = f.type === 'file' ? '@' + f.value : f.value;
          lines.push("  -F '" + f.name + '=' + val + "'");
        });
      }
    }
    return lines.join(' \\\n');
  }

  function formatFetchSnippet(model) {
    var url = urlWithQuery(model.url, model.query);
    var isMultipart = model.body && model.body.kind === 'multipart';
    var headers = model.headers.filter(function (h) {
      return !(isMultipart && h.name === 'Content-Type');
    });
    var pre = [];
    var opts = ["  method: '" + model.method + "',"];
    if (headers.length) {
      opts.push('  headers: {');
      headers.forEach(function (h, i) {
        opts.push("    '" + h.name + "': '" + h.value + "'" + (i < headers.length - 1 ? ',' : ''));
      });
      opts.push('  },');
    }
    if (model.body) {
      if (model.body.kind === 'json') {
        opts.push('  body: JSON.stringify(' + JSON.stringify(model.body.value, null, 2) + '),');
      } else if (isMultipart) {
        pre.push('const formData = new FormData();');
        model.body.fields.forEach(function (f) {
          if (f.type === 'file') pre.push("formData.append('" + f.name + "', fileInput.files[0]); // " + f.value);
          else pre.push("formData.append('" + f.name + "', '" + f.value + "');");
        });
        pre.push('');
        opts.push('  body: formData,');
      }
    }
    return pre.concat(["fetch('" + url + "', {"], opts, ['})']).join('\n');
  }

  function formatAxiosSnippet(model) {
    var url = urlWithQuery(model.url, model.query);
    var method = model.method.toLowerCase();
    var isMultipart = model.body && model.body.kind === 'multipart';
    var headers = model.headers.filter(function (h) {
      return !(isMultipart && h.name === 'Content-Type');
    });
    var config = null;
    if (headers.length) {
      var configLines = ['  headers: {'];
      headers.forEach(function (h, i) {
        configLines.push("    '" + h.name + "': '" + h.value + "'" + (i < headers.length - 1 ? ',' : ''));
      });
      configLines.push('  }');
      config = configLines.join('\n');
    }
    var pre = [];
    var dataArg;
    if (isMultipart) {
      pre.push('const formData = new FormData();');
      model.body.fields.forEach(function (f) {
        if (f.type === 'file') pre.push("formData.append('" + f.name + "', fileInput.files[0]); // " + f.value);
        else pre.push("formData.append('" + f.name + "', '" + f.value + "');");
      });
      pre.push('');
      dataArg = 'formData';
    } else if (model.body && model.body.kind === 'json') {
      dataArg = JSON.stringify(model.body.value, null, 2);
    }
    var args = ["'" + url + "'"];
    if (dataArg !== undefined) args.push(dataArg);
    if (config) args.push('{\n' + config + '\n}');
    return pre.concat(['axios.' + method + '(' + args.join(', ') + ')']).join('\n');
  }

  function pyLiteral(value) {
    return JSON.stringify(value, null, 4)
      .replace(/\btrue\b/g, 'True')
      .replace(/\bfalse\b/g, 'False')
      .replace(/\bnull\b/g, 'None');
  }

  function formatPythonSnippet(model) {
    var url = urlWithQuery(model.url, model.query);
    var method = model.method.toLowerCase();
    var isMultipart = model.body && model.body.kind === 'multipart';
    var headers = model.headers.filter(function (h) {
      return !(isMultipart && h.name === 'Content-Type');
    });
    var args = ["    '" + url + "'"];
    if (headers.length) {
      var headerDict = {};
      headers.forEach(function (h) {
        headerDict[h.name] = h.value;
      });
      args.push('    headers=' + pyLiteral(headerDict));
    }
    if (model.body) {
      if (model.body.kind === 'json') {
        args.push('    json=' + pyLiteral(model.body.value));
      } else if (isMultipart) {
        var files = {};
        var data = {};
        model.body.fields.forEach(function (f) {
          if (f.type === 'file') files[f.name] = "open('" + f.value + "', 'rb')";
          else data[f.name] = f.value;
        });
        var fileKeys = Object.keys(files);
        if (fileKeys.length) {
          var filesLines = fileKeys.map(function (k) {
            return "        '" + k + "': " + files[k];
          });
          args.push('    files={\n' + filesLines.join(',\n') + '\n    }');
        }
        if (Object.keys(data).length) args.push('    data=' + pyLiteral(data));
      }
    }
    return ['import requests', '', 'response = requests.' + method + '(', args.join(',\n'), ')'].join('\n');
  }

  function formatHttpieSnippet(model) {
    var url = urlWithQuery(model.url, model.query);
    var isMultipart = model.body && model.body.kind === 'multipart';
    var lines = ['http' + (isMultipart ? ' --form' : '') + ' ' + model.method + " '" + url + "'"];
    model.headers.forEach(function (h) {
      if (isMultipart && h.name === 'Content-Type') return;
      lines.push("  '" + h.name + ':' + h.value + "'");
    });
    if (model.body) {
      if (model.body.kind === 'json') {
        lines.push("  --raw='" + JSON.stringify(model.body.value, null, 2) + "'");
      } else if (isMultipart) {
        model.body.fields.forEach(function (f) {
          lines.push("  '" + f.name + (f.type === 'file' ? '@' : '=') + f.value + "'");
        });
      }
    }
    return lines.join(' \\\n');
  }

  function formatJQuerySnippet(model) {
    var url = urlWithQuery(model.url, model.query);
    var isMultipart = model.body && model.body.kind === 'multipart';
    var pre = [];
    var opts = ["  url: '" + url + "',", "  method: '" + model.method + "',"];
    var otherHeaders = model.headers.filter(function (h) {
      return h.name !== 'Content-Type';
    });
    if (otherHeaders.length) {
      opts.push('  headers: {');
      otherHeaders.forEach(function (h, i) {
        opts.push("    '" + h.name + "': '" + h.value + "'" + (i < otherHeaders.length - 1 ? ',' : ''));
      });
      opts.push('  },');
    }
    if (isMultipart) {
      pre.push('var formData = new FormData();');
      model.body.fields.forEach(function (f) {
        if (f.type === 'file') pre.push("formData.append('" + f.name + "', fileInput.files[0]); // " + f.value);
        else pre.push("formData.append('" + f.name + "', '" + f.value + "');");
      });
      pre.push('');
      opts.push('  data: formData,', '  processData: false,', '  contentType: false,');
    } else if (model.body && model.body.kind === 'json') {
      opts.push("  contentType: 'application/json',");
      opts.push('  data: JSON.stringify(' + JSON.stringify(model.body.value, null, 2) + '),');
    }
    return pre.concat(['$.ajax({'], opts, ['})']).join('\n');
  }

  function formatXhrSnippet(model) {
    var url = urlWithQuery(model.url, model.query);
    var isMultipart = model.body && model.body.kind === 'multipart';
    var lines = [];
    if (isMultipart) {
      lines.push('var formData = new FormData();');
      model.body.fields.forEach(function (f) {
        if (f.type === 'file') lines.push("formData.append('" + f.name + "', fileInput.files[0]); // " + f.value);
        else lines.push("formData.append('" + f.name + "', '" + f.value + "');");
      });
      lines.push('');
    }
    lines.push('var xhr = new XMLHttpRequest();');
    lines.push("xhr.open('" + model.method + "', '" + url + "');");
    model.headers.forEach(function (h) {
      if (isMultipart && h.name === 'Content-Type') return;
      lines.push("xhr.setRequestHeader('" + h.name + "', '" + h.value + "');");
    });
    if (model.body && model.body.kind === 'json') {
      lines.push('xhr.send(JSON.stringify(' + JSON.stringify(model.body.value, null, 2) + '));');
    } else if (isMultipart) {
      lines.push('xhr.send(formData);');
    } else {
      lines.push('xhr.send();');
    }
    return lines.join('\n');
  }

  /** Raw sockets, not a library — Node's own `http`/`https` module has no
   *  built-in multipart encoder, so that case gets an honest one-line note
   *  pointing at `fetch`/`FormData` (available in Node 18+) or a
   *  multipart-encoding package, rather than hand-rolling a boundary
   *  encoder here. */
  function formatNodeSnippet(model) {
    var parts = parseUrlParts(model.url);
    var mod = parts.protocol === 'https' ? 'https' : 'http';
    var isMultipart = model.body && model.body.kind === 'multipart';
    if (isMultipart) {
      return [
        "const " + mod + " = require('" + mod + "');",
        '',
        "// Node's http/https module has no built-in multipart encoder —",
        "// use fetch() with FormData (Node 18+), or a package like 'form-data'.",
      ].join('\n');
    }
    var bodyJson = model.body && model.body.kind === 'json' ? JSON.stringify(model.body.value, null, 2) : null;
    var headers = model.headers.slice();
    var lines = ["const " + mod + " = require('" + mod + "');", ''];
    if (bodyJson) lines.push('const data = JSON.stringify(' + bodyJson + ');', '');
    lines.push('const options = {');
    lines.push("  hostname: '" + parts.hostname + "',");
    if (parts.port) lines.push('  port: ' + parts.port + ',');
    lines.push("  path: '" + urlWithQuery(parts.path, model.query) + "',");
    lines.push("  method: '" + model.method + "',");
    if (headers.length) {
      lines.push('  headers: {');
      headers.forEach(function (h, i) {
        lines.push("    '" + h.name + "': '" + h.value + "'" + (i < headers.length - 1 ? ',' : ''));
      });
      lines.push('  },');
    }
    lines.push('};', '');
    lines.push('const req = ' + mod + '.request(options, (res) => {');
    lines.push("  let body = '';");
    lines.push("  res.on('data', (chunk) => { body += chunk; });");
    lines.push("  res.on('end', () => { console.log(body); });");
    lines.push('});');
    if (bodyJson) lines.push('req.write(data);');
    lines.push('req.end();');
    return lines.join('\n');
  }

  /** `http.client` (stdlib) has no built-in multipart encoder either — same
   *  honest-note approach as the Node snippet above, pointing at `requests`
   *  (see `formatPythonSnippet`) instead of hand-rolling one. */
  function formatPythonHttpClientSnippet(model) {
    var parts = parseUrlParts(model.url);
    var isMultipart = model.body && model.body.kind === 'multipart';
    if (isMultipart) {
      return [
        'import http.client',
        '',
        '# http.client has no built-in multipart encoder — see the "Python (Requests)"',
        '# example instead, or build the multipart body by hand.',
      ].join('\n');
    }
    var conn = parts.protocol === 'https' ? 'HTTPSConnection' : 'HTTPConnection';
    var lines = ['import http.client'];
    var bodyJson = model.body && model.body.kind === 'json' ? JSON.stringify(model.body.value, null, 2) : null;
    if (bodyJson) lines.push('import json');
    lines.push('', 'conn = http.client.' + conn + "('" + parts.hostname + (parts.port ? "', " + parts.port : "'") + ')');
    if (bodyJson) lines.push('payload = json.dumps(' + pyLiteral(model.body.value) + ')');
    if (model.headers.length) {
      lines.push('headers = ' + pyLiteral(model.headers.reduce(function (acc, h) {
        acc[h.name] = h.value;
        return acc;
      }, {})));
    }
    var reqArgs = ["'" + model.method + "'", "'" + urlWithQuery(parts.path, model.query) + "'"];
    if (bodyJson) reqArgs.push('payload');
    if (model.headers.length) reqArgs.push('headers');
    lines.push('conn.request(' + reqArgs.join(', ') + ')');
    lines.push('res = conn.getresponse()');
    lines.push('print(res.read().decode())');
    return lines.join('\n');
  }

  function formatPhpCurlSnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    var lines = ['<?php', '$curl = curl_init();', 'curl_setopt_array($curl, [', "  CURLOPT_URL => '" + urlWithQuery(model.url, model.query) + "',", '  CURLOPT_RETURNTRANSFER => true,', "  CURLOPT_CUSTOMREQUEST => '" + model.method + "',"];
    var headers = model.headers.filter(function (h) {
      return !(isMultipart && h.name === 'Content-Type');
    });
    if (headers.length) {
      lines.push('  CURLOPT_HTTPHEADER => [');
      headers.forEach(function (h, i) {
        lines.push("    '" + h.name + ': ' + h.value + "'" + (i < headers.length - 1 ? ',' : ''));
      });
      lines.push('  ],');
    }
    if (model.body) {
      if (model.body.kind === 'json') {
        lines.push('  CURLOPT_POSTFIELDS => json_encode(' + phpLiteral(model.body.value, '  ') + '),');
      } else if (isMultipart) {
        lines.push('  CURLOPT_POSTFIELDS => [');
        model.body.fields.forEach(function (f, i) {
          var val = f.type === 'file' ? "new CURLFile('" + f.value + "')" : "'" + f.value + "'";
          lines.push("    '" + f.name + "' => " + val + (i < model.body.fields.length - 1 ? ',' : ''));
        });
        lines.push('  ],');
      }
    }
    lines.push(']);', '', '$response = curl_exec($curl);', 'curl_close($curl);', 'echo $response;');
    return lines.join('\n');
  }

  function formatJavaOkHttpSnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    var lines = ['OkHttpClient client = new OkHttpClient();'];
    var bodyVar = null;
    if (isMultipart) {
      lines.push('MultipartBody body = new MultipartBody.Builder()', '  .setType(MultipartBody.FORM)');
      model.body.fields.forEach(function (f) {
        if (f.type === 'file') lines.push("  .addFormDataPart('" + f.name + "', '" + f.value + "', RequestBody.create(MediaType.parse('application/octet-stream'), new File('" + f.value + "')))");
        else lines.push("  .addFormDataPart(\"" + f.name + '", "' + f.value + '")');
      });
      lines.push('  .build();');
      bodyVar = 'body';
    } else if (model.body && model.body.kind === 'json') {
      lines.push('MediaType mediaType = MediaType.parse("application/json");');
      lines.push('RequestBody body = RequestBody.create(mediaType, "' + JSON.stringify(model.body.value).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '");');
      bodyVar = 'body';
    }
    lines.push('Request request = new Request.Builder()');
    lines.push('  .url("' + urlWithQuery(model.url, model.query) + '")');
    lines.push('  .method("' + model.method + '", ' + (bodyVar || 'null') + ')');
    model.headers.forEach(function (h) {
      if (isMultipart && h.name === 'Content-Type') return;
      lines.push('  .addHeader("' + h.name + '", "' + h.value + '")');
    });
    lines.push('  .build();');
    lines.push('Response response = client.newCall(request).execute();');
    return lines.join('\n');
  }

  function formatGoSnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    if (isMultipart) {
      // Go's standard library builds a multipart body via mime/multipart's
      // own Writer (no one-liner) — a real stub here would need to import
      // and use it, unlike the "fmt"/"net/http" imports below, so this
      // stays a short note instead of unused-import code that wouldn't
      // actually compile.
      return ['// multipart/form-data: build the body with mime/multipart.Writer', "// (see Go's standard library docs), then POST it via net/http as usual."].join('\n');
    }
    var lines = ['package main', '', 'import (', '\t"fmt"', '\t"net/http"'];
    if (model.body && model.body.kind === 'json') lines.push('\t"strings"');
    lines.push(')', '', 'func main() {');
    lines.push('\turl := "' + urlWithQuery(model.url, model.query) + '"');
    if (model.body && model.body.kind === 'json') {
      lines.push('\tpayload := strings.NewReader(`' + JSON.stringify(model.body.value, null, 2) + '`)');
      lines.push('\treq, _ := http.NewRequest("' + model.method + '", url, payload)');
    } else {
      lines.push('\treq, _ := http.NewRequest("' + model.method + '", url, nil)');
    }
    model.headers.forEach(function (h) {
      lines.push('\treq.Header.Add("' + h.name + '", "' + h.value + '")');
    });
    lines.push('\tres, _ := http.DefaultClient.Do(req)');
    lines.push('\tdefer res.Body.Close()');
    lines.push('\tfmt.Println(res.Status)');
    lines.push('}');
    return lines.join('\n');
  }

  function formatRubySnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    var methodClass = model.method.charAt(0) + model.method.slice(1).toLowerCase();
    var lines = ["require 'net/http'"];
    if (!isMultipart) lines.push("require 'json'");
    lines.push('', "uri = URI('" + urlWithQuery(model.url, model.query) + "')", 'http = Net::HTTP.new(uri.host, uri.port)');
    if (isHttpsUrl(model.url)) lines.push('http.use_ssl = true');
    lines.push('request = Net::HTTP::' + methodClass + '.new(uri)');
    model.headers.forEach(function (h) {
      if (isMultipart && h.name === 'Content-Type') return;
      lines.push("request['" + h.name + "'] = '" + h.value + "'");
    });
    if (model.body && model.body.kind === 'json') {
      lines.push('request.body = ' + rubyHash(model.body.value) + '.to_json');
    } else if (isMultipart) {
      lines.push('# multipart bodies: see net/http\'s Net::HTTP::Post::Multipart (net-http-multipart gem)');
      lines.push('# or build a multipart/form-data body by hand.');
    }
    lines.push('response = http.request(request)', 'puts response.read_body');
    return lines.join('\n');
  }

  function isHttpsUrl(url) {
    return url.indexOf('https://') === 0;
  }

  /** A Ruby hash literal (`"key" => value`) for a JSON-like example value —
   *  same role as `pyLiteral`/`phpLiteral`, Ruby's own hash syntax. */
  function rubyHash(value, indent) {
    indent = indent || '';
    if (value === null || value === undefined) return 'nil';
    if (typeof value === 'boolean' || typeof value === 'number') return String(value);
    if (typeof value === 'string') return '"' + value.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    var nextIndent = indent + '  ';
    if (Array.isArray(value)) {
      var items = value.map(function (v) {
        return nextIndent + rubyHash(v, nextIndent);
      });
      return '[\n' + items.join(',\n') + '\n' + indent + ']';
    }
    var keys = Object.keys(value);
    var lines = keys.map(function (k) {
      return nextIndent + '"' + k + '" => ' + rubyHash(value[k], nextIndent);
    });
    return '{\n' + lines.join(',\n') + '\n' + indent + '}';
  }

  function formatCsharpSnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    var lines = ['using System.Net.Http;', 'using System.Text;', 'using System.IO;', '', 'var client = new HttpClient();'];
    lines.push('var request = new HttpRequestMessage(new HttpMethod("' + model.method + '"), "' + urlWithQuery(model.url, model.query) + '");');
    // `Content-Type` is a *content* header in HttpClient's model — setting
    // it via `request.Headers.Add` (a request-header collection) throws at
    // runtime; it's passed as `StringContent`'s own 3rd argument below
    // instead, so it's excluded here regardless of body kind.
    var headers = model.headers.filter(function (h) {
      return h.name !== 'Content-Type';
    });
    headers.forEach(function (h) {
      lines.push('request.Headers.Add("' + h.name + '", "' + h.value + '");');
    });
    if (isMultipart) {
      lines.push('var content = new MultipartFormDataContent();');
      model.body.fields.forEach(function (f) {
        if (f.type === 'file') lines.push('content.Add(new StreamContent(File.OpenRead("' + f.value + '")), "' + f.name + '", "' + f.value + '");');
        else lines.push('content.Add(new StringContent("' + f.value + '"), "' + f.name + '");');
      });
      lines.push('request.Content = content;');
    } else if (model.body && model.body.kind === 'json') {
      lines.push('request.Content = new StringContent(' + csharpStringLiteral(JSON.stringify(model.body.value, null, 2)) + ', Encoding.UTF8, "application/json");');
    }
    lines.push('var response = await client.SendAsync(request);');
    return lines.join('\n');
  }

  function formatSwiftSnippet(model) {
    var isMultipart = model.body && model.body.kind === 'multipart';
    var lines = ['import Foundation', '', 'let url = URL(string: "' + urlWithQuery(model.url, model.query) + '")!', 'var request = URLRequest(url: url)', 'request.httpMethod = "' + model.method + '"'];
    var headers = model.headers.filter(function (h) {
      return !(isMultipart && h.name === 'Content-Type');
    });
    headers.forEach(function (h) {
      lines.push('request.setValue("' + h.value + '", forHTTPHeaderField: "' + h.name + '")');
    });
    if (model.body && model.body.kind === 'json') {
      var jsonStr = JSON.stringify(model.body.value, null, 2).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
      lines.push('request.httpBody = "' + jsonStr + '".data(using: .utf8)');
    } else if (isMultipart) {
      lines.push('// multipart/form-data: build a boundary-delimited Data body by hand,');
      lines.push('// or use a library like Alamofire.');
    }
    lines.push('', 'let task = URLSession.shared.dataTask(with: request) { data, response, error in', '  // handle response', '}', 'task.resume()');
    return lines.join('\n');
  }

  /** The code-sample half of the request rail's dropdown — everything
   *  except "Body" itself, which `renderRequestSection`'s `refreshSelect`
   *  computes separately per alternative (see `bodyKindEntry`) and
   *  prepends, since its options depend on the currently-selected content
   *  type rather than being fixed like these are. `{key, label}` items
   *  ungrouped render as top-level `<option>`s; `{group, items}` ones
   *  render as an `<optgroup>` — one group per language, several
   *  client/library variants inside, matching how Scalar's own
   *  request-snippet picker is organized. */
  var REQUEST_SNIPPET_KINDS = [
    {
      group: 'Shell',
      items: [
        { key: 'curl', label: 'cURL' },
        { key: 'httpie', label: 'HTTPie' },
      ],
    },
    {
      group: 'JavaScript',
      items: [
        { key: 'opra', label: 'OPRA Client' },
        { key: 'fetch', label: 'Fetch' },
        { key: 'axios', label: 'Axios' },
        { key: 'jquery', label: 'jQuery' },
        { key: 'xhr', label: 'XHR' },
      ],
    },
    { group: 'Node.js', items: [{ key: 'node', label: 'HTTP' }] },
    {
      group: 'Python',
      items: [
        { key: 'python', label: 'Requests' },
        { key: 'python_httpclient', label: 'http.client' },
      ],
    },
    { group: 'PHP', items: [{ key: 'php', label: 'cURL' }] },
    { group: 'Java', items: [{ key: 'java', label: 'OkHttp' }] },
    { group: 'Go', items: [{ key: 'go', label: 'net/http' }] },
    { group: 'Ruby', items: [{ key: 'ruby', label: 'Net::HTTP' }] },
    { group: 'C#', items: [{ key: 'csharp', label: 'HttpClient' }] },
    { group: 'Swift', items: [{ key: 'swift', label: 'URLSession' }] },
  ];

  var REQUEST_SNIPPET_FORMATTERS = {
    opra: formatOpraClientSnippet,
    curl: formatCurlSnippet,
    httpie: formatHttpieSnippet,
    fetch: formatFetchSnippet,
    axios: formatAxiosSnippet,
    jquery: formatJQuerySnippet,
    xhr: formatXhrSnippet,
    node: formatNodeSnippet,
    python: formatPythonSnippet,
    python_httpclient: formatPythonHttpClientSnippet,
    php: formatPhpCurlSnippet,
    java: formatJavaOkHttpSnippet,
    go: formatGoSnippet,
    ruby: formatRubySnippet,
    csharp: formatCsharpSnippet,
    swift: formatSwiftSnippet,
  };

  var REQUEST_SNIPPET_HIGHLIGHTERS = {
    opra: function (code) {
      return highlightJs(code, ['OpraHttpClient', 'FormData']);
    },
    curl: highlightShell,
    httpie: highlightShell,
    fetch: highlightJs,
    axios: highlightJs,
    jquery: function (code) {
      return highlightJs(code, ['ajax']);
    },
    xhr: function (code) {
      return highlightJs(code, ['XMLHttpRequest', 'open', 'send', 'setRequestHeader']);
    },
    node: function (code) {
      return highlightJs(code, ['http', 'https', 'request']);
    },
    python: highlightPython,
    python_httpclient: function (code) {
      return highlightPython(code, ['json', 'http', 'client']);
    },
    php: function (code) {
      return highlightGeneric(code, ['curl_init', 'curl_setopt_array', 'curl_exec', 'curl_close', 'json_encode', 'echo', 'new', 'CURLFile']);
    },
    java: function (code) {
      return highlightGeneric(code, ['new', 'OkHttpClient', 'MediaType', 'RequestBody', 'MultipartBody', 'Request', 'Response', 'File']);
    },
    go: function (code) {
      return highlightGeneric(code, ['package', 'import', 'func', 'main', 'http', 'strings', 'defer']);
    },
    ruby: function (code) {
      return highlightGeneric(code, ['require', 'Net', 'HTTP', 'URI', 'new', 'puts']);
    },
    csharp: function (code) {
      return highlightGeneric(code, ['var', 'new', 'await', 'HttpClient', 'HttpRequestMessage', 'HttpMethod', 'StringContent', 'MultipartFormDataContent', 'StreamContent', 'File']);
    },
    swift: function (code) {
      return highlightGeneric(code, ['import', 'let', 'var', 'URL', 'URLRequest', 'URLSession']);
    },
  };

  /** The "Request" rail (see `render()`) covers the *whole* request this
   *  operation needs — method, path, path/query/header parameters, and a
   *  body if there is one — not just the request body, so it's built for
   *  every operation, not only ones with a `requestBody`. The "Request
   *  body" *content* section (h2, tabs, per-alternative panels) is the one
   *  part that's still conditional on `op.requestBody` existing; a
   *  bodyless operation (GET, DELETE, ...) just skips straight to whatever
   *  comes after it, with the rail still showing generated snippets built
   *  from `buildRequestModel(doc, ctrlPath, op, null)` (no body, but still
   *  a real method/path/parameters to call).
   *
   *  `requestBody.content` is an array precisely because an operation can
   *  accept more than one alternative representation of the same body
   *  (e.g. `application/json` *or* `multipart/form-data` for the same
   *  upload endpoint) — a tab per alternative, only shown at all once
   *  there's more than one; a single alternative (the common case) just
   *  renders its panel directly with no tab chrome around it.
   *
   *  The rail itself is a header (method + full path) and a dropdown that
   *  switches between the *currently selected* alternative's own body
   *  example (skipped entirely when there's no body to show; a "Body"
   *  entry that itself expands into a JSON/YAML/TOML sub-group whenever
   *  that alternative's `contentType` lists more than one serialization —
   *  see `bodyKindEntry` — instead of only ever showing JSON) and generated
   *  cURL/Fetch/Axios/Python/etc. snippets built from the operation's real
   *  method/path/parameters/body (`buildRequestModel`) — switching the
   *  content-type tab regenerates whichever snippet kind is currently
   *  selected, AND rebuilds the "Body" entry for whichever alternative is
   *  now current (`refreshSelect`), since a different alternative can offer
   *  a different set of serializations. Structured like
   *  `renderResponsesSection`'s own rail (header / scrollable content /
   *  absolutely-positioned copy button that doesn't scroll away with long
   *  content — see `.response-rail-content-wrap` in styles.css, mirrored
   *  here as `.request-rail-content-wrap`), just without a footer. */
  function renderRequestSection(main, doc, op, ctrlPath, railExample) {
    var requestBody = op.requestBody;
    var hasBody = !!requestBody;
    var selectedKind = hasBody ? 'body' : 'curl';
    var currentMedia = null;
    var railContent = null;
    var railCopyHolder = null;
    var select = null;

    function renderRail() {
      if (!railContent) return;
      clear(railContent);
      clear(railCopyHolder);
      var bodyFormat = BODY_KIND_FORMAT[selectedKind];
      if (bodyFormat) {
        var bodyView = currentMedia ? requestBodyExample(doc, currentMedia, bodyFormat) : null;
        if (bodyView) {
          railContent.appendChild(bodyView.content);
          railCopyHolder.appendChild(bodyView.copyBtn);
        } else {
          railContent.appendChild(el('div', { class: 'empty-note' }, [t('operation.noBodyAlternative')]));
        }
        return;
      }
      var model = buildRequestModel(doc, ctrlPath, op, currentMedia);
      var snippet = REQUEST_SNIPPET_FORMATTERS[selectedKind](model);
      var highlighted = REQUEST_SNIPPET_HIGHLIGHTERS[selectedKind](snippet);
      railContent.appendChild(el('pre', { class: 'example-json' }, [el('code', { html: highlighted })]));
      var copyBtn = copyButton(snippet, 15);
      copyBtn.classList.add('copy-btn-lg');
      railCopyHolder.appendChild(copyBtn);
    }

    // Rebuilds the dropdown's options for `media`'s own set of body
    // formats (the "Body" entry only — the rest of `REQUEST_SNIPPET_KINDS`
    // never changes) and re-applies `selectedKind` to the new `<select>`;
    // when that value no longer exists among the new options (switching
    // from a JSON+YAML+TOML alternative to a plain-JSON or multipart one,
    // say), the browser falls back to the new first option on its own, so
    // reading `select.value` back afterward is what keeps `selectedKind` in
    // sync with what's actually showing instead of pointing at a choice
    // that no longer exists.
    function refreshSelect(media) {
      if (!select) return;
      clear(select);
      var kinds = (hasBody ? [bodyKindEntry(media)] : []).concat(REQUEST_SNIPPET_KINDS);
      kinds.forEach(function (k) {
        if (k.group) {
          var group = el('optgroup', { label: k.group });
          k.items.forEach(function (item) {
            group.appendChild(el('option', { value: item.key }, [item.label]));
          });
          select.appendChild(group);
        } else {
          select.appendChild(el('option', { value: k.key }, [k.label]));
        }
      });
      // Assigning `.value` a string that matches no `<option>` doesn't fall
      // back to the first one — it leaves nothing selected at all
      // (`selectedIndex -1`, `.value` reading back as `''`) — so that has
      // to be checked and corrected for explicitly.
      select.value = selectedKind;
      if (select.selectedIndex === -1) select.selectedIndex = 0;
      selectedKind = select.value;
    }

    function showExample(media) {
      currentMedia = media;
      refreshSelect(media);
      renderRail();
    }

    if (railExample) {
      railExample.classList.add('request-rail');
      var fullPath = operationPath(ctrlPath, op);
      var header = el('div', { class: 'request-rail-header' }, [
        el('span', { class: 'request-rail-path mono' }, [methodBadge(op.method), ' ', fullPath]),
      ]);
      select = el('select', { class: 'request-rail-select' });
      select.addEventListener('change', function () {
        selectedKind = select.value;
        renderRail();
      });
      header.appendChild(select);
      railExample.appendChild(header);
      railContent = el('div', { class: 'request-rail-content' });
      railCopyHolder = el('div', { class: 'request-rail-copy' });
      railExample.appendChild(el('div', { class: 'request-rail-content-wrap' }, [railContent, railCopyHolder]));
    }

    if (!hasBody) {
      showExample(null);
      return;
    }

    var section = el('div', { class: 'section' }, [el('h2', {}, [t('operation.requestBody')])]);
    var metaChildren = [];
    if (requestBody.required) metaChildren.push(flagBadge('required'));
    var descBlock = mdBlock(doc, requestBody.description);
    if (descBlock) metaChildren.push(descBlock);
    if (metaChildren.length) section.appendChild(el('div', { class: 'request-body-meta' }, metaChildren));

    var contents = requestBody.content || [];
    if (contents.length > 1) {
      var panels = contents.map(function (media) {
        return renderMediaTypePanel(doc, media);
      });
      var tabBar = el('div', { class: 'content-tabs' });
      contents.forEach(function (media, i) {
        var label = Array.isArray(media.contentType)
          ? media.contentType.join(', ')
          : media.contentType || 'application/json';
        var tabBtn = el('button', { class: 'content-tab' + (i === 0 ? ' active' : ''), type: 'button' }, [label]);
        tabBtn.addEventListener('click', function () {
          Array.prototype.forEach.call(tabBar.children, function (b) {
            b.classList.remove('active');
          });
          tabBtn.classList.add('active');
          panels.forEach(function (p, j) {
            p.hidden = j !== i;
          });
          showExample(media);
        });
        tabBar.appendChild(tabBtn);
      });
      section.appendChild(tabBar);
      section.appendChild(
        el('p', { class: 'content-alt-note' }, [
          t('operation.multipleFormats'),
        ]),
      );
      panels.forEach(function (p, i) {
        p.hidden = i !== 0;
        section.appendChild(p);
      });
      showExample(contents[0]);
    } else if (contents.length === 1) {
      section.appendChild(renderMediaTypePanel(doc, contents[0]));
      showExample(contents[0]);
    }
    main.appendChild(section);
  }

  /** Each response collapses to just its status line by default (a plain
   *  `<details>`, not a custom widget — the browser's own disclosure
   *  triangle and keyboard support come for free, and `name` groups them
   *  so opening one closes whichever other response was already open,
   *  Scalar-style) — a page with several responses documented reads as a
   *  short list of status codes first, each one's full schema only a
   *  click away, instead of every response's type tree dumped on screen
   *  at once. Deliberately plain (a divider between rows, no per-row
   *  border/background/status-color) rather than looking like the
   *  request body's own bordered `.media-type-panel`s — those are
   *  reference material for a body you're about to construct yourself,
   *  while these are more like a short index of outcomes, and coloring or
   *  boxing every single one made them read as louder than that.
   *
   *  `railResponseExample` (the "Responses" row's own rail — see
   *  `render()`) is a self-contained mini status-code switcher, not just
   *  a passive mirror of whichever `<details>` is open: its own tab bar
   *  (`response-tabs`) can pick a different response independently, a
   *  "Show Schema" checkbox swaps its content pane between the
   *  synthesized JSON example and the actual type tree, and a fixed
   *  footer (status code + description) stays put below that pane —
   *  only the pane itself scrolls internally when its content runs
   *  long (see `.response-rail` in styles.css), so the tabs and footer
   *  are never pushed out of view. Opening a `<details>` on the left
   *  still re-syncs the rail to that same response, but the rail's own
   *  tabs are the primary way to flip through responses without leaving
   *  a schema expanded. */
  function renderResponsesSection(main, doc, responses, railResponseExample) {
    var section = el('div', { class: 'section' }, [el('h2', {}, [t('operation.responses')])]);
    var list = el('div', { class: 'responses-list' });

    var showSchema = false;
    var activeIndex = 0;
    var tabButtons = [];
    var railContent = null;
    var railCopyHolder = null;
    var railFooterCode = null;
    var railFooterDesc = null;
    var schemaToggleLabel = null;

    // "Show Schema" is the raw OPRA type definition (what `resolveType`
    // resolves a `type` reference down to — the same schema envelope
    // `schema-builder.ts` emits for every named type), not
    // `renderTypeTreeWithInherits`'s own human-readable field list: that's
    // documentation rendered FROM the schema, and showing it here under a
    // "schema" toggle would just be the same content twice in two
    // different outfits rather than an actual look at the schema itself.
    //
    // The copy button lives in `railCopyHolder`, a sibling of `railContent`
    // rather than something nested inside it — this rail has its own
    // internal scroll (see `.response-rail-content` in styles.css), and a
    // button positioned relative to something that scrolls would scroll
    // right along with it, off screen with the rest of the content instead
    // of staying put like the tabs/footer around it (the Request panel's
    // own rail — `renderRequestSection` — uses the exact same
    // `railCopyHolder`-as-sibling pattern for the same reason).
    function renderRailContent(r) {
      if (!railContent) return;
      clear(railContent);
      clear(railCopyHolder);
      // "Show Schema" only ever toggles between two views of `r.type` — an
      // example value or its raw definition — so a response with no `type`
      // at all (a 204, or any other response documented as bodyless) has
      // nothing for it to switch to; leaving it visible just invites
      // clicking a checkbox that changes nothing.
      if (schemaToggleLabel) schemaToggleLabel.hidden = !r.type;
      var json = null;
      if (showSchema) {
        var def = r.type ? resolveType(doc, r.type).def : null;
        json = def ? JSON.stringify(def, null, 2) : null;
      } else if (r.type) {
        json = JSON.stringify(buildExampleValue(doc, r.type), null, 2);
      }
      if (json) {
        railContent.appendChild(el('pre', { class: 'example-json' }, [el('code', { html: highlightJson(json) })]));
        var copyBtn = copyButton(json, 15);
        copyBtn.classList.add('copy-btn-lg');
        railCopyHolder.appendChild(copyBtn);
      } else {
        railContent.appendChild(el('div', { class: 'empty-note' }, [t('operation.noBody')]));
      }
      railFooterCode.textContent = formatStatusCode(r.statusCode);
      railFooterDesc.textContent = r.description || '';
    }

    function selectResponse(i) {
      activeIndex = i;
      tabButtons.forEach(function (b, j) {
        b.classList.toggle('active', j === i);
      });
      renderRailContent(responses[i]);
    }

    if (railResponseExample) {
      railResponseExample.classList.add('response-rail');
      var tabsBar = el('div', { class: 'response-tabs' });
      responses.forEach(function (r, i) {
        var tabBtn = el('button', { class: 'response-tab' + (i === 0 ? ' active' : ''), type: 'button' }, [formatStatusCode(r.statusCode)]);
        tabBtn.addEventListener('click', function () {
          selectResponse(i);
        });
        tabButtons.push(tabBtn);
        tabsBar.appendChild(tabBtn);
      });
      var schemaCheckbox = el('input', { type: 'checkbox' });
      schemaCheckbox.addEventListener('change', function () {
        showSchema = schemaCheckbox.checked;
        renderRailContent(responses[activeIndex]);
      });
      schemaToggleLabel = el('label', { class: 'show-schema-toggle' }, [schemaCheckbox, t('operation.showSchema')]);
      tabsBar.appendChild(schemaToggleLabel);
      railResponseExample.appendChild(tabsBar);
      railContent = el('div', { class: 'response-rail-content' });
      railCopyHolder = el('div', { class: 'response-rail-copy' });
      railResponseExample.appendChild(el('div', { class: 'response-rail-content-wrap' }, [railContent, railCopyHolder]));
      railFooterCode = el('code', {}, ['']);
      railFooterDesc = el('div', { class: 'footer-desc' }, ['']);
      railResponseExample.appendChild(
        el('div', { class: 'response-rail-footer' }, [
          el('div', { class: 'footer-status' }, tNodes('operation.httpStatusCode', { code: railFooterCode })),
          railFooterDesc,
        ]),
      );
      renderRailContent(responses[0]);
    }

    responses.forEach(function (r, i) {
      var details = el('details', { class: 'response-row', name: 'op-responses' });
      details.appendChild(
        el('summary', {}, [
          el('span', { class: 'mono response-status' }, [formatStatusCode(r.statusCode)]),
          r.description ? el('span', { class: 'response-desc' }, [r.description]) : null,
        ]),
      );
      var body = el('div', { class: 'body' });
      if (r.type) body.appendChild(renderTypeTreeWithInherits(doc, r.type));
      else body.appendChild(el('div', { class: 'empty-note' }, [t('operation.noBody')]));
      details.appendChild(body);
      details.addEventListener('toggle', function () {
        if (details.open) selectResponse(i);
      });
      list.appendChild(details);
    });
    section.appendChild(list);
    main.appendChild(section);
  }

  function renderControllerPage(main, docKey, doc, found, ctrlRoute) {
    var ctrl = found.ctrl;
    main.appendChild(el('h1', { class: 'mono' }, [found.name]));
    main.appendChild(el('p', { class: 'description path' }, [found.ctrlPath || '/']));
    var ctrlDescBlock = mdBlock(doc, ctrl.description);
    if (ctrlDescBlock) main.appendChild(ctrlDescBlock);
    renderParametersSections(main, doc, ctrl.parameters);

    var ops = ctrl.operations ? Object.keys(ctrl.operations) : [];
    if (ops.length) {
      var opSection = el('div', { class: 'section' }, [el('h2', {}, [t('controller.operations')])]);
      ops.forEach(function (opKey) {
        var op = ctrl.operations[opKey];
        opSection.appendChild(
          el(
            'a',
            { class: 'row-link', href: hrefFor(docKey, ctrlRoute + '/' + encodeURIComponent(opKey)) },
            [
              methodBadge(op.method),
              op.title
                ? el('span', {}, [op.title])
                : el('span', { class: 'mono' }, [opKey + '()']),
              el('span', { class: 'row-path' }, [operationPath(found.ctrlPath || '/', op)]),
              op.description ? el('span', { class: 'row-desc', dir: 'auto' }, [op.description]) : null,
            ],
          ),
        );
      });
      main.appendChild(opSection);
    }

    var children = ctrl.controllers ? Object.keys(ctrl.controllers) : [];
    if (children.length) {
      var childSection = el('div', { class: 'section' }, [el('h2', {}, [t('controller.childControllers')])]);
      children.forEach(function (name) {
        var child = ctrl.controllers[name];
        childSection.appendChild(
          el('a', { class: 'row-link', href: hrefFor(docKey, ctrlRoute + '/' + encodeURIComponent(name)) }, [
            el('span', { class: 'mono' }, [name]),
            el('span', { class: 'row-desc path' }, [controllerPath(child, found.ctrlPath)]),
          ]),
        );
      });
      main.appendChild(childSection);
    }

    if (!ops.length && !children.length) {
      main.appendChild(el('div', { class: 'section empty-note' }, [t('controller.empty')]));
    }
  }

  /** `topMain` and `responsesMain` are up to two separate containers (see
   *  `render()`), not one flowing column: everything through the parameter
   *  sections *and* the Request section (rail + any request body content)
   *  goes in `topMain`, sharing row 1's `.rail-col` with `toc` (see that
   *  CSS comment for why `railExample` is safe to stack there while
   *  `railResponseExample` still needs a row of its own); "Responses" (if
   *  any) goes in `responsesMain`, next to `railResponseExample`'s own
   *  rail, starting right below wherever row 1 ends. `railExample` is
   *  always built — every operation has a method/path/parameters worth
   *  showing request snippets for, even without a request body — so
   *  `topMain` never needs a second, separate container the way
   *  `responsesMain` does; a responses row that has nothing to show
   *  doesn't get created, so `render()` passes `topMain` for that
   *  container instead (with `railResponseExample` as `null`). */
  function renderOperationPage(topMain, responsesMain, docKey, doc, found, railExample, railResponseExample) {
    var op = found.op;
    var fullPath = operationPath(found.ctrlPath, op);

    // A `title` becomes the page's real heading (a sentence, not a code
    // identifier) with the technical `opKey()` demoted to a small mono
    // line right underneath — same relationship OpenAPI tools draw
    // between an operation's `summary` and its `operationId`. Without a
    // `title`, this renders exactly as it always has.
    if (op.title) {
      topMain.appendChild(el('h1', { dir: 'auto' }, [op.title]));
      topMain.appendChild(el('div', { class: 'op-id mono' }, [found.opKey + '()']));
    } else {
      topMain.appendChild(el('h1', { class: 'mono' }, [found.opKey + '()']));
    }
    var sub = el('p', { class: 'op-sub' }, [methodBadge(op.method), el('span', { class: 'path' }, [fullPath])]);
    topMain.appendChild(sub);
    if (found.ctrlName) {
      topMain.appendChild(
        el(
          'p',
          { class: 'description' },
          tNodes('operation.partOf', {
            controller: el('a', { href: hrefFor(docKey, found.ctrlRoute) }, [found.ctrlName]),
          }),
        ),
      );
    }

    if (op.deprecated) {
      topMain.appendChild(
        el('span', { class: 'badge deprecated' }, [
          typeof op.deprecated === 'string'
            ? t('operation.deprecatedReason', { reason: op.deprecated })
            : t('operation.deprecated'),
        ]),
      );
    }
    if (op.composition) topMain.appendChild(el('div', { class: 'badge' }, [t('operation.composition', { value: op.composition })]));
    var opDescBlock = mdBlock(doc, op.description);
    if (opDescBlock) topMain.appendChild(opDescBlock);

    renderParametersSections(topMain, doc, op.parameters);

    renderRequestSection(topMain, doc, op, found.ctrlPath, railExample);

    if (op.responses && op.responses.length) {
      renderResponsesSection(responsesMain, doc, op.responses, railResponseExample);
    } else {
      responsesMain.appendChild(el('div', { class: 'section empty-note' }, [t('operation.noResponses')]));
    }
  }

  /** Every other named type in `doc` whose fields, composition (`inherits`),
   *  or union members reference `typeName` — a reverse-lookup "used by"
   *  list for the model page's "References to this Resource" section. */
  function findReferencingTypes(doc, typeName) {
    var found = [];
    Object.keys(doc.types || {}).forEach(function (name) {
      if (name === typeName) return;
      var def = doc.types[name];
      var used = false;
      function scan(ref) {
        if (used || ref == null) return;
        if (typeof ref === 'string') {
          if (ref === typeName) used = true;
          return;
        }
        if (ref.kind === 'ArrayType') scan(ref.type);
        else if (ref.kind === 'UnionType') (ref.types || []).forEach(scan);
      }
      if (def.fields) {
        Object.keys(def.fields).forEach(function (fname) {
          scan(def.fields[fname].type);
        });
      }
      if (def.inherits && def.inherits.types) def.inherits.types.forEach(scan);
      if (def.types) def.types.forEach(scan);
      if (def.type) scan(def.type);
      if (used) found.push(name);
    });
    return found;
  }

  /** A field's own declared example value (`ApiField.examples`), if any —
   *  the first entry of the array, or the first value of a name-keyed
   *  record. Returns `undefined` when the field has none, so callers can
   *  fall back to a synthesized placeholder. */
  function firstFieldExampleValue(examples) {
    if (!examples) return undefined;
    if (Array.isArray(examples)) return examples.length ? examples[0] : undefined;
    var keys = Object.keys(examples);
    return keys.length ? examples[keys[0]] : undefined;
  }

  /** A placeholder value for a SimpleType with no real example data to
   *  draw from — guessed from its builtin name/kind, or from its own
   *  constraint properties (min/max, length) for a custom SimpleType. A
   *  *named* SimpleType's own declared examples (`@SimpleType().Example()`)
   *  take priority over any of that guessing. */
  function exampleForSimpleType(d) {
    if (d.examples && d.examples.length && d.examples[0] && 'value' in d.examples[0]) {
      return d.examples[0].value;
    }
    var name = (d.name || d.kind || '').toLowerCase();
    var props = d.properties || {};
    if (name === 'boolean') return true;
    if (name === 'number' || name === 'integer' || name === 'bigint') {
      return typeof props.minValue === 'number' ? props.minValue : 0;
    }
    if (name === 'date') return '2024-01-01';
    if (name === 'datetime') return '2024-01-01T00:00:00Z';
    if (name === 'null') return null;
    if (name === 'object' || name === 'any') return {};
    if (name === 'base64') return 'base64==';
    if (typeof props.minLength === 'number' && props.minLength > 'string'.length) {
      return 'string'.padEnd(props.minLength, 'x');
    }
    return 'string';
  }

  /** A synthesized example value for whatever `ref` resolves to — an
   *  object with one key per field for a ComplexType/MappedType/MixinType,
   *  the first value for an Enum, the first member's example for a Union,
   *  a guessed placeholder for a SimpleType, wrapped in `[...]` per `[]`
   *  layer. `seenNames` guards against infinite recursion on a
   *  self-referential type (e.g. a tree node containing itself). */
  function buildExampleValue(doc, ref, seenNames) {
    seenNames = seenNames || [];
    var u = unwrapArray(doc, ref);
    var d = u.def;
    if (!d) return null;
    var depth = (u.suffix.match(/\[\]/g) || []).length;
    var nextSeen = u.name ? seenNames.concat([u.name]) : seenNames;
    var value;
    if (u.name && seenNames.indexOf(u.name) !== -1) {
      value = '…';
    } else if (d.fields) {
      value = {};
      Object.keys(d.fields).forEach(function (fname) {
        var f = d.fields[fname];
        var declared = firstFieldExampleValue(f.examples);
        value[fname] = declared !== undefined ? declared : buildExampleValue(doc, f.type, nextSeen);
      });
    } else if (d.kind === 'EnumType') {
      var enumKeys = Object.keys(d.values || {});
      value = enumKeys.length ? enumKeys[0] : null;
    } else if (d.kind === 'UnionType') {
      value = d.types && d.types.length ? buildExampleValue(doc, d.types[0], nextSeen) : null;
    } else if (d.kind === 'SimpleType') {
      value = exampleForSimpleType(d);
    } else {
      value = null;
    }
    for (var i = 0; i < depth; i++) value = [value];
    return value;
  }

  /** A type's own declared example list (`@SimpleType().Example()` —
   *  `DataType.examples`, `{ description, value }` pairs), shown on its
   *  model page as one row per example: the value as a boxed, copyable
   *  chip (see `exampleChip`), plus its description underneath when given.
   *  Distinct from the synthesized "Example" JSON block below
   *  (`renderExampleBlock`), which guesses a whole-object shape for
   *  ComplexType/MappedType/MixinType rather than listing real declared
   *  values for one type. */
  function renderTypeExamples(doc, examples) {
    if (!examples || !examples.length) return null;
    var list = el('div', { class: 'field-list' });
    // Numbered ("Example 1", "Example 2", ...) — with more than one and
    // no description on some of them, a bare stack of value chips (all
    // the same size, same indent, separated only by the same thin
    // divider every other field-list row already has) gave no cue that
    // each row was its own distinct example rather than, say, one
    // multi-part value.
    examples.forEach(function (ex, i) {
      var head = el('span', { class: 'field-head' }, [
        el('span', { class: 'key' }, [t('model.exampleIndex', { index: i + 1 })]),
        exampleChip(ex.value),
      ]);
      if (ex.description) {
        // On the same line as the chip, not its own paragraph below —
        // a separate block the same size as body text read as the
        // "real" content, with the small chip above it looking more
        // like a label than the actual value. Inline and visibly
        // secondary (smaller, muted, "— " prefix) keeps the chip itself
        // as the one thing that looks like the example.
        head.appendChild(
          el('span', { class: 'example-desc', dir: 'auto', html: '— ' + mdInline(doc, ex.description) }),
        );
      }
      var row = el('div', { class: 'field-row' }, [head]);
      list.appendChild(row);
    });
    return list;
  }

  /** A copyable "Example" JSON block for a ComplexType/MappedType/MixinType
   *  model page — a synthesized instance showing its overall shape at a
   *  glance, the way a REST API reference (Scalar, Swagger UI) shows a
   *  sample request/response body next to the field list. Syntax-colored
   *  (see `highlightJson`); the copy button sits inside the code box's own
   *  top-right corner (like most doc-site code blocks), rather than next
   *  to the heading, and is a larger variant of the same `copyButton` used
   *  for individual example chips — a whole-block action reads better as
   *  a more prominent target than an inline one. */
  function renderExampleBlock(doc, typeName) {
    var example = buildExampleValue(doc, typeName);
    var json = JSON.stringify(example, null, 2);
    var btn = copyButton(json, 15);
    btn.classList.add('copy-btn-lg');
    return el('div', { class: 'section' }, [
      el('h2', {}, [t('model.example')]),
      el('div', { class: 'example-json-wrap' }, [
        el('pre', { class: 'example-json' }, [el('code', { html: highlightJson(json) })]),
        btn,
      ]),
    ]);
  }

  function renderModelPage(main, doc, typeName) {
    var def = doc.types && doc.types[typeName];
    var kindKey = def ? dataTypeIconKind(def.kind) : null;
    main.appendChild(
      el('h1', { class: 'mono' }, [
        def ? iconFor(kindKey, 'c-' + kindKey) : null,
        typeName,
        def ? el('span', { class: 'badge kind-badge c-' + kindKey }, [def.kind]) : null,
      ]),
    );
    if (!def) {
      main.appendChild(el('div', { class: 'empty-note' }, [t('model.notFound')]));
      return;
    }
    var inheritsBlock = renderInherits(doc, def.inherits);
    if (inheritsBlock) main.appendChild(inheritsBlock);

    var modelDescBlock = mdBlock(doc, def.description);
    if (modelDescBlock) {
      main.appendChild(el('div', { class: 'section' }, [el('h2', {}, [t('overview.description')]), modelDescBlock]));
    }

    var referencedBy = findReferencingTypes(doc, typeName);
    if (referencedBy.length) {
      main.appendChild(
        el('div', { class: 'section' }, [
          el('h2', {}, [t('model.referencesToThis')]),
          el(
            'div',
            { class: 'reference-list' },
            referencedBy.map(function (name) {
              return typeRefNode(doc, name);
            }),
          ),
        ]),
      );
    }

    var fieldsHeading =
      def.kind === 'EnumType'
        ? t('model.values')
        : def.kind === 'UnionType'
          ? t('model.types')
          : def.kind === 'SimpleType'
            ? t('model.properties')
            : t('model.fields');
    main.appendChild(
      el('div', { class: 'section' }, [el('h2', {}, [fieldsHeading]), renderTypeTree(doc, typeName)]),
    );

    var typeExamplesNode = renderTypeExamples(doc, def.examples);
    if (typeExamplesNode) {
      main.appendChild(el('div', { class: 'section' }, [el('h2', {}, [t('model.examples')]), typeExamplesNode]));
    }

    if (def.kind === 'ComplexType' || def.kind === 'MappedType' || def.kind === 'MixinType') {
      main.appendChild(renderExampleBlock(doc, typeName));
    }
  }

  // ---------- sidebar ----------

  function buildSidebar(nav, docKey, doc) {
    clear(nav);
    var filterValue = ((document.getElementById('opra-sidebar-filter') || {}).value || '').toLowerCase();
    // `null` (not just falsy) when nothing's selected, so every check
    // below reads the same as `filterValue`'s own "empty means no
    // filter" convention rather than a subtly different truthy/length
    // check at each call site.
    var methodFilter = state.methodFilter && state.methodFilter.length ? state.methodFilter : null;
    // Persisted across rebuilds (search, navigation) for the life of the
    // page — which controller folders the user has collapsed. A search in
    // progress always shows the full (matching) tree, ignoring collapse.
    var collapsedNav = state.collapsedNav || (state.collapsedNav = {});

    // Separate from `collapsedNav` above (which nests one controller
    // folder under another via route prefixes) — these key top-level
    // sections instead ("controllers", "models", "kind:ComplexType", ...),
    // which have no route of their own to prefix-match against. Same
    // "ignore collapse while a search is in progress" rule applies, so a
    // matching result is never hidden behind a section the user happened
    // to have closed earlier.
    var collapsedGroups = state.collapsedGroups || (state.collapsedGroups = {});
    function groupCollapsed(key) {
      return !filterValue && !!collapsedGroups[key];
    }
    // Which section the *current page* falls under — Docusaurus only
    // accent-colors a category's own title when the active page is
    // inside it, rather than every category title all the time.
    var activeRoute = parseHash().rest;
    var activeInCtl = activeRoute[0] === 'ctl';
    var activeInModels = activeRoute[0] === 'model';
    var activeModelKind = activeInModels && doc.types && doc.types[activeRoute[1]] ? doc.types[activeRoute[1]].kind : null;

    // The document's own root page (title, version, description, a
    // one-line content summary — see `renderOverviewPage`) — first item
    // in the nav, above Controllers/Models, so it's always reachable
    // rather than only implicitly at "wherever the hash happens to be
    // empty". Styled like a category title (bold, uppercase — see
    // `.sidebar a.nav-doc-info` in CSS) since it represents the document
    // itself, same rank as "Controllers"/"Models" — but no icon, and no
    // chevron since it's a plain link with nothing to collapse. A bare
    // sibling rather than wrapped in its own `.group`, so `Controllers`'
    // own divider (below) reads as the boundary of the *first* section,
    // consistent with the one between `Controllers` and `Models`, rather
    // than this needing a second, redundant one right above it too.
    if (!filterValue) {
      nav.appendChild(
        el('a', { class: 'nav-link nav-doc-info' + (!activeRoute.length ? ' active' : ''), href: hrefFor(docKey, '') }, [
          el('span', { class: 'name' }, [t('sidebar.overview')]),
        ]),
      );
    }

    // Wraps `children` in an animated collapse/expand container: the
    // outer `.nav-children` is the CSS-grid-rows trick (`1fr` expanded,
    // `0fr` collapsed, transitioned) and the inner `.nav-children-inner`
    // is what actually clips the content as that row shrinks (a grid
    // item's automatic min-height would otherwise refuse to shrink below
    // its content's size — `min-height: 0` on that inner div, in CSS, is
    // what overrides it). Children stay in the DOM either way, which is
    // what makes the collapse animatable at all — the previous approach
    // (skip building collapsed subtrees outright) had nothing to
    // transition since there was nothing there to shrink.
    function collapseWrap(children, collapsed) {
      return el('div', { class: 'nav-children' + (collapsed ? ' collapsed' : '') }, [
        el('div', { class: 'nav-children-inner' }, children),
      ]);
    }

    // A top-level group ("Controllers"/"Models") or a Models kind
    // sub-heading: a clickable title paired with its own `collapseWrap`.
    // Toggling flips `collapsedGroups[key]` and updates the title's
    // chevron and the wrap's classes *directly on these same DOM nodes*,
    // rather than calling `buildSidebar` again — an animated CSS
    // transition needs an existing element whose class changes, not a
    // freshly-built replacement that starts life already in its target
    // state with nothing to transition from (which is what re-invoking
    // buildSidebar on every click amounted to). Returns `{title, wrap}`
    // so the caller places each in the right spot in the group's markup.
    function buildCollapsibleSection(cls, label, key, isActiveSection, children) {
      var collapsed = groupCollapsed(key);
      var wrap = collapseWrap(children, collapsed);
      var chevron = iconFor('chevronDown', 'group-chevron' + (collapsed ? ' collapsed' : ''));
      var title = el(
        'div',
        {
          class: cls + (isActiveSection ? ' title-active' : ''),
          onClick: function (e) {
            e.preventDefault();
            collapsedGroups[key] = !collapsedGroups[key];
            saveCollapsedState();
            var nowCollapsed = groupCollapsed(key);
            wrap.classList.toggle('collapsed', nowCollapsed);
            chevron.classList.toggle('collapsed', nowCollapsed);
          },
        },
        // Label first, chevron last (pushed to the row's far end by
        // `.group-chevron`'s own `margin-left: auto`) — Docusaurus puts a
        // category's collapse arrow at the right of the row, not
        // leading the label.
        [label, chevron],
      );
      return { title: title, wrap: wrap };
    }

    // Builds one controller level's rows (folder links, each followed by
    // its own animated `collapseWrap` of operations/sub-folders) and
    // recurses for nested controllers — replaces the old
    // `walkControllers`-driven flat append, which relied on skipping a
    // collapsed folder's descendants outright rather than something that
    // could stay in the DOM and animate shut.
    function buildControllerNodes(controllers, parentPath, parentRoute, depth) {
      var nodes = [];
      Object.keys(controllers).forEach(function (name) {
        var ctrl = controllers[name];
        var path = controllerPath(ctrl, parentPath);
        var route = parentRoute + '/' + encodeURIComponent(name);
        var hay = (name + ' ' + path + ' ' + (ctrl.description || '')).toLowerCase();
        if (filterValue && hay.indexOf(filterValue) === -1 && !hasMatchingDescendant(ctrl, filterValue)) return;
        // Unlike the text filter above, a method filter never matches the
        // *folder* itself (a controller has no "method" of its own) — a
        // folder only stays once at least one of its own descendant
        // operations actually uses one of the selected methods, or it
        // would render as an empty heading with nothing under it.
        if (methodFilter && !hasMatchingDescendantMethod(ctrl, methodFilter)) return;
        anyCtrl = true;

        var childNodes = [];
        if (ctrl.operations) {
          Object.keys(ctrl.operations).forEach(function (opKey) {
            var op = ctrl.operations[opKey];
            // Only the operation's *own* incremental path segment (if
            // any) — not `operationPath`'s fully-resolved absolute path,
            // which is mostly just the parent controller's own path
            // repeated verbatim. Including that inherited path here made
            // searching e.g. "customer" surface every single operation
            // under a `Customers@{customerId}`-style controller
            // (`setStatus`, `delete`, `update`, even ones nested further
            // down under `Notes`) regardless of what the operation
            // itself is actually called — the controller's own `hay`
            // check a few lines up (plus `hasMatchingDescendant`) is
            // already what decides whether that folder belongs in a
            // filtered tree at all.
            var opHay = (opKey + ' ' + (op.title || '') + ' ' + op.method + ' ' + (op.path || '')).toLowerCase();
            if (filterValue && opHay.indexOf(filterValue) === -1) return;
            if (methodFilter && methodFilter.indexOf(op.method) === -1) return;
            var opRoute = route + '/' + encodeURIComponent(opKey);
            anyCtrl = true;
            childNodes.push(
              // No leading icon here — the colored method badge on the
              // right already identifies the row, and a generic "play"
              // triangle in front of every operation read as its own
              // clickable "run" affordance rather than a type marker.
              el('a', { class: 'nav-link nav-op depth-' + (depth + 1), href: hrefFor(docKey, opRoute) }, [
                opNameNode(op, opKey, null, filterValue),
                methodBadge(op.method),
              ]),
            );
          });
        }
        if (ctrl.controllers) {
          childNodes = childNodes.concat(buildControllerNodes(ctrl.controllers, path, route, depth + 1));
        }

        var hasChildren = childNodes.length > 0;
        // Ignoring collapse while a search is in progress (same rule as
        // `groupCollapsed`) so a matching result is never hidden behind
        // a folder the user happened to have closed earlier.
        var isCollapsed = !filterValue && !!collapsedNav[route];
        var wrap = hasChildren ? collapseWrap(childNodes, isCollapsed) : null;
        // Trailing, not leading (Docusaurus puts a category's collapse
        // arrow at the right of the row) — pushed there by
        // `.nav-toggle`'s own `margin-left: auto`; a childless folder
        // just omits it outright rather than reserving its space with
        // a spacer, since nothing to its right needs to stay aligned.
        // Toggling flips `collapsedNav[route]` and updates `wrap`'s and
        // this span's own classes directly (see `buildCollapsibleSection`
        // for why: re-invoking `buildSidebar` here would replace `wrap`
        // with a freshly-built node already in its target state, with
        // nothing for the CSS transition to animate from).
        var toggle = hasChildren
          ? el(
              'span',
              {
                class: 'nav-toggle' + (isCollapsed ? ' collapsed' : ''),
                onClick: function (e) {
                  e.preventDefault();
                  e.stopPropagation();
                  collapsedNav[route] = !collapsedNav[route];
                  saveCollapsedState();
                  var nowCollapsed = !filterValue && !!collapsedNav[route];
                  wrap.classList.toggle('collapsed', nowCollapsed);
                  toggle.classList.toggle('collapsed', nowCollapsed);
                },
              },
              [iconFor('chevronDown')],
            )
          : null;
        // No folder icon here either — it read as a literal file folder
        // rather than "an API resource group"; the bold weight (see
        // `.sidebar a.nav-ctrl`) is enough to mark it as a category, same
        // as a kind-group title under Models.
        //
        // A first click on a controller not already showing navigates to
        // its own page, same as any other link — but clicking it again
        // once it's already the active page would otherwise do nothing
        // (the hash doesn't change), so that click is repurposed to
        // toggle collapse/expand instead, exactly like the chevron
        // already does (whose own `stopPropagation` keeps this handler
        // from double-firing when *it's* the one clicked).
        var isActiveCtrl = activeRoute.join('/') === route;
        nodes.push(
          el(
            'a',
            {
              class: 'nav-link nav-ctrl depth-' + depth,
              href: hrefFor(docKey, route),
              onClick:
                hasChildren && isActiveCtrl
                  ? function (e) {
                      e.preventDefault();
                      collapsedNav[route] = !collapsedNav[route];
                      saveCollapsedState();
                      var nowCollapsed = !filterValue && !!collapsedNav[route];
                      wrap.classList.toggle('collapsed', nowCollapsed);
                      toggle.classList.toggle('collapsed', nowCollapsed);
                    }
                  : undefined,
            },
            [el('span', { class: 'name mono' }, highlightParts(name, filterValue)), toggle],
          ),
        );
        if (wrap) nodes.push(wrap);
      });
      return nodes;
    }

    // Every operation anywhere in the tree (not just one level), for the
    // "Sections" sidebar view below — a flat list is what lets one operation
    // be bucketed under several of its own `sections` at once, unlike
    // `buildControllerNodes`'s walk, which builds one nested DOM tree
    // mirroring the *controller* structure exactly once.
    function collectAllOperations(ctrls, parentRoute) {
      var out = [];
      Object.keys(ctrls).forEach(function (name) {
        var ctrl = ctrls[name];
        var route = parentRoute + '/' + encodeURIComponent(name);
        if (ctrl.operations) {
          Object.keys(ctrl.operations).forEach(function (opKey) {
            out.push({
              opKey: opKey,
              // The declaring controller's name, so an operation with no
              // `title` can still be told apart from a same-named one under
              // another controller once this flat list mixes them together.
              ctrlName: name,
              op: ctrl.operations[opKey],
              route: route + '/' + encodeURIComponent(opKey),
            });
          });
        }
        if (ctrl.controllers) {
          out = out.concat(collectAllOperations(ctrl.controllers, route));
        }
      });
      return out;
    }

    // "Sections" mode: one top-level section per `doc.api.sections` entry
    // (in declaration order — same reasoning as `servers[0]` being "the"
    // default server), plus any section name an operation references but
    // that isn't declared (rendered too, just without a description/icon),
    // then a final "Ungrouped" section for anything with no `sections` at
    // all — never omitted outright, so an operation is always reachable
    // from this view even if nobody bothered to categorize it yet. An
    // operation listed in more than one section is simply repeated under
    // each, matching how OpenAPI's own multi-tag operations are shown by
    // every tool that renders them.
    function buildSectionsNav(ctrls) {
      var allOps = collectAllOperations(ctrls, 'ctl');
      var bySection = {};
      var ungrouped = [];
      allOps.forEach(function (entry) {
        // Only the operation's own incremental path segment, not the
        // fully-resolved absolute path — see the matching comment in
        // `buildControllerNodes` for why (the inherited parent path
        // otherwise makes every operation under, say, a
        // `Customers@{customerId}` controller match "customer" regardless
        // of the operation's own name).
        var opHay = (
          entry.opKey + ' ' + (entry.op.title || '') + ' ' + entry.op.method + ' ' + (entry.op.path || '')
        ).toLowerCase();
        entry.matches =
          (!filterValue || opHay.indexOf(filterValue) !== -1) &&
          (!methodFilter || methodFilter.indexOf(entry.op.method) !== -1);
        if (entry.op.sections && entry.op.sections.length) {
          entry.op.sections.forEach(function (g) {
            (bySection[g] = bySection[g] || []).push(entry);
          });
        } else {
          ungrouped.push(entry);
        }
      });

      function opRow(entry) {
        return el('a', { class: 'nav-link nav-op depth-1', href: hrefFor(docKey, entry.route) }, [
          opTitleNode(entry.op, entry.ctrlName + '.' + entry.opKey, null, filterValue),
          methodBadge(entry.op.method),
        ]);
      }

      var declared = (doc.api && doc.api.sections) || [];
      var declaredNames = declared.map(function (g) {
        return g.name;
      });
      var extra = Object.keys(bySection)
        .filter(function (n) {
          return declaredNames.indexOf(n) === -1;
        })
        .map(function (n) {
          return { name: n };
        });
      var anyShown = false;
      declared.concat(extra).forEach(function (g) {
        var entries = (bySection[g.name] || []).filter(function (e) {
          return e.matches;
        });
        if (!entries.length) return;
        anyShown = true;
        var label = g.icon ? el('span', {}, [el('span', { class: 'group-icon' }, [g.icon]), ' ' + g.name]) : g.name;
        var key = 'group:' + g.name;
        var section = buildCollapsibleSection('group-title', label, key, false, entries.map(opRow));
        nav.appendChild(el('div', { class: 'group' }, [section.title, section.wrap]));
      });
      var ungroupedEntries = ungrouped.filter(function (e) {
        return e.matches;
      });
      if (ungroupedEntries.length) {
        anyShown = true;
        var ungroupedSection = buildCollapsibleSection(
          'group-title',
          t('sidebar.ungrouped'),
          'group:__ungrouped__',
          false,
          ungroupedEntries.map(opRow),
        );
        nav.appendChild(el('div', { class: 'group' }, [ungroupedSection.title, ungroupedSection.wrap]));
      }
      if (!anyShown && allOps.length) {
        var emptyTitle = buildCollapsibleSection('group-title', t('sidebar.sections'), 'sections', false, [
          el('div', { class: 'empty-note' }, [t('sidebar.noMatches')]),
        ]);
        nav.appendChild(el('div', { class: 'group' }, [emptyTitle.title, emptyTitle.wrap]));
      }
    }

    var controllers = (doc.api && doc.api.controllers) || {};
    if (state.groupBy === 'sections' && doc.api && doc.api.sections && doc.api.sections.length) {
      buildSectionsNav(controllers);
    } else {
      var anyCtrl = false;
      var ctlChildNodes = buildControllerNodes(controllers, '', 'ctl', 0);
      if (!anyCtrl) {
        // No controllers in this document at all (e.g. a models-only
        // reference doc) — omit the section entirely rather than showing an
        // empty "Controllers" heading. A search that filtered every result
        // out still gets a "No matches." note, since there's something to
        // say there.
        if (Object.keys(controllers).length) {
          var ctlEmptyTitle = buildCollapsibleSection('group-title', t('sidebar.controllers'), 'controllers', activeInCtl, [
            el('div', { class: 'empty-note' }, [t('sidebar.noMatches')]),
          ]);
          nav.appendChild(el('div', { class: 'group' }, [ctlEmptyTitle.title, ctlEmptyTitle.wrap]));
        }
      } else {
        var ctlSection = buildCollapsibleSection('group-title', t('sidebar.controllers'), 'controllers', activeInCtl, ctlChildNodes);
        nav.appendChild(el('div', { class: 'group' }, [ctlSection.title, ctlSection.wrap]));
      }
    }

    // The "Models" nav lists only the document's own declared types (what
    // it was actually given via `types: [...]`) — not every type reached
    // incidentally while walking controllers/operations above (e.g. a
    // field's type), which remain reachable by following a reference but
    // aren't advertised as one of this document's own models.
    var types = doc.types || {};
    var declaredNames = doc.declaredTypes || Object.keys(types);
    var modelKindFilter =
      state.modelKindFilter && state.modelKindFilter.length ? state.modelKindFilter : null;
    var byKind = {};
    declaredNames.forEach(function (name) {
      if (!types[name]) return;
      if (filterValue && name.toLowerCase().indexOf(filterValue) === -1) return;
      var kind = types[name].kind;
      if (modelKindFilter && modelKindFilter.indexOf(kind) === -1) return;
      (byKind[kind] = byKind[kind] || []).push(name);
    });
    var kinds = Object.keys(byKind);
    if (kinds.length) {
      var modelBody = [];
      TYPE_GROUP_ORDER.concat(kinds.filter(function (k) { return TYPE_GROUP_ORDER.indexOf(k) === -1; })).forEach(
        function (kind) {
          if (!byKind[kind]) return;
          var kindKey = 'kind:' + kind;
          var kindLinks = byKind[kind].sort().map(function (name) {
            return el('a', { class: 'nav-link nav-model', href: hrefFor(docKey, 'model/' + encodeURIComponent(name)) }, [
              iconFor(dataTypeIconKind(kind), 'c-' + dataTypeIconKind(kind)),
              el('span', { class: 'name mono' }, highlightParts(name, filterValue)),
            ]);
          });
          var kindSection = buildCollapsibleSection(
            'kind-title',
            dataTypeGroupLabel(kind),
            kindKey,
            activeModelKind === kind,
            kindLinks,
          );
          modelBody.push(kindSection.title, kindSection.wrap);
        },
      );
      var modelsSection = buildCollapsibleSection('group-title', t('sidebar.models'), 'models', activeInModels, modelBody);
      nav.appendChild(el('div', { class: 'group' }, [modelsSection.title, modelsSection.wrap]));
    }
  }

  function hasMatchingDescendant(ctrl, filterValue) {
    var found = false;
    if (ctrl.operations) {
      Object.keys(ctrl.operations).forEach(function (opKey) {
        if (opKey.toLowerCase().indexOf(filterValue) !== -1) found = true;
      });
    }
    if (!found && ctrl.controllers) {
      Object.keys(ctrl.controllers).forEach(function (name) {
        if (name.toLowerCase().indexOf(filterValue) !== -1 || hasMatchingDescendant(ctrl.controllers[name], filterValue)) {
          found = true;
        }
      });
    }
    return found;
  }

  /** Same recursive shape as `hasMatchingDescendant`, for the method
   *  filter instead of the text one — whether any operation anywhere
   *  under `ctrl` uses one of `methods`. */
  function hasMatchingDescendantMethod(ctrl, methods) {
    var found = false;
    if (ctrl.operations) {
      Object.keys(ctrl.operations).forEach(function (opKey) {
        if (methods.indexOf(ctrl.operations[opKey].method) !== -1) found = true;
      });
    }
    if (!found && ctrl.controllers) {
      Object.keys(ctrl.controllers).forEach(function (name) {
        if (hasMatchingDescendantMethod(ctrl.controllers[name], methods)) found = true;
      });
    }
    return found;
  }

  /** `'#/ref/root/...'` and bare `'#/...'` both resolve to the root
   *  document (see `parseHash`) — a link and the live location can each
   *  use either form for the exact same page (the header logo's `href`
   *  is always the explicit `ref/root/` form, on purpose — see its own
   *  comment in `init` — while every sidebar link for the root document
   *  is bare) — collapsing both down to one canonical spelling is what
   *  lets `highlightActive` compare them by plain string equality. */
  function normalizeHash(hash) {
    return hash.replace(/^#\/ref\/root\/?/, '#/');
  }

  function highlightActive(nav) {
    var hash = normalizeHash(location.hash || '#/');
    Array.prototype.forEach.call(nav.querySelectorAll('a.nav-link'), function (a) {
      a.classList.toggle('active', normalizeHash(a.getAttribute('href') || '') === hash);
    });
  }

  // ---------- document switcher ----------

  var openPickerMenu = null;

  document.addEventListener('click', function () {
    if (openPickerMenu) openPickerMenu.hidden = true;
  });

  function docTitle(docKey) {
    var doc = docs[docKey];
    return (doc && doc.info && doc.info.title) || docKey;
  }

  function buildPicker(container) {
    clear(container);
    // The *active* document's own version — this chip sits right next to
    // its title now (it used to live on its own over in `.header-right`,
    // always showing root's version regardless of which document was
    // open — see `init()`'s history — which stopped making sense once the
    // two were merged into one control: a reference doc's own title next
    // to root's version would just be two unrelated facts glued together). */
    var activeDoc = docs[state.docKey];
    var activeVersion = activeDoc && activeDoc.info && activeDoc.info.version;
    var current = el('div', { class: 'picker', id: 'opra-picker-btn' }, [
      iconFor('book'),
      el('span', { class: 'picker-label' }, [docTitle(state.docKey)]),
      activeVersion ? el('span', { class: 'header-version' }, [t('common.versionTag', { version: activeVersion })]) : null,
      iconFor('chevronDown'),
    ]);
    container.appendChild(current);

    var refKeys = Object.keys(docs).filter(function (k) {
      return k !== 'root';
    });
    if (!refKeys.length) return; // nothing to switch to — plain, non-interactive label

    var menu = el('div', { class: 'picker-menu', id: 'opra-picker-menu' });
    menu.hidden = true;
    menu.appendChild(el('div', { class: 'group-label' }, [t('header.thisDocument')]));
    var rootInfo = docs.root.info || {};
    menu.appendChild(
      pickerItem('root', rootInfo.title || 'root', 'root' + (rootInfo.version ? ' · v' + rootInfo.version : '')),
    );
    menu.appendChild(el('div', { class: 'group-label' }, [t('header.references')]));
    refKeys.forEach(function (ns) {
      var info = docs[ns].info || {};
      menu.appendChild(pickerItem(ns, info.title || ns, ns + (info.version ? ' · v' + info.version : '')));
    });
    container.appendChild(menu);

    current.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = !menu.hidden;
      openPickerMenu = menu.hidden ? null : menu;
    });
  }

  function pickerItem(key, title, sub) {
    var item = el('div', { class: 'picker-item' + (key === state.docKey ? ' sel' : '') }, [
      el('span', { class: 't' }, [title]),
      el('span', { class: 's' }, [sub]),
    ]);
    item.addEventListener('click', function (ev) {
      ev.stopPropagation();
      // `stopPropagation` above means the document-level "click anywhere
      // closes the open menu" handler never runs for this click — close
      // it explicitly instead, or picking an item would leave the menu
      // sitting open over the page it just navigated to.
      if (openPickerMenu) {
        openPickerMenu.hidden = true;
        openPickerMenu = null;
      }
      if (key === state.docKey) return;
      // Switching *to* "root" produces a bare hash (`hrefFor('root', '')`
      // is just `'#/'`, no `ref/` prefix — see `routePrefix`) that's
      // indistinguishable from a same-document relative link, and
      // `parseHash`'s fallback for that case resolves against
      // `state.docKey` — which, without this, is still the *previous*
      // document until `render()` gets around to updating it. Setting it
      // here first means that fallback already sees the right answer by
      // the time `hashchange` fires `render()`.
      state.docKey = key;
      location.hash = hrefFor(key, '');
    });
    return item;
  }

  // ---------- router ----------

  /** A bare `#/model/X` (no `ref/<ns>/` prefix) resolves relative to
   *  whichever document is currently active — so a markdown link written
   *  inside a description stays within the document it was authored in,
   *  whether that document is mounted as root or as someone's reference. */
  function parseHash() {
    var hash = location.hash.replace(/^#\/?/, '');
    var parts = hash.split('/').filter(Boolean);
    if (parts[0] === 'ref' && parts[1]) {
      return { docKey: decodeURIComponent(parts[1]), rest: parts.slice(2) };
    }
    return { docKey: state.docKey, rest: parts };
  }

  function render() {
    hideTypeTooltipNow();
    var parsed = parseHash();
    var main = document.getElementById('opra-main');
    var nav = document.getElementById('opra-nav');
    var picker = document.getElementById('opra-picker');

    // `.page-rows` holds one or two independent flex rows (see styles.css's
    // own comment on `.page-row`): row 1 is always `contentTop` (title,
    // parameters, and the Request section — body or not) + its own
    // rail-col (`railCol`), which stacks `toc` and `railExample` together
    // — the Request rail covers every operation now, not just ones with a
    // request body, and stacking it with `toc` (rather than giving it a
    // separate row keyed to the "Request body" section, which doesn't
    // exist for a bodyless operation) is what lets the alignment step
    // below line it up with whichever heading is actually first, instead
    // of leaving a dead gap when there's nothing to size a second row from.
    // Row 2, `contentResponses` + its own rail (`railResponseExample`),
    // only for one with documented responses, follows immediately after
    // row 1 and is kept in its OWN row (not folded into `railCol` too) so
    // its sticky range stays bounded to just that row — see `.rail-col`'s
    // own CSS comment for why sharing one column across sections that can
    // each be arbitrarily long made rails stick at the same offset and
    // pile on top of each other instead of handing off. Every other page
    // renders solely into `contentTop`, a single row with no `railExample`.
    // `pageWrap` is what `buildToc` scans for section headings, across
    // every row `pageRows` ends up with.
    clear(main);
    var contentTop = el('div', { class: 'content-col content-top' });
    var toc = el('div', { class: 'toc' });
    var railCol = el('div', { class: 'rail-col' }, [toc]);
    var pageRows = el('div', { class: 'page-rows' }, [el('div', { class: 'page-row' }, [contentTop, railCol])]);
    var pageWrap = el('div', {}, [pageRows]);
    main.appendChild(pageWrap);

    var doc = docs[parsed.docKey];
    if (!doc) {
      contentTop.appendChild(el('div', { class: 'empty-note' }, [t('router.unknownDocument', { key: parsed.docKey })]));
      buildToc(pageWrap, toc);
      return;
    }
    state.docKey = parsed.docKey;
    // A document with no declared `api.sections` has nothing for "View
    // Options" to switch to — hide the button entirely rather than
    // offering a "Sections" option that would just render an empty
    // section. This document falls back to showing "API Structure"
    // regardless (see `buildSidebar`'s own `state.groupBy === 'sections'`
    // check, which already re-verifies `doc.api.sections` itself) — but
    // `state.groupBy` itself, the user's actual *preference*, is left
    // untouched here rather than overwritten to `'structure'`: it used to
    // be, which meant switching to this document and back to one that
    // *does* have sections silently lost "Sections" and left the user
    // re-picking it by hand every time they crossed a document with
    // nothing to section.
    var groupByBtn = document.getElementById('opra-groupby-btn');
    var hasSections = !!(doc.api && doc.api.sections && doc.api.sections.length);
    groupByBtn.hidden = !hasSections;
    // `state.groupBy` starts out `undefined` (never explicitly initialized
    // — see `state`'s own declaration) rather than the string `'structure'`
    // itself, so comparisons against it need this same fallback wherever
    // "structure" is checked, or the very first render would leave neither
    // item's `.sel`/checkmark showing at all. Falls back to "structure"
    // outright (regardless of the stored preference) whenever the active
    // document has nothing to section — reflecting what's actually on
    // screen for *this* document, without touching the preference itself.
    var effectiveGroupBy = hasSections ? state.groupBy || 'structure' : 'structure';
    ['structure', 'sections'].forEach(function (key) {
      var item = document.getElementById('opra-groupby-item-' + key);
      if (item) item.classList.toggle('sel', effectiveGroupBy === key);
    });
    // The OpenAPI schema option only makes sense for a document that
    // actually has an HTTP api (a types-only reference document, e.g.
    // "Customer Models Document", has none) — the native Opra Schema
    // option stays available regardless.
    var hasHttpApi = !!(doc.api && doc.api.transport === 'http');
    var viewOpenapiItem = document.getElementById('opra-view-openapi');
    if (viewOpenapiItem) viewOpenapiItem.hidden = !hasHttpApi;
    // The generated client is an HTTP client — same "nothing to map"
    // reasoning as the OpenAPI item just above, so it's hidden for the
    // same types-only documents.
    var viewTsClientItem = document.getElementById('opra-view-tsclient');
    if (viewTsClientItem) viewTsClientItem.hidden = !hasHttpApi;
    var tsClientLabel = document.getElementById('opra-view-tsclient-label');
    if (tsClientLabel) tsClientLabel.hidden = !hasHttpApi;
    buildSidebar(nav, state.docKey, doc);
    buildPicker(picker);
    highlightActive(nav);

    var rest = parsed.rest;
    var handled = false;
    var needsRailAlign = false;
    if (!rest.length) {
      renderOverviewPage(contentTop, doc);
      handled = true;
    } else if (rest[0] === 'model' && rest[1]) {
      renderModelPage(contentTop, doc, decodeURIComponent(rest[1]));
      handled = true;
    } else if (rest[0] === 'ctl') {
      var op = findOperationByRoute(doc, rest.join('/'));
      if (op) {
        // `toc` moves into its own wrapper here (rather than staying a
        // direct `railCol` child, as it is for every other page) so its
        // *own* sticky range can be bounded to just its own segment of row
        // 1 — see the alignment step below for why, and `.rail-col`'s own
        // CSS comment for the mechanics.
        var tocWrap = el('div', { class: 'toc-wrap' }, []);
        railCol.insertBefore(tocWrap, toc);
        tocWrap.appendChild(toc);
        var railExample = el('div', { class: 'rail-example' });
        railCol.appendChild(railExample);
        var contentResponses = contentTop;
        var railResponseExample = null;
        if (op.op.responses && op.op.responses.length) {
          contentResponses = el('div', { class: 'content-col content-responses' });
          railResponseExample = el('div', { class: 'rail-example' });
          pageRows.appendChild(el('div', { class: 'page-row' }, [contentResponses, el('div', { class: 'rail-col' }, [railResponseExample])]));
        }
        renderOperationPage(contentTop, contentResponses, state.docKey, doc, op, railExample, railResponseExample);
        handled = true;
        needsRailAlign = true;
      } else {
        var ctl = findControllerByRoute(doc, rest.join('/'));
        if (ctl) {
          renderControllerPage(contentTop, state.docKey, doc, ctl, rest.join('/'));
          handled = true;
        }
      }
    }
    if (!handled) {
      contentTop.appendChild(el('div', { class: 'empty-note' }, [t('router.pageNotFound')]));
    }
    buildToc(pageWrap, toc);
    // Bound `tocWrap`'s height to the distance between row 1's top and
    // `contentTop`'s first `h2` (whichever section actually comes first —
    // Path/Query/Header parameters, or "Request body" itself when there
    // are none), rather than leaving it to shrink-wrap `toc`'s own
    // (usually much shorter) natural height: `toc`'s sticky range is
    // bounded by its own containing block, which is now `tocWrap` instead
    // of the full-height `railCol` every other rail element uses — so
    // sizing that wrapper to end exactly where `railExample` begins is
    // what makes `toc` un-stick and scroll away right as `railExample`
    // arrives to take its place, instead of `toc` staying frozen in place
    // (bound by all of `railCol`, which spans the entire row) while
    // `railExample` slides up and simply paints over whatever of `toc` it
    // reaches. This has to run after `buildToc` (not right after
    // `renderOperationPage`) since `buildToc` is what actually fills `toc`
    // with its heading links — measuring its height any earlier would
    // catch it still empty and undershoot. Reading the heading's real
    // rendered offset is the only way to get this right — the two columns
    // have no shared content to align them via CSS alone.
    if (needsRailAlign) {
      var firstHeading = contentTop.querySelector('h2');
      if (firstHeading) {
        var headingOffset = firstHeading.getBoundingClientRect().top - contentTop.getBoundingClientRect().top;
        var tocGap = parseFloat(getComputedStyle(railCol).rowGap) || 0;
        var tocHeight = toc.getBoundingClientRect().height;
        tocWrap.style.height = Math.max(tocHeight, headingOffset - tocGap) + 'px';
      }
    }
  }

  var tocScrollHandler = null;

  /** Populates the "on this page" rail (a fresh `.toc` element built
   *  alongside `container` for this render — see `render()`) from the page
   *  that was just rendered into `container` (`.page-rows`, spanning every
   *  content cell — an operation page splits its own content across up to
   *  three of them, see `renderOperationPage`, so this can't just scan
   *  one): one entry per `h2` section heading
   *  (Description/Fields/Examples/...), in document order. Clicking an
   *  entry scrolls straight to its heading via `scrollIntoView` rather
   *  than an `href="#..."` anchor, since `location.hash` is this app's own
   *  routing signal (see `parseHash`) and setting it to a heading name
   *  would be read as a navigation, not a same-page scroll. The entry
   *  nearest the top of the reading pane is kept highlighted by a scroll
   *  listener on `.main`, torn down before every rebuild so listeners
   *  don't pile up across page changes on the same DOM node. */
  function buildToc(container, toc) {
    var main = document.getElementById('opra-main');
    if (tocScrollHandler) {
      main.removeEventListener('scroll', tocScrollHandler);
      tocScrollHandler = null;
    }
    var headings = Array.prototype.slice.call(container.querySelectorAll('h2'));
    if (!headings.length) {
      toc.appendChild(el('div', { class: 'toc-empty' }, [t('toc.noSections')]));
      return;
    }
    toc.appendChild(el('div', { class: 'toc-title' }, [t('toc.onThisPage')]));
    var list = el('div', { class: 'toc-list' });
    function setActive(i) {
      links.forEach(function (l, j) {
        l.classList.toggle('active', j === i);
      });
    }
    var links = headings.map(function (h, i) {
      var link = el('div', { class: 'toc-link' }, [h.textContent]);
      link.addEventListener('click', function () {
        h.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Mark active immediately rather than waiting on the `scroll`
        // listener below to catch up with wherever `scrollIntoView`
        // lands — on a page short enough that everything already fits in
        // view (e.g. a small SimpleType like Country) there is no scroll
        // to wait for at all (see `hasOverflow` below).
        setActive(i);
      });
      list.appendChild(link);
      return link;
    });
    toc.appendChild(list);
    setActive(0);

    // A page with no scrollable overflow (content fits the viewport
    // outright) never fires a `scroll` event, so there is nothing for a
    // scroll-driven scrollspy to key off — leave the active entry
    // click-driven only, rather than have it computed from a `scrollTop`
    // that can't move. Attaching the listener anyway used to actively
    // fight the click handler above: a `scrollIntoView` call that has
    // nowhere to scroll can still emit a same-position `scroll` event,
    // which would immediately recompute and stomp the just-clicked entry.
    if (main.scrollHeight <= main.clientHeight + 4) return;

    tocScrollHandler = function () {
      // Once scrolled (at least near) to the bottom, force the *last*
      // heading active outright — the final section (often "Example")
      // may not have enough trailing content below it to ever be
      // scrolled up to within the same-heading threshold used otherwise,
      // which would leave it unreachable/never-active even while it's
      // the very thing on screen at max scroll.
      var atBottom = main.scrollTop + main.clientHeight >= main.scrollHeight - 4;
      if (atBottom) {
        setActive(headings.length - 1);
        return;
      }
      var mainTop = main.getBoundingClientRect().top;
      var active = 0;
      for (var i = 0; i < headings.length; i++) {
        if (headings[i].getBoundingClientRect().top - mainTop <= 32) active = i;
      }
      setActive(active);
    };
    main.addEventListener('scroll', tocScrollHandler);
    tocScrollHandler();
  }

  // ---------- app shell ----------

  /** "⌘K" on a Mac, "Ctrl K" elsewhere — shown in the search box (see
   *  `init`) and must stay truthful: the same keys actually focus it,
   *  via the `keydown` listener registered in `init`. */
  function kbdShortcutLabel() {
    var isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
    return isMac ? '⌘K' : 'Ctrl K';
  }

  function currentTheme() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  }

  /** A globe with meridians — the conventional "choose a language" mark,
   *  drawn at the same 20px/1.5-stroke weight as the theme toggle's own
   *  contrast circle so the two round buttons sit together evenly. */
  var LANGUAGE_ICON =
    '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5">' +
    '<circle cx="10" cy="10" r="7.25"/>' +
    '<path d="M2.75 10h14.5"/>' +
    '<path d="M10 2.75c2 2.2 3 4.6 3 7.25s-1 5.05-3 7.25c-2-2.2-3-4.6-3-7.25s1-5.05 3-7.25Z"/>' +
    '</svg>';

  var THEME_TOGGLE_ICON =
    '<svg viewBox="0 0 20 20" width="20" height="20"><circle cx="10" cy="10" r="7.25" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M10 2.75a7.25 7.25 0 0 1 0 14.5Z" fill="currentColor"/></svg>';

  /** A dark/light contrast-circle button — persists the choice to
   *  `localStorage` (read back at the very top of this file, before
   *  anything else runs, so a later visit doesn't flash the server's
   *  default theme first) and flips `data-theme` on `<html>` directly,
   *  same attribute the server sets from `ApiUiOptions.theme`. */
  function themeToggleButton() {
    return el('button', {
      class: 'theme-toggle',
      type: 'button',
      title: t('header.toggleTheme'),
      html: THEME_TOGGLE_ICON,
      onClick: function () {
        var next = currentTheme() === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        try {
          localStorage.setItem('opra-ui-theme', next);
        } catch (e) {
          // Storage can be unavailable (private browsing, disabled site
          // data) — the toggle still works for this page load either way.
        }
      },
    });
  }

  /** A `.picker-menu` dropdown (the same look/behavior as the document
   *  picker and "Export" right next to it — `.header-export-btn`'s
   *  own trigger style, a `.groupby-item`-shaped row with a checkmark for
   *  the active one, same `openPickerMenu` single-open bookkeeping)
   *  switching which *scope* of the document is being viewed (see
   *  `ApiUiOptions.scopes`/`scope`) — `null` whenever the server didn't
   *  embed a `ui.scopes` list at all (a single fixed scope has nothing to
   *  switch between). A native `<select>` was tried first here, but its
   *  own browser-drawn open-dropdown chrome looks nothing like every
   *  other menu in this header — this reuses the exact same building
   *  blocks as those instead of introducing a second visual language.
   *  Unlike the theme toggle above or the sidebar's own Group By (both
   *  pure client-side state), picking a scope is a *real navigation*:
   *  each scope is its own server-rendered page — see `expressApiUi`'s
   *  `/{scope}` routing — since two scopes of the same OPRA document can
   *  expose genuinely different fields/types, not just a filtered view of
   *  one fixed rendering. `location.hash` is preserved across the reload,
   *  so switching scope keeps you on the same operation/model page, now
   *  viewed under the new scope — exactly the point of comparing the two. */
  function scopeSelector(ui) {
    if (!ui.scopes || ui.scopes.length < 2) return null;
    var btn = el('button', { class: 'header-export-btn', type: 'button', title: t('header.scope') }, [
      el('span', {}, [t('header.scopeActive', { scope: ui.scope || '' })]),
      iconFor('chevronDown'),
    ]);
    var menu = el('div', { class: 'picker-menu header-scope-menu' });
    menu.hidden = true;
    ui.scopes.forEach(function (s) {
      var item = el('div', { class: 'picker-item groupby-item' + (s === ui.scope ? ' sel' : '') }, [
        el('span', { class: 't' }, [s]),
        iconFor('check', 'groupby-check'),
      ]);
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        menu.hidden = true;
        openPickerMenu = null;
        if (s === ui.scope) return;
        window.location.href = (ui.basePath || '') + '/' + encodeURIComponent(s) + window.location.hash;
      });
      menu.appendChild(item);
    });
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = !menu.hidden;
      openPickerMenu = menu.hidden ? null : menu;
    });
    return el('div', { class: 'header-scope-wrap' }, [btn, menu]);
  }

  /** A language's name written in that language itself ("Türkçe", not
   *  "Turkish") — what a reader looking for their own language scans for.
   *  `Intl.DisplayNames` is built into every browser this app targets, so
   *  no name table ships here; the raw code is the fallback if it ever
   *  can't resolve one. */
  function languageLabel(code) {
    try {
      var names = new Intl.DisplayNames([code], { type: 'language' });
      var name = names.of(code);
      // Capitalized *in that language's own locale* — `toUpperCase()` would
      // turn Turkish "i" into "I" rather than "İ".
      if (name && name !== code) return name.charAt(0).toLocaleUpperCase(code) + name.slice(1);
    } catch (e) {
      // Unknown/invalid tag — fall through to the code itself.
    }
    return code;
  }

  /** The header's language selector: a round icon button (same shape as the
   *  theme toggle beside it) opening the same `.picker-menu` the scope
   *  selector uses. `null` whenever the server embedded fewer than two
   *  languages — nothing to switch between.
   *
   *  The menu is split in two: languages the *document itself* is written
   *  in, and the ones that only localize this interface. Both are worth
   *  offering — an English-only API still reads better with its chrome in
   *  the reader's own language — but they aren't the same promise, so they
   *  don't sit in one undifferentiated list.
   *
   *  Like the scope selector, picking one is a *real navigation*: the page
   *  is rendered (and cached) per language on the server, so this reloads
   *  with `?lang=` set, keeping `location.hash` so the reader stays on the
   *  same operation/model page in their new language. */
  function languageSelector(ui) {
    if (!ui.languages || ui.languages.length < 2) return null;
    var active = UI_LANG;
    var btn = el('button', {
      class: 'lang-toggle',
      type: 'button',
      title: t('header.language', { language: languageLabel(active) }),
      html: LANGUAGE_ICON,
    });
    var menu = el('div', { class: 'picker-menu header-lang-menu' });
    menu.hidden = true;
    var docLanguages = ui.docLanguages || [];
    function isDocLanguage(code) {
      return (
        docLanguages.indexOf(code) !== -1 ||
        docLanguages.some(function (l) {
          return l.toLowerCase() === code.toLowerCase();
        })
      );
    }
    function addItem(code) {
      var item = el('div', { class: 'picker-item groupby-item' + (code === active ? ' sel' : '') }, [
        el('span', { class: 't' }, [languageLabel(code)]),
        el('span', { class: 's lang-code mono' }, [code]),
        iconFor('check', 'groupby-check'),
      ]);
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        menu.hidden = true;
        openPickerMenu = null;
        if (code === active) return;
        var url = new URL(window.location.href);
        url.searchParams.set('lang', code);
        window.location.href = url.toString();
      });
      menu.appendChild(item);
    }
    var translated = ui.languages.filter(isDocLanguage);
    var interfaceOnly = ui.languages.filter(function (code) {
      return !isDocLanguage(code);
    });
    // One flat list when the document isn't translated at all — an
    // "Interface only" heading over every entry says nothing.
    if (translated.length && interfaceOnly.length) {
      menu.appendChild(el('div', { class: 'group-label' }, [t('header.documentLanguages')]));
      translated.forEach(addItem);
      menu.appendChild(el('div', { class: 'group-label' }, [t('header.interfaceOnly')]));
      interfaceOnly.forEach(addItem);
    } else {
      ui.languages.forEach(addItem);
    }
    btn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = !menu.hidden;
      openPickerMenu = menu.hidden ? null : menu;
    });
    return el('div', { class: 'header-lang-wrap' }, [btn, menu]);
  }

  // ---------- schema export ----------

  /** Base URL for this document's server-side export endpoints (see
   *  `expressApiUi` in `express-api-ui.ts`) — always the mount root
   *  (`location.pathname`), since every real navigation in this app goes
   *  through `location.hash` instead; `location.pathname` never changes
   *  regardless of which document/page is currently open. */
  function exportBaseUrl() {
    return location.pathname.replace(/\/+$/, '');
  }

  /** Carries this page's own language (see `window.__OPRA_UI__.lang`, set
   *  server-side from the request's `?lang=`) through to the export
   *  endpoints, so a schema modal or a generated client never comes back in
   *  a different language than the page the reader is looking at. */
  function exportUrl(kind, docKey) {
    var ui = window.__OPRA_UI__ || {};
    var url = exportBaseUrl() + '/' + kind + '/' + encodeURIComponent(docKey) + '.json';
    return ui.lang ? url + '?lang=' + encodeURIComponent(ui.lang) : url;
  }

  function exportFilename(docKey, suffix) {
    var slug = docTitle(docKey)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return (slug || docKey) + '.' + suffix + '.json';
  }

  /** Forces a save-as download of `url` under `filename` — a same-origin
   *  `<a download>` click reliably triggers this in every current browser
   *  regardless of the response's own `Content-Type`/`Content-Disposition`,
   *  so nothing extra is needed server-side beyond serving the JSON. */
  function downloadUrl(url, filename) {
    var a = el('a', { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  var schemaModalOverlay = null;

  function closeSchemaModal() {
    if (!schemaModalOverlay) return;
    schemaModalOverlay.remove();
    schemaModalOverlay = null;
    document.removeEventListener('keydown', onSchemaModalKeydown);
  }

  function onSchemaModalKeydown(ev) {
    if (ev.key === 'Escape') closeSchemaModal();
  }

  /** A small modal showing `kind`'s (`schema`/`openapi`) raw JSON for
   *  the currently active document, syntax-highlighted with the same
   *  `highlightJson` used for every other JSON block in the app — used in
   *  place of just opening the raw endpoint in a new tab (see the export
   *  menu's own "View ..." items below), with the same download action
   *  from the menu repeated in the modal's own header for convenience once
   *  it's already open. */
  /** Saves `text` itself as a local file (not a server round-trip) — used
   *  so the modal's own download button can save whichever format
   *  (`JSON`/`YAML`) is currently on screen, not just the JSON the server
   *  endpoint returns. `downloadUrl` (a plain same-origin URL) still
   *  covers the export menu's own JSON-only shortcuts. */
  function downloadText(text, filename, mime) {
    var blob = new Blob([text], { type: mime });
    var blobUrl = URL.createObjectURL(blob);
    downloadUrl(blobUrl, filename);
    setTimeout(function () {
      URL.revokeObjectURL(blobUrl);
    }, 1000);
  }

  /** Wraps every case-insensitive occurrence of `term` in `html` with a
   *  numbered `<mark>`, skipping over tag markup itself (so a search term
   *  can never land inside a class name or a `data-*` attribute) — the
   *  same "split on tags, only touch the text runs" trick as every other
   *  layered highlighter in this file. Used to search *within* an
   *  already syntax-highlighted schema (see `openSchemaModal`) without
   *  re-tokenizing it. */
  function highlightSearchHits(html, term) {
    if (!term) return { html: html, count: 0 };
    var re = new RegExp(escapeRegExp(term), 'gi');
    var count = 0;
    var result = html.replace(/(<[^>]+>)|([^<]+)/g, function (whole, tag, text) {
      if (tag) return tag;
      return text.replace(re, function (m) {
        var hit = '<mark class="schema-search-hit" data-hit="' + count + '">' + m + '</mark>';
        count++;
        return hit;
      });
    });
    return { html: result, count: count };
  }

  function openSchemaModal(kind, title) {
    closeSchemaModal();
    var url = exportUrl(kind, state.docKey);
    var jsonFilename = exportFilename(state.docKey, kind);
    var format = 'json';
    var data = null;
    var baseHtml = '';
    var searchTerm = '';
    var hitCount = 0;
    var activeHit = -1;

    var jsonBtn = el('button', { class: 'modal-format-btn sel', type: 'button' }, ['JSON']);
    var yamlBtn = el('button', { class: 'modal-format-btn', type: 'button' }, ['YAML']);
    var formatToggle = el('div', { class: 'modal-format-toggle' }, [jsonBtn, yamlBtn]);
    var copySlot = el('span', { class: 'modal-copy-slot' });
    var downloadBtn = el(
      'button',
      { class: 'modal-icon-btn', type: 'button', title: t('common.download') },
      [iconFor('download')],
    );
    var closeBtn = el(
      'button',
      { class: 'modal-icon-btn', type: 'button', title: t('common.close') },
      [iconFor('close')],
    );
    closeBtn.addEventListener('click', closeSchemaModal);

    // A find-in-page style search, centered in the header itself (not a
    // second row) — a compact fixed-width box, not a full-width bar,
    // since a schema search term is normally a short key/word. Searches
    // the currently displayed format's text; switching JSON ↔ YAML keeps
    // whatever search term is active (see `renderFormat`).
    var searchInput = el('input', {
      class: 'modal-search-input',
      type: 'search',
      placeholder: t('schemaModal.searchPlaceholder'),
    });
    var searchStatus = el('span', { class: 'modal-search-status' }, ['']);
    var searchPrevBtn = el(
      'button',
      { class: 'modal-icon-btn', type: 'button', title: t('schemaModal.previousMatch') },
      [iconFor('chevronDown', 'rotate-180')],
    );
    var searchNextBtn = el(
      'button',
      { class: 'modal-icon-btn', type: 'button', title: t('schemaModal.nextMatch') },
      [iconFor('chevronDown')],
    );
    var header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-header-left' }, [el('span', { class: 'modal-title' }, [title]), formatToggle]),
      el('div', { class: 'modal-search' }, [searchInput, searchStatus, searchPrevBtn, searchNextBtn]),
      el('div', { class: 'modal-header-actions' }, [copySlot, downloadBtn, closeBtn]),
    ]);

    var code = el('code', {}, [t('common.loading')]);
    var body = el('div', { class: 'modal-body' }, [el('pre', { class: 'example-json modal-json' }, [code])]);
    var dialog = el('div', { class: 'modal-dialog' }, [header, body]);
    schemaModalOverlay = el('div', { class: 'modal-overlay' }, [dialog]);
    schemaModalOverlay.addEventListener('click', function (ev) {
      if (ev.target === schemaModalOverlay) closeSchemaModal();
    });
    document.body.appendChild(schemaModalOverlay);
    document.addEventListener('keydown', onSchemaModalKeydown);

    // Both formats are rendered from the same parsed `data` (fetched once
    // as JSON, converted to YAML client-side via the same `toYaml` the
    // request-body examples already use elsewhere) — switching formats is
    // just re-rendering already-loaded data, no second request.
    function currentText() {
      return format === 'yaml' ? toYaml(data, 0) : JSON.stringify(data, null, 2);
    }

    function setActiveHit(index) {
      var marks = code.querySelectorAll('.schema-search-hit');
      marks.forEach(function (m) {
        m.classList.remove('active');
      });
      activeHit = hitCount ? (index + hitCount) % hitCount : -1;
      // The prev/next/status trio only makes sense once there's actually
      // a search term — hidden entirely until then (not just empty),
      // rather than sitting there pushing the search box away from them.
      // With a term but zero matches, they stay visible but disabled —
      // there's nowhere to navigate to, but that's a different state
      // than "no search yet".
      var hasTerm = !!searchTerm;
      searchStatus.hidden = !hasTerm;
      searchPrevBtn.hidden = !hasTerm;
      searchNextBtn.hidden = !hasTerm;
      var noMatches = hasTerm && !hitCount;
      searchPrevBtn.disabled = noMatches;
      searchNextBtn.disabled = noMatches;
      searchStatus.textContent = !hasTerm ? '' : hitCount ? activeHit + 1 + '/' + hitCount : '0/0';
      if (activeHit < 0) return;
      var mark = code.querySelector('[data-hit="' + activeHit + '"]');
      if (mark) {
        mark.classList.add('active');
        mark.scrollIntoView({ block: 'center' });
      }
    }

    function applySearch() {
      var result = highlightSearchHits(baseHtml, searchTerm);
      code.innerHTML = result.html;
      hitCount = result.count;
      setActiveHit(0);
    }

    function renderFormat() {
      if (data === null) return;
      var text = currentText();
      baseHtml = format === 'yaml' ? highlightYaml(text) : highlightJson(text);
      jsonBtn.classList.toggle('sel', format === 'json');
      yamlBtn.classList.toggle('sel', format === 'yaml');
      // A copy button mirrors every other JSON/YAML block in the app (see
      // `requestBodyExample`'s own `copyButton(text, 15)`) — rebuilt on
      // every format switch since it captures its value up front rather
      // than reading it later.
      clear(copySlot);
      copySlot.appendChild(copyButton(text, 17));
      applySearch();
    }
    jsonBtn.addEventListener('click', function () {
      format = 'json';
      renderFormat();
    });
    yamlBtn.addEventListener('click', function () {
      format = 'yaml';
      renderFormat();
    });
    downloadBtn.addEventListener('click', function () {
      if (data === null) return;
      if (format === 'yaml') {
        downloadText(currentText(), jsonFilename.replace(/\.json$/, '.yaml'), 'application/yaml');
      } else {
        downloadUrl(url, jsonFilename);
      }
    });
    searchInput.addEventListener('input', function () {
      searchTerm = searchInput.value;
      applySearch();
    });
    searchInput.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (hitCount) setActiveHit(activeHit + (ev.shiftKey ? -1 : 1));
    });
    searchPrevBtn.addEventListener('click', function () {
      if (hitCount) setActiveHit(activeHit - 1);
    });
    searchNextBtn.addEventListener('click', function () {
      if (hitCount) setActiveHit(activeHit + 1);
    });

    fetch(url)
      .then(function (res) {
        return res.json();
      })
      .then(function (json) {
        data = json;
        renderFormat();
      })
      .catch(function () {
        code.textContent = t('schemaModal.failedToLoad');
      });
  }

  /** Lazily loads the browser-side TypeScript-client generator bundle (see
   *  `expressApiUi`'s own `/codegen/*.js` route and `codegen-bundle/
   *  browser-entry.ts`) — a dynamic `import()` so the (fairly large)
   *  bundle is only ever fetched once someone actually clicks "TypeScript
   *  Client" below, and cached so a second click doesn't refetch it. */
  var codegenBundlePromise = null;
  function loadCodegenBundle() {
    if (!codegenBundlePromise) {
      codegenBundlePromise = import(exportBaseUrl() + '/codegen/browser-entry.js');
    }
    return codegenBundlePromise;
  }

  function clientZipFilename(docKey) {
    var slug = docTitle(docKey)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return (slug || docKey) + '.client.zip';
  }

  /** Generates a TypeScript client for the currently active document and
   *  saves it as a zip — entirely in this browser tab (see
   *  `codegen-bundle/browser-entry.ts`'s own doc comment for why: the
   *  server only ever serves already-public schema JSON and this one
   *  static script, never runs the generator itself). Mirrors
   *  `getDocsByKey()` on the server side: the active document's own
   *  schema carries only a lightweight `{id, url, info}` pointer per
   *  reference namespace, so each one's *full* schema is fetched
   *  separately (the same `/schema/<ns>.json` route, once per namespace)
   *  before handing everything to `generateTypeScriptClientZip`. Returns
   *  the promise so `openTsClientModal`'s own download button can drive
   *  its label/status from it, rather than this function reaching into a
   *  particular button's DOM itself (see `generateTypeScriptClient`'s
   *  previous, menu-item-specific incarnation).
   */
  function generateAndDownloadTsClient() {
    var docKey = state.docKey;
    return fetch(exportUrl('schema', docKey))
      .then(function (res) {
        if (!res.ok) throw new Error(t('tsClient.failedSchema'));
        return res.json();
      })
      .then(function (rootSchema) {
        var refNames = Object.keys(rootSchema.references || {}).filter(function (ns) {
          return ns !== 'opra';
        });
        return Promise.all(
          refNames.map(function (ns) {
            return fetch(exportUrl('schema', ns))
              .then(function (res) {
                if (!res.ok) throw new Error(t('tsClient.failedReferenceSchema', { namespace: ns }));
                return res.json();
              })
              .then(function (json) {
                return [ns, json];
              });
          }),
        ).then(function (pairs) {
          var referenceSchemas = {};
          pairs.forEach(function (pair) {
            referenceSchemas[pair[0]] = pair[1];
          });
          return loadCodegenBundle().then(function (mod) {
            return mod.generateTypeScriptClientZip(rootSchema, referenceSchemas);
          });
        });
      })
      .then(function (zipBytes) {
        var blob = new Blob([zipBytes], { type: 'application/zip' });
        var blobUrl = URL.createObjectURL(blob);
        downloadUrl(blobUrl, clientZipFilename(docKey));
        setTimeout(function () {
          URL.revokeObjectURL(blobUrl);
        }, 1000);
      });
  }

  /** The base URL a `$schema`-aware tool (namely `@opra/cli`'s own
   *  `oprimp generate`) should be pointed at — the adapter's own service
   *  root, where `GET $schema` actually lives (see `HttpAdapter`), which
   *  is *not* necessarily this page's own mount (`ui.basePath`, e.g.
   *  `/ui`): the two happen to be the same origin in every example this
   *  app ships with (the adapter mounted at the app root, `apiUi` as a
   *  sibling route on it), so `location.origin` is offered as a best-
   *  effort default rather than something guaranteed correct for every
   *  possible deployment — the modal says as much. */
  function guessServiceUrl() {
    return location.origin;
  }

  var tsClientModalOverlay = null;

  function closeTsClientModal() {
    if (!tsClientModalOverlay) return;
    tsClientModalOverlay.remove();
    tsClientModalOverlay = null;
    document.removeEventListener('keydown', onTsClientModalKeydown);
  }

  function onTsClientModalKeydown(ev) {
    if (ev.key === 'Escape') closeTsClientModal();
  }

  /** The "Export" menu's "TypeScript Client" entry opens this instead of
   *  downloading straight away — generating one takes a moment and isn't
   *  the only way to get a client, so it's worth a beat to show both
   *  options: the `@opra/cli` command line (the more flexible route —
   *  custom output directory, file headers, etc.) and a direct in-
   *  browser download (the same generation this app itself now runs,
   *  saved as a zip with no separate install). */
  function openTsClientModal() {
    closeTsClientModal();

    var closeBtn = el(
      'button',
      { class: 'modal-icon-btn', type: 'button', title: t('common.close') },
      [iconFor('close')],
    );
    closeBtn.addEventListener('click', closeTsClientModal);
    var header = el('div', { class: 'modal-header' }, [
      el('div', { class: 'modal-header-left' }, [
        iconFor('download'),
        el('span', { class: 'modal-title' }, [t('tsClient.title')]),
      ]),
      el('div', { class: 'modal-header-actions' }, [closeBtn]),
    ]);

    // `oprimp generate <serviceUrl> <outDir>` — positional, not flags (see
    // `packages/cli/src/oprimp-cli.ts`). `--lang` is appended only when
    // this page itself is being read in a particular language, so the
    // generated JSDoc matches what the reader sees here.
    var uiLang = (window.__OPRA_UI__ || {}).lang;
    var cmd =
      'npx oprimp generate ' +
      guessServiceUrl() +
      ' ./client' +
      (uiLang ? ' --lang ' + uiLang : '');
    var cmdRow = el('div', { class: 'tsclient-cmd' }, [
      el('code', { class: 'mono' }, [cmd]),
      copyButton(cmd, 14),
    ]);

    var statusEl = el('div', { class: 'tsclient-status', hidden: true });
    var downloadLabel = el('span', {}, [t('common.download')]);
    var downloadBtn = el(
      'button',
      { class: 'tsclient-download-btn', type: 'button' },
      [iconFor('download'), downloadLabel],
    );
    downloadBtn.addEventListener('click', function () {
      if (downloadBtn.classList.contains('busy')) return;
      downloadBtn.classList.add('busy');
      downloadLabel.textContent = t('tsClient.generating');
      statusEl.hidden = true;
      generateAndDownloadTsClient()
        .then(function () {
          statusEl.hidden = false;
          statusEl.className = 'tsclient-status ok';
          statusEl.textContent = t('tsClient.downloaded');
        })
        .catch(function (err) {
          statusEl.hidden = false;
          statusEl.className = 'tsclient-status err';
          statusEl.textContent =
            t('tsClient.failed', { error: err && err.message ? err.message : err });
        })
        .finally(function () {
          downloadBtn.classList.remove('busy');
          downloadLabel.textContent = t('common.download');
        });
    });

    var body = el('div', { class: 'modal-body tsclient-body' }, [
      el('p', {}, [t('tsClient.intro')]),
      el('div', { class: 'tsclient-h' }, [t('tsClient.cliHeading')]),
      el(
        'p',
        {},
        // The package name is a node, not an interpolated string: it stays
        // `<code class="mono">@opra/cli</code>` wherever a translation's own
        // word order puts it.
        tNodes('tsClient.cliUse', { package: el('code', { class: 'mono' }, ['@opra/cli']) }),
      ),
      cmdRow,
      el('p', { class: 'tsclient-hint' }, [t('tsClient.cliNote')]),
      el('div', { class: 'tsclient-h' }, [t('tsClient.downloadHeading')]),
      el('p', {}, [t('tsClient.downloadNote')]),
      downloadBtn,
      statusEl,
    ]);

    var dialog = el('div', { class: 'modal-dialog tsclient-dialog' }, [header, body]);
    tsClientModalOverlay = el('div', { class: 'modal-overlay' }, [dialog]);
    tsClientModalOverlay.addEventListener('click', function (ev) {
      if (ev.target === tsClientModalOverlay) closeTsClientModal();
    });
    document.body.appendChild(tsClientModalOverlay);
    document.addEventListener('keydown', onTsClientModalKeydown);
  }

  /** The "Export" menu's own "TypeScript Client" entry — opens
   *  `openTsClientModal` rather than acting directly, since (unlike its
   *  two siblings, which just open a read-only viewer) there's a real
   *  choice to offer here: the CLI or a direct browser download. */
  function typescriptClientMenuItem(menu) {
    var item = el('div', { class: 'picker-item groupby-item', id: 'opra-view-tsclient' }, [
      iconFor('download'),
      el('span', { class: 't' }, [t('header.tsClient')]),
    ]);
    item.addEventListener('click', function (ev) {
      ev.stopPropagation();
      menu.hidden = true;
      openPickerMenu = null;
      openTsClientModal();
    });
    return item;
  }

  // ---------- full-text search ----------

  /** One MiniSearch index per document, built once and cached — every
   *  controller, operation, its own parameters, every model, and every
   *  model field becomes one searchable entry. `label` is the entry's own
   *  display name (boosted highest — a name match should always outrank
   *  a description-only one); `desc` is its description/prose, the only
   *  field an excerpt (see `buildExcerpt`) is ever built from; `aux`
   *  carries an operation's raw `opKey`/path (searchable — a technical
   *  name like `avatar` still finds "Update avatar" — but never shown or
   *  excerpted, since it isn't prose). MiniSearch (vendored, see
   *  `assets/vendor/minisearch.js`) does its own per-token prefix and
   *  fuzzy (edit-distance) matching, which is what plain
   *  substring/subsequence matching (this function's previous, hand-
   *  rolled incarnation) couldn't: a multi-word query like "the porfile"
   *  tokenizes into "the" + "porfile", and each token is fuzzy-matched
   *  *independently* against the index, so a typo in one word doesn't
   *  sink the whole query the way a single whole-string edit-
   *  distance/subsequence check did. Scoped to a single document, the
   *  same way the sidebar's own Quick Filter always has been — this app
   *  has no notion of a single search spanning multiple documents at
   *  once. */
  var searchIndexCache = {};
  function buildSearchIndex(docKey) {
    if (searchIndexCache[docKey]) return searchIndexCache[docKey];
    var doc = docs[docKey];
    var entries = [];
    var nextId = 0;
    function push(entry) {
      entry.id = nextId++;
      entries.push(entry);
    }
    if (doc && doc.api && doc.api.controllers) {
      (function walk(controllers, parentRoute, parentLabel) {
        Object.keys(controllers).forEach(function (name) {
          var ctrl = controllers[name];
          var route = parentRoute + '/' + encodeURIComponent(name);
          var label = parentLabel ? parentLabel + ' › ' + name : name;
          push({
            type: 'controller',
            label: name,
            // A root-level controller has no meaningful parent to show —
            // an empty breadcrumb here (see `renderResults`), not a
            // generic "Controller" fallback that would just repeat what
            // this row's own group header ("Controllers") already says.
            sublabel: parentLabel || '',
            desc: ctrl.description || '',
            aux: '',
            route: route,
          });
          if (ctrl.operations) {
            Object.keys(ctrl.operations).forEach(function (opKey) {
              var op = ctrl.operations[opKey];
              var opRoute = route + '/' + encodeURIComponent(opKey);
              var opLabel = op.title || opKey;
              push({
                type: 'operation',
                label: opLabel,
                sublabel: label,
                method: op.method,
                desc: op.description || '',
                aux: opKey + ' ' + (op.path || ''),
                route: opRoute,
              });
              (op.parameters || []).forEach(function (p) {
                push({
                  type: 'parameter',
                  label: p.name,
                  sublabel: opLabel,
                  desc: p.description || '',
                  aux: '',
                  route: opRoute,
                });
              });
            });
          }
          if (ctrl.controllers) walk(ctrl.controllers, route, label);
        });
      })(doc.api.controllers, 'ctl', '');
    }
    var types = doc.types || {};
    Object.keys(types).forEach(function (name) {
      var type = types[name];
      var route = 'model/' + encodeURIComponent(name);
      push({
        type: 'model',
        label: name,
        sublabel: dataTypeGroupLabel(type.kind, 1),
        desc: type.description || '',
        aux: '',
        route: route,
      });
      if (type.fields) {
        Object.keys(type.fields).forEach(function (fname) {
          var f = type.fields[fname];
          push({
            type: 'field',
            label: fname,
            sublabel: name,
            desc: f.description || '',
            aux: '',
            route: route,
          });
        });
      }
    });

    var mini = new MiniSearch({
      fields: ['label', 'desc', 'aux'],
      storeFields: ['type', 'label', 'sublabel', 'desc', 'route', 'method'],
      searchOptions: {
        boost: { label: 3, aux: 1.2 },
        fuzzy: 0.25,
        prefix: true,
      },
    });
    mini.addAll(entries);
    var built = { mini: mini };
    searchIndexCache[docKey] = built;
    return built;
  }

  /** Wraps every occurrence of any of `terms` in `text` in a `<mark>` —
   *  like the sidebar's own `highlightParts` above, but for *several*
   *  terms at once, and where a term isn't necessarily a literal
   *  substring of what the user typed: MiniSearch's fuzzy/prefix matching
   *  means the term that actually matched (e.g. "profile", found in the
   *  index) can differ from the query token that found it (e.g.
   *  "porfile") — `terms` here is always the former, read off each
   *  result's own `match` map (see `renderResults`), so this highlights
   *  the real word, not the typo. Overlapping/adjacent hits merge into
   *  one `<mark>` instead of nesting or duplicating. */
  function highlightTerms(text, terms) {
    if (!terms || !terms.length) return [text];
    var lower = text.toLowerCase();
    var ranges = [];
    terms.forEach(function (term) {
      if (!term) return;
      var pos = 0;
      var idx;
      while ((idx = lower.indexOf(term, pos)) !== -1) {
        ranges.push([idx, idx + term.length]);
        pos = idx + term.length;
      }
    });
    if (!ranges.length) return [text];
    ranges.sort(function (a, b) {
      return a[0] - b[0] || a[1] - b[1];
    });
    var merged = [ranges[0].slice()];
    ranges.slice(1).forEach(function (r) {
      var last = merged[merged.length - 1];
      if (r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push(r.slice());
    });
    var parts = [];
    var pos = 0;
    merged.forEach(function (r) {
      if (r[0] > pos) parts.push(text.slice(pos, r[0]));
      parts.push(el('mark', { class: 'match-highlight' }, [text.slice(r[0], r[1])]));
      pos = r[1];
    });
    if (pos < text.length) parts.push(text.slice(pos));
    return parts;
  }

  /** A KWIC ("keyword in context") snippet — the same idea Docusaurus's
   *  own search results show: not the whole description, just a window
   *  around wherever a matched term actually landed, so the reader sees
   *  *why* this result matched, not only *that* it did. `descTerms` are
   *  the (already-lowercased) real words `renderResults` found matched
   *  specifically within this entry's `desc` field; returns `null` when
   *  there's nothing to show one for — the match came from the label or
   *  the hidden `aux` field instead, and the row's breadcrumb alone is
   *  enough context for that. */
  function buildExcerpt(desc, descTerms) {
    if (!desc || !descTerms.length) return null;
    var lower = desc.toLowerCase();
    var bestIdx = -1;
    descTerms.forEach(function (term) {
      var idx = lower.indexOf(term);
      if (idx !== -1 && (bestIdx === -1 || idx < bestIdx)) bestIdx = idx;
    });
    if (bestIdx === -1) return null;
    var BEFORE = 40;
    var AFTER = 100;
    var start = Math.max(0, bestIdx - BEFORE);
    var end = Math.min(desc.length, bestIdx + AFTER);
    var snippet = desc.slice(start, end).trim();
    return (start > 0 ? '…' : '') + snippet + (end < desc.length ? '…' : '');
  }

  /** Fixed display order (top to bottom) for whichever of these five
   *  groups actually turned up a match — independent of `allocateRows`'s
   *  own ascending-by-count sort below, which only decides *how many*
   *  rows each gets, not the order they're shown in. */
  var SEARCH_CATEGORIES = [
    { type: 'controller', label: t('search.controllers') },
    { type: 'operation', label: t('search.operations') },
    { type: 'parameter', label: t('search.parameters') },
    { type: 'model', label: t('search.models') },
    { type: 'field', label: t('search.fields') },
  ];
  var SEARCH_MAX_ROWS = 12;

  /** Splits a fixed `maxRows` budget across categories so a search that
   *  happens to turn up 30 fields and 3 models doesn't bury those 3
   *  models under a screen entirely full of fields. Water-filling from
   *  the smallest count up: a category with fewer matches than an equal
   *  share gets all of them (nothing wasted), and whatever it *didn't*
   *  use rolls over into the equal share recomputed for the categories
   *  still waiting — so 8 controllers/30 fields/3 models at maxRows=12
   *  comes out 4/5/3 (models take all 3 of their own first, freeing 9 to
   *  split between the remaining two), not an even, comparison-blind 4
   *  each or a purely proportional (and modest-category-crushing) split. */
  function allocateRows(counts, maxRows) {
    var cats = Object.keys(counts).filter(function (c) {
      return counts[c] > 0;
    });
    cats.sort(function (a, b) {
      return counts[a] - counts[b];
    });
    var remaining = maxRows;
    var alloc = {};
    cats.forEach(function (cat, i) {
      var isLast = i === cats.length - 1;
      var share = isLast ? remaining : Math.floor(remaining / (cats.length - i));
      var take = Math.min(counts[cat], share);
      alloc[cat] = take;
      remaining -= take;
    });
    return alloc;
  }

  /** A Docusaurus-style search — everywhere the sidebar's own Quick
   *  Filter doesn't reach: operation/parameter/model/field
   *  *descriptions*, not just names already visible as a nav row. Built
   *  entirely client-side from `buildSearchIndex` (the whole document is
   *  already embedded in the page — nothing to fetch, and at the size of
   *  a single API's own reference — hundreds, not millions, of entries —
   *  MiniSearch's own index build/query cost is well under a frame's
   *  budget on every keystroke). A popup anchored under the header's own
   *  search box (see `init`), not a centered modal — the box itself does
   *  the actual typing, same as any other autocomplete, rather than
   *  handing off to a separate input inside an overlay. */
  function initSearchPopup(searchInput, searchPopup, searchResultsEl) {
    var activeIndex = -1;
    // Whether `activeIndex` is currently *shown* (a row actually painted
    // `.active`) — distinct from the index itself, which `renderResults`
    // always primes to `0` so Enter alone opens the top match. The first
    // arrow-key press after a fresh render only reveals that row instead
    // of skipping past it to index 1.
    var activeVisible = false;

    function isOpen() {
      return !searchPopup.hidden;
    }
    function open() {
      if (openPickerMenu && openPickerMenu !== searchPopup) openPickerMenu.hidden = true;
      openPickerMenu = searchPopup;
      searchPopup.hidden = false;
      renderResults(searchInput.value);
    }
    function close() {
      searchPopup.hidden = true;
      if (openPickerMenu === searchPopup) openPickerMenu = null;
    }

    function setActive(i) {
      var rows = searchResultsEl.querySelectorAll('.search-result-item');
      Array.prototype.forEach.call(rows, function (r) {
        r.classList.remove('active');
      });
      if (i < 0 || i >= rows.length) {
        activeIndex = -1;
        activeVisible = false;
        return;
      }
      activeIndex = i;
      activeVisible = true;
      rows[i].classList.add('active');
      rows[i].scrollIntoView({ block: 'nearest' });
    }

    function renderResults(query) {
      clear(searchResultsEl);
      if (!query) {
        searchResultsEl.appendChild(
          el('div', { class: 'search-popup-empty' }, [t('search.hint')]),
        );
        return;
      }
      // MiniSearch already returns results sorted by score, descending,
      // across the whole document regardless of type — grouping below
      // just partitions that single sorted list by `type`, so each
      // group's own relative order is preserved for free.
      var results = buildSearchIndex(state.docKey).mini.search(query);
      var byType = {};
      results.forEach(function (r) {
        (byType[r.type] = byType[r.type] || []).push(r);
      });
      var counts = {};
      Object.keys(byType).forEach(function (key) {
        counts[key] = byType[key].length;
      });
      var alloc = allocateRows(counts, SEARCH_MAX_ROWS);

      var shown = 0;
      SEARCH_CATEGORIES.forEach(function (cat) {
        var list = byType[cat.type];
        var take = alloc[cat.type] || 0;
        if (!list || !take) return;
        searchResultsEl.appendChild(
          el('div', { class: 'search-group-label' }, [t('search.categoryCount', { category: cat.label, count: list.length })]),
        );
        list.slice(0, take).forEach(function (r) {
          // `r.match` (from MiniSearch) maps each *real* word it found —
          // not the raw query token, which may be a typo of it — to the
          // list of fields it matched in; split those into "found in the
          // label" (highlight the heading) vs. "found in the
          // description" (highlight it too, and is what `buildExcerpt`
          // builds its snippet around) — a term matching only the hidden
          // `aux` field (an operation's raw path) does neither.
          var labelTerms = [];
          var descTerms = [];
          Object.keys(r.match).forEach(function (term) {
            var fields = r.match[term];
            if (fields.indexOf('label') !== -1) labelTerms.push(term);
            if (fields.indexOf('desc') !== -1) descTerms.push(term);
          });
          var textChildren = [el('div', { class: 'search-result-label' }, highlightTerms(r.label, labelTerms))];
          var excerpt = buildExcerpt(r.desc, descTerms);
          if (excerpt) {
            textChildren.push(
              el('div', { class: 'search-result-excerpt', dir: 'auto' }, highlightTerms(excerpt, descTerms)),
            );
          }
          var row = el('a', { class: 'search-result-item', href: hrefFor(state.docKey, r.route) }, [
            el('div', { class: 'search-result-crumb' }, r.sublabel ? [r.sublabel, el('span', { class: 'search-result-crumb-arrow' }, [IS_RTL ? '‹' : '›'])] : []),
            el('div', { class: 'search-result-text' }, textChildren),
            r.method ? methodBadge(r.method) : null,
          ]);
          searchResultsEl.appendChild(row);
          shown++;
        });
      });
      if (!shown) {
        searchResultsEl.appendChild(el('div', { class: 'search-popup-empty' }, [t('search.noMatches', { query: query })]));
        return;
      }
      // The top row is the one Enter opens without having to press
      // ArrowDown first — but that's just `activeIndex` bookkeeping, not
      // a visual state: rows are otherwise plain until the user actually
      // does something (hovers, or presses an arrow key), so a fresh
      // result list never opens looking like its own top row is already
      // selected. `setActive` (which *does* paint `.active`) is only
      // ever called from the arrow-key handlers below.
      activeIndex = 0;
      activeVisible = false;
    }

    searchInput.addEventListener('focus', open);
    searchInput.addEventListener('click', function (ev) {
      ev.stopPropagation();
      open();
    });
    searchInput.addEventListener('input', function () {
      renderResults(searchInput.value);
    });
    searchInput.addEventListener('keydown', function (ev) {
      var rows = searchResultsEl.querySelectorAll('.search-result-item');
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        // A fresh render's own `activeIndex` (always `0`) isn't shown
        // yet — the first press just reveals it, rather than skipping
        // straight to row 1.
        setActive(activeVisible ? Math.min(activeIndex + 1, rows.length - 1) : activeIndex);
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        setActive(activeVisible ? Math.max(activeIndex - 1, 0) : activeIndex);
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        if (activeIndex >= 0 && rows[activeIndex]) rows[activeIndex].click();
      } else if (ev.key === 'Escape') {
        close();
        searchInput.blur();
      }
    });
    // A result is a plain `<a href>` — clicking it navigates on its own;
    // the same document-level "click anywhere closes whichever menu is
    // open" handler `buildPicker`'s own menu already relies on closes
    // this popup right after, since it's `openPickerMenu` while open.

    return { open: open, close: close, isOpen: isOpen };
  }

  function init() {
    var app = document.getElementById('app');
    var ui = window.__OPRA_UI__ || {};

    // The logo (if any) anchors the header's left edge, followed by a
    // divider and the document picker (built into `#opra-picker` below —
    // see `buildPicker`, which now also carries the root version chip
    // that used to sit over in `.header-right`); `.search`'s own
    // `margin-left: auto` (see CSS) is what actually pushes the rest of
    // `.header-right` to the far edge regardless of what precedes it —
    // Docusaurus's own navbar layout (logo/brand left, search right).
    var headerChildren = [];
    if (ui.logo) {
      // Always the *main* (root) document's own "Document Info" page —
      // a fixed "home" destination, unlike the document picker beside it
      // (which stays wherever's currently active) — regardless of which
      // document happens to be open when it's clicked. `hrefFor('root',
      // '')` would just be the bare hash `'#/'`, which `parseHash`
      // reads as "relative to whatever document is already active" (the
      // same ambiguity `pickerItem`'s click handler has to work around) —
      // the explicit `ref/root/` form sidesteps that outright, so this
      // can stay a plain link instead of needing its own click handler.
      var logoLink = el(
        'a',
        { class: 'header-logo', href: ui.logo.href || '#/ref/root/' },
        [el('img', { src: ui.logo.src, alt: ui.logo.alt || ui.logo.label || t('header.logoAlt') })],
      );
      if (ui.logo.label) logoLink.appendChild(el('span', { class: 'header-logo-label' }, [ui.logo.label]));
      headerChildren.push(logoLink);
      headerChildren.push(el('span', { class: 'header-divider' }));
    }
    headerChildren.push(el('div', { class: 'picker-wrap', id: 'opra-picker' }));
    var headerRight = [];

    var scopeSelectEl = scopeSelector(ui);
    if (scopeSelectEl) headerRight.push(scopeSelectEl);

    // A labeled "Export" button opening a menu of the two formats
    // this document can be viewed as — its own native Opra schema
    // (always available) and an OpenAPI mapping (only when this document
    // actually has an HTTP api — see `render()`'s own `viewOpenapiItem`
    // sync below, mirroring how `groupByBtn` hides "Sections" for a document
    // with nothing to section). Each opens `openSchemaModal`, which already
    // carries its own download action in its header — no separate
    // "download" entries needed here.
    var exportMenu = el('div', { class: 'picker-menu header-export-menu' });
    exportMenu.hidden = true;
    function viewMenuItem(id, kind, icon, label) {
      var item = el('div', { class: 'picker-item groupby-item', id: id }, [
        iconFor(icon),
        el('span', { class: 't' }, [label]),
      ]);
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        exportMenu.hidden = true;
        openPickerMenu = null;
        openSchemaModal(kind, label);
      });
      return item;
    }
    exportMenu.appendChild(viewMenuItem('opra-view-schema', 'schema', 'book', t('header.opraSchema')));
    exportMenu.appendChild(viewMenuItem('opra-view-openapi', 'openapi', 'globe', t('header.openapiSchema')));
    exportMenu.appendChild(el('div', { class: 'group-label', id: 'opra-view-tsclient-label' }, [t('header.downloadGroup')]));
    exportMenu.appendChild(typescriptClientMenuItem(exportMenu));
    var exportBtn = el(
      'button',
      { class: 'header-export-btn', id: 'opra-export-btn', type: 'button', title: t('header.export') },
      [iconFor('eye'), el('span', {}, [t('header.export')])],
    );
    exportBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      exportMenu.hidden = !exportMenu.hidden;
      openPickerMenu = exportMenu.hidden ? null : exportMenu;
    });
    headerRight.push(el('div', { class: 'header-export-wrap' }, [exportBtn, exportMenu]));
    var langSelectEl = languageSelector(ui);
    if (langSelectEl) headerRight.push(langSelectEl);
    headerRight.push(themeToggleButton());
    // The results popup lives inside `.search` itself (which is already
    // `position: relative`) so it anchors directly under the box, not as
    // a separate centered overlay — `initSearchPopup` (see above) wires
    // up everything else once these three exist.
    var globalSearchInput = el('input', { id: 'opra-search', type: 'search', placeholder: t('header.searchPlaceholder') });
    var searchResultsEl = el('div', { class: 'search-popup-results' });
    var searchPopup = el('div', { class: 'search-popup' }, [searchResultsEl]);
    searchPopup.hidden = true;
    headerRight.push(
      el('div', { class: 'search' }, [
        globalSearchInput,
        el('span', { class: 'search-kbd' }, [kbdShortcutLabel()]),
        searchPopup,
      ]),
    );
    initSearchPopup(globalSearchInput, searchPopup, searchResultsEl);
    headerChildren.push(el('div', { class: 'header-right' }, headerRight));
    var header = el('div', { class: 'header' }, headerChildren);
    // `#opra-nav` is now the *inner* scrollable list only — `buildSidebar`
    // clears and rebuilds it on every keystroke (search, sidebar filter, or
    // navigation), which would destroy a filter input living inside it
    // (losing focus/cursor position mid-type). The outer `.sidebar` wrapper
    // holds the filter box above it instead, untouched by those rebuilds,
    // with the list scrolling independently beneath it (see `.sidebar-nav`
    // in CSS).
    var navList = el('nav', { class: 'sidebar-nav', id: 'opra-nav' });
    var sidebarFilterInput = el('input', { id: 'opra-sidebar-filter', type: 'search', placeholder: t('sidebar.filterPlaceholder') });
    // Clears the filter without needing to select-and-delete the text by
    // hand — hidden whenever the box is already empty (toggled alongside
    // the sync logic below), so it only ever appears once there's
    // something to clear.
    var sidebarFilterClear = el('button', { class: 'sidebar-filter-clear', type: 'button', title: t('sidebar.clearFilter'), hidden: true }, [
      iconFor('close'),
    ]);
    sidebarFilterClear.addEventListener('click', function (e) {
      e.preventDefault();
      sidebarFilterInput.value = '';
      onSidebarFilterInput();
      sidebarFilterInput.focus();
    });

    // A small square icon button (hidden until `render()` finds an active
    // document that actually declares `api.sections` — a document with
    // nothing to section has nothing for this to switch to) opening a
    // `.picker-menu` identical in spirit to the document picker's own
    // dropdown above — a "Group By" label followed by the two modes,
    // whichever's active marked `.sel`. Reuses the same `openPickerMenu`
    // single-open-menu bookkeeping `buildPicker`'s own menu already
    // participates in, so opening this one closes that one and vice versa,
    // and the shared document-level click handler closes whichever is open
    // without each menu needing its own listener for that.
    var groupByBtn = el('button', { class: 'sidebar-groupby-btn', id: 'opra-groupby-btn', type: 'button', title: t('sidebar.viewOptions'), hidden: true }, [
      iconFor('eye'),
    ]);
    var groupByMenu = el('div', { class: 'picker-menu sidebar-groupby-menu' });
    groupByMenu.hidden = true;
    groupByMenu.appendChild(el('div', { class: 'group-label' }, [t('sidebar.groupBy')]));
    var groupByOptions = [
      { key: 'structure', label: t('sidebar.groupByStructure'), icon: 'folder' },
      { key: 'sections', label: t('sidebar.groupBySections'), icon: 'tag' },
    ];
    var groupByItemEls = {};
    groupByOptions.forEach(function (opt) {
      // The check mark (right-aligned via `.groupby-check`'s own
      // `margin-left: auto`) is always present in the DOM, not appended
      // only when selected — its visibility toggles purely through CSS
      // (`.picker-item.sel .groupby-check`, alongside the `.sel` class
      // `syncGroupByUi` already sets), so selecting an option never
      // shifts the row's own width/padding the way conditionally
      // inserting the icon would.
      var item = el('div', { class: 'picker-item groupby-item', id: 'opra-groupby-item-' + opt.key }, [
        iconFor(opt.icon),
        el('span', { class: 't' }, [opt.label]),
        iconFor('check', 'groupby-check'),
      ]);
      item.addEventListener('click', function (ev) {
        ev.stopPropagation();
        groupByMenu.hidden = true;
        openPickerMenu = null;
        if (state.groupBy === opt.key) return;
        state.groupBy = opt.key;
        try {
          localStorage.setItem('opra-ui-groupby', opt.key);
        } catch (e) {
          // ignore
        }
        syncGroupByUi();
        buildSidebar(navList, state.docKey, docs[state.docKey]);
        highlightActive(navList);
      });
      groupByItemEls[opt.key] = item;
      groupByMenu.appendChild(item);
    });

    // Every controller folder's own route, anywhere in the tree — the
    // same keys `collapsedNav` (in `buildSidebar`) looks up per folder,
    // just collected up front here instead of discovered lazily while
    // rendering, so "Collapse All" can mark them all at once.
    function collectControllerRoutes(controllers, parentRoute) {
      var routes = [];
      Object.keys(controllers).forEach(function (name) {
        var route = parentRoute + '/' + encodeURIComponent(name);
        routes.push(route);
        if (controllers[name].controllers) {
          routes = routes.concat(collectControllerRoutes(controllers[name].controllers, route));
        }
      });
      return routes;
    }

    // "Expand All" clears both collapse dicts outright — absence of a key
    // is what `buildSidebar` already treats as "not collapsed" everywhere,
    // so there's nothing to enumerate. "Collapse All" is the opposite
    // problem: collapsing means *setting* a key, so it walks the active
    // document once to mark every controller folder, every Models kind
    // sub-heading, and (in Sections mode) every section — the exact same
    // set `buildSidebar` would otherwise discover one collapsible section
    // at a time as the user opened this or that folder by hand.
    function setAllNavCollapsed(collapsed) {
      var doc = docs[state.docKey];
      if (!doc) return;
      if (!collapsed) {
        state.collapsedNav = {};
        state.collapsedGroups = {};
      } else {
        state.collapsedNav = state.collapsedNav || {};
        state.collapsedGroups = state.collapsedGroups || {};
        var controllers = (doc.api && doc.api.controllers) || {};
        collectControllerRoutes(controllers, 'ctl').forEach(function (route) {
          state.collapsedNav[route] = true;
        });
        state.collapsedGroups.controllers = true;
        state.collapsedGroups.models = true;
        var kinds = {};
        var types = doc.types || {};
        Object.keys(types).forEach(function (name) {
          kinds[types[name].kind] = true;
        });
        Object.keys(kinds).forEach(function (kind) {
          state.collapsedGroups['kind:' + kind] = true;
        });
        if (doc.api && doc.api.sections) {
          doc.api.sections.forEach(function (g) {
            state.collapsedGroups['group:' + g.name] = true;
          });
        }
        state.collapsedGroups['group:__ungrouped__'] = true;
      }
      saveCollapsedState();
      groupByMenu.hidden = true;
      openPickerMenu = null;
      buildSidebar(navList, state.docKey, docs[state.docKey]);
      highlightActive(navList);
    }
    groupByMenu.appendChild(el('div', { class: 'group-label' }, [t('sidebar.sidebarGroup')]));
    var expandAllBtn = el('button', { class: 'picker-item sidebar-menu-action', type: 'button' }, [t('sidebar.expandAll')]);
    expandAllBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      setAllNavCollapsed(false);
    });
    var collapseAllBtn = el('button', { class: 'picker-item sidebar-menu-action', type: 'button' }, [t('sidebar.collapseAll')]);
    collapseAllBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      setAllNavCollapsed(true);
    });
    groupByMenu.appendChild(expandAllBtn);
    groupByMenu.appendChild(collapseAllBtn);

    groupByBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      groupByMenu.hidden = !groupByMenu.hidden;
      openPickerMenu = groupByMenu.hidden ? null : groupByMenu;
    });
    // Reflects `state.groupBy` on the menu's own `.sel` item — called
    // right after a click here, and once more at startup before the very
    // first `render()` (which has its own equivalent of this same sync,
    // aware of whether the *active* document even has sections to
    // switch to — see its own `effectiveGroupBy`). The button itself
    // stays visually the same regardless of which mode is active — only
    // the checkmark in the menu tells them apart.
    function syncGroupByUi() {
      // `state.groupBy` starts out `undefined` (see `state`'s own
      // declaration), not the string `'structure'` — this fallback is what
      // makes the very first call (right below) actually mark "API
      // Structure" selected instead of leaving neither item checked.
      var effectiveGroupBy = state.groupBy || 'structure';
      groupByOptions.forEach(function (opt) {
        groupByItemEls[opt.key].classList.toggle('sel', effectiveGroupBy === opt.key);
      });
    }
    syncGroupByUi();

    // A funnel-icon button opening a menu of two independent multi-select
    // filter groups (HTTP method, model kind) to narrow the sidebar down
    // to — same `.picker-menu`/single-open-menu machinery as `groupByBtn`
    // right next to it, just multi-select instead of picking one of two
    // exclusive modes: each option toggles independently, and each
    // group's own "ALL" is a plain reset back to no filter for *that*
    // group rather than one more option alongside them. The menu stays
    // open across a click (unlike `groupByMenu`/the document picker)
    // since picking one option is normally the start of picking a few,
    // not the whole interaction — "Clear All" at the top is the one
    // action that *does* close it, being a decisive "done filtering"
    // reset rather than another selection.
    var filterBadge = el('span', { class: 'filter-badge', hidden: true }, ['0']);
    var methodFilterBtn = el(
      'button',
      { class: 'sidebar-groupby-btn', id: 'opra-methodfilter-btn', type: 'button', title: t('sidebar.filterOptions') },
      [iconFor('filter'), filterBadge],
    );
    var methodFilterMenu = el('div', { class: 'picker-menu sidebar-groupby-menu filter-menu' });
    methodFilterMenu.hidden = true;

    var clearAllBtn = el('button', { class: 'picker-item filter-clear-all', type: 'button' }, [t('sidebar.clearAll')]);
    clearAllBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      state.methodFilter = [];
      state.modelKindFilter = [];
      sidebarFilterInput.value = '';
      syncFilterUi();
      onSidebarFilterInput();
      methodFilterMenu.hidden = true;
      openPickerMenu = null;
    });
    methodFilterMenu.appendChild(clearAllBtn);

    // A generic toggle-group builder — one `state[stateKey]` array, an
    // "ALL" reset item, and one item per `{key, content}` option; shared
    // by the method group (colored `methodBadge` chips, for quick visual
    // recognition — GET/POST/PATCH already read this way everywhere else
    // in the sidebar) and the model-kind group (icon + label, matching
    // how the Models section itself marks each kind) below.
    var filterItemEls = {};
    function filterGroup(stateKey, label, options) {
      methodFilterMenu.appendChild(el('div', { class: 'group-label' }, [label]));
      var idPrefix = 'opra-' + stateKey + '-';
      function item(key, content) {
        var el_ = el('div', { class: 'picker-item groupby-item', id: idPrefix + key }, [
          content,
          iconFor('check', 'groupby-check'),
        ]);
        el_.addEventListener('click', function (ev) {
          ev.stopPropagation();
          if (key === 'ALL') {
            state[stateKey] = [];
          } else {
            var list = state[stateKey] || (state[stateKey] = []);
            var idx = list.indexOf(key);
            if (idx === -1) list.push(key);
            else list.splice(idx, 1);
          }
          syncFilterUi();
          buildSidebar(navList, state.docKey, docs[state.docKey]);
          highlightActive(navList);
        });
        filterItemEls[idPrefix + key] = el_;
        return el_;
      }
      methodFilterMenu.appendChild(item('ALL', el('span', { class: 't' }, [t('sidebar.allMethods')])));
      options.forEach(function (opt) {
        methodFilterMenu.appendChild(item(opt.key, opt.content));
      });
    }
    // Every HTTP method OPRA's own schema supports (see `OpraSchema.HttpMethod`
    // in `packages/common`), not just the handful the demo happens to use.
    var METHOD_FILTER_OPTIONS = [
      'GET',
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'HEAD',
      'OPTIONS',
      'QUERY',
      'SEARCH',
    ];
    filterGroup(
      'methodFilter',
      t('sidebar.filterByMethod'),
      METHOD_FILTER_OPTIONS.map(function (m) {
        return { key: m, content: methodBadge(m) };
      }),
    );
    var MODEL_KIND_FILTER_OPTIONS = ['ComplexType', 'SimpleType', 'EnumType'];
    filterGroup(
      'modelKindFilter',
      t('sidebar.filterByModel'),
      MODEL_KIND_FILTER_OPTIONS.map(function (kind) {
        return {
          key: kind,
          content: el('span', {}, [
            iconFor(dataTypeIconKind(kind), 'c-' + dataTypeIconKind(kind)),
            ' ' + dataTypeGroupLabel(kind),
          ]),
        };
      }),
    );
    methodFilterBtn.addEventListener('click', function (ev) {
      ev.stopPropagation();
      methodFilterMenu.hidden = !methodFilterMenu.hidden;
      openPickerMenu = methodFilterMenu.hidden ? null : methodFilterMenu;
    });
    // Reflects both filter groups' state on the button (an `.active`
    // outline plus a small count badge whenever either is narrowing
    // anything) and each menu item's own `.sel` — a group's own "ALL" is
    // checked exactly when nothing else in *that* group is selected.
    function syncFilterUi() {
      var methodCount = (state.methodFilter && state.methodFilter.length) || 0;
      var modelCount = (state.modelKindFilter && state.modelKindFilter.length) || 0;
      var total = methodCount + modelCount;
      methodFilterBtn.classList.toggle('active', total > 0);
      filterBadge.hidden = total === 0;
      filterBadge.textContent = String(total);
      filterItemEls['opra-methodFilter-ALL'].classList.toggle('sel', !methodCount);
      METHOD_FILTER_OPTIONS.forEach(function (m) {
        filterItemEls['opra-methodFilter-' + m].classList.toggle(
          'sel',
          !!(methodCount && state.methodFilter.indexOf(m) !== -1),
        );
      });
      filterItemEls['opra-modelKindFilter-ALL'].classList.toggle('sel', !modelCount);
      MODEL_KIND_FILTER_OPTIONS.forEach(function (kind) {
        filterItemEls['opra-modelKindFilter-' + kind].classList.toggle(
          'sel',
          !!(modelCount && state.modelKindFilter.indexOf(kind) !== -1),
        );
      });
    }
    syncFilterUi();

    var sidebar = el('div', { class: 'sidebar' }, [
      el('div', { class: 'sidebar-filter' }, [
        el('div', { class: 'sidebar-groupby-wrap' }, [groupByBtn, groupByMenu]),
        el('div', { class: 'sidebar-groupby-wrap' }, [methodFilterBtn, methodFilterMenu]),
        el('div', { class: 'search sidebar-filter-search' }, [sidebarFilterInput, sidebarFilterClear]),
      ]),
      navList,
    ]);
    var main = el('main', { class: 'main', id: 'opra-main' });
    app.appendChild(header);
    app.appendChild(sidebar);
    app.appendChild(main);

    // The Quick Filter box narrows the sidebar tree already on screen —
    // see its own `filterValue` line in `buildSidebar`.
    function onSidebarFilterInput() {
      sidebarFilterClear.hidden = !sidebarFilterInput.value;
      buildSidebar(navList, state.docKey, docs[state.docKey]);
      highlightActive(navList);
    }
    sidebarFilterInput.addEventListener('input', function () {
      onSidebarFilterInput();
    });
    // The visible "⌘K"/"Ctrl K" hint (see `kbdShortcutLabel`) promises
    // this actually works, not just decorates the search box — focusing
    // it is what opens the results popup (see `initSearchPopup`'s own
    // `focus` listener), so this is all ⌘K itself needs to do.
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        globalSearchInput.focus();
      }
    });
    window.addEventListener('hashchange', render);
    main.addEventListener('scroll', hideTypeTooltipNow);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
