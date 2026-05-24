import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Wails uses a custom wails:// scheme which doesn't support CORS.
// The crossorigin attribute Vite adds to <script type="module"> causes WKWebView
// to block script loading. This plugin strips it from the built HTML.
function removeCrossorigin(): Plugin {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/ crossorigin/g, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), removeCrossorigin()],
})
