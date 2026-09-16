/**
 * The authoring layer — loaded only when `oprimp docs:studio` renders the
 * page (see `ApiUiOptions.authoring`), never by `expressApiUi`.
 *
 * The idea is that the documentation page *is* the editor. Every block of
 * prose `app.js` rendered from the source bundle carries `data-doc-key` /
 * `data-doc-field` (see `markEditable`); clicking one opens a markdown editor
 * in its place, and saving re-renders the page through the same `mdToHtml`
 * that produced it — so what you are typing against is the real thing, with
 * real admonitions, code fences and type chips, not an approximation of them.
 *
 * `app.js` owns the schema tree and the renderer; this file only ever mutates
 * a text on a node it was handed and asks for a re-render, so the two stay
 * cleanly separated even though they share a global scope.
 */
(function () {
  'use strict';

  var ui = window.__OPRA_UI__ || {};
  var authoring = ui.authoring;
  if (!authoring) return;

  var api;
  var docs;

  /** The editor's own strings, from the same per-language dictionary as the
   *  rest of the interface — so choosing a language in the badge translates
   *  the editor with it. Everything here is under `studio.*`, which the
   *  server leaves out of a normally served page entirely: a reader should
   *  not carry the vocabulary of a tool they never load.
   *
   *  Resolved through the host rather than re-reading `window.__OPRA_I18N__`
   *  so there is one lookup with one fallback rule, in `app.js`. */
  function msg(key, vars) {
    return api.t('studio.' + key, vars);
  }

  // ---------- reaching the schema node a key addresses ----------

  /** Walks the embedded tree for the node carrying `key`, so an edit can be
   *  written straight into what the renderer reads. The key addresses the
   *  *bundle*, whose shape deliberately doesn't match the flattened tree the
   *  page renders (types collapse into one map, parameters are merged down
   *  from ancestors), so this searches rather than walks a path. */
  function findNode(root, key) {
    var wanted = JSON.stringify(key);
    var found = null;
    (function walk(value) {
      if (found || !value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        for (var i = 0; i < value.length && !found; i++) walk(value[i]);
        return;
      }
      if (value._docKey && JSON.stringify(value._docKey) === wanted) {
        found = value;
        return;
      }
      var keys = Object.keys(value);
      for (var j = 0; j < keys.length && !found; j++) walk(value[keys[j]]);
    })(root);
    return found;
  }

  // ---------- the bundle being edited ----------

  /* The file on disk, as the server last wrote it. Deliberately consulted
   * instead of the rendered page for anything about *this* language: a text
   * the bundle doesn't carry still renders, from the source, so the page
   * cannot tell "translated" from "not translated yet".
   *
   * Filled in by `start()`, not here: the server appends it in a script tag
   * just before `</body>`, which runs after this file does. Null when the
   * page wasn't served by the studio at all. */
  var bundle = null;

  function bundleValue(key, field) {
    var node = bundle;
    for (var i = 0; i < key.length && node; i++) {
      node = typeof node[key[i]] === 'object' ? node[key[i]] : null;
    }
    var value = node && node[field];
    return typeof value === 'string' ? value : '';
  }

  function setBundleValue(key, field, value) {
    if (!bundle) return;
    var node = bundle;
    for (var i = 0; i < key.length; i++) {
      if (!node[key[i]] || typeof node[key[i]] !== 'object') node[key[i]] = {};
      node = node[key[i]];
    }
    node[field] = value;
  }

  // ---------- saving ----------

  function save(key, field, value) {
    return fetch(authoring.saveUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // The language travels with every save rather than the server holding a
      // "current" one: two tabs on two languages is how translating actually
      // goes, and a server-side current would cross them.
      body: JSON.stringify({
        key: key,
        field: field,
        value: value,
        lang: authoring.lang,
      }),
    }).then(function (res) {
      if (res.ok) return;
      return res
        .json()
        .catch(function () {
          return {};
        })
        .then(function (body) {
          throw new Error(body.error || res.status + ' ' + res.statusText);
        });
    });
  }

  // ---------- the editor ----------

  /* Drawn in the same house style as `app.js`'s own `ICONS` — a 24-unit box
   * stroked with `currentColor` — so the toolbar reads as part of the page
   * rather than a widget dropped onto it. */
  var ICONS = {
    bold: '<path d="M7 5h5.4a3.5 3.5 0 0 1 0 7H7z"/><path d="M7 12h6.4a3.5 3.5 0 0 1 0 7H7z"/>',
    italic: '<path d="M18 5h-6M12 19H6M14.6 5 9.4 19"/>',
    code: '<path d="m15.5 8.5 4 3.5-4 3.5M8.5 8.5l-4 3.5 4 3.5"/>',
    heading: '<path d="M6 4v16M18 4v16M6 12h12"/>',
    quote:
      '<path d="M4 5v14"/><path d="M9 7.5h11M9 12h11M9 16.5h7" stroke-width="1.6"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4.4 6h.01M4.4 12h.01M4.4 18h.01" stroke-width="2.8"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M3.9 5.6h1.3V10M3.5 10h2.6M3.6 14.7a1.4 1.4 0 1 1 2.4 1L3.6 18.5h2.6" stroke-width="1.4"/>',
    link: '<path d="M10.5 13.5a4.5 4.5 0 0 0 6.4 0l2.1-2.1a4.5 4.5 0 0 0-6.4-6.4l-1.2 1.2"/><path d="M13.5 10.5a4.5 4.5 0 0 0-6.4 0L5 12.6a4.5 4.5 0 0 0 6.4 6.4l1.2-1.2"/>',
    codeblock:
      '<path d="M9 4H7.5A2.5 2.5 0 0 0 5 6.5v3A2.5 2.5 0 0 1 2.5 12 2.5 2.5 0 0 1 5 14.5v3A2.5 2.5 0 0 0 7.5 20H9"/><path d="M15 4h1.5A2.5 2.5 0 0 1 19 6.5v3a2.5 2.5 0 0 0 2.5 2.5 2.5 2.5 0 0 0-2.5 2.5v3a2.5 2.5 0 0 1-2.5 2.5H15"/>',
    callout:
      '<path d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9a1.5 1.5 0 0 1-1.5 1.5H9l-5 4z"/><path d="M12 7.3v3.4M12 13.2h.01"/>',
    caret: '<path d="m8 10 4 4 4-4"/>',
    pencil:
      '<path d="M4 20.5h4L20 8.5a2.8 2.8 0 0 0-4-4L4 16.5z"/><path d="m14.5 6 3.5 3.5"/>',
  };

  function icon(name, size) {
    var span = document.createElement('span');
    span.className = 'studio-icon';
    span.innerHTML =
      '<svg viewBox="0 0 24 24" width="' +
      (size || 15) +
      '" height="' +
      (size || 15) +
      '" fill="none" stroke="currentColor" stroke-width="1.9" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      ICONS[name] +
      '</svg>';
    return span;
  }

  /* Anything that opens a block — a heading, a quote, a list item. Stripped
   * before a new one is applied so that turning a bullet into a quote
   * replaces its marker instead of stacking a second one in front of it. */
  var BLOCK_PREFIX = /^(#{1,4}\s+|>\s?|[-*]\s+|\d+\.\s+)/;

  /** Wraps the selection (or inserts `placeholder` and selects it, so the
   *  button is useful with nothing selected). */
  function applyWrap(cm, before, after, placeholder) {
    var had = cm.getSelection();
    var body = had || placeholder || '';
    cm.replaceSelection(before + body + after, 'around');
    if (!had && placeholder) {
      var from = cm.getCursor('from');
      var to = cm.getCursor('to');
      cm.setSelection(
        { line: from.line, ch: from.ch + before.length },
        { line: to.line, ch: to.ch - after.length },
      );
    }
    cm.focus();
  }

  /** Toggles a line marker across every line the selection touches — off
   *  when they all already carry it, on otherwise, which is how a rich
   *  editor's list and quote buttons behave. */
  function applyLine(cm, re, make) {
    var from = cm.getCursor('from').line;
    var to = cm.getCursor('to').line;
    var allOn = true;
    for (var l = from; l <= to; l++) {
      if (!re.test(cm.getLine(l))) {
        allOn = false;
        break;
      }
    }
    for (l = from; l <= to; l++) {
      var line = cm.getLine(l);
      var bare = line.replace(BLOCK_PREFIX, '');
      cm.replaceRange(
        allOn ? bare : make(l - from) + bare,
        { line: l, ch: 0 },
        { line: l, ch: line.length },
      );
    }
    cm.focus();
  }

  function lineCount(text) {
    return text.split('\n').length - 1;
  }

  /** Inserts a fenced construct — a code block, a callout — on lines of its
   *  own, with a blank line on either side. The blank lines are not
   *  cosmetic: `mdToHtml` ends a paragraph at a callout but not at a code
   *  fence, and either way prose that runs straight into a fence is the one
   *  thing markdown authors get wrong most often. */
  function applyBlock(cm, open, close, placeholder) {
    var had = cm.getSelection();
    var body = had || placeholder || '';
    var from = cm.getCursor('from');
    var to = cm.getCursor('to');
    var head = cm.getLine(from.line).slice(0, from.ch);
    var tail = cm.getLine(to.line).slice(to.ch);
    var lead = head.trim()
      ? '\n\n'
      : from.line > 0 && cm.getLine(from.line - 1).trim()
        ? '\n'
        : '';
    var after = to.line + 1 < cm.lineCount() ? cm.getLine(to.line + 1) : '';
    var trail = tail.trim() ? '\n\n' : after.trim() ? '\n' : '';
    cm.replaceSelection(
      lead + open + '\n' + body + '\n' + close + trail,
      'around',
    );
    // Leave the body selected, so typing over the placeholder just works.
    var start = from.line + lineCount(lead) + 1;
    var end = start + lineCount(body);
    cm.setSelection(
      { line: start, ch: 0 },
      { line: end, ch: cm.getLine(end).length },
    );
    cm.focus();
  }

  var ADMONITIONS = ['note', 'tip', 'info', 'warning', 'danger'];

  /* `separator` entries are rendered as a hairline; everything else is a
   * button. `key` is both the shortcut and what the tooltip advertises. */
  var TOOLS = [
    { id: 'bold', key: 'B', run: w('**', '**', 'boldText') },
    { id: 'italic', key: 'I', run: w('_', '_', 'text') },
    { id: 'code', run: w('`', '`', 'code') },
    { separator: true },
    {
      id: 'heading',
      run: function (cm) {
        applyLine(cm, /^#{1,4}\s+/, function () {
          return '### ';
        });
      },
    },
    {
      id: 'quote',
      run: function (cm) {
        applyLine(cm, /^>\s?/, function () {
          return '> ';
        });
      },
    },
    {
      id: 'ul',
      run: function (cm) {
        applyLine(cm, /^[-*]\s+/, function () {
          return '- ';
        });
      },
    },
    {
      id: 'ol',
      run: function (cm) {
        applyLine(cm, /^\d+\.\s+/, function (i) {
          return i + 1 + '. ';
        });
      },
    },
    { separator: true },
    {
      id: 'link',
      key: 'K',
      run: w('[', '](#/model/TypeName)', 'label'),
    },
    {
      id: 'codeblock',
      run: function (cm) {
        applyBlock(cm, '```', '```', msg('sample.code'));
      },
    },
    { id: 'callout', menu: ADMONITIONS },
  ];

  /** `sample` names a placeholder in the dictionary, resolved when the
   *  button is pressed rather than when this table is built — the text goes
   *  into the author's prose, so it belongs in their language. */
  function w(before, after, sample) {
    return function (cm) {
      applyWrap(cm, before, after, msg('sample.' + sample));
    };
  }

  var openEditor = null;

  function closeEditor() {
    if (!openEditor) return;
    openEditor.restore();
    openEditor = null;
  }

  function openFor(target) {
    if (openEditor) closeEditor();
    var key = JSON.parse(target.getAttribute('data-doc-key'));
    var field = target.getAttribute('data-doc-field');
    var node = findNode(docs, key);
    // The bundle's own text, not the page's: editing `tr` on an entry that
    // file has never carried should open empty, not pre-filled with the
    // English the renderer fell back to.
    var current = bundle
      ? bundleValue(key, field)
      : (node && node[field]) || '';

    var wrap = document.createElement('div');
    wrap.className = 'studio-editor';
    wrap.setAttribute('data-view', 'write');
    /** Undone when the editor closes — an editor opened and abandoned a
     *  hundred times over a session must not leave a hundred listeners on
     *  `document` behind it. */
    var teardown = [];

    // ---- row 1: where this text lives, and how to look at it ----

    var head = document.createElement('div');
    head.className = 'studio-head';
    var path = document.createElement('span');
    path.className = 'studio-path mono';
    var segments = key.concat(field);
    path.title = segments.join(' › ');
    /* The ancestors are context and the field is the answer to "what am I
     * editing", so when the column is too narrow for all of it the ellipsis
     * has to eat the front — hence the two spans, one that shrinks and one
     * that never does. */
    var trail = document.createElement('span');
    trail.className = 'studio-path-trail';
    var trailText = document.createElement('span');
    trailText.textContent = segments.slice(0, -1).join(' › ');
    trail.appendChild(trailText);
    var leaf = document.createElement('span');
    leaf.className = 'studio-path-leaf';
    leaf.textContent = segments[segments.length - 1];
    path.appendChild(trail);
    path.appendChild(leaf);
    head.appendChild(path);

    var views = document.createElement('div');
    views.className = 'studio-views';
    var viewButtons = {};
    [
      ['write', msg('viewWrite')],
      ['split', msg('viewSplit')],
      ['preview', msg('viewPreview')],
    ].forEach(function (entry) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studio-view studio-view-' + entry[0];
      btn.textContent = entry[1];
      btn.addEventListener('click', function () {
        setView(entry[0]);
      });
      viewButtons[entry[0]] = btn;
      views.appendChild(btn);
    });
    head.appendChild(views);
    wrap.appendChild(head);

    // ---- row 2: the formatting toolbar ----

    var bar = document.createElement('div');
    bar.className = 'studio-bar';
    TOOLS.forEach(function (tool) {
      if (tool.separator) {
        var hr = document.createElement('span');
        hr.className = 'studio-sep';
        bar.appendChild(hr);
        return;
      }
      if (tool.menu) {
        bar.appendChild(buildCalloutMenu(tool));
        return;
      }
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studio-tool';
      var label = msg('tool.' + tool.id);
      btn.title = tool.key ? label + ' (⌘' + tool.key + ')' : label;
      btn.setAttribute('aria-label', label);
      btn.appendChild(icon(tool.id));
      btn.addEventListener('mousedown', function (ev) {
        // Keep the caret where it is: a toolbar button must never be what
        // takes focus away from the text it is about to change.
        ev.preventDefault();
      });
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        tool.run(editor);
      });
      bar.appendChild(btn);
    });
    wrap.appendChild(bar);

    /** The one construct with no counterpart in plain markdown, so it gets a
     *  menu showing each callout under the icon it renders with. */
    function buildCalloutMenu(tool) {
      var holder = document.createElement('span');
      holder.className = 'studio-menu-holder';
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'studio-tool';
      btn.title = msg('callout');
      btn.setAttribute('aria-label', msg('callout'));
      btn.appendChild(icon('callout'));
      btn.appendChild(icon('caret', 11));
      var menu = document.createElement('div');
      menu.className = 'studio-menu';
      tool.menu.forEach(function (kind) {
        var item = document.createElement('button');
        item.type = 'button';
        item.className = 'studio-menu-item admonition-' + kind;
        var glyph = document.createElement('span');
        glyph.className = 'studio-menu-icon';
        glyph.innerHTML = (api.admonitionIcons || {})[kind] || '';
        item.appendChild(glyph);
        // The heading the callout will actually carry, from the page's own
        // dictionary — so the menu reads "İPUCU" next to the tip icon rather
        // than naming the syntax.
        item.appendChild(document.createTextNode(api.t('admonition.' + kind)));
        item.addEventListener('mousedown', function (ev) {
          ev.preventDefault();
        });
        item.addEventListener('click', function () {
          holder.classList.remove('open');
          applyBlock(editor, ':::' + kind, ':::', msg('sample.callout'));
        });
        menu.appendChild(item);
      });
      btn.addEventListener('mousedown', function (ev) {
        ev.preventDefault();
      });
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        holder.classList.toggle('open');
      });
      var dismiss = function (ev) {
        if (!holder.contains(ev.target)) holder.classList.remove('open');
      };
      document.addEventListener('mousedown', dismiss);
      teardown.push(function () {
        document.removeEventListener('mousedown', dismiss);
      });
      holder.appendChild(btn);
      holder.appendChild(menu);
      return holder;
    }

    // ---- row 3: the text, and what it will look like ----

    var panes = document.createElement('div');
    panes.className = 'studio-panes';
    var editPane = document.createElement('div');
    editPane.className = 'studio-pane studio-pane-edit';
    var previewPane = document.createElement('div');
    previewPane.className = 'studio-pane studio-pane-preview';
    panes.appendChild(editPane);
    panes.appendChild(previewPane);
    wrap.appendChild(panes);

    // ---- row 4: state and the two decisions ----

    var foot = document.createElement('div');
    foot.className = 'studio-foot';
    var status = document.createElement('span');
    status.className = 'studio-status';
    if (target.hasAttribute('data-doc-unstable')) {
      status.textContent = msg('unstable');
      status.className += ' warn';
    }
    var saveBtn = document.createElement('button');
    saveBtn.type = 'button';
    saveBtn.className = 'studio-save';
    saveBtn.textContent = msg('save');
    var cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'studio-cancel';
    cancelBtn.textContent = msg('cancel');
    foot.appendChild(status);
    foot.appendChild(cancelBtn);
    foot.appendChild(saveBtn);
    wrap.appendChild(foot);

    /* A text rendered inside a `<summary>` — a response's one-line
     * description shares that row with its status code — has nowhere to put
     * an editor: anything dropped in there is squeezed beside the code, and
     * every click in it toggles the `<details>`. Open it just below the
     * summary instead, and leave the line itself where it is. */
    var summary = target.closest('summary');
    if (summary) {
      if (
        summary.parentElement &&
        summary.parentElement.tagName === 'DETAILS'
      ) {
        summary.parentElement.open = true;
      }
      target.classList.add('studio-editing');
      summary.insertAdjacentElement('afterend', wrap);
    } else {
      target.replaceWith(wrap);
    }

    var shortcuts = {
      'Cmd-Enter': commit,
      'Ctrl-Enter': commit,
      Esc: function () {
        closeEditor();
      },
    };
    TOOLS.forEach(function (tool) {
      if (!tool.key) return;
      ['Cmd-', 'Ctrl-'].forEach(function (prefix) {
        shortcuts[prefix + tool.key] = function (cm) {
          tool.run(cm);
        };
      });
    });

    var editor = window.CodeMirror(editPane, {
      value: current,
      mode: 'markdown',
      lineWrapping: true,
      viewportMargin: Infinity,
      extraKeys: shortcuts,
    });
    editor.focus();
    editor.setCursor(editor.lineCount(), 0);

    var previewTimer = null;
    editor.on('change', function () {
      if (wrap.getAttribute('data-view') === 'write') return;
      clearTimeout(previewTimer);
      previewTimer = setTimeout(renderPreview, 120);
    });

    function renderPreview() {
      previewPane.innerHTML = '';
      var rendered = api.preview(editor.getValue());
      if (rendered) {
        previewPane.appendChild(rendered);
        return;
      }
      var empty = document.createElement('div');
      empty.className = 'studio-preview-empty';
      empty.textContent = msg('previewEmpty');
      previewPane.appendChild(empty);
    }

    function setView(view) {
      wrap.setAttribute('data-view', view);
      Object.keys(viewButtons).forEach(function (name) {
        viewButtons[name].classList.toggle('active', name === view);
      });
      if (view !== 'write') renderPreview();
      // CodeMirror measures nothing while it is `display:none`, so it comes
      // back with a zero-height gutter unless it is told to re-measure.
      if (view !== 'preview') editor.refresh();
      if (view !== 'preview') editor.focus();
    }
    setView('write');

    openEditor = {
      restore: function () {
        clearTimeout(previewTimer);
        teardown.forEach(function (fn) {
          fn();
        });
        if (summary) {
          target.classList.remove('studio-editing');
          wrap.remove();
        } else {
          wrap.replaceWith(target);
        }
      },
    };

    function commit() {
      var value = editor.getValue();
      status.textContent = msg('saving');
      status.className = 'studio-status';
      saveBtn.disabled = true;
      save(key, field, value).then(
        function () {
          // The node the renderer reads *is* the node we just persisted to,
          // so re-rendering shows exactly what a fresh page load would; the
          // bundle mirror keeps the checklist and the next editor honest.
          if (node) node[field] = value;
          setBundleValue(key, field, value);
          clearTimeout(previewTimer);
          teardown.forEach(function (fn) {
            fn();
          });
          // `render()` replaces the whole view, editor included, so there is
          // nothing left to restore — just stop calling it open.
          openEditor = null;
          api.render();
          refreshTodo();
        },
        function (e) {
          saveBtn.disabled = false;
          status.textContent = msg('failed', { error: e.message });
          status.className = 'studio-status warn';
        },
      );
    }

    saveBtn.addEventListener('click', commit);
    cancelBtn.addEventListener('click', closeEditor);
  }

  // ---------- edit affordances ----------

  /** Makes every marked block editable: the block itself opens the editor,
   *  and a pencil in its corner says so. `app.js` renders an empty stand-in
   *  (`data-doc-empty`) for a text the document declares and nobody has
   *  written — those are the ones most worth writing, and they have nothing
   *  on screen to aim at, so they get a label of their own here. */
  function decorate() {
    var blocks = document.querySelectorAll('[data-doc-key]');
    Array.prototype.forEach.call(blocks, function (block) {
      if (block.classList.contains('studio-marked')) return;
      block.classList.add('studio-marked');
      if (block.hasAttribute('data-doc-empty')) {
        block.classList.add('studio-empty');
        block.textContent = msg('empty');
      }
      if (block.hasAttribute('data-doc-foreign')) {
        block.classList.add('studio-readonly');
        block.title = msg('foreign');
        return;
      }
      block.classList.add('studio-editable');
      block.title = msg('edit');
      var pencil = document.createElement('span');
      pencil.className = 'studio-pencil';
      pencil.appendChild(icon('pencil', 12));
      block.appendChild(pencil);
      block.addEventListener('click', function (ev) {
        // A description can hold links — a `#/model/Name` type chip above
        // all — and following one has to keep working; only a click on the
        // prose itself is a request to rewrite it.
        if (ev.target.closest('a')) return;
        // Don't snatch away a selection someone is making to copy.
        var selection = window.getSelection();
        if (
          selection &&
          !selection.isCollapsed &&
          block.contains(selection.anchorNode)
        ) {
          return;
        }
        ev.preventDefault();
        ev.stopPropagation();
        openFor(block);
      });
    });
  }

  // ---------- the "what still needs writing" panel ----------

  var todoPanel = null;

  /** Every text slot the document declares, with whether it is filled. Built
   *  from `_docFields` rather than from what happens to be rendered: an
   *  operation with no description at all is exactly the one worth listing,
   *  and it has nothing on screen. */
  function collectSlots() {
    var slots = [];
    var seen = {};
    /* Scoped to what `docs:extract` agrees exists (see `declaredSlots` in
     * `studio-command.ts`) — the renderer knows about more places a text
     * could be looked up than the export walk collects, and offering those
     * as work to do would produce entries the next extraction calls
     * orphans. Absent when the page wasn't served by the studio. */
    var declared = window.__OPRA_STUDIO_SLOTS__;
    var allowed = declared ? Object.create(null) : null;
    if (declared) {
      declared.forEach(function (path) {
        allowed[path] = true;
      });
    }
    (function walk(value) {
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (value._docKey && value._docFields && !value._docForeign) {
        value._docFields.forEach(function (field) {
          var id = JSON.stringify(value._docKey.concat(field));
          if (seen[id]) return;
          if (allowed && !allowed[id]) return;
          seen[id] = true;
          slots.push({
            key: value._docKey,
            field: field,
            filled: bundle
              ? !!bundleValue(value._docKey, field).trim()
              : !!(value[field] && String(value[field]).trim()),
          });
        });
      }
      Object.keys(value).forEach(function (k) {
        walk(value[k]);
      });
    })(docs);
    return slots;
  }

  function refreshTodo() {
    if (!todoPanel) return;
    var slots = collectSlots();
    var missing = slots.filter(function (s) {
      return !s.filled;
    });
    var body = todoPanel.querySelector('.studio-todo-body');
    var count = todoPanel.querySelector('.studio-todo-count');
    count.textContent = msg('todoCount', {
      done: slots.length - missing.length,
      total: slots.length,
    });
    body.innerHTML = '';
    if (!missing.length) {
      var done = document.createElement('div');
      done.className = 'studio-todo-empty';
      done.textContent = msg('todoEmpty');
      body.appendChild(done);
      return;
    }
    renderBranch(treeOf(missing), body, 0);
  }

  /** The outstanding keys as a tree, which is what they always were — each
   *  one is a path through the same document, and printed flat every row
   *  repeated the ancestry of the row above it. */
  function treeOf(missing) {
    var root = { key: [], children: {}, order: [], fields: [], count: 0 };
    missing.forEach(function (slot) {
      var node = root;
      root.count++;
      slot.key.forEach(function (segment) {
        if (!node.children[segment]) {
          node.children[segment] = {
            name: segment,
            key: node.key.concat(segment),
            children: {},
            order: [],
            fields: [],
            count: 0,
          };
          node.order.push(segment);
        }
        node = node.children[segment];
        node.count++;
      });
      node.fields.push(slot.field);
    });
    return root;
  }

  /** One row per segment, all the way down — no run of only-children folded
   *  into a breadcrumb. Folding kept the panel shorter but made the same
   *  segment a level in one place and part of a label in another, so the
   *  tree's shape depended on how much happened to be missing rather than on
   *  the document. Depth is what collapsing is for. */
  function renderBranch(parent, container, depth) {
    parent.order.forEach(function (name) {
      var node = parent.children[name];
      var row = document.createElement('div');
      row.className = 'studio-todo-group';
      row.style.paddingInlineStart = 6 + depth * 11 + 'px';
      var chevron = icon('caret', 11);
      chevron.classList.add('studio-todo-chevron');
      row.appendChild(chevron);
      var label = document.createElement('span');
      label.className = 'studio-todo-label';
      label.textContent = node.name;
      row.appendChild(label);
      var badge = document.createElement('span');
      badge.className = 'studio-todo-badge';
      badge.textContent = node.count;
      row.appendChild(badge);
      var branch = document.createElement('div');
      row.addEventListener('click', function () {
        row.classList.toggle('collapsed');
        branch.hidden = row.classList.contains('collapsed');
      });
      container.appendChild(row);
      container.appendChild(branch);
      node.fields.forEach(function (field) {
        branch.appendChild(todoLeaf(node.key, field, depth + 1));
      });
      renderBranch(node, branch, depth + 1);
    });
  }

  function todoLeaf(key, field, depth) {
    var row = document.createElement('div');
    row.className = 'studio-todo-item';
    row.style.paddingInlineStart = 6 + depth * 11 + 'px';
    // The whole path, for the one question a leaf on its own can't answer:
    // which of the identical `description` rows is this?
    row.title = key.concat(field).join(' › ');
    var leaf = document.createElement('span');
    leaf.className = 'studio-todo-leaf';
    leaf.textContent = field;
    row.appendChild(leaf);
    row.addEventListener('click', function () {
      api.goTo(key);
    });
    /* The row takes you to the page; the pencil takes you there *and* opens
     * the editor. Without it, the shortest path from "this one is missing" to
     * typing was: click, find the block again on a page you just arrived at,
     * click that. */
    var pencil = document.createElement('button');
    pencil.type = 'button';
    pencil.className = 'studio-todo-edit';
    pencil.title = msg('edit');
    pencil.setAttribute('aria-label', msg('edit'));
    pencil.appendChild(icon('pencil', 11));
    pencil.addEventListener('click', function (ev) {
      ev.stopPropagation();
      revealSlot(key, field);
    });
    row.appendChild(pencil);
    return row;
  }

  /* Set while a navigation is on its way to the page that holds it, and
   * consumed by the render that lands there. */
  var pendingOpen = null;

  function revealSlot(key, field) {
    var before = location.hash;
    pendingOpen = { key: key, field: field };
    api.goTo(key);
    /* Already on that page: the hash didn't change, so nothing re-renders and
     * nothing would ever consume it. The block is right here. */
    if (location.hash === before) openPendingSlot();
  }

  /** Opens the editor on whatever `revealSlot` asked for, if this page turned
   *  out to hold it. Runs after every render and clears the request either
   *  way — a key that isn't on the page it routes to is a dead end, not
   *  something to keep waiting for. */
  function openPendingSlot() {
    if (!pendingOpen) return;
    var wanted = JSON.stringify(pendingOpen.key);
    var field = pendingOpen.field;
    pendingOpen = null;
    var blocks = document.querySelectorAll('[data-doc-key]');
    for (var i = 0; i < blocks.length; i++) {
      var block = blocks[i];
      if (
        block.getAttribute('data-doc-key') === wanted &&
        block.getAttribute('data-doc-field') === field &&
        !block.hasAttribute('data-doc-foreign')
      ) {
        block.scrollIntoView({ block: 'center' });
        openFor(block);
        return;
      }
    }
  }

  function buildTodoPanel() {
    todoPanel = document.createElement('div');
    todoPanel.className = 'studio-todo';
    var head = document.createElement('div');
    head.className = 'studio-todo-head';
    var title = document.createElement('span');
    title.textContent = msg('todoTitle');
    var count = document.createElement('span');
    count.className = 'studio-todo-count';
    head.appendChild(title);
    head.appendChild(count);
    var body = document.createElement('div');
    body.className = 'studio-todo-body';
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'studio-todo-toggle';
    toggle.textContent = '▾';
    toggle.addEventListener('click', function () {
      todoPanel.classList.toggle('collapsed');
      toggle.textContent = todoPanel.classList.contains('collapsed')
        ? '▸'
        : '▾';
    });
    head.appendChild(toggle);
    todoPanel.appendChild(head);
    todoPanel.appendChild(body);
    document.body.appendChild(todoPanel);
    refreshTodo();
  }

  // ---------- wiring ----------

  /** `app.js` publishes its host API from its own `init()`, which waits for
   *  `DOMContentLoaded` — and this script is inlined right after it, so at
   *  this point there is usually nothing to attach to yet. Registering a
   *  listener of our own runs after `app.js`'s (listeners fire in
   *  registration order), which is exactly when the host exists. */
  /** Which language an edit lands in, badged next to the document's title.
   *  Nothing else on the page says it — the prose simply *is* that language,
   *  and reading Turkish while writing into `en.json` is a mistake you only
   *  find out about later, in a diff.
   *
   *  Re-checked after every render: the document picker beside it is rebuilt
   *  each time, which takes the badge with it. Anchored to the picker's
   *  wrapper rather than the picker for the same reason. */
  /* The server validates authoritatively before this ever becomes a
   * filename; this copy only decides whether to offer a typed tag at all. */
  var LANGUAGE_TAG = /^[A-Za-z]{2,8}(-[A-Za-z0-9]{2,8})*$/;

  var displayNames;
  /* Same thing, but silent about tags it doesn't recognize — which is how
   * "is this actually a language?" gets answered without shipping a list of
   * every tag in existence. */
  var strictNames;
  var displayNamesTried = false;

  function initDisplayNames() {
    displayNamesTried = true;
    try {
      var locale = [document.documentElement.lang || 'en'];
      displayNames = new Intl.DisplayNames(locale, { type: 'language' });
      strictNames = new Intl.DisplayNames(locale, {
        type: 'language',
        fallback: 'none',
      });
    } catch (e) {
      displayNames = null;
    }
  }

  /** "de" → "German", in whatever language the page is already in. Nobody
   *  should have to know the codes to add a language; `Intl.DisplayNames`
   *  knows them all, including tags that aren't in the suggested list, so
   *  even a typed one gets named back for confirmation. */
  function languageName(tag) {
    if (!displayNamesTried) initDisplayNames();
    if (!displayNames) return tag;
    try {
      return displayNames.of(tag) || tag;
    } catch (e) {
      return tag;
    }
  }

  /** Whether a typed tag is worth offering as a language of its own. Shape
   *  alone isn't enough: half of "German" typed into a filter box is `germ`,
   *  which is a perfectly well-formed tag and no language at all. Where the
   *  platform can't tell us, shape is all we have. */
  function knownLanguage(tag) {
    if (!displayNamesTried) initDisplayNames();
    if (!displayNames) return LANGUAGE_TAG.test(tag);
    try {
      return !!strictNames.of(tag);
    } catch (e) {
      return false;
    }
  }

  /** Starting a language the project has no bundle for. Asks the server to
   *  write the empty file first and only then navigates: `?lang=` is
   *  deliberately not allowed to create anything, so that a mistyped tag in
   *  the address bar can't leave a stray bundle behind. */
  function addLanguageRow(holder) {
    var options = authoring.addLanguageOptions || [];
    var row = document.createElement('div');
    row.className = 'studio-lang-add';
    var input = document.createElement('input');
    input.type = 'text';
    input.placeholder = msg('addLanguage');
    input.spellcheck = false;
    var list = document.createElement('div');
    list.className = 'studio-lang-options';
    var status = document.createElement('div');
    status.className = 'studio-lang-add-error';
    status.hidden = true;

    function submit(tag) {
      if (!tag) return;
      input.disabled = true;
      status.hidden = true;
      fetch(authoring.addLanguageUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lang: tag }),
      })
        .then(function (res) {
          return res.json().then(function (body) {
            if (!res.ok) throw new Error(body.error || res.statusText);
            return body;
          });
        })
        .then(function (body) {
          holder.classList.remove('open');
          location.href =
            '?lang=' + encodeURIComponent(body.lang || tag) + location.hash;
        })
        .catch(function (e) {
          input.disabled = false;
          status.textContent = e.message;
          status.hidden = false;
          input.focus();
        });
    }

    function option(tag) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'studio-lang-option';
      var code = document.createElement('span');
      code.className = 'studio-lang-code';
      code.textContent = tag;
      item.appendChild(code);
      item.appendChild(document.createTextNode(languageName(tag)));
      item.addEventListener('click', function () {
        submit(tag);
      });
      return item;
    }

    /** Matches on either half — someone who knows `pt` types that, someone
     *  who doesn't types "Portug". */
    function matches() {
      var q = input.value.trim().toLowerCase();
      if (!q) return options;
      return options.filter(function (tag) {
        return (
          tag.toLowerCase().indexOf(q) === 0 ||
          languageName(tag).toLowerCase().indexOf(q) >= 0
        );
      });
    }

    function renderOptions() {
      var found = matches();
      list.innerHTML = '';
      found.forEach(function (tag) {
        list.appendChild(option(tag));
      });
      var typed = input.value.trim();
      // Anything BCP 47 can name is a legitimate documentation language, so a
      // tag the suggestions don't carry is still offered — named, so you can
      // see whether you typed the one you meant.
      if (
        typed &&
        LANGUAGE_TAG.test(typed) &&
        knownLanguage(typed) &&
        !found.some(function (tag) {
          return tag.toLowerCase() === typed.toLowerCase();
        })
      ) {
        list.appendChild(option(typed));
      }
    }

    input.addEventListener('input', renderOptions);
    input.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      var first = list.querySelector('.studio-lang-option');
      if (first) first.click();
    });
    renderOptions();
    row.appendChild(input);
    row.appendChild(list);
    row.appendChild(status);
    return row;
  }

  function badgeLanguage() {
    var anchor = document.querySelector('.header .picker-wrap');
    if (!anchor || !authoring.lang) return;
    if (
      anchor.nextElementSibling &&
      anchor.nextElementSibling.classList.contains('studio-lang-wrap')
    ) {
      return;
    }
    var languages = authoring.languages || [];
    var holder = document.createElement('span');
    holder.className = 'studio-menu-holder studio-lang-wrap';

    var badge = document.createElement(
      languages.length > 1 ? 'button' : 'span',
    );
    badge.className = 'studio-lang';
    if (badge.tagName === 'BUTTON') badge.type = 'button';
    badge.title = authoring.file
      ? msg('editingFile', { file: authoring.file })
      : msg('editing');
    badge.appendChild(icon('pencil', 11));
    var code = document.createElement('span');
    code.textContent = authoring.lang.toUpperCase();
    badge.appendChild(code);
    holder.appendChild(badge);
    anchor.insertAdjacentElement('afterend', holder);
    if (languages.length < 2) return;

    badge.appendChild(icon('caret', 11));
    var menu = document.createElement('div');
    menu.className = 'studio-menu studio-lang-menu';
    var label = document.createElement('div');
    label.className = 'studio-menu-label';
    label.textContent = msg('editingLanguage');
    menu.appendChild(label);
    languages.forEach(function (tag) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'studio-menu-item studio-lang-item';
      if (tag.toLowerCase() === authoring.lang.toLowerCase()) {
        item.classList.add('active');
      }
      var itemCode = document.createElement('span');
      itemCode.className = 'studio-lang-code';
      itemCode.textContent = tag.toUpperCase();
      item.appendChild(itemCode);
      item.appendChild(document.createTextNode(tag + '.json'));
      item.addEventListener('click', function () {
        /* A full load, not a swap: the prose, the interface language and the
         * bundle the editor writes to all change together, and the server is
         * the only thing that knows how. The hash comes along so you land on
         * the page you were reading, in the other language. */
        location.href = '?lang=' + encodeURIComponent(tag) + location.hash;
      });
      menu.appendChild(item);
    });
    if (authoring.addLanguageUrl) menu.appendChild(addLanguageRow(holder));
    badge.addEventListener('click', function (ev) {
      ev.preventDefault();
      holder.classList.toggle('open');
    });
    document.addEventListener('mousedown', function (ev) {
      if (!holder.contains(ev.target)) holder.classList.remove('open');
    });
    holder.appendChild(menu);
  }

  function start() {
    api = window.__OPRA_STUDIO_HOST__;
    if (!api) return;
    docs = api.docs;
    bundle = window.__OPRA_STUDIO_BUNDLE__ || null;
    document.documentElement.classList.add('studio-on');
    badgeLanguage();
    api.onRendered(badgeLanguage);
    api.onRendered(decorate);
    // After `decorate`, so the block it opens is already an editable one.
    api.onRendered(openPendingSlot);
    decorate();
    buildTodoPanel();
  }

  if (window.__OPRA_STUDIO_HOST__) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
