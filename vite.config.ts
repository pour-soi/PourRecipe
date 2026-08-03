import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "PourRecipe", short_name: "PourRecipe",
        description: "离线可用的个人食谱记录与制作日志",
        lang: "zh-CN",
        theme_color: "#176D5E", background_color: "#F1F5F2",
        display: "standalone", start_url: "/", scope: "/",
        icons: [
          {src:"/pwa-192.png",sizes:"192x192",type:"image/png"},
          {src:"/pwa-512.png",sizes:"512x512",type:"image/png"},
          {src:"/pwa-maskable-512.png",sizes:"512x512",type:"image/png",purpose:"maskable"}
        ]
      },
      workbox: {
        cleanupOutdatedCaches: true, clientsClaim: true, skipWaiting: true,
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,png,svg,webmanifest}"],
        runtimeCaching: [{
          urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@tesseract\.js-data\//,
          handler: "CacheFirst",
          options: {cacheName:"pourrecipe-ocr-language-data",expiration:{maxEntries:6,maxAgeSeconds:31536000}}
        }]
      }
    })
  ]
});
