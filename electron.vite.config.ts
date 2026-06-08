import { defineConfig } from "electron-vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: { index: "src/main.ts" },
        external: ["electron", /^node:/],
      },
    },
  },
  preload: {
    build: {
      rollupOptions: {
        input: { index: "src/main/preload.ts" },
        external: ["electron", /^node:/],
        output: {
          format: "cjs",
          entryFileNames: "[name].js",
        },
      },
    },
  },
  renderer: {
    root: "src/renderer",
    plugins: [svelte()],
    build: {
      rollupOptions: {
        input: "src/renderer/index.html",
      },
    },
  },
});
