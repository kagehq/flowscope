export default defineNuxtConfig({
  devtools: { enabled: false },
  css: ['~/assets/tailwind.css'],
  typescript: { strict: true },
  alias: {
    '@flowscope/shared': '../../packages/shared/src',
  },
  postcss: {
    plugins: {
      tailwindcss: {},
      autoprefixer: {},
    },
  },
});

