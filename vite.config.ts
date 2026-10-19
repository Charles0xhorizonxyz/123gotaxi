import { defineConfig } from 'vitest/config';

// BASE_PATH lets the site live under a sub-path (e.g. "/gogogo-rodeo/" on
// github.io) before the custom domain is connected. Defaults to "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2022' },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
