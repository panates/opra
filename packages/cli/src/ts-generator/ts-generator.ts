import { EventEmitter } from 'node:events';
import { ApiDocument } from '@opra/common';
import colors from 'ansi-colors';
import type { IFileWriter } from '../interfaces/file-writer.interface.js';
import type { ILogger } from '../interfaces/logger.interface.js';
import {
  _generateArrayTypeCode,
  _generateComplexTypeCode,
  _generateEnumTypeCode,
  _generateMappedTypeCode,
  _generateMixinTypeCode,
  _generateSimpleTypeCode,
  _generateTypeCode,
  _generateUnionTypeCode,
  generateDataType,
} from './generators/generate-data-type.js';
import { generateDocument } from './generators/generate-document.js';
import { generateHttpApi } from './generators/generate-http-api.js';
import { generateHttpController } from './generators/generate-http-controller.js';
import { generateProjectFiles } from './generators/generate-project-files.js';
import { TsFile } from './ts-file.js';

/**
 * TsGenerator
 *
 * A class responsible for generating TypeScript code from an OPRA API document.
 */
export namespace TsGenerator {
  /**
   * Configuration options for TsGenerator.
   */
  export interface Options {
    /** The URL of the OPRA service. Only required when generating from a
     *  URL/document-id (the default) rather than passing an already-built
     *  `ApiDocument` straight to `generateFiles()`. */
    serviceUrl?: string;
    /** The output directory for the generated files. Only meaningful for
     *  `generate()`'s own disk-writing step — `generateFiles()` alone
     *  never reads it. Defaults to `cwd`. */
    outDir?: string;
    /** The current working directory `outDir` is resolved against.
     *  Defaults to `process.cwd()` — resolved lazily, by `generate()`,
     *  not here, so constructing a `TsGenerator` has no Node-API
     *  dependency of its own. */
    cwd?: string;
    /** Logger instance for outputting information. */
    logger?: ILogger;
    /** File writer instance. Defaults to FileWriter. */
    writer?: IFileWriter;
    /** Optional header to add to each generated file. */
    fileHeader?: string;
    /** Whether to add .js extension to imports. */
    importExt?: boolean;
    /** Whether to export references with namespaces. */
    referenceNamespaces?: boolean;
    /** Language the fetched documentation texts should be in (see
     *  `?lang=` on the service's own `$schema` endpoint). Only meaningful
     *  when generating from a `serviceUrl`. */
    lang?: string;
  }

  /** One generated source file, purely in memory — what `generateFiles()`
   *  returns, before `generate()`'s own disk-writing step turns each of
   *  these into a real file under `outDir`. */
  export interface GeneratedFile {
    /** Path relative to `outDir` (e.g. `./models/types/customer.ts`). */
    filename: string;
    /** The file's own generated TypeScript source. */
    content: string;
  }
}

/**
 * TsGenerator
 *
 * Main class for managing the TypeScript code generation process.
 */
export class TsGenerator extends EventEmitter {
  declare protected generateDocument: typeof generateDocument;
  declare protected generateDataType: typeof generateDataType;
  declare protected _generateTypeCode: typeof _generateTypeCode;
  declare protected _generateArrayTypeCode: typeof _generateArrayTypeCode;
  declare protected _generateComplexTypeCode: typeof _generateComplexTypeCode;
  declare protected _generateEnumTypeCode: typeof _generateEnumTypeCode;
  declare protected _generateMappedTypeCode: typeof _generateMappedTypeCode;
  declare protected _generateMixinTypeCode: typeof _generateMixinTypeCode;
  declare protected _generateSimpleTypeCode: typeof _generateSimpleTypeCode;
  declare protected _generateUnionTypeCode: typeof _generateUnionTypeCode;
  declare protected generateHttpApi: typeof generateHttpApi;
  declare protected generateHttpController: typeof generateHttpController;
  declare protected _documentRoot: string;
  declare protected _typesRoot: string;
  declare protected _typesNamespace: string;
  declare protected _apiPath: string;
  declare protected _fileHeaderDocInfo: string;
  protected _files: Record<string, TsFile> = {};
  protected _started = false;
  protected _document?: ApiDocument;
  protected _documentsMap: Map<
    string,
    {
      document: ApiDocument;
      generator: TsGenerator;
    }
  >;
  protected _filesMap: WeakMap<Object, TsFile>;
  protected _generatedFiles?: TsGenerator.GeneratedFile[];
  readonly serviceUrl?: string;
  readonly lang?: string;
  /** Raw, as given to the constructor — resolved against `cwd` (with
   *  its own `process.cwd()` fallback) lazily, only by `generate()`'s
   *  own disk-writing step. */
  readonly outDir?: string;
  readonly cwd?: string;
  readonly writer?: IFileWriter;
  readonly options: {
    importExt: boolean;
    referenceNamespaces?: boolean;
  };
  fileHeader: string;

  /**
   * Initializes a new TsGenerator instance.
   *
   * @param init - Configuration options.
   */
  constructor(init: TsGenerator.Options) {
    super();
    this.serviceUrl = init.serviceUrl;
    this.lang = init.lang;
    this.cwd = init.cwd;
    this.outDir = init.outDir;
    this.fileHeader = init.fileHeader || '';
    this.writer = init.writer;
    this.options = {
      importExt: !!init.importExt,
      referenceNamespaces: init.referenceNamespaces,
    };
    this._documentsMap = new Map();
    this._documentRoot = './';
    this._filesMap = new WeakMap();
    this.on('log', (message: string, ...args) =>
      init.logger?.log?.(message, ...args),
    );
    this.on('error', (message: string, ...args) =>
      init.logger?.error?.(message, ...args),
    );
    this.on('debug', (message: string, ...args) =>
      init.logger?.debug?.(message, ...args),
    );
    this.on('warn', (message: string, ...args) =>
      init.logger?.warn?.(message, ...args),
    );
    this.on('verbose', (message: string, ...args) =>
      init.logger?.verbose?.(message, ...args),
    );
  }

