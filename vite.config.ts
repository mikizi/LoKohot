import { resolve } from "node:path";
import { defineConfig } from "vite";

/** `./` base so GitHub Pages works for project pages without extra config. */
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: resolve(__dirname, "index.html"),
        admin: resolve(__dirname, "admin.html"),
      },
    },
  },
});
