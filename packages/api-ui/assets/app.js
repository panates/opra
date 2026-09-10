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

  // ---------- minimal markdown renderer (no external dependency) ----------

  /** Escapes text before any markdown-driven HTML is generated from it. */
  function mdEscape(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Inline markdown: `code`, **bold**, *italic*, [text](https://url) and
   *  [text](#/model/Name) — the latter navigates within the reference UI
   *  itself, so descriptions can cross-link to other models/operations. */
  function mdInline(raw) {
    var s = mdEscape(raw);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*(?!\*)/g, '$1<em>$2</em>');
    s = s.replace(/\[([^\]]+)\]\((#[^)\s]+|https?:\/\/[^)\s]+)\)/g, function (m, label, href) {
      var isHash = href.charAt(0) === '#';
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

  /** A small, safe subset of markdown: headings, paragraphs, blockquotes,
   *  ordered/unordered lists, and the inline styles above. Good enough for
   *  API/model descriptions without pulling in a markdown dependency. */
  function mdToHtml(src) {
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
        html += '<h' + level + '>' + mdInline(h[2]) + '</h' + level + '>';
        i++;
        continue;
      }
      if (/^>\s?/.test(line)) {
        var quoteLines = [];
        while (i < lines.length && /^>\s?/.test(lines[i])) {
          quoteLines.push(lines[i].replace(/^>\s?/, ''));
          i++;
        }
        html += '<blockquote>' + mdInline(quoteLines.join(' ')) + '</blockquote>';
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        var uItems = [];
        while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
          uItems.push('<li>' + mdInline(lines[i].replace(/^[-*]\s+/, '')) + '</li>');
          i++;
        }
        html += '<ul>' + uItems.join('') + '</ul>';
        continue;
      }
      if (/^\d+\.\s+/.test(line)) {
        var oItems = [];
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          oItems.push('<li>' + mdInline(lines[i].replace(/^\d+\.\s+/, '')) + '</li>');
          i++;
        }
        html += '<ol>' + oItems.join('') + '</ol>';
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
      html += '<p>' + mdInline(para.join(' ')) + '</p>';
    }
    return html;
  }

  /** Renders a markdown description as a block-level element, or `null` when empty. */
  function mdBlock(description, cls) {
    if (!description) return null;
    return el('div', { class: 'markdown' + (cls ? ' ' + cls : ''), html: mdToHtml(description) });
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
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><path d="M5 4h9M5 8h9M5 12h9"/><circle cx="2" cy="4" r=".9" fill="currentColor" stroke="none"/><circle cx="2" cy="8" r=".9" fill="currentColor" stroke="none"/><circle cx="2" cy="12" r=".9" fill="currentColor" stroke="none"/></svg>',
    book:
      '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"><path d="M2 2.6h4.4c1 0 1.6.6 1.6 1.6v9.2c0-.8-.6-1.4-1.6-1.4H2V2.6ZM14 2.6H9.6C8.6 2.6 8 3.2 8 4.2v9.2c0-.8.6-1.4 1.6-1.4H14V2.6Z"/></svg>',
    chevronDown:
      '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6 8 10.5 12.5 6"/></svg>',
    chevronRight:
      '<svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3.5 10.5 8 6 12.5"/></svg>',
  };

  var TEXT_ICONS = {
    simple: 'Aa',
    array: '[ ]',
    union: '∪',
    mixin: '⊕',
    mapped: '⇆',
  };

  function iconFor(kind, cls) {
    if (ICONS[kind]) return svg(ICONS[kind], cls);
    var label = TEXT_ICONS[kind] || '?';
    return el('span', { class: 'icon text-icon ' + (cls || '') }, [label]);
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
   *  resolved type plus an `array<...>` prefix/suffix pair for display.
   *  Array-ness is read structurally from ArrayType — the sibling `isArray`
   *  flag some schema nodes carry is deprecated and never consulted. */
  function unwrapArray(doc, ref) {
    var r = resolveType(doc, ref);
    var prefix = '';
    var suffix = '';
    while (r.def && r.def.kind === 'ArrayType') {
      prefix += 'array<';
      suffix = '>' + suffix;
      r = resolveType(doc, r.def.type);
    }
    return { name: r.name, def: r.def, prefix: prefix, suffix: suffix };
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

  function renderTypeTree(doc, ref, seen) {
    seen = seen || [];
    var container = el('div', { class: 'tree' });

    function renderNode(name, ref2, extra, seenNames) {
      var u = unwrapArray(doc, ref2);
      var d = u.def;
      var row = el('div', { class: 'node' });
      var head = el('span', {}, [
        name ? el('span', { class: 'key' }, [name]) : null,
        name ? text(': ') : null,
        el('span', { class: 'type' }, [
          u.prefix + (u.name || (d && d.name) || (d && d.kind) || 'any') + u.suffix,
        ]),
      ]);
      if (extra && extra.required) head.appendChild(el('span', { class: 'flag' }, ['required']));
      if (extra && extra.deprecated) head.appendChild(el('span', { class: 'flag' }, ['deprecated']));
      row.appendChild(head);
      if (extra && extra.description) {
        row.appendChild(mdBlock(extra.description, 'field-description'));
      }

      if (!d) return row;
      if (u.name && seenNames.indexOf(u.name) !== -1) {
        row.appendChild(el('div', { class: 'flag' }, ['(circular reference)']));
        return row;
      }
      var nextSeen = u.name ? seenNames.concat([u.name]) : seenNames;

      // ComplexType, MixinType and MappedType all share the framework's
      // ComplexTypeBase implementation: base/mixin/pick-omit-partial merges
      // are already resolved into one flat `fields` map server-side (see
      // `ApiUiSchemaBuilder`), so all three render identically here — no
      // `base`/`types` chain to walk on this side.
      if (d.fields) {
        var indent = el('div', { class: 'indent' });
        Object.keys(d.fields).forEach(function (fname) {
          var f = d.fields[fname];
          indent.appendChild(
            renderNode(
              fname,
              f.type,
              {
                required: f.required,
                deprecated: f.deprecated,
                description: f.description,
              },
              nextSeen,
            ),
          );
        });
        row.appendChild(indent);
      } else if (d.kind === 'ComplexType' || d.kind === 'MixinType' || d.kind === 'MappedType') {
        row.appendChild(el('div', { class: 'indent' }, [el('div', { class: 'flag' }, ['(no fields)'])]));
      } else if (d.kind === 'EnumType') {
        var values = d.values || {};
        var indentEnum = el('div', { class: 'indent enum-values' });
        Object.keys(values).forEach(function (val) {
          var meta = values[val] || {};
          var valueRow = el('div', { class: 'node enum-value' }, [el('span', { class: 'key' }, [val])]);
          if (meta.description) valueRow.appendChild(mdBlock(meta.description, 'enum-value-description'));
          indentEnum.appendChild(valueRow);
        });
        if (!Object.keys(values).length) {
          indentEnum.appendChild(el('div', { class: 'flag' }, ['(no values)']));
        }
        row.appendChild(indentEnum);
      } else if (d.kind === 'UnionType') {
        var indent3 = el('div', { class: 'indent' });
        (d.types || []).forEach(function (t) {
          indent3.appendChild(renderNode(null, t, null, nextSeen));
        });
        row.appendChild(indent3);
      } else if (d.kind === 'SimpleType' && d.properties && Object.keys(d.properties).length) {
        row.appendChild(
          el('div', { class: 'indent' }, [el('span', { class: 'flag' }, [JSON.stringify(d.properties)])]),
        );
      }
      return row;
    }

    container.appendChild(renderNode(null, ref, null, seen));
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

  function renderOverviewPage(main, doc) {
    var info = doc.info || {};
    main.appendChild(el('h1', {}, [info.title || 'API Reference']));
    if (info.version) main.appendChild(el('span', { class: 'badge' }, ['v' + info.version]));
    if (doc.api && doc.api.url) {
      main.appendChild(el('p', { class: 'description' }, ['Server: ' + doc.api.url]));
    }
    var descBlock = mdBlock(info.description, 'section');
    if (descBlock) main.appendChild(descBlock);
    var opCount = 0;
    var ctrlCount = Object.keys((doc.api && doc.api.controllers) || {}).length;
    walkControllers((doc.api && doc.api.controllers) || {}, '', 'ctl', null, function () {
      opCount++;
    });
    var typeCount = Object.keys(doc.types || {}).length;
    main.appendChild(
      el('div', { class: 'section description' }, [
        ctrlCount + ' top-level controller(s), ' + opCount + ' operation(s), ' + typeCount + ' named model(s).',
      ]),
    );
  }

  function renderControllerPage(main, docKey, doc, found, ctrlRoute) {
    var ctrl = found.ctrl;
    main.appendChild(el('h1', { class: 'mono' }, [found.name]));
    main.appendChild(el('p', { class: 'description path' }, [found.ctrlPath || '/']));
    var ctrlDescBlock = mdBlock(ctrl.description);
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
    var opDescBlock = mdBlock(op.description);
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
              el('td', {}, [mdBlock(p.description) || '']),
            ]),
          );
        });
        section.appendChild(table);
        main.appendChild(section);
      });
    }

    if (op.requestBody) {
      var rbSection = el('div', { class: 'section' }, [el('h2', {}, ['Request body'])]);
      var rbDescBlock = mdBlock(op.requestBody.description);
      if (rbDescBlock) rbSection.appendChild(rbDescBlock);
      (op.requestBody.content || []).forEach(function (media) {
        rbSection.appendChild(el('div', { class: 'badge' }, [media.contentType || 'application/json']));
        if (media.type) rbSection.appendChild(renderTypeTree(doc, media.type));
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
        if (r.type) body.appendChild(renderTypeTree(doc, r.type));
        else body.appendChild(el('div', { class: 'empty-note' }, ['No body']));
        block.appendChild(body);
        resSection.appendChild(block);
      });
      main.appendChild(resSection);
    } else {
      main.appendChild(el('div', { class: 'section empty-note' }, ['No documented responses.']));
    }
  }

  function renderModelPage(main, doc, typeName) {
    var def = doc.types && doc.types[typeName];
    main.appendChild(
      el('h1', { class: 'mono' }, [
        def ? iconFor(dataTypeIconKind(def.kind), 'c-' + dataTypeIconKind(def.kind)) : null,
        typeName,
      ]),
    );
    if (!def) {
      main.appendChild(el('div', { class: 'empty-note' }, ['Model not found.']));
      return;
    }
    main.appendChild(el('span', { class: 'badge' }, [def.kind]));
    var modelDescBlock = mdBlock(def.description);
    if (modelDescBlock) main.appendChild(modelDescBlock);
    main.appendChild(el('div', { class: 'section' }, [renderTypeTree(doc, typeName)]));
  }

  // ---------- sidebar ----------

  function buildSidebar(nav, docKey, doc) {
    clear(nav);
    var filterValue = ((document.getElementById('opra-search') || {}).value || '').toLowerCase();

    var ctlGroup = el('div', { class: 'group' }, [el('div', { class: 'group-title' }, ['Controllers'])]);
    var controllers = (doc.api && doc.api.controllers) || {};
    var anyCtrl = false;
    walkControllers(
      controllers,
      '',
      'ctl',
      function (ctrl, ctrlPath, ctrlRoute, name, depth) {
        var hay = (name + ' ' + ctrlPath + ' ' + (ctrl.description || '')).toLowerCase();
        if (filterValue && hay.indexOf(filterValue) === -1 && !hasMatchingDescendant(ctrl, filterValue)) return;
        anyCtrl = true;
        ctlGroup.appendChild(
          el(
            'a',
            { class: 'nav-link nav-ctrl depth-' + depth, href: hrefFor(docKey, ctrlRoute) },
            [iconFor('folder', 'c-folder'), el('span', { class: 'name mono' }, [name])],
          ),
        );
      },
      function (ctrl, ctrlPath, opKey, op, opRoute, depth) {
        var hay = (opKey + ' ' + op.method + ' ' + operationPath(ctrlPath, op)).toLowerCase();
        if (filterValue && hay.indexOf(filterValue) === -1) return;
        anyCtrl = true;
        ctlGroup.appendChild(
          el('a', { class: 'nav-link nav-op depth-' + depth, href: hrefFor(docKey, opRoute) }, [
            iconFor('operation', 'c-op'),
            el('span', { class: 'name mono' }, [opKey]),
            methodBadge(op.method),
          ]),
        );
      },
    );
    if (!anyCtrl) ctlGroup.appendChild(el('div', { class: 'empty-note' }, ['No matches.']));
    nav.appendChild(ctlGroup);

    var types = doc.types || {};
    var byKind = {};
    Object.keys(types).forEach(function (name) {
      if (filterValue && name.toLowerCase().indexOf(filterValue) === -1) return;
      var kind = types[name].kind;
      (byKind[kind] = byKind[kind] || []).push(name);
    });
    var kinds = Object.keys(byKind);
    if (kinds.length) {
      var modelGroup = el('div', { class: 'group' }, [el('div', { class: 'group-title' }, ['Models'])]);
      TYPE_GROUP_ORDER.concat(kinds.filter(function (k) { return TYPE_GROUP_ORDER.indexOf(k) === -1; })).forEach(
        function (kind) {
          if (!byKind[kind]) return;
          modelGroup.appendChild(el('div', { class: 'kind-title' }, [dataTypeGroupLabel(kind)]));
          byKind[kind].sort().forEach(function (name) {
            modelGroup.appendChild(
              el('a', { class: 'nav-link nav-model', href: hrefFor(docKey, 'model/' + encodeURIComponent(name)) }, [
                iconFor(dataTypeIconKind(kind), 'c-' + dataTypeIconKind(kind)),
                el('span', { class: 'name mono' }, [name]),
              ]),
            );
          });
        },
      );
      nav.appendChild(modelGroup);
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

  function highlightActive(nav) {
    var hash = location.hash || '#/';
    Array.prototype.forEach.call(nav.querySelectorAll('a.nav-link'), function (a) {
      a.classList.toggle('active', a.getAttribute('href') === hash);
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
      if (key === state.docKey) return;
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
    var parsed = parseHash();
    var main = document.getElementById('opra-main');
    var nav = document.getElementById('opra-nav');
    var picker = document.getElementById('opra-picker');

    var doc = docs[parsed.docKey];
    if (!doc) {
      clear(main);
      main.appendChild(el('div', { class: 'empty-note' }, ['Unknown document: ' + parsed.docKey]));
      return;
    }
    state.docKey = parsed.docKey;
    clear(main);
    buildSidebar(nav, state.docKey, doc);
    buildPicker(picker);
    highlightActive(nav);

    var rest = parsed.rest;
    if (!rest.length) {
      renderOverviewPage(main, doc);
      return;
    }
    if (rest[0] === 'model' && rest[1]) {
      renderModelPage(main, doc, decodeURIComponent(rest[1]));
      return;
    }
    if (rest[0] === 'ctl') {
      var op = findOperationByRoute(doc, rest.join('/'));
      if (op) {
        renderOperationPage(main, state.docKey, doc, op);
        return;
      }
      var ctl = findControllerByRoute(doc, rest.join('/'));
      if (ctl) {
        renderControllerPage(main, state.docKey, doc, ctl, rest.join('/'));
        return;
      }
    }
    main.appendChild(el('div', { class: 'empty-note' }, ['Page not found.']));
  }

  // ---------- app shell ----------

  function init() {
    var app = document.getElementById('app');
    var header = el('div', { class: 'header' }, [
      el('div', { class: 'picker-wrap', id: 'opra-picker' }),
      el('div', { class: 'search' }, [el('input', { id: 'opra-search', type: 'search', placeholder: 'Search…' })]),
    ]);
    var nav = el('nav', { class: 'sidebar', id: 'opra-nav' });
    var main = el('main', { class: 'main', id: 'opra-main' });
    app.appendChild(header);
    app.appendChild(nav);
    app.appendChild(main);

    document.getElementById('opra-search').addEventListener('input', function () {
      buildSidebar(nav, state.docKey, docs[state.docKey]);
      highlightActive(nav);
    });
    window.addEventListener('hashchange', render);
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
