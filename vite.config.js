import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    target: "es2022", sourcemap: true, chunkSizeWarningLimit: 750,
    // Keep the large engine cacheable independently from story and gameplay updates.
    rolldownOptions: { output: { codeSplitting: { groups: [{ name: "three-vendor", test: /node_modules[\\/]three[\\/]/ }] } } },
  },
});
