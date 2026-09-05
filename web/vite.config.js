import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // GitHub Pages 发布到 /caelum/ 子路径
  base: "/caelum/",
  plugins: [svelte()],
  server: { port: 5173, open: false },
});