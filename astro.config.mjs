import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Set ASTRO_SITE and ASTRO_BASE in the GitHub Actions repo variables.
// With a custom domain: site="https://yourdomain.com", base="/"
// Without a custom domain: site="https://youruser.github.io", base="/repo-name"
export default defineConfig({
  site: process.env.ASTRO_SITE || "https://kishoresudhamalla.github.io",
  base: process.env.ASTRO_BASE || "/",
  output: "static",
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
