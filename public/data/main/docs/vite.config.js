import { defineConfig, loadEnv } from 'vite'
import { minify } from 'html-minifier-terser'
import QRCode from 'qrcode'
import { resolve } from 'path'
import { readFileSync, writeFileSync } from 'fs'
import { VitePWA } from 'vite-plugin-pwa'

const htmlMinifierPlugin = () => {
  return {
    name: 'html-minifier-plugin',
    enforce: 'post',
    async transformIndexHtml(html) {
      return await minify(html, {
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
        minifyCSS: true,
        removeAttributeQuotes: true,
        collapseBooleanAttributes: true,
        processConditionalComments: true,
        removeOptionalTags: true
      })
    },
  }
}

const qrCodePlugin = () => {
  return {
    name: 'qr-code-plugin',
    async writeBundle() {
      const filePath = resolve(__dirname, 'dist/index.html')
      const code = readFileSync(filePath, 'utf-8')

      await QRCode.toFile(resolve(__dirname, 'public/index.qr.png'), code, {
        errorCorrectionLevel: 'L',
        type: 'png',
        width: 1000,
        margin: 1
      })

      const pwaScript = `<link rel="manifest" href="manifest.webmanifest"><script>if('serviceWorker'in navigator)navigator.serviceWorker.register('sw.js')</script>`

      const bootloader = `<script>
        (async () => {
          try {
            let d = await getDB();
            let k = await keys(undefined, d);
            if (k.length > 0) return;

            A.innerText = 'Booting...';

            let list = await (await fetch('links/index.json')).json();
            for (let f of [...new Set(list)]) {
              let content = await (await fetch('links/' + f)).text();
              await write(content, f, d);
            }
            
            location.reload();
          } catch (e) { console.error('Bootloader failed', e) }
        })()
      </script>`

      writeFileSync(filePath, code + bootloader.replace(/\s+/g, ' ') + pwaScript)
    }
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const baseUrl = process.env.BASE_URL || env.BASE_URL || '/'

  return {
    base: baseUrl,
    plugins: [
      VitePWA({
        strategies: 'generateSW',
        registerType: 'autoUpdate',
        injectRegister: null,
        manifest: {
          name: 'QRx',
          short_name: 'qrx',
          description: 'a recursive html file small enough to fit in a qr code',
          display: 'browser',
          theme_color: '#ffffff',
          icons: [
            { src: 'favicon.png', sizes: '192x192', type: 'image/png' },
            { src: 'favicon.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
          globIgnores: ['**/404.html'],
          cleanupOutdatedCaches: true,
          clientsClaim: true,
          skipWaiting: true
        }
      }),
      htmlMinifierPlugin(),
      qrCodePlugin()
    ],
    build: {
      minify: 'terser',
      terserOptions: { format: { comments: false } },
    }
  }
})
