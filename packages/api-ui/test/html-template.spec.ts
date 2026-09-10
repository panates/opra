import { expect } from 'expect';
import { renderApiUiHtml } from '../src/html-template.js';

describe('api-ui:html-template', () => {
  it('Should embed the docs envelope as inline JSON for the client script to read', () => {
    const html = renderApiUiHtml({
      root: { spec: '1.0', id: 'x', info: { title: 'x' } },
      refs: {},
    });
    expect(html).toContain('window.__OPRA_DOCS__');
    expect(html).toContain('"title":"x"');
  });

  it('Should escape the page title and default it to the root document title', () => {
    expect(
      renderApiUiHtml({ root: {}, refs: {} }, { pageTitle: '<script>' }),
    ).toContain('<title>&lt;script&gt;</title>');
    expect(
      renderApiUiHtml({ root: { info: { title: 'Demo' } }, refs: {} }),
    ).toContain('<title>Demo</title>');
    expect(renderApiUiHtml({ root: {}, refs: {} })).toContain(
      '<title>API Reference</title>',
    );
  });

  it('Should default to the dark theme and honor an explicit theme', () => {
    expect(renderApiUiHtml({ root: {}, refs: {} })).toContain(
      'data-theme="dark"',
    );
    expect(
      renderApiUiHtml({ root: {}, refs: {} }, { theme: 'light' }),
    ).toContain('data-theme="light"');
  });

  it('Should inline the client script and styles', () => {
    const html = renderApiUiHtml({ root: {}, refs: {} });
    expect(html).toContain('function init()');
    expect(html).toContain('.sidebar');
  });

  it('Should apply a nonce to script and style tags when given', () => {
    const html = renderApiUiHtml({ root: {}, refs: {} }, { nonce: 'abc123' });
    expect(html).toContain('<style nonce="abc123">');
    expect(html).toContain('<script nonce="abc123">');
  });

  it('Should append customCss after the built-in styles', () => {
    const html = renderApiUiHtml(
      { root: {}, refs: {} },
      { customCss: 'body{color:red}' },
    );
    expect(html).toContain('body{color:red}');
  });

  it('Should embed pre-flattened referenced documents too', () => {
    const html = renderApiUiHtml({
      root: { info: { title: 'Root' } },
      refs: { cm: { info: { title: 'Models' } } },
    });
    expect(html).toContain('"cm"');
    expect(html).toContain('"Models"');
  });
});
