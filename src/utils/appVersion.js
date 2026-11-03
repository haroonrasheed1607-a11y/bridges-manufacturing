import release from '../../release.json';
// Some hosting build pipelines omit Vite's compile-time replacement.
export const appVersion = typeof __APP_VERSION__ !== 'undefined'
  ? __APP_VERSION__
  : (typeof document !== 'undefined' && document.querySelector('meta[name="application-version"]')?.content) || release.minimumVersion;
