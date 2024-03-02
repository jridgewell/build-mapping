import typescript from '@rollup/plugin-typescript';

function configure(esm) {
  return {
    input: 'src/build-mapping.ts',
    output: esm
      ? { format: 'es', dir: 'dist', entryFileNames: '[name].mjs', sourcemap: true }
      : {
          format: 'umd',
          name: 'buildMapping',
          dir: 'dist',
          entryFileNames: '[name].umd.js',
          sourcemap: true,
          globals: {
            '@jridgewell/set-array': 'setArray',
            '@jridgewell/sourcemap-codec': 'sourcemapCodec',
            '@jridgewell/trace-mapping': 'traceMapping',
          },
        },
    plugins: [
      typescript({
        tsconfig: './tsconfig.build.json',
        tslib: './throw-when-needed',
      }),
    ],
    watch: {
      include: 'src/**',
    },
  };
}

export default [configure(false), configure(true)];
