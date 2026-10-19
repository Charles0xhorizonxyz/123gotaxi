import { defineConfig, type Plugin } from 'vitest/config';

// The browser enforces this policy on the published site. Most importantly,
// connect-src 'none' means the page cannot send anything (typed addresses
// included) to any server, even if a bug or a compromised library tried to.
// Milestones 3-4 will add exactly the map-tile and search hosts, nothing else.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'none'",
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

// BASE_PATH lets the site live under a sub-path (e.g. "/gogogo-rodeo/" on
// github.io) before the custom domain is connected. Defaults to "/".
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  build: { target: 'es2022' },
  plugins: [securityHeaders()],
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
