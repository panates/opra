/**
 * A deliberately non-functional stand-in for `node:fs`, used only so
 * esbuild can successfully bundle the disk-writing code path
 * (`TsGenerator#generate()`, `write-to-disk.ts`, `clean-directory.ts`,
 * `file-writer.ts`) as its own separate, code-split chunk — see
 * `browser-entry.ts`, which only ever calls `generateFiles()`, never
 * `generate()`. That chunk is therefore never actually *fetched* by a
 * browser at runtime; this only needs to exist so the *build* succeeds,
 * not so these functions actually work. If one of them somehow ran
 * anyway, throwing immediately is far better than silently doing
 * nothing.
 */
function unsupported(name: string): never {
  throw new Error(
    `fs.${name}() is not available in the browser codegen bundle`,
  );
}

export function existsSync(): boolean {
  return unsupported('existsSync');
}
export function readdirSync(): string[] {
  return unsupported('readdirSync');
}
export function statSync(): { isDirectory(): boolean } {
  return unsupported('statSync');
}
export function rmdirSync(): void {
  return unsupported('rmdirSync');
}
export function readFileSync(): string {
  return unsupported('readFileSync');
}
export function unlinkSync(): void {
  return unsupported('unlinkSync');
}
export function mkdirSync(): void {
  return unsupported('mkdirSync');
}
export function writeFileSync(): void {
  return unsupported('writeFileSync');
}

export default {
  existsSync,
  readdirSync,
  statSync,
  rmdirSync,
  readFileSync,
  unlinkSync,
  mkdirSync,
  writeFileSync,
};
