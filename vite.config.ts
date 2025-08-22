import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Menu Planner',
        short_name: 'Planner',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml'
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/data\/menu\.json$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'menu-data'
            }
          }
        ]
      }
    })
  ],
  test: {
    environment: 'jsdom'
  }
});
