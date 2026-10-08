import fs from 'node:fs';
import os from 'node:os';
import typeIs from '@browsery/type-is';
import { BadRequestError, HttpMediaType } from '@opra/common';
import fsPromise from 'fs/promises';
import * as MP from 'multipasta/node';
import { AsyncEventEmitter } from 'node-events-async';
import type { StrictOmit } from 'ts-gems';
import { isNotNullish, ValidationError } from 'valgen';
import type { HttpRequest } from '../interfaces/http-request.interface.js';
import { LocalFile } from './local-file.js';

/**
 * Whatever valgen rejects while a part is being read is the *request's*
 * fault: a part that does not validate, or a required one the client left
 * out. Thrown as the raw `ValidationError` it reached
 * `HttpAdapter.handleRequest()`, whose catch block assumes a
 * `ValidationError` arriving that far out can only have come from encoding
 * the response - so a malformed upload was answered `500
 * RESPONSE_VALIDATION` and logged as a server error, for a request the
 * server had understood perfectly well. The reader knows which side of the
 * exchange it is validating, so it says so here, the same way the unknown-
 * field and content-type checks above already answer 400.
 */
function requestValidationError(error: ValidationError): BadRequestError {
  const issues = error.issues || [];
  return new BadRequestError(
    {
      // One issue is almost always the whole story ("Multi part field
      // \"file\" is required") and reads better than a generic headline
      // with the real message buried in `details`.
      message:
        issues.length === 1 && issues[0].message
          ? issues[0].message
          : 'Multipart request validation failed',
      code: 'REQUEST_VALIDATION',
      details: issues,
    },
    error,
  );
}

/**
 * MultipartReader is a drop-in replacement for MultipartReader that uses
 * `multipasta` instead of `busboy`. The key advantage: part-level headers
 * (e.g. `Request-Id`) are fully exposed via `item.headers`.
 */
export class MultipartReader extends AsyncEventEmitter {
  protected _started = false;
  protected _streamClosed = false;
  protected _finished = false;
  protected _cancelled = false;
  protected _pendingWrites = 0;
  protected _stream: MP.MultipastaStream;
  protected _items: MultipartReader.Item[] = [];
  protected _stack: MultipartReader.Item[] = [];
  protected tempDirectory: string;
  scope?: string;

  constructor(
    protected request: HttpRequest,
    options?: MultipartReader.Options,
    protected mediaType?: HttpMediaType,
  ) {
    super();
    this.setMaxListeners(1000);
    this.tempDirectory = options?.tempDirectory || os.tmpdir();
    this.scope = options?.scope;

    const stream = MP.make({
      headers: request.headers as Record<string, string>,
      isFile: options?.isFile,
    });
    this._stream = stream;

    stream.once('error', (e: any) => {
      this._cancelled = true;
      this._finished = true;
      if (this.listenerCount('error') > 0) this.emit('error', e);
    });

    // Stream closed means the parser is done, but file writes may still be in
    // progress. _finished is set only when stream closes AND all writes complete.
    stream.on('close', () => {
      this._streamClosed = true;
      this._checkFinished();
    });

    stream.on('field', (part: MP.Field) => {
      const headers = _flattenHeaders(part.info.headers);
      const item: MultipartReader.Field = {
        kind: 'field',
        field: part.info.name,
        value: MP.decodeField(part.info, part.value),
        mimeType: part.info.contentType,
        encoding: part.info.contentTypeParameters['charset'],
        headers,
      };
      this._items.push(item);
      this._stack.push(item);
      this.emit('item', item);
    });

    stream.on('file', (file: MP.FileStream) => {
      const saveTo = LocalFile.tempFilename(
        file.info.filename ?? file.info.name,
        this.tempDirectory,
      );
      const writeStream = fs.createWriteStream(saveTo);
      file.pipe(writeStream);

      // Build a "ready" promise that resolves when the write is fully flushed.
      // buffer() / text() await this so callers always read a complete file.
      const ready = new Promise<void>(resolve =>
        writeStream.once('finish', resolve),
      );

      // Emit the item immediately (preserves part order) — the write may
      // still be in progress, but reading is deferred via ready.
      const headers = _flattenHeaders(file.info.headers);
      const item = new MultipartFile(file.info.name, saveTo, ready, {
        filename: file.info.filename ?? file.info.name,
        type: file.info.contentType,
        encoding: (file.info.contentTypeParameters['charset'] ??
          'utf-8') as BufferEncoding,
        autoDelete: true,
        headers,
      });
      this._items.push(item);
      this._stack.push(item);
      this.emit('item', item);

      this._pendingWrites++;
      ready.then(() => {
        this._pendingWrites--;
        this._checkFinished();
      });
    });
  }

  protected _checkFinished() {
    if (this._streamClosed && this._pendingWrites === 0) {
      this._finished = true;
      this.emit('_finished');
    }
  }

  get items(): MultipartReader.Item[] {
    return this._items;
  }

