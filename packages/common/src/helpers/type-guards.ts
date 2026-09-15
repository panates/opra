/// <reference lib="dom" />
import type { Readable, Stream } from 'stream';

export function isStream(x: any): x is Stream {
  return x !== null && typeof x === 'object' && typeof x.pipe === 'function';
}

export function isReadable(x: any): x is Readable {
  return (
    (isStream(x) as any) &&
    typeof x._read === 'function' &&
    typeof x._readableState === 'object'
  );
}

export function isWritable(x: any): x is Readable {
  return (isStream(x) as any) && typeof x._write === 'function';
}

export function isReadableStream(x: any): x is ReadableStream {
  return (
    (isStream(x) as any) &&
    typeof x.getReader === 'function' &&
    typeof x.pipeThrough === 'function' &&
    typeof x.pipeTo === 'function'
  );
}

export function isBlob(x: any): x is Blob {
  return (
    x !== null &&
    typeof x === 'object' &&
    typeof x.size === 'number' &&
    typeof x.arrayBuffer === 'function' &&
    typeof x.stream === 'function'
  );
}

export function isFormData(x: any): x is FormData {
  return (
    x !== null &&
    typeof x.constructor === 'function' &&
    x.constructor.name === 'FormData' &&
    typeof x.append === 'function' &&
    typeof x.getAll === 'function'
  );
}

export function isURL(x: any): x is URL {
  return (
    x !== null &&
    typeof x == 'object' &&
    typeof x.host === 'string' &&
    typeof x.href === 'string'
  );
}
