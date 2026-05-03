import { describe, expect, it } from 'vitest';

import pkg from '../package.json';

describe('package exports', () => {
  it('provides CommonJS require targets for every public subpath', () => {
    const exportsMap = pkg.exports as Record<string, { import?: string; require?: string; types?: string }>;

    for (const [subpath, entry] of Object.entries(exportsMap)) {
      expect(entry.import, `${subpath} import`).toMatch(/^\.\/dist\/esm\/.+\.js$/);
      expect(entry.require, `${subpath} require`).toMatch(/^\.\/dist\/cjs\/.+\.cjs$/);
      expect(entry.types, `${subpath} types`).toMatch(/^\.\/dist\/esm\/.+\.d\.ts$/);
    }
  });
});
