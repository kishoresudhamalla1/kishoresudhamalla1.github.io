import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

// Set ASTRO_SITE and ASTRO_BASE in the GitHub Actions repo variables.
// With a custom domain: site="https://yourdomain.com", base="/"
// Without a custom domain: site="https://youruser.github.io", base="/repo-name"
export default defineConfig({
  site: process.env.ASTRO_SITE || "https://kishoresudhamalla1.github.io",
  base: process.env.ASTRO_BASE || "/",
  output: "static",
  // Old case-study URLs (shared on LinkedIn / the résumé) now point at the
  // rewritten pages.
  redirects: {
    "/work/time-management-system": "/work/time-management",
    "/work/time-management-system-v2": "/work/time-management",
    "/work/beyond-the-task": "/work/flows-journeys-playbooks",
    "/work/workflows-journeys": "/work/flows-journeys-playbooks",
    "/redesign": "/",
    "/redesign/about": "/about",
    "/redesign/ai-lab": "/ai-lab",
    "/redesign/thinking": "/thinking",
  },
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
});
