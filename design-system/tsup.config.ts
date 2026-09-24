import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { 'index.es': 'src/index.ts' },
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  outExtension: () => ({ js: '.js' }),
  external: ['react', 'react-dom', 'react/jsx-runtime'],
  injectStyle: false,
  clean: true,
  sourcemap: false,
  treeshake: true,
})
