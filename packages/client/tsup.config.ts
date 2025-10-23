import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    react: 'src/react.ts',
    vue: 'src/vue.ts',
  },
  format: ['cjs', 'esm'],
  dts: {
    entry: {
      index: 'src/index.ts',
      // Skip auto-generation for react/vue, use manual .d.ts
    },
    resolve: true,
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  minify: true,
  target: 'es2020',
  external: ['react', 'vue'],
  noExternal: [],
  tsconfig: './tsconfig.json',
  // Copy manual .d.ts files after build
  async onSuccess() {
    const fs = await import('fs/promises');
    await fs.copyFile('src/integrations/react.d.ts', 'dist/react.d.ts');
    await fs.copyFile('src/integrations/vue.d.ts', 'dist/vue.d.ts');
  },
});

