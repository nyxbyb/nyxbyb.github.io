import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

export default defineConfig({
  // GitHub 用户名站点：nyxbyb.github.io（根路径）
  base: "/",
  plugins: [svelte()],
  server: { port: 5173, open: false },
});