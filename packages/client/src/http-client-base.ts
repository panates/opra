import { updateErrorMessage } from '@jsopen/objects';
import {
  ApiDocument,
  ApiDocumentFactory,
  OpraSchema,
  type URLSearchParamsInit,
} from '@opra/common';
import type { StrictOmit } from 'ts-gems';
import { kBackend } from './constants.js';
import { HttpBackend } from './http-backend.js';
import { HttpBundleObservable } from './http-bundle-observable.js';
import { HttpRequestObservable } from './http-request-observable.js';

const SPLIT_BACKSLASH_PATTERN = /^(\/*)(.+)/;

/**
 * Namespace for {@link OpraClientBase} related types and interfaces.
 *
 * @namespace OpraClientBase
 */
export namespace OpraClientBase {
  /** Configuration options for OpraClientBase */
  export interface Options {
    /** The API document associated with this client */
    document?: ApiDocument;
  }

  /** Generic request options for OPRA client */
  export type RequestOptions = Partial<
    StrictOmit<HttpBackend.RequestInit, 'url'>
  > & {
    /** URL parameters */
    params?: URLSearchParamsInit;
  };
}

/**
 * Base class for OPRA HTTP clients.
 *
 * @class OpraClientBase
 * @abstract
 */
export abstract class HttpClientBase<TRequestOptions = {}, TResponseExt = {}> {
  declare protected [kBackend]: HttpBackend;

  /**
   * Creates a new instance of HttpClientBase.
   *
   * @param backend The backend instance to use for requests.
   * @protected
   */
  protected constructor(backend: HttpBackend) {
    Object.defineProperty(this, kBackend, {
      enumerable: false,
      value: backend,
    });
  }

  /**
   * Gets the base service URL.
   */
  get serviceUrl(): string {
    return this[kBackend].serviceUrl;
  }

  /**
   * Fetches the API document from the service.
   *
   * @param options Fetch options.
   * @returns A promise that resolves to an ApiDocument.
   * @throws {@link Error} if there is an issue fetching or parsing the document.
   */
  async fetchDocument(options?: {
    documentId?: string;
    /** Language to fetch the documentation texts in — applied to every
     *  reference fetched below too, so one document never comes back in a
     *  mix of languages. */
    lang?: string;
  }): Promise<ApiDocument> {
    const documentMap: Record<string, any> = {};
    const getDocument = async (documentId?: string) => {
      const req = this.request('$schema', {
        headers: new Headers({ accept: 'application/json' }),
      });
      if (documentId) req.param('id', documentId);
      if (options?.lang) req.param('lang', options.lang);
      const body = await req.getBody().catch(e => {
        updateErrorMessage(
          e,
          'Error fetching api schema from url (' +
            this.serviceUrl +
            ').\n' +
            e.message,
        );
        throw e;
      });
      if (body.references) {
        const oldReferences = body.references;
        body.references = {};
        for (const [ns, obj] of Object.entries<OpraSchema.DocumentReference>(
          oldReferences,
        )) {
          if (documentMap[obj.id] === null)
            throw new Error('Circular reference detected');
          documentMap[obj.id] = null;
          const x = await getDocument(obj.id);
          body.references[ns] = documentMap[obj.id] = x;
        }
      }
      return body;
    };

    const body = await getDocument(options?.documentId);
    return await ApiDocumentFactory.createDocument(body).catch(e => {
      updateErrorMessage(e, 'Error loading api document.\n' + e.message);
      throw e;
    });
  }

  /**
   * Creates a new {@link HttpRequestObservable} for a specific path.
   *
   * @param path The path of the request.
   * @param options Request options.
   * @returns A new HttpRequestObservable instance.
   */
  request<TBody = any>(path: string, options?: OpraClientBase.RequestOptions) {
    /* Remove leading backslashes */
    path = SPLIT_BACKSLASH_PATTERN.exec(path)?.[2] || '';
    const observable = new HttpRequestObservable<
      TBody,
      TBody,
      TRequestOptions,
      TResponseExt
    >(this[kBackend], {
      ...options,
      method: options?.method || 'GET',
      url: new URL(path, this.serviceUrl),
    });
    if (options?.params) observable.param(options.params);
    return observable;
  }

  /**
   * Sends a DELETE request.
   *
   * @param path The path of the request.
   * @param options Request options.
   * @returns A new HttpRequestObservable instance.
   */
  delete<TBody = any>(
    path: string,
    options?: StrictOmit<OpraClientBase.RequestOptions, 'method' | 'body'>,
  ) {
    return this.request<TBody>(path, {
      ...options,
      method: 'DELETE',
    });
  }

  /**
   * Sends a GET request.
   *
   * @param path The path of the request.
   * @param options Request options.
   * @returns A new HttpRequestObservable instance.
   */
  get<TBody = any>(
    path: string,
    options?: StrictOmit<OpraClientBase.RequestOptions, 'method' | 'body'>,
  ) {
    return this.request<TBody>(path, {
      ...options,
      method: 'GET',
    });
  }

  /**
   * Sends a PATCH request.
   *
   * @param path The path of the request.
   * @param requestBody The request body.
   * @param options Request options.
   * @returns A new HttpRequestObservable instance.
   */
  patch<TBody = any>(
    path: string,
    requestBody: any,
    options?: StrictOmit<OpraClientBase.RequestOptions, 'method' | 'body'>,
  ) {
    return this.request<TBody>(path, {
      ...options,
      method: 'PATCH',
      body: requestBody,
    });
  }

  /**
   * Sends a POST request.
   *
   * @param path The path of the request.
   * @param requestBody The request body.
   * @param options Request options.
   * @returns A new HttpRequestObservable instance.
   */
  post<TBody = any>(
    path: string,
    requestBody: any,
    options?: StrictOmit<OpraClientBase.RequestOptions, 'method' | 'body'>,
  ) {
    return this.request<TBody>(path, {
      ...options,
      method: 'POST',
      body: requestBody,
    });
  }

  /**
   * Sends a PUT request.
   *
   * @param path The path of the request.
   * @param requestBody The request body.
   * @param options Request options.
   * @returns A new HttpRequestObservable instance.
   */
  put<TBody = any>(
    path: string,
    requestBody: any,
    options?: StrictOmit<OpraClientBase.RequestOptions, 'method' | 'body'>,
  ) {
    return this.request<TBody>(path, {
      ...options,
      method: 'PUT',
      body: requestBody,
    });
  }

  /**
   * Bundles multiple requests into a single multipart HTTP request and
   * distributes the parsed sub-responses back to callers.
   *
   * @param requests The list of requests to bundle.
   * @returns A {@link HttpBundleObservable} that emits an ordered array of {@link HttpResponse}.
   */
  bundle(requests: HttpRequestObservable<any>[]): HttpBundleObservable {
    return new HttpBundleObservable(this[kBackend], requests);
  }

  /**
   * Executes a transaction composed of multiple HTTP requests.
   *
   * @param {HttpRequestObservable<any>[]} requests - An array of HTTP request observables that are part of the transaction.
   * @return {HttpBundleObservable} A new observable that represents the bundled transaction.
   */
  transaction(requests: HttpRequestObservable<any>[]): HttpBundleObservable {
    return new HttpBundleObservable(this[kBackend], requests).param({
      transaction: true,
    });
  }
}