  /**
   * Retrieves the next item (field or file) from the multipart stream.
   */
  async getNext(): Promise<MultipartReader.Item | undefined> {
    let item = this._stack.shift();
    if (!item && !this._finished) {
      this.resume();
      item = await new Promise<any>((resolve, reject) => {
        let resolved = false;
        if (this._stack.length) return resolve(this._stack.shift());
        if (this._finished) return resolve(this._stack.shift());
        const onDone = () => {
          if (resolved) return;
          resolved = true;
          resolve(this._stack.shift());
        };
        // _finished fires only after stream closes AND all file writes complete
        this.once('_finished', onDone);
        this.once('item', () => {
          this.pause();
          this.removeListener('_finished', onDone);
          if (resolved) return;
          resolved = true;
          resolve(this._stack.shift());
        });
        this.once('error', e => reject(e));
      });
    }

    if (item && this.mediaType) {
      const field = this.mediaType.findMultipartField(item.field);
      if (!field)
        throw new BadRequestError(`Unknown multipart field (${item.field})`);
      if (item.kind === 'field') {
        const decode = field.generateCodec('decode', {
          scope: this.scope,
          ignoreReadonlyFields: true,
          projection: '*',
        });
        try {
          item!.value = decode(item!.value, {
            onFail: issue =>
              `Multipart field (${item.field}) validation failed: ` +
              issue.message,
          });
        } catch (e: any) {
          if (!(e instanceof ValidationError)) throw e;
          throw requestValidationError(e);
        }
        this.emit('field', item);
      } else if (item.kind === 'file') {
        if (field.contentType) {
          const arr = Array.isArray(field.contentType)
            ? field.contentType
            : [field.contentType];
          if (!(item.type && arr.find(ct => typeIs.is(item.type!, [ct])))) {
            throw new BadRequestError(
              `Multipart field (${item.field}) do not accept this content type`,
            );
          }
        }
        this.emit('file', item);
      }
    }

    /* if all items received we check for required items */
    if (
      this._finished &&
      this.mediaType &&
      this.mediaType.multipartFields?.length > 0
    ) {
      const fieldsLeft = new Set(this.mediaType.multipartFields);
      for (const x of this._items) {
        const field = this.mediaType.findMultipartField(x.field);
        if (field) fieldsLeft.delete(field);
      }
      let error: ValidationError | undefined;
      for (const field of fieldsLeft) {
        if (!field.required) continue;
        try {
          isNotNullish(null, {
            onFail: () =>
              `Multi part field "${String(field.fieldName)}" is required`,
          });
        } catch (e: any) {
          if (!error) {
            error = e;
          } else
            (error as ValidationError).issues.push(
              ...(e as ValidationError).issues,
            );
        }
      }
      if (error) {
        const e = requestValidationError(error);
        this.emit('error', e);
        throw e;
      }
    }
    return item;
  }

  /**
   * Retrieves all items from the multipart stream.
   */
  async getAll(): Promise<MultipartReader.Item[]> {
    const items: MultipartReader.Item[] = [...this._items];
    let item: MultipartReader.Item | undefined;
    while (!this._cancelled && (item = await this.getNext())) {
      items.push(item);
    }
    return items;
  }

  cancel() {
    this._cancelled = true;
    if (this._started) this.resume();
  }

  resume() {
    if (!this._started) {
      this._started = true;
      this.request.pipe(this._stream);
      // Drain the readable side of the Duplex so 'end' → 'close' can fire.
      this._stream.resume();
    }
    this.request.resume();
  }

  pause() {
    this.request.pause();
  }

  /**
   * Purges all temporary files created by the reader.
   */
  async purge() {
    const promises: Promise<any>[] = [];
    this._items.forEach(item => {
      if (item.kind !== 'file') return;
      promises.push(fsPromise.unlink(item.storedPath).catch(() => {}));
    });
    return Promise.allSettled(promises);
  }
}

/**
 *
 * @class
 */
class MultipartFile extends LocalFile {
  readonly kind = 'file';
  readonly field: string;
  readonly headers: Record<string, string>;
  private readonly _ready: Promise<void>;

  constructor(
    field: string,
    storedPath: string,
    ready: Promise<void>,
    options: LocalFile.Options & { headers?: Record<string, string> } = {
      autoDelete: true,
    },
  ) {
    super(storedPath, options);
    this.field = field;
    this.headers = options.headers ?? {};
    this._ready = ready;
  }

  async text(): Promise<string> {
    await this._ready;
    return super.text();
  }

  async buffer(): Promise<Buffer> {
    await this._ready;
    return super.buffer();
  }
}

/**
 *
 * @namespace
 */
export namespace MultipartReader {
  export interface Options extends StrictOmit<
    MP.NodeConfig,
    'headers' | 'isFile'
  > {
    tempDirectory?: string;
    scope?: string;
    isFile?: (info: MP.PartInfo) => boolean;
  }

  export interface Field {
    kind: 'field';
    field: string;
    value?: any;
    mimeType?: string;
    encoding?: string;
    headers?: Record<string, string>;
  }

  export type File = MultipartFile;

  export type Item = Field | File;
}

function _flattenHeaders(
  headers: Record<string, string | string[]>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}
