import path from 'node:path';
import { HttpApi } from '@opra/common';
import { camelCase, pascalCase } from 'putil-varhelpers';
import { CodeBlock } from '../../code-block.js';
import { httpControllerNodeScript } from '../http-controller-node.js';
import type { TsGenerator } from '../ts-generator.js';
import { wrapJSDocString } from '../utils/string-utils.js';

/**
 * Generates TypeScript code for an HTTP API.
 *
 * @param api - The HTTP API to generate code for.
 * @returns A promise that resolves to the generated TsFile.
 */
export async function generateHttpApi(this: TsGenerator, api: HttpApi) {
  let file = this._filesMap.get(api);
  if (file) return file;

  const className = api.name ? pascalCase(api.name) : 'Api';
  file = this.addFile(className + '.ts');
  file.addImport('@opra/client', ['kClient', 'OpraHttpClient']);

  const indexTs = this.addFile('/index.ts', true);
  indexTs.addExport('.' + file.filename);

  const httpApiNodeFile = this.addFile('./http-controller-node.ts');
  httpApiNodeFile.code.content = httpControllerNodeScript;

  const classBlock = (file.code[className] = new CodeBlock());

  // Print JSDoc
  classBlock.doc = `/** 
 * ${wrapJSDocString(api.description || '')}
 * @class ${className}
 * @url ${path.posix.join(this.serviceUrl, '$schema')}
 */`;
  classBlock.head = `\nexport class ${className} {\n\t`;
  classBlock.properties = 'readonly [kClient]: OpraHttpClient;';

  const classConstBlock = (classBlock.classConstBlock = new CodeBlock());
  classConstBlock.head = `\n\nconstructor(client: OpraHttpClient) {`;
  classConstBlock.body = `\n\tthis[kClient] = client;`;
  classConstBlock.tail = `\b\n}\n`;

  for (const controller of api.controllers.values()) {
    const generator = this.extend();
    const f = await generator.generateHttpController(controller);
    const childClassName = pascalCase(controller.name) + 'Controller';
    file.addImport('.' + f.filename, [childClassName]);
    const property =
      '$' +
      controller.name.charAt(0).toLowerCase() +
      camelCase(controller.name.substring(1));
    classBlock.properties += `\nreadonly ${property}: ${childClassName};`;
    classConstBlock.body += `\nthis.${property} = new ${childClassName}(client);`;
  }

  classBlock.tail = `\b}`;
  return file;
}
