/// <reference types="vitest/config" />
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { CONTENT_SECURITY_POLICY, renderHeadersFile } from './src/config/csp.ts';
import { BMC_FRAME_PATH, BMC_FRAME_URL_PATH, bmcSlugFromUrl, buildBmcFrame } from './src/config/bmc.ts';
import { renderThirdPartyLicenses } from './scripts/third-party-licenses.ts';

/**
 * Injects the Content Security Policy as a <meta> tag in production builds.
 * (Not in dev: Vite's HMR client relies on inline scripts.)
 * Hosting platforms additionally send the policy as an HTTP header – see the generated dist/_headers.
 */
function cspMetaPlugin(bmcUrl: string | undefined): Plugin {
  const slug = bmcSlugFromUrl(bmcUrl);
  const frame = slug ? buildBmcFrame(slug) : null;
  return {
    name: 'segl-csp',
    configureServer(server) {
      // Serve the isolated Buy Me a Coffee frame in dev as well.
      server.middlewares.use(BMC_FRAME_URL_PATH, (_req, res) => {
        if (!frame) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Content-Security-Policy', frame.csp);
        res.end(frame.html);
      });
    },
    generateBundle() {
      // Security headers for Cloudflare Pages / Netlify, generated from the same source as the meta CSP.
      this.emitFile({ type: 'asset', fileName: '_headers', source: renderHeadersFile(frame?.csp) });
      if (frame) this.emitFile({ type: 'asset', fileName: BMC_FRAME_PATH, source: frame.html });
      // License notices for all bundled third-party code.
      this.emitFile({ type: 'asset', fileName: 'third-party-licenses.txt', source: renderThirdPartyLicenses() });
    },
    transformIndexHtml(html, ctx) {
      if (ctx.server) return html;
      // frame-ancestors is ignored in <meta>; it is delivered via HTTP headers instead.
      const metaPolicy = CONTENT_SECURITY_POLICY.replace(/frame-ancestors[^;]*;?\s*/, '').trim();
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${metaPolicy}" />`,
      );
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const base = env.VITE_BASE || '/';

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      cspMetaPlugin(env.VITE_BUYMEACOFFEE_URL),
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        manifest: {
          name: 'segl.',
          short_name: 'segl.',
          description: 'Prepare sensitive PDFs for sharing – processed locally in your browser.',
          lang: 'nb',
          start_url: '.',
          scope: '.',
          display: 'standalone',
          background_color: '#131416',
          theme_color: '#131416',
          icons: [
            { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
            { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
            { src: 'icons/icon.svg', sizes: 'any', type: 'image/svg+xml' },
          ],
        },
        workbox: {
          // Only the application shell and pdf.js resources are cached. User documents are never
          // fetched over the network, so they can never end up in the cache.
          globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,wasm,bcmap,pfb,ttf,icc,webmanifest}'],
          maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
          navigateFallback: 'index.html',
          // The isolated Buy Me a Coffee frame must never be answered with the app shell.
          navigateFallbackDenylist: [/\/bmc\//],
          cleanupOutdatedCaches: true,
          runtimeCaching: [],
        },
        devOptions: { enabled: false },
      }),
    ],
    worker: { format: 'es' },
    build: {
      target: 'es2022',
      sourcemap: false,
      chunkSizeWarningLimit: 2500,
    },
    server: { port: 5173 },
    preview: { port: 4173 },
    test: {
      include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
      environment: 'node',
      testTimeout: 30_000,
    },
  };
});