  /**
   * Runs the actual code-generation pipeline and returns the produced
   * files purely in memory — no disk access at all. This is the
   * Node-API-free half of `generate()` (see there for the other half:
   * writing these to disk under `outDir`), kept separate so a caller
   * that already has a live `ApiDocument` (e.g. one reconstructed
   * client-side from a fetched schema, with no `outDir`/filesystem to
   * speak of) can generate without either.
   *
   * Passing `document` skips the `serviceUrl` HTTP fetch inside
   * `generateDocument()` entirely. Memoized — a second call (with or
   * without `document`) returns the same result rather than
   * regenerating.
   */
  async generateFiles(
    document?: ApiDocument,
  ): Promise<TsGenerator.GeneratedFile[]> {
    if (this._generatedFiles) return this._generatedFiles;
    this._apiPath = '/api';
    this._typesRoot = '/models';
    // `this._document` is a scratch field `generateDocument()` reassigns
    // for *whatever* document it's currently processing - including, deep
    // inside data-type generation, a plain reference lookup for a
    // primitive type's own builtin document (see `generate-data-type.ts`'s
    // `this.generateDocument(doc)`) - so by the time everything settles it
    // no longer reliably points at the root document. `generateDocument()`'s
    // own return value doesn't have that problem: it resolves to a local
    // binding fixed at the top of *this* call, so it's used here instead.
    const { document: rootDocument } = await this.generateDocument(document);
    const { importExt } = this.options;
    this._generatedFiles = [
      ...Object.values(this._files).map(file => ({
        filename: file.filename,
        content: file.generate({ importExt }),
      })),
      // README/LICENSE describe the generated *package* as a whole, so
      // they're only ever built from the root document, once.
      ...generateProjectFiles(rootDocument),
    ];
    return this._generatedFiles;
  }

  /**
   * Starts the code generation process: builds every file (see
   * `generateFiles()`, which this passes `document` through to) then
   * writes each one to disk under `outDir`, after first removing
   * whatever was generated there previously. `write-to-disk.js` (the
   * only Node-API-dependent part of this whole class) is imported here,
   * dynamically, rather than at this file's own top level — see there
   * for why.
   *
   * @throws {@link Error} If generation fails.
   */
  async generate(document?: ApiDocument) {
    if (this._started) return;
    this.emit('start');
    try {
      this._started = true;
      this.emit('log', colors.cyan('Removing old files..'));
      const files = await this.generateFiles(document);
      const { writeFilesToDisk } = await import('./write-to-disk.js');
      await writeFilesToDisk(files, {
        outDir: this.outDir,
        cwd: this.cwd,
        writer: this.writer,
        onVerbose: message => this.emit('verbose', message),
      });
    } catch (e) {
      this.emit('error', e);
      throw e;
    } finally {
      this.emit('finish');
    }
  }

  /**
   * Retrieves a file from the internal cache by its path.
   *
   * @param filePath - The path of the file to retrieve.
   * @returns The TsFile instance or undefined if not found.
   */
  protected getFile(filePath: string): TsFile {
    return this._files[filePath];
  }

  /**
   * Adds a new file to the generator or returns an existing one.
   *
   * @param filePath - The path of the file to add.
   * @param returnExists - Whether to return the file if it already exists instead of throwing.
   * @returns The newly created or existing TsFile instance.
   * @throws {@link Error} If the file already exists and returnExists is false.
   */
  protected addFile(filePath: string, returnExists?: boolean): TsFile {
    if (!(filePath.startsWith('.') || filePath.startsWith('/')))
      filePath = './' + filePath;
    let file = this.getFile(filePath);
    if (file) {
      if (returnExists) return file;
      throw new Error(`File "${filePath}" already exists`);
    }
    file = new TsFile(filePath);
    file.code.header =
      this.fileHeader +
      (this._fileHeaderDocInfo ? '\n' + this._fileHeaderDocInfo : '') +
      '\n\n';
    this._files[file.filename] = file;
    return file;
  }

  protected extend(): TsGenerator {
    const instance = {
      options: { ...this.options },
    } as any;
    Object.setPrototypeOf(instance, this);
    return instance as TsGenerator;
  }

  static {
    TsGenerator.prototype.generateDocument = generateDocument;
    TsGenerator.prototype.generateDataType = generateDataType;
    TsGenerator.prototype._generateTypeCode = _generateTypeCode;
    TsGenerator.prototype._generateArrayTypeCode = _generateArrayTypeCode;
    TsGenerator.prototype._generateComplexTypeCode = _generateComplexTypeCode;
    TsGenerator.prototype._generateEnumTypeCode = _generateEnumTypeCode;
    TsGenerator.prototype._generateMappedTypeCode = _generateMappedTypeCode;
    TsGenerator.prototype._generateMixinTypeCode = _generateMixinTypeCode;
    TsGenerator.prototype._generateSimpleTypeCode = _generateSimpleTypeCode;
    TsGenerator.prototype._generateUnionTypeCode = _generateUnionTypeCode;
    TsGenerator.prototype.generateHttpApi = generateHttpApi;
    TsGenerator.prototype.generateHttpController = generateHttpController;
  }
}
