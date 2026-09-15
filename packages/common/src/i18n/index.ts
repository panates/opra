import { I18n } from './i18n.js';

export * from './i18n.js';
export * from './translate.js';
export * from './translation-store.js';

const i18n = I18n.createInstance();
i18n.init().catch(() => undefined);
export { i18n };
