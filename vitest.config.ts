import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/ahap.ts',
        'src/transforms.ts',
        'src/patterns.ts',
        'src/sync.ts',
        'src/visualizer.ts',
        'src/testing.ts',
        'src/validate.ts',
        'src/recorder.ts',
        'src/sequence.ts',
      ],
      reporter: ['text', 'text-summary', 'html', 'json-summary'],
      thresholds: {
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 75,
      },
    },
  },
});
