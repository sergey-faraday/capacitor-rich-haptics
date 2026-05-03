import nodeResolve from '@rollup/plugin-node-resolve';

const subpathInputs = {
  index: 'dist/esm/index.js',
  react: 'dist/esm/react.js',
  vue: 'dist/esm/vue.js',
  patterns: 'dist/esm/patterns.js',
  ahap: 'dist/esm/ahap.js',
  transforms: 'dist/esm/transforms.js',
  testing: 'dist/esm/testing.js',
  validate: 'dist/esm/validate.js',
  recorder: 'dist/esm/recorder.js',
  sequence: 'dist/esm/sequence.js',
  sync: 'dist/esm/sync.js',
  visualizer: 'dist/esm/visualizer.js',
};

export default [
  {
    input: 'dist/esm/index.js',
    output: [
      {
        file: 'dist/plugin.js',
        format: 'iife',
        name: 'capacitorRichHaptics',
        globals: { '@capacitor/core': 'capacitorExports' },
        sourcemap: true,
        inlineDynamicImports: true,
      },
      {
        file: 'dist/plugin.cjs.js',
        format: 'cjs',
        sourcemap: true,
        inlineDynamicImports: true,
      },
    ],
    external: ['@capacitor/core'],
    plugins: [nodeResolve()],
  },
  {
    input: subpathInputs,
    output: {
      dir: 'dist/cjs',
      format: 'cjs',
      entryFileNames: '[name].cjs',
      sourcemap: true,
    },
    external: ['@capacitor/core', 'react', 'vue'],
    plugins: [nodeResolve()],
  },
];
