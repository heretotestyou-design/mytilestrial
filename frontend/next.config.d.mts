// Types for importing next.config.mjs from tests (src/test/securityHeaders.test.ts).
declare const config: {
  headers(): Promise<{ source: string; headers: { key: string; value: string }[] }[]>;
  [key: string]: unknown;
};
export default config;
