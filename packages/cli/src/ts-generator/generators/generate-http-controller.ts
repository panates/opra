import path from 'node:path';
import typeIs from '@browsery/type-is';
import {
  ComplexType,
  DataType,
  HttpController,
  HttpParameter,
  MimeTypes,
  OperationResult,
} from '@opra/common';
import { camelCase, pascalCase } from 'putil-varhelpers';
import { CodeBlock } from '../../code-block.js';
import type { TsGenerator } from '../ts-generator.js';
import { locateNamedType } from '../utils/locate-named-type.js';
import { wrapJSDocString } from '../utils/string-utils.js';

/**
 * Generates TypeScript code for an HTTP controller.
 *
 * @param controller - The HTTP controller to generate code for.
 * @returns A promise that resolves to the generated TsFile.
 */
export async function generateHttpController(
  this: TsGenerator,
  controller: HttpController,
) {
  let file = this._filesMap.get(controller);
  if (file) return file;

  /**
   * Generates parameter documentation for JSDoc.
   *
   * @param name - The name of the parameter.
   * @param type - The data type of the parameter.
   * @param options - Additional options for the parameter.
   * @returns A promise that resolves to the documentation string.
   */
  const generateParamDoc = async (
    name: string,
    type?: DataType,
    options?: {
      isArray?: boolean;
      required?: boolean;
      description?: string;
    },
  ): Promise<string> => {
    let out = `\n * @param - ` + (options?.required ? name : `[${name}]`);
    if (options?.description)
      out += `  - ${wrapJSDocString(options?.description)}`;
    if (type instanceof ComplexType && type.embedded) {
      for (const f of type.fields('*')) {
        out += await generateParamDoc(name + '.' + f.name, f.type, f);
      }
    }
    return out;
  };

  const className = pascalCase(controller.name) + 'Controller';
  file = this.addFile(path.join(this._apiPath, className + '.ts'));
  file.addImport('@opra/client', [
    'HttpRequestObservable',
    'kClient',
    'OpraHttpClient',
  ]);
  file.addImport(path.relative(file.dirname, '/http-controller-node.ts'), [
    'HttpControllerNode',
  ]);

  const classBlock = (file.code[className] = new CodeBlock());

  classBlock.doc = `/** 
 * ${wrapJSDocString(controller.description || '')}
 * @class ${className}
 * @apiUrl ${path.posix.join(this.serviceUrl, controller.getFullUrl())}
 */`;
  classBlock.head = `\nexport class ${className} extends HttpControllerNode {\n\t`;
  classBlock.properties = '';

  const classConstBlock = (classBlock.classConstBlock = new CodeBlock());
  classConstBlock.head = `\n/**
 * @param client - OpraHttpClient instance to operate
 */  
constructor(client: OpraHttpClient) {`;
  classConstBlock.body = `\n\tsuper(client);`;
  classConstBlock.tail = `\b\n}\n`;

  if (controller.controllers.size) {
    for (const child of controller.controllers.values()) {
      const generator = this.extend();
      generator._apiPath = path.join(this._apiPath, className);
      const f = await generator.generateHttpController(child);
      const childClassName = pascalCase(child.name) + 'Controller';
      file.addImport(f.filename, [childClassName]);
      const property =
        '$' +
        child.name.charAt(0).toLowerCase() +
        camelCase(child.name.substring(1));
      classBlock.properties += `\nreadonly ${property}: ${childClassName};`;
      classConstBlock.body += `\nthis.${property} = new ${childClassName}(client);`;
    }
  }

  /* Process operations */
  const mergedControllerParams = [...controller.parameters];
  let _base: HttpController | undefined = controller;
  while (_base.owner instanceof HttpController) {
    _base = _base.owner;
    mergedControllerParams.unshift(..._base.parameters);
  }

  for (const operation of controller.operations.values()) {
    const mergedParams = [...mergedControllerParams, ...operation.parameters];

    const operationBlock = (classBlock['operation_' + operation.name] =
      new CodeBlock());

    operationBlock.doc = new CodeBlock();

    operationBlock.doc.header = `
/** 
 * ${wrapJSDocString(operation.description || operation.name + ' operation')}`;
    operationBlock.doc.parameters = new CodeBlock();

    if (mergedParams.length) {
      const block = new CodeBlock();
      block.doc = '\n *\n * RegExp parameters:';
      let i = 0;
      for (const prm of operation.parameters) {
        if (!(prm.name instanceof RegExp)) continue;
        i++;
        block.doc +=
          `\n *   > ${String(prm.name)} - ${prm.description || ''}` +
          `\n *       - location: ${prm.location}` +
          `\n *       - type: ${locateNamedType(prm.type)?.name || 'any'}${prm.isArray ? '[' + prm.arraySeparator + ']' : ''}` +
          (prm.default
            ? `\n *       - default: ${typeof prm.default === 'object' ? 'object' : prm.default}`
            : '') +
          (prm.required ? `\n *       - required: ${prm.required}` : '') +
          (prm.deprecated ? `\n *       - deprecated: ${prm.deprecated}` : '');
      }
      if (i) operationBlock.doc.regExParameters = block;
    }
    operationBlock.doc.tail = `
 * @apiUrl ${path.posix.join(this.serviceUrl, operation.getFullUrl())}    
 */\n`;

    operationBlock.head = `${operation.name}(`;

    /* Process operation parameters */
    const pathParams: HttpParameter[] = [];
    const queryParams: HttpParameter[] = [];
    const headerParams: HttpParameter[] = [];
    if (mergedParams.length) {
      const pathParamsMap: Record<string, HttpParameter> = {};
      const queryParamsMap: Record<string, HttpParameter> = {};
      const headerParamsMap: Record<string, HttpParameter> = {};
      for (const prm of mergedParams) {
        if (typeof prm.name !== 'string') continue;
        if (prm.location === 'path') pathParamsMap[prm.name] = prm;
        if (prm.location === 'query') queryParamsMap[prm.name] = prm;
        if (prm.location === 'header') headerParamsMap[prm.name] = prm;
      }
      pathParams.push(...Object.values(pathParamsMap));
      queryParams.push(...Object.values(queryParamsMap));
      headerParams.push(...Object.values(headerParamsMap));
    }

    /* Process path parameters and add as function arguments */
    let argIndex = 0;
    for (const prm of pathParams) {
      let typeDef: string;
      if (prm.type) {
        const xt = await this.generateDataType(prm.type, 'typeDef', file);
        typeDef = xt.kind === 'embedded' ? xt.code : xt.typeName;
      } else typeDef = `any`;
      if (prm.isArray) typeDef += '[]';
      if (argIndex++ > 0) operationBlock.head += ', ';
      operationBlock.head += `${prm.name}: ${typeDef}`;
      operationBlock.doc.parameters +=
        `\n * @param ` +
        (prm.required ? prm.name : `[${prm.name}]`) +
        (prm.description ? ' - ' + wrapJSDocString(prm.description || '') : '');
    }

    /* Process requestBody and add as function argument ($body) */
    let hasBody = false;
    if (operation.requestBody?.content.length) {
      if (argIndex++ > 0) operationBlock.head += ', ';
      let typeArr: string[] = [];
      for (const content of operation.requestBody.content) {
        if (content.type) {
          /* Generate JSDoc for parameter */
          operationBlock.doc.parameters += await generateParamDoc(
            '$body',
            content.type,
            {
              required: operation.requestBody.required,
              description: content.description || content.type.description,
            },
          );

          const xt = await this.generateDataType(content.type, 'typeDef', file);
          let typeDef = xt.kind === 'embedded' ? xt.code : xt.typeName;
          if (typeDef === 'any') {
            typeArr = [];
            break;
          }
          if (xt.kind === 'named') {
            if (operation.requestBody.partial) {
              file.addImport('ts-gems', ['PartialDTO'], true);
              typeDef = `PartialDTO<${typeDef}>`;
            } else {
              file.addImport('ts-gems', ['DTO'], true);
              typeDef = `DTO<${typeDef}>`;
            }
          }
          if (typeDef && content.isArray) typeDef += '[]';
          typeDef = typeDef || 'undefined';
          if (!typeArr.includes(typeDef)) typeArr.push(typeDef);
          continue;
        } else if (
          content.contentType &&
          typeIs.is(String(content.contentType), ['multipart/*'])
        ) {
          const typeDef = 'FormData';
          if (!typeArr.includes(typeDef)) typeArr.push(typeDef);
          continue;
        }
        typeArr = [];
        break;
      }
      const typeDef = typeArr.join(' | ') || 'any';
      operationBlock.head += `$body: ${typeDef}`;
      // operationBlock.doc.parameters += `\n * @param {${typeDef}} $body - Http body` + bodyFields;
      hasBody = true;
    }

    /* process query params */
    const isQueryRequired = queryParams.find(p => p.required);
    const isHeadersRequired = queryParams.find(p => p.required);

    if (queryParams.length) {
      if (argIndex++ > 0) operationBlock.head += ', ';
      operationBlock.head +=
        '\n\t$params' +
        (isHeadersRequired || isQueryRequired ? '' : '?') +
        ': {\n\t';
      operationBlock.doc.parameters +=
        '\n * @param $params - Available parameters for the operation';

      let hasAdditionalFields = false;
      for (const prm of queryParams) {
        if (typeof prm.name !== 'string') {
          hasAdditionalFields = true;
          continue;
        }
        operationBlock.doc.parameters += await generateParamDoc(
          '$params.' + prm.name,
          prm.type,
          prm,
        );
        operationBlock.head += `${prm.name}${prm.required ? '' : '?'}: `;
        if (prm.type) {
          const xt = await this.generateDataType(prm.type, 'typeDef', file);
          let typeDef = xt.kind === 'embedded' ? xt.code : xt.typeName;
          if (prm.isArray) typeDef += '[]';
          operationBlock.head += `${typeDef};\n`;
        } else operationBlock.head += `any;\n`;
      }
      if (hasAdditionalFields) {
        operationBlock.head += '[index: string]: any;\n';
      }
      operationBlock.head += '\b}\b';
    }

    /* process header params */
    if (headerParams.length) {
      // eslint-disable-next-line no-useless-assignment
      if (argIndex++ > 0) operationBlock.head += ', \n';
      operationBlock.head +=
        '\t$headers' + (isHeadersRequired ? '' : '?') + ': {\n\t';

      for (const prm of headerParams) {
        operationBlock.head += `/**\n * ${prm.description || ''}\n */\n`;
        operationBlock.head += `${prm.name}${prm.required ? '' : '?'}: `;
        if (prm.type) {
          const xt = await this.generateDataType(prm.type, 'typeDef', file);
          let typeDef = xt.kind === 'embedded' ? xt.code : xt.typeName;
          if (prm.isArray) typeDef += '[]';
          operationBlock.head += `${typeDef};\n`;
        } else operationBlock.head += `any;\n`;
      }
      operationBlock.head += '\b}\b';
    }

    /* Determine return type */
    const returnTypes: string[] = [];
    let typeDef: string;
    for (const resp of operation.responses) {
      if (!resp.statusCode.find(r => r.intersects(200, 299))) continue;
      typeDef = '';
      if (resp.type) {
        const xt = await this.generateDataType(resp.type, 'typeDef', file);
        typeDef = xt.kind === 'embedded' ? xt.code : xt.typeName;
      }
      if (typeDef) {
        if (typeDef !== 'OperationResult') {
          const isArray = typeDef.endsWith('[]');
          if (isArray) typeDef = typeDef.substring(0, typeDef.length - 2);
          if (resp.partial) {
            file.addImport('ts-gems', ['PartialDTO'], true);
            typeDef = `PartialDTO<${typeDef}>`;
          } else {
            file.addImport('ts-gems', ['DTO'], true);
            typeDef = `DTO<${typeDef}>`;
          }
          if (isArray) typeDef += '[]';
        }
      }
      if (typeDef && resp.isArray) typeDef += '[]';
      if (
        resp.contentType &&
        typeIs.is(String(resp.contentType), [MimeTypes.opra_response_json]) &&
        !(
          resp.type instanceof ComplexType &&
          resp.type.base?.ctor === OperationResult
        )
      ) {
        file.addImport('@opra/common', ['OperationResult'], true);
        typeDef = typeDef ? `OperationResult<${typeDef}>` : 'OperationResult';
      }
      typeDef = typeDef || 'undefined';
      if (!returnTypes.includes(typeDef)) returnTypes.push(typeDef);
    }

    operationBlock.head += `\n): HttpRequestObservable<${returnTypes.join(' | ') || 'any'}>{`;

    operationBlock.body = `\n\t`;
    operationBlock.body +=
      `const url = this._prepareUrl('${operation.getFullUrl()}', {` +
      pathParams.map(p => p.name).join(', ') +
      '});';
    operationBlock.body +=
      `\nreturn this[kClient].request(url, { method: '${operation.method}'` +
      (hasBody ? ', body: $body' : '') +
      (queryParams.length ? ', params: $params as any' : '') +
      (headerParams.length ? ', headers: $headers as any' : '') +
      '});';

    operationBlock.tail = `\b\n};\n`;
  }

  classBlock.tail = `\b}`;

  return file;
}
