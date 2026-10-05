import type { ApiDocument, OpraSchema } from '@opra/common';
import type { TsGenerator } from '../ts-generator.js';

/**
 * Builds the client package's own top-level `README.md` (and, when the
 * document declares one, a `LICENSE` file) from `document.info` — plain
 * text/Markdown, so unlike every other generated file these are built
 * directly rather than through `TsFile` (whose `generate()` always adds
 * a TypeScript-specific header/import block that would make no sense
 * here).
 *
 * @param document - The root document being generated for (a reference's
 *   own `info`/`license` never applies to the client package as a whole).
 */
export function generateProjectFiles(
  document: ApiDocument,
): TsGenerator.GeneratedFile[] {
  const files: TsGenerator.GeneratedFile[] = [
    { filename: '/README.md', content: generateReadme(document) },
  ];
  const license = document.info?.license;
  if (license) {
    files.push({ filename: '/LICENSE', content: generateLicense(license) });
  }
  return files;
}

function generateReadme(document: ApiDocument): string {
  const info = document.info || {};
  const title = info.title || 'API';
  const lines: string[] = [`# ${title} - TypeScript Client`, ''];
  if (info.version) lines.push(`Version: ${info.version}`, '');
  lines.push(
    'This client was generated automatically by ' +
      '[`@opra/cli`](https://www.oprajs.com) from the ' +
      `"${title}" OPRA document. Do not edit these files by hand - ` +
      're-generate them instead whenever the API changes.',
    '',
  );
  if (info.description) {
    lines.push('## About', '', stripAdmonitions(info.description), '');
  }
  lines.push(
    '## Structure',
    '',
    '- `index.ts` - the package entry point; re-exports everything below.',
    '- `api/` - controller classes, one per OPRA HTTP controller.',
    '- `models/` - generated data types.',
    '- `references/` - types and controllers from referenced documents, if any.',
  );
  if (info.license) {
    const { name, url } = info.license;
    lines.push('', '## License', '', url ? `[${name}](${url})` : name);
  }
  return lines.join('\n') + '\n';
}

/** Docusaurus-style admonition blocks (`:::tip ... :::`) render as a
 *  callout box in the api-ui reference page's own markdown renderer, but
 *  a plain `README.md` (GitHub, npm, an editor's preview) doesn't
 *  understand that syntax at all — the `:::` fences would just show up
 *  as literal text. Converted to a plain blockquote instead, which every
 *  Markdown renderer (including api-ui's) already understands. */
const ADMONITION_RE = /:::(\w+)[ \t]*(.*)\n([\s\S]*?)\n:::/g;

function stripAdmonitions(text: string): string {
  return text.replace(
    ADMONITION_RE,
    (_match, type: string, title: string, body: string) => {
      const label =
        title.trim() || type.charAt(0).toUpperCase() + type.slice(1);
      const quotedBody = body
        .split('\n')
        .map(line => (line ? `> ${line}` : '>'))
        .join('\n');
      return `> **${label}**\n>\n${quotedBody}`;
    },
  );
}

function generateLicense(license: OpraSchema.LicenseInfo): string {
  if (license.content) return license.content;
  return (
    `This project is licensed under the ${license.name} license.\n` +
    (license.url ? `${license.url}\n` : '')
  );
}
