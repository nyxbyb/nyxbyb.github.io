import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

export default defineConfig({
  // The app lives at /web/; the artifact root keeps a compatible redirect.
  base: "/web/",
  plugins: [svelte()],
  build: {
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        room: fileURLToPath(new URL("./room.html", import.meta.url)),
      },
    },
  },
  server: { port: 5173, open: false },
});
