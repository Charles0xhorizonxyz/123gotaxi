import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { EXPANDER_URL, GEOAPIFY_KEY, GEOAPIFY_URL, PHOTON_URL } from './src/config.ts';

// The browser enforces this policy on the published site. Most importantly,
// connect-src allows exactly two outside servers: the address lookup (it only
// ever receives coordinates) and our link expander (it only ever receives a
// short map link). The page cannot send anything anywhere else, even if a bug
// or a compromised library tried to.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src ${[GEOAPIFY_KEY && GEOAPIFY_URL, PHOTON_URL, EXPANDER_URL].filter(Boolean).join(' ')}`,
  "manifest-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

// Only on build: the dev server needs a live connection for hot reload.
function securityHeaders(): Plugin {
  return {
    name: 'security-meta',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<head>',
        `<head>
    <meta http-equiv="Content-Security-Policy" content="${CONTENT_SECURITY_POLICY}" />`,
      );
    },
  };
}

// BASE_PATH lets the site live under a sub-path (e.g. "/123gotaxi/" on
// github.io) before the custom domain is connected. Defaults to "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: {
    target: 'es2022',
    // Two pages: the app, and the one-pager for places at /onmysite/.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        onmysite: fileURLToPath(new URL('./onmysite/index.html', import.meta.url)),
      },
    },
  },
  plugins: [securityHeaders()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
