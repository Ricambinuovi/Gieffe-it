import { defineConfig } from "vite"
import { svelte } from "@sveltejs/vite-plugin-svelte"

// Tauri si aspetta una porta fissa in sviluppo
export default defineConfig({
  plugins: [svelte()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: "127.0.0.1" },
  build: { target: "es2022", outDir: "dist", emptyOutDir: true },
  test: { environment: "node", include: ["src/**/*.test.ts"] },
})
