// Passed to esbuild's own `inject` option (see `client-codegen-bundle.ts`) —
// its whole purpose, per esbuild's own docs, is exactly this: providing a
// `process` global for code that references it as a bare, unimported
// identifier (`process.env...`, `process.nextTick(...)`) rather than
// importing it, which the `node:process` alias below doesn't cover on its
// own since there's no import site for `alias` to redirect.
export { default as process } from 'process';
