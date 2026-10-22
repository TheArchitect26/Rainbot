import { RULES_VERSION } from '../game/challenges';
declare const __APP_VERSION__: string;
declare const __BUILD_COMMIT__: string;
declare const __BUILD_TARGET__: string;

export const BUILD_INFO = Object.freeze({
  version: typeof __APP_VERSION__ === 'undefined' ? '0.2.0-dev' : __APP_VERSION__,
  commit: typeof __BUILD_COMMIT__ === 'undefined' ? 'local' : __BUILD_COMMIT__,
  target: typeof __BUILD_TARGET__ === 'undefined' ? 'test' : __BUILD_TARGET__,
  rules: RULES_VERSION,
});
