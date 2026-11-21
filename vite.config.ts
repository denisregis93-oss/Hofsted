import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// base "./" permite hospedar em qualquer subpasta (GitHub Pages, Netlify, Vercel…).
// "npm run build:html" gera um único arquivo HTML com JS e CSS embutidos (pasta dist-html/).
export default defineConfig(({ mode }) =>
  mode === "html"
    ? { plugins: [react(), viteSingleFile()], base: "./", build: { outDir: "dist-html" } }
    : { plugins: [react()], base: "./" },
);
