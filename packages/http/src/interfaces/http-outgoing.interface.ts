import { mergePrototype } from '@opra/common';
import { type StrictOmit } from 'ts-gems';
import { HttpOutgoingHost } from '../impl/http-outgoing.host.js';
import { isHttpOutgoing, isNodeOutgoingMessage } from '../type-guards.js';
import type { HttpIncoming } from './http-incoming.interface.js';
import { NodeOutgoingMessage } from './node-outgoing-message.interface.js';

/**
 * HttpOutgoing represents an outgoing HTTP response.
 * It extends NodeOutgoingMessage with additional functionality for handling HTTP responses.
 */
export interface HttpOutgoing extends StrictOmit<
  NodeOutgoingMessage,
  'req' | 'appendHeader' | 'setHeader'
> {
  req: HttpIncoming;

  readonly finished?: boolean;

  appendHeader(name: string, value: string | readonly string[]): this;

  getHeader(name: string): number | string | string[] | undefined;

  setHeader(name: string, value: number | string | readonly string[]): this;

  /**
   * Set _Content-Disposition_ header to _attachment_ with optional `filename`.
   */
  attachment(filename?: string): this;

  /* Clear cookie `name`. */
  clearCookie(name: string, options?: CookieOptions): this;

  /**
   * Set cookie `name` to `val`, with the given `options`.
   *
   * Options:
   *
   *    - `maxAge`   max-age in milliseconds, converted to `expires`
   *    - `signed`   sign the cookie
   *    - `path`     defaults to "/"
   *
   * Examples:
   *
   *    // "Remember Me" for 15 minutes
   *    res.cookie('rememberme', '1', { expires: new Date(Date.now() + 900000), httpOnly: true });
   *
   *    // save as above
   *    res.cookie('rememberme', '1', { maxAge: 900000, httpOnly: true })
   */
  cookie(name: string, val: string, options: CookieOptions): this;

  cookie(name: string, val: any, options: CookieOptions): this;

  cookie(name: string, val: any): this;

  /**
   * Set _Content-Type_ response header with `type` through `mime.lookup()`
   * when it does not contain "/", or set the Content-Type to `type` otherwise.
   *
   * @example
   *     res.type('.html');
   *     res.type('html');
   *     res.type('json');
   *     res.type('application/json');
   *     res.type('png');
   */
  contentType(type: string): this;

  /**
   * Set Link header field with the given `links`.
   *
   * Examples:
   *
   *    res.links({
   *      next: 'http://api.example.com/users?page=2',
   *      last: 'http://api.example.com/users?page=5'
   *    });
   */
  links(links: Record<string, string>): this;

  /**
   * Set the location header to `url`.
   *
   * The given `url` can also be the name of a mapped url, for
   * example by default express supports "back" which redirects
   * to the _Referrer_ or _Referer_ headers or "/".
   *
   * Examples:
   *
   *    res.location('/foo/bar').;
   *    res.location('http://example.com');
   *    res.location('../login'); // /blog/post/1 -> /blog/login
   *
   * Mounting:
   *
   *   When an application is mounted and `res.location()`
   *   is given a path that does _not_ lead with "/" it becomes
   *   relative to the mount-point. For example if the application
   *   is mounted at "/blog", the following would become "/blog/login".
   *
   *      res.location('login');
   *
   *   While the leading slash would result in a location of "/login":
   *
   *      res.location('/login');
   */
  location(url: string): this;

  /**
   * Redirect to the given `url` with optional response `status`
   * defaulting to 302.
   *
   * The resulting `url` is determined by `res.location()`, so
   * it will play nicely with mounted apps, relative paths,
   * `"back"` etc.
   *
   * Examples:
   *
   *    res.redirect('back');
   *    res.redirect('/foo/bar');
   *    res.redirect('http://example.com');
   *    res.redirect(301, 'http://example.com');
   *    res.redirect('http://example.com', 301);
   *    res.redirect('../login'); // /blog/post/1 -> /blog/login
   */
  redirect(url: string): void;

  redirect(status: number, url: string): void;

  /**
   * Set status `code`.
   */
  status(code: number): this;

  /**
   * Send the given HTTP status code.
   *
   * Sets the response status to `statusCode` and the body of the
   * response to the standard description from node's http.STATUS_CODES
   * or the statusCode number if no description.
   */
  sendStatus(statusCode: number): this;

  /**
   * Send a response.
   *
   * @example
   *     res.send(new Buffer('wahoo'));
   *     res.send({ some: 'json' });
   *     res.send('<p>some html</p>');
   *     res.status(404).send('Sorry, cant find that');
   */
  send(body?: any): this;
}

export interface CookieOptions {
  secret?: string;
  maxAge?: number;
  signed?: boolean;
  expires?: Date;
  httpOnly?: boolean;
  path?: string;
  domain?: string;
  secure?: boolean;
  encode?: (val: string) => string;
  sameSite?: boolean | 'lax' | 'strict' | 'none';
}

/**
 * Utility functions for HttpOutgoing.
 */
export namespace HttpOutgoing {
  /**
   * Creates an HttpOutgoing instance from various sources.
   *
   * @param instance - The source instance.
   * @returns The HttpOutgoing instance.
   */
  export function from(
    instance: HttpOutgoing | NodeOutgoingMessage.Initiator,
  ): HttpOutgoing {
    if (isHttpOutgoing(instance)) return instance;
    if (!isNodeOutgoingMessage(instance))
      instance = NodeOutgoingMessage.from(instance);
    mergePrototype(instance, HttpOutgoingHost.prototype);
    return instance as HttpOutgoing;
  }
}
