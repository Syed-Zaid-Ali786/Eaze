import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    outDir: "dist",
  },
  server: {
    fs: {
      // The playground imports the canonical engine alongside this app.
      allow: [fileURLToPath(new URL('.', import.meta.url)), fileURLToPath(new URL('../engine', import.meta.url))],
    },
    // Don't watch packaging output: electron-builder drops ~270 MB of binaries
    // in there, and holding handles on them breaks its final directory rename.
    watch: {
      ignored: ["**/release/**", "**/node_modules/**", "**/.git/**"],
    },
  },
})
