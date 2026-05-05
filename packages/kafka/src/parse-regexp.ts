export function parseRegExp(str: string): RegExp {
  const i = str.lastIndexOf('/');
  if (str.startsWith('/') && i) {
    const s = str.substring(1, i);
    return new RegExp(s);
  }
  throw new TypeError(`"${str}" is not a valid RegExp string`);
}
