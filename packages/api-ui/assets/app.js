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
      title: 'Copy to clipboard',
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
        var admTitle = adm[2] && adm[2].trim() ? adm[2].trim() : admType.toUpperCase();
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
    var node = el('div', { class: 'markdown' + (cls ? ' ' + cls : ''), html: mdToHtml(doc, description) });
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
  };

  var TEXT_ICONS = {
    array: '[ ]',
    union: '∪',
  };

  function iconFor(kind, cls) {
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
    if (ICONS[kind]) return '<span class="icon">' + ICONS[kind] + '</span>';
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

  function dataTypeGroupLabel(kind) {
    switch (kind) {
      case 'ComplexType':
        return 'Complex types';
      case 'SimpleType':
        return 'Simple types';
      case 'EnumType':
        return 'Enums';
      case 'ArrayType':
        return 'Arrays';
      case 'UnionType':
        return 'Unions';
      case 'MixinType':
        return 'Mixins';
      case 'MappedType':
        return 'Mapped types';
      default:
        return kind;
    }
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

  function typeLabel(doc, ref) {
    var u = unwrapArray(doc, ref);
    // `u.name` is set only for a *referenced* (named, non-inlined) type.
    // SimpleTypes are always inlined (even named/builtin ones — see
    // `schema-builder.ts`), so their own name travels on `u.def.name`
    // instead; fall back to the generic kind only for a truly anonymous type.
    var inner =
      u.name ||
      (u.def && u.def.name) ||
      (u.def && u.def.kind.replace('Type', '').toLowerCase()) ||
      'any';
    return u.prefix + inner + u.suffix;
  }

  /** A type-chip (icon + name, tinted by kind — same look as a markdown
   *  cross-reference) linking to that model's page, or an inline type's
   *  best label when it has no page of its own. A fields-bearing type with
   *  no name of its own is what OPRA calls "embedded" (a ComplexType et al.
   *  declared `{ embedded: true }`, meant to live only inside a field) —
   *  labeled as such rather than showing the uninformative raw kind name,
   *  since that's also why it isn't a clickable link. */
  function typeRefNode(doc, ref) {
    var u = unwrapArray(doc, ref);
    var d = u.def;
    var embedded = !!(d && !u.name && !d.name && d.fields);
    var name = u.name || (d && d.name) || (embedded ? 'embedded' : d && d.kind) || 'unknown';
    var iconKind = d ? dataTypeIconKind(d.kind) : 'cube';
    var attrs = { class: 'type-chip c-' + iconKind };
    if (u.name) attrs.href = hrefFor(state.docKey, 'model/' + encodeURIComponent(u.name));
    var node = el(u.name ? 'a' : 'span', attrs, [iconFor(iconKind), name]);
    attachTypeHover(node, doc, ref);
    return node;
  }

  // ---------- data-type hover tooltip ----------

  var typeTooltipEl = null;
  var typeTooltipTimer = null;

  function ensureTypeTooltip() {
    if (!typeTooltipEl) {
      typeTooltipEl = el('div', { class: 'type-tooltip' });
      document.body.appendChild(typeTooltipEl);
    }
    return typeTooltipEl;
  }

  function hideTypeTooltip() {
    if (typeTooltipTimer) {
      clearTimeout(typeTooltipTimer);
      typeTooltipTimer = null;
    }
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
    var name = u.name || d.name || (embedded ? 'embedded' : d.kind);
    var iconKind = dataTypeIconKind(d.kind);
    var tip = ensureTypeTooltip();
    clear(tip);
    tip.appendChild(
      el('div', { class: 'type-tooltip-head' }, [
        iconFor(iconKind, 'c-' + iconKind),
        el('span', { class: 'mono' }, [name]),
        el('span', { class: 'badge kind-badge c-' + iconKind }, [d.kind]),
      ]),
    );
    var brief = briefText(d.description, 220);
    tip.appendChild(
      el('div', { class: 'type-tooltip-desc' + (brief ? '' : ' empty') }, [brief || 'No description.']),
    );

    var rect = anchor.getBoundingClientRect();
    tip.style.left = rect.left + 'px';
    tip.style.top = rect.bottom + 6 + 'px';
    tip.classList.add('visible');
    requestAnimationFrame(function () {
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var tw = tip.offsetWidth;
      var th = tip.offsetHeight;
      if (rect.left + tw > vw - 8) tip.style.left = Math.max(8, vw - tw - 8) + 'px';
      if (rect.bottom + 6 + th > vh - 8) tip.style.top = Math.max(8, rect.top - th - 6) + 'px';
    });
  }

  /** Shows a small info popover (name, kind, description) after a short
   *  hover delay over any element that represents a reference to a data
   *  type — a field's type label, an Extends/Mixin link, a markdown
   *  type-chip. */
  function attachTypeHover(node, doc, ref) {
    node.addEventListener('mouseenter', function () {
      typeTooltipTimer = setTimeout(function () {
        showTypeTooltip(node, doc, ref);
      }, 450);
    });
    node.addEventListener('mouseleave', hideTypeTooltip);
  }

  /** What each field flag means — shown as its hover tooltip, since the
   *  short badge label alone ("exclusive", "localization"...) isn't
   *  self-explanatory. */
  var FLAG_HINTS = {
    required: 'This field must be provided.',
    deprecated: 'This field is deprecated and may be removed in the future.',
    readonly: 'This field is read-only — it cannot be set by the client.',
    writeonly: 'This field is write-only — it is not included in responses.',
    exclusive: 'This field is only returned when explicitly requested, not by default.',
    localization: 'This field supports localization — it can hold a separate value per language.',
  };

  /** A small badge for a boolean field trait (required, readonly, ...),
   *  with a hover tooltip explaining what it means. */
  function flagBadge(key, label) {
    return el('span', { class: 'flag', title: FLAG_HINTS[key] }, [label || key]);
  }

  /** A small "from X" flag shown at the end of an inherited field's line,
   *  naming whichever type actually declared it (rather than the type
   *  being viewed). Styled like the required/deprecated flags next to it —
   *  not as a standalone icon before the field name, which reads as the
   *  field's own identity marker (that's what type-kind icons mean
   *  elsewhere in this UI) rather than a provenance note. */
  function fromFlag(from) {
    var label = typeof from === 'string' ? from : (from && (from.name || from.kind)) || 'a base type';
    var title = 'Inherited from ' + label;
    if (typeof from === 'string') {
      return el(
        'a',
        { class: 'flag from-flag', title: title, href: hrefFor(state.docKey, 'model/' + encodeURIComponent(from)) },
        ['from ' + label],
      );
    }
    return el('span', { class: 'flag from-flag', title: title }, ['from ' + label]);
  }

  /** "Extends X" / "Mixin of (X, Y)" / "Mapped from X" — shown once, above
   *  a model page's title. Deliberately not repeated inline for every
   *  embedded/nested occurrence of a type (see `fromFlag` for the
   *  per-field equivalent), since that reads as noise rather than signal. */
  function renderInherits(doc, inherits) {
    if (!inherits || !inherits.types || !inherits.types.length) return null;
    var chips = [];
    inherits.types.forEach(function (t, i) {
      if (i > 0) chips.push(text(', '));
      chips.push(typeRefNode(doc, t));
    });
    var prefix =
      inherits.kind === 'mixin' ? 'Mixin of ' : inherits.kind === 'mapped' ? 'Mapped from ' : 'Extends ';
    return el('p', { class: 'inherits' }, [prefix].concat(chips));
  }

  /** A field's type: the same tinted icon-chip used everywhere else on the
   *  page (Mixin of / References to this Resource / markdown cross-refs),
   *  with a TypeScript-style `[]` suffix (muted, plain text, after the
   *  chip) per array layer — `string[]`, or `string[][]` for an array of
   *  arrays. Every named type — including EnumType — is just a chip here:
   *  hovering shows a quick summary, clicking goes to its own page for the
   *  full detail (e.g. an enum's full value list). */
  function fieldTypeNode(doc, ref) {
    var u = unwrapArray(doc, ref);
    var chip = typeRefNode(doc, ref);
    if (!u.prefix && !u.suffix) return chip;
    return el('span', { class: 'field-type' }, [u.prefix, chip, u.suffix]);
  }

  /** "minValue" -> "Min value" — for labeling a SimpleType property whose
   *  raw key is a camelCase identifier. */
  function humanizePropKey(key) {
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
      container.appendChild(
        el('div', { class: 'prop-row' }, [
          el('span', { class: 'prop-key', title: desc || null }, [humanizePropKey(key) + ': ']),
          key === 'pattern' ? el('code', {}, [String(value)]) : text(String(value)),
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
            el('span', { class: 'prop-key' }, ['Min array items: ']),
            text(String(c.minOccurs)),
          ]),
        );
      }
      if (c.maxOccurs != null) {
        container.appendChild(
          el('div', { class: 'prop-row' }, [
            el('span', { class: 'prop-key' }, ['Max array items: ']),
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
      el('span', { class: 'prop-key' }, [values.length > 1 ? 'Examples: ' : 'Example: ']),
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
      fieldTypeNode(doc, ref2),
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

    // Anything unnamed (embedded ComplexType/MappedType/MixinType fields,
    // and anonymous unions) is walked inline — there's nowhere else to
    // point a reader to see it. Anything named (including EnumType) is
    // just the chip above.
    if (d && !u.name && d.fields) {
      var nestedFields = el('div', { class: 'field-nested' });
      renderFieldRows(doc, d.fields).forEach(function (r) {
        nestedFields.appendChild(r);
      });
      row.appendChild(nestedFields);
    } else if (d && !u.name && d.kind === 'UnionType') {
      var nested = el('div', { class: 'field-nested' });
      (d.types || []).forEach(function (t) {
        nested.appendChild(renderFieldNode(doc, null, t, null));
      });
      row.appendChild(nested);
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
    if (!keys.length) return el('div', { class: 'empty-note' }, ['No values.']);
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

  /** The page's own "Fields" section: the type's fields/values/members
   *  rendered directly, without a redundant row repeating the type's own
   *  name (the page's `<h1>` and "Fields" heading already say what this
   *  is). Nested field types stop at one level — see `renderFieldNode`. */
  function renderTypeTree(doc, ref) {
    var container = el('div', { class: 'field-list' });
    var u = unwrapArray(doc, ref);
    var d = u.def;
    if (!d) return container;
    if (d.fields) {
      var rows = renderFieldRows(doc, d.fields);
      rows.forEach(function (r) {
        container.appendChild(r);
      });
      if (!rows.length) return el('div', { class: 'empty-note' }, ['No fields.']);
    } else if (d.kind === 'EnumType') {
      return renderEnumValues(doc, d);
    } else if (d.kind === 'UnionType') {
      (d.types || []).forEach(function (t) {
        container.appendChild(renderFieldNode(doc, null, t, null));
      });
    } else if (d.kind === 'SimpleType') {
      var propRows = d.properties && renderSimpleTypePropertyRows(doc, d.properties, d.propertyDescriptions);
      if (propRows && propRows.length) {
        propRows.forEach(function (r) {
          container.appendChild(r);
        });
      } else {
        return el('div', { class: 'empty-note' }, ['No properties.']);
      }
    } else {
      return el('div', { class: 'empty-note' }, ['No fields.']);
    }
    return container;
  }

  /** Prepends the "Extends X" / "Mixin of (...)" / "Mapped from X"
   *  composition line before a type's field tree, wherever that tree is
   *  shown outside the type's own dedicated model page (a model page
   *  already shows it next to its kind badge, via `renderInherits`) — e.g.
   *  a request/response body whose type is a MappedType or MixinType. */
  function renderTypeTreeWithInherits(doc, ref) {
    var u = unwrapArray(doc, ref);
    var d = u.def;
    var container = el('div', {});
    if (d && d.inherits) {
      var inheritsBlock = renderInherits(doc, d.inherits);
      if (inheritsBlock) container.appendChild(inheritsBlock);
    }
    container.appendChild(renderTypeTree(doc, ref));
    return container;
  }

  function statusClass(code) {
    if (typeof code !== 'number') return '';
    return 'status-' + Math.floor(code / 100);
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
        var contentPre = el('pre', { class: 'license-content' }, [lic.content]);
        contentPre.hidden = true;
        var toggleBtn = el('button', { class: 'text-toggle-btn', type: 'button' }, ['View full text']);
        toggleBtn.addEventListener('click', function () {
          contentPre.hidden = !contentPre.hidden;
          toggleBtn.textContent = contentPre.hidden ? 'View full text' : 'Hide full text';
        });
        row.appendChild(toggleBtn);
        body.push(contentPre);
      }
      items.push(metaItem('License', 'scale', body));
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
        metaItem(info.contact.length > 1 ? 'Contacts' : 'Contact', 'users', [
          el('div', { class: 'contact-cards' }, cards),
        ]),
      );
    }

    if (info.termsOfService) {
      if (isHttpUrl(info.termsOfService)) {
        items.push(
          metaItem('Terms of Service', 'book', [
            el('a', { href: info.termsOfService, target: '_blank', rel: 'noopener' }, ['View terms of service ↗']),
          ]),
        );
      } else {
        // A long inline terms text is clamped to 3 lines by default, with a
        // "Show more" toggle — added only once the text is confirmed to
        // actually overflow that clamp (measured post-layout), rather than
        // showing a toggle for a one-line blurb that never needed one.
        var textEl = el('div', { class: 'terms-text clamped' }, [info.termsOfService]);
        var moreBtn = el('button', { class: 'text-toggle-btn', type: 'button' }, ['Show more']);
        moreBtn.hidden = true;
        moreBtn.addEventListener('click', function () {
          var stillClamped = textEl.classList.toggle('clamped');
          moreBtn.textContent = stillClamped ? 'Show more' : 'Show less';
        });
        items.push(metaItem('Terms of Service', 'book', [textEl, moreBtn]));
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
    var section = el('div', { class: 'section' }, [el('h2', {}, ['Reference documents'])]);
    keys.sort().forEach(function (ns) {
      var rinfo = (embedded.refs[ns] && embedded.refs[ns].info) || {};
      section.appendChild(
        el('a', { class: 'row-link', href: hrefFor(ns, '') }, [
          iconFor('book'),
          el('span', { class: 'mono' }, [rinfo.title || ns]),
          rinfo.version ? el('span', { class: 'row-desc' }, ['v' + rinfo.version]) : null,
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
    var section = el('div', { class: 'section' }, [el('h2', {}, ['Controllers'])]);
    names.sort().forEach(function (name) {
      var ctrl = controllers[name];
      var n = countOperations(ctrl);
      section.appendChild(
        el('a', { class: 'row-link', href: hrefFor(docKey, 'ctl/' + encodeURIComponent(name)) }, [
          iconFor('folder', 'c-folder'),
          el('span', { class: 'mono' }, [name]),
          el('span', { class: 'row-desc' }, [n + (n === 1 ? ' operation' : ' operations')]),
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
    var section = el('div', { class: 'section' }, [el('h2', {}, ['Models'])]);
    var chipRow = el('div', { class: 'stat-chips' });
    TYPE_GROUP_ORDER.concat(kinds.filter(function (k) { return TYPE_GROUP_ORDER.indexOf(k) === -1; })).forEach(
      function (kind) {
        if (!byKind[kind]) return;
        var names = byKind[kind].sort();
        var iconKind = dataTypeIconKind(kind);
        var label = dataTypeGroupLabel(kind);
        if (names.length === 1) label = label.replace(/s$/, '');
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
      el('h1', {}, [
        info.title || 'API Reference',
        info.version ? el('span', { class: 'badge' }, ['v' + info.version]) : null,
      ]),
    );
    if (doc.api && doc.api.url) {
      main.appendChild(el('p', { class: 'description path' }, ['Server: ' + doc.api.url]));
    }
    renderInfoMeta(main, doc, info);

    var descBlock = mdBlock(doc, info.description);
    if (descBlock) {
      main.appendChild(el('div', { class: 'section' }, [el('h2', {}, ['Description']), descBlock]));
    }

    // `embedded.refs` is always the *root* document's own references (only
    // one level deep — see `ApiUiFactory.render`), so this section only
    // makes sense on the root's own Document Info page; showing it while
    // viewing a reference document itself would misleadingly look like
    // that document references itself/its siblings.
    if (state.docKey === 'root') renderReferencesSection(main);
    renderControllersSection(main, state.docKey, doc);
    renderModelsSection(main, state.docKey, doc);
  }

  function renderControllerPage(main, docKey, doc, found, ctrlRoute) {
    var ctrl = found.ctrl;
    main.appendChild(el('h1', { class: 'mono' }, [found.name]));
    main.appendChild(el('p', { class: 'description path' }, [found.ctrlPath || '/']));
    var ctrlDescBlock = mdBlock(doc, ctrl.description);
    if (ctrlDescBlock) main.appendChild(ctrlDescBlock);

    var ops = ctrl.operations ? Object.keys(ctrl.operations) : [];
    if (ops.length) {
      var opSection = el('div', { class: 'section' }, [el('h2', {}, ['Operations'])]);
      ops.forEach(function (opKey) {
        var op = ctrl.operations[opKey];
        opSection.appendChild(
          el(
            'a',
            { class: 'row-link', href: hrefFor(docKey, ctrlRoute + '/' + encodeURIComponent(opKey)) },
            [methodBadge(op.method), el('span', { class: 'mono' }, [opKey + '()']), op.description ? el('span', { class: 'row-desc' }, [op.description]) : null],
          ),
        );
      });
      main.appendChild(opSection);
    }

    var children = ctrl.controllers ? Object.keys(ctrl.controllers) : [];
    if (children.length) {
      var childSection = el('div', { class: 'section' }, [el('h2', {}, ['Child controllers'])]);
      children.forEach(function (name) {
        var child = ctrl.controllers[name];
        childSection.appendChild(
          el('a', { class: 'row-link', href: hrefFor(docKey, ctrlRoute + '/' + encodeURIComponent(name)) }, [
            iconFor('folder', 'c-folder'),
            el('span', { class: 'mono' }, [name]),
            el('span', { class: 'row-desc path' }, [controllerPath(child, found.ctrlPath)]),
          ]),
        );
      });
      main.appendChild(childSection);
    }

    if (!ops.length && !children.length) {
      main.appendChild(el('div', { class: 'section empty-note' }, ['This controller has no operations or child controllers.']));
    }
  }

  function renderOperationPage(main, docKey, doc, found) {
    var op = found.op;
    var fullPath = operationPath(found.ctrlPath, op);

    main.appendChild(el('h1', { class: 'mono' }, [found.opKey + '()']));
    var sub = el('p', { class: 'op-sub' }, [methodBadge(op.method), el('span', { class: 'path' }, [fullPath])]);
    main.appendChild(sub);
    if (found.ctrlName) {
      main.appendChild(
        el('p', { class: 'description' }, [
          'Part of ',
          el('a', { href: hrefFor(docKey, found.ctrlRoute) }, [found.ctrlName]),
        ]),
      );
    }

    if (op.deprecated) {
      main.appendChild(
        el('span', { class: 'badge deprecated' }, [typeof op.deprecated === 'string' ? 'deprecated: ' + op.deprecated : 'deprecated']),
      );
    }
    if (op.composition) main.appendChild(el('div', { class: 'badge' }, ['composition: ' + op.composition]));
    var opDescBlock = mdBlock(doc, op.description);
    if (opDescBlock) main.appendChild(opDescBlock);

    if (op.parameters && op.parameters.length) {
      ['path', 'query', 'header', 'cookie'].forEach(function (loc) {
        var params = op.parameters.filter(function (p) {
          return p.location === loc;
        });
        if (!params.length) return;
        var section = el('div', { class: 'section' }, [
          el('h2', {}, [loc.charAt(0).toUpperCase() + loc.slice(1) + ' parameters']),
        ]);
        var table = el('table', { class: 'props' }, [
          el('tr', {}, [el('th', {}, ['Name']), el('th', {}, ['Type']), el('th', {}, ['Required']), el('th', {}, ['Description'])]),
        ]);
        params.forEach(function (p) {
          table.appendChild(
            el('tr', {}, [
              el('td', {}, [el('code', {}, [String(p.name)])]),
              el('td', {}, [typeLabel(doc, p.type)]),
              el('td', {}, [p.required ? 'yes' : 'no']),
              el('td', {}, [mdBlock(doc, p.description) || '']),
            ]),
          );
        });
        section.appendChild(table);
        main.appendChild(section);
      });
    }

    if (op.requestBody) {
      var rbSection = el('div', { class: 'section' }, [el('h2', {}, ['Request body'])]);
      var rbDescBlock = mdBlock(doc, op.requestBody.description);
      if (rbDescBlock) rbSection.appendChild(rbDescBlock);
      (op.requestBody.content || []).forEach(function (media) {
        rbSection.appendChild(el('div', { class: 'badge' }, [media.contentType || 'application/json']));
        if (media.type) rbSection.appendChild(renderTypeTreeWithInherits(doc, media.type));
      });
      main.appendChild(rbSection);
    }

    if (op.responses && op.responses.length) {
      var resSection = el('div', { class: 'section' }, [el('h2', {}, ['Responses'])]);
      op.responses.forEach(function (r) {
        var block = el('div', { class: 'response-block' }, [
          el('div', { class: 'status-line ' + statusClass(typeof r.statusCode === 'number' ? r.statusCode : 0) }, [
            formatStatusCode(r.statusCode) + (r.description ? ' — ' + r.description : ''),
          ]),
        ]);
        var body = el('div', { class: 'body' });
        if (r.type) body.appendChild(renderTypeTreeWithInherits(doc, r.type));
        else body.appendChild(el('div', { class: 'empty-note' }, ['No body']));
        block.appendChild(body);
        resSection.appendChild(block);
      });
      main.appendChild(resSection);
    } else {
      main.appendChild(el('div', { class: 'section empty-note' }, ['No documented responses.']));
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
        el('span', { class: 'key' }, ['Example ' + (i + 1)]),
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
          el('span', { class: 'example-desc', html: '— ' + mdInline(doc, ex.description) }),
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
      el('h2', {}, ['Example']),
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
      main.appendChild(el('div', { class: 'empty-note' }, ['Model not found.']));
      return;
    }
    var inheritsBlock = renderInherits(doc, def.inherits);
    if (inheritsBlock) main.appendChild(inheritsBlock);

    var modelDescBlock = mdBlock(doc, def.description);
    if (modelDescBlock) {
      main.appendChild(el('div', { class: 'section' }, [el('h2', {}, ['Description']), modelDescBlock]));
    }

    var referencedBy = findReferencingTypes(doc, typeName);
    if (referencedBy.length) {
      main.appendChild(
        el('div', { class: 'section' }, [
          el('h2', {}, ['References to this Resource']),
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
        ? 'Values'
        : def.kind === 'UnionType'
          ? 'Types'
          : def.kind === 'SimpleType'
            ? 'Properties'
            : 'Fields';
    main.appendChild(
      el('div', { class: 'section' }, [el('h2', {}, [fieldsHeading]), renderTypeTree(doc, typeName)]),
    );

    var typeExamplesNode = renderTypeExamples(doc, def.examples);
    if (typeExamplesNode) {
      main.appendChild(el('div', { class: 'section' }, [el('h2', {}, ['Examples']), typeExamplesNode]));
    }

    if (def.kind === 'ComplexType' || def.kind === 'MappedType' || def.kind === 'MixinType') {
      main.appendChild(renderExampleBlock(doc, typeName));
    }
  }

  // ---------- sidebar ----------

  function buildSidebar(nav, docKey, doc) {
    clear(nav);
    var filterValue = ((document.getElementById('opra-search') || {}).value || '').toLowerCase();
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
          el('span', { class: 'name' }, ['Document Info']),
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
        anyCtrl = true;

        var childNodes = [];
        if (ctrl.operations) {
          Object.keys(ctrl.operations).forEach(function (opKey) {
            var op = ctrl.operations[opKey];
            var opHay = (opKey + ' ' + op.method + ' ' + operationPath(path, op)).toLowerCase();
            if (filterValue && opHay.indexOf(filterValue) === -1) return;
            var opRoute = route + '/' + encodeURIComponent(opKey);
            anyCtrl = true;
            childNodes.push(
              el('a', { class: 'nav-link nav-op depth-' + (depth + 1), href: hrefFor(docKey, opRoute) }, [
                iconFor('operation', 'c-op'),
                el('span', { class: 'name mono' }, [opKey]),
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
                  var nowCollapsed = !filterValue && !!collapsedNav[route];
                  wrap.classList.toggle('collapsed', nowCollapsed);
                  toggle.classList.toggle('collapsed', nowCollapsed);
                },
              },
              [iconFor('chevronDown')],
            )
          : null;
        nodes.push(
          el(
            'a',
            { class: 'nav-link nav-ctrl depth-' + depth, href: hrefFor(docKey, route) },
            [iconFor('folder', 'c-folder'), el('span', { class: 'name mono' }, [name]), toggle],
          ),
        );
        if (wrap) nodes.push(wrap);
      });
      return nodes;
    }

    var controllers = (doc.api && doc.api.controllers) || {};
    var anyCtrl = false;
    var ctlChildNodes = buildControllerNodes(controllers, '', 'ctl', 0);
    if (!anyCtrl) {
      // No controllers in this document at all (e.g. a models-only
      // reference doc) — omit the section entirely rather than showing an
      // empty "Controllers" heading. A search that filtered every result
      // out still gets a "No matches." note, since there's something to
      // say there.
      if (Object.keys(controllers).length) {
        var ctlEmptyTitle = buildCollapsibleSection('group-title', 'Controllers', 'controllers', activeInCtl, [
          el('div', { class: 'empty-note' }, ['No matches.']),
        ]);
        nav.appendChild(el('div', { class: 'group' }, [ctlEmptyTitle.title, ctlEmptyTitle.wrap]));
      }
    } else {
      var ctlSection = buildCollapsibleSection('group-title', 'Controllers', 'controllers', activeInCtl, ctlChildNodes);
      nav.appendChild(el('div', { class: 'group' }, [ctlSection.title, ctlSection.wrap]));
    }

    // The "Models" nav lists only the document's own declared types (what
    // it was actually given via `types: [...]`) — not every type reached
    // incidentally while walking controllers/operations above (e.g. a
    // field's type), which remain reachable by following a reference but
    // aren't advertised as one of this document's own models.
    var types = doc.types || {};
    var declaredNames = doc.declaredTypes || Object.keys(types);
    var byKind = {};
    declaredNames.forEach(function (name) {
      if (!types[name]) return;
      if (filterValue && name.toLowerCase().indexOf(filterValue) === -1) return;
      var kind = types[name].kind;
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
              el('span', { class: 'name mono' }, [name]),
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
      var modelsSection = buildCollapsibleSection('group-title', 'Models', 'models', activeInModels, modelBody);
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
    var current = el('div', { class: 'picker', id: 'opra-picker-btn' }, [
      iconFor('book'),
      el('span', { class: 'picker-label' }, [docTitle(state.docKey)]),
      iconFor('chevronDown'),
    ]);
    container.appendChild(current);

    var refKeys = Object.keys(docs).filter(function (k) {
      return k !== 'root';
    });
    if (!refKeys.length) return; // nothing to switch to — plain, non-interactive label

    var menu = el('div', { class: 'picker-menu', id: 'opra-picker-menu' });
    menu.hidden = true;
    menu.appendChild(el('div', { class: 'group-label' }, ['This document']));
    var rootInfo = docs.root.info || {};
    menu.appendChild(
      pickerItem('root', rootInfo.title || 'root', 'root' + (rootInfo.version ? ' · v' + rootInfo.version : '')),
    );
    menu.appendChild(el('div', { class: 'group-label' }, ['References']));
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
    hideTypeTooltip();
    var parsed = parseHash();
    var main = document.getElementById('opra-main');
    var nav = document.getElementById('opra-nav');
    var picker = document.getElementById('opra-picker');

    // Every page's content lives inside this inner wrapper rather than
    // directly in `.main` (the scroll container) — it's what caps the
    // reading width (see `.content-col`) and what `buildToc` scans for
    // `h2` section headings, so a page's own render*Page(main, ...) calls
    // below still just append into "main" by name, unaware it's this
    // wrapper rather than the scroll container itself. `toc` rides next
    // to it in `.page-row` (a flex row, not a grid track of its own — see
    // that rule's comment) so the TOC rail stays visually attached to
    // the content it describes instead of pinned to the viewport edge.
    clear(main);
    var content = el('div', { class: 'content-col' });
    var toc = el('div', { class: 'toc' });
    main.appendChild(el('div', { class: 'page-row' }, [content, toc]));

    var doc = docs[parsed.docKey];
    if (!doc) {
      content.appendChild(el('div', { class: 'empty-note' }, ['Unknown document: ' + parsed.docKey]));
      buildToc(content, toc);
      return;
    }
    state.docKey = parsed.docKey;
    buildSidebar(nav, state.docKey, doc);
    buildPicker(picker);
    highlightActive(nav);

    var rest = parsed.rest;
    var handled = false;
    if (!rest.length) {
      renderOverviewPage(content, doc);
      handled = true;
    } else if (rest[0] === 'model' && rest[1]) {
      renderModelPage(content, doc, decodeURIComponent(rest[1]));
      handled = true;
    } else if (rest[0] === 'ctl') {
      var op = findOperationByRoute(doc, rest.join('/'));
      if (op) {
        renderOperationPage(content, state.docKey, doc, op);
        handled = true;
      } else {
        var ctl = findControllerByRoute(doc, rest.join('/'));
        if (ctl) {
          renderControllerPage(content, state.docKey, doc, ctl, rest.join('/'));
          handled = true;
        }
      }
    }
    if (!handled) {
      content.appendChild(el('div', { class: 'empty-note' }, ['Page not found.']));
    }
    buildToc(content, toc);
  }

  var tocScrollHandler = null;

  /** Populates the "on this page" rail (a fresh `.toc` element built
   *  alongside `content` for this render — see `render()`) from the page
   *  that was just rendered into `content`: one entry per `h2` section
   *  heading (Description/Fields/Examples/...), in document order.
   *  Clicking an entry scrolls straight to its heading via
   *  `scrollIntoView` rather than an `href="#..."` anchor, since
   *  `location.hash` is this app's own routing signal (see `parseHash`)
   *  and setting it to a heading name would be read as a navigation, not
   *  a same-page scroll. The entry nearest the top of the reading pane is
   *  kept highlighted by a scroll listener on `.main`, torn down before
   *  every rebuild so listeners don't pile up across page changes on the
   *  same DOM node. */
  function buildToc(content, toc) {
    var main = document.getElementById('opra-main');
    if (tocScrollHandler) {
      main.removeEventListener('scroll', tocScrollHandler);
      tocScrollHandler = null;
    }
    var headings = Array.prototype.slice.call(content.querySelectorAll('h2'));
    if (!headings.length) {
      toc.appendChild(el('div', { class: 'toc-empty' }, ['No sections']));
      return;
    }
    toc.appendChild(el('div', { class: 'toc-title' }, ['On this page']));
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
      title: 'Toggle color theme',
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

  function init() {
    var app = document.getElementById('app');
    var ui = window.__OPRA_UI__ || {};

    // The logo (if any) anchors the header's left edge; `.search`'s own
    // `margin-left: auto` (see CSS) is what actually pushes the search
    // box to the right regardless of whether a logo is present —
    // Docusaurus's own navbar layout (logo/brand left, search right).
    var headerChildren = [];
    if (ui.logo) {
      // Always the *main* (root) document's own "Document Info" page —
      // a fixed "home" destination, unlike the document picker below it
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
        [el('img', { src: ui.logo.src, alt: ui.logo.alt || ui.logo.label || 'Logo' })],
      );
      if (ui.logo.label) logoLink.appendChild(el('span', { class: 'header-logo-label' }, [ui.logo.label]));
      headerChildren.push(logoLink);
    }
    // Root document's own version — "the main document", as opposed to
    // whichever one happens to be active (a reference doc's version
    // would be a different, and less useful, thing to show up here).
    var rootVersion = docs.root && docs.root.info && docs.root.info.version;
    var headerRight = [];
    if (rootVersion) {
      headerRight.push(el('span', { class: 'header-version' }, ['v' + rootVersion]));
    }
    headerRight.push(themeToggleButton());
    headerRight.push(
      el('div', { class: 'search' }, [
        el('input', { id: 'opra-search', type: 'search', placeholder: 'Search' }),
        el('span', { class: 'search-kbd' }, [kbdShortcutLabel()]),
      ]),
    );
    headerChildren.push(el('div', { class: 'header-right' }, headerRight));
    var header = el('div', { class: 'header' }, headerChildren);
    // The document picker moves here — where the search box used to sit,
    // right above the sidebar it controls — now that search has moved up
    // into the header.
    var docBar = el('div', { class: 'search-bar' }, [el('div', { class: 'picker-wrap', id: 'opra-picker' })]);
    var nav = el('nav', { class: 'sidebar', id: 'opra-nav' });
    var main = el('main', { class: 'main', id: 'opra-main' });
    app.appendChild(header);
    app.appendChild(docBar);
    app.appendChild(nav);
    app.appendChild(main);

    var searchInput = document.getElementById('opra-search');
    searchInput.addEventListener('input', function () {
      buildSidebar(nav, state.docKey, docs[state.docKey]);
      highlightActive(nav);
    });
    // The visible "⌘K"/"Ctrl K" hint (see `kbdShortcutLabel`) promises
    // this actually works, not just decorates the search box.
    document.addEventListener('keydown', function (e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });
    window.addEventListener('hashchange', render);
    main.addEventListener('scroll', hideTypeTooltip);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
