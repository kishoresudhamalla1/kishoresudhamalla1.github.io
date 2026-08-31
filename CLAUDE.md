# Portfolio — Kishore Kumar Sudhamalla

## Stack
- **Astro v5** (static output) + **@astrojs/react** for animated components
- **Tailwind CSS v4** via `@tailwindcss/vite` — CSS-based config in `src/styles/global.css`, no `tailwind.config.js`
- **Framer Motion** in React components (`.tsx`), hydrated with `client:load` or `client:visible`
- Deployed to **GitHub Pages** via GitHub Actions (`.github/workflows/deploy.yml`)

## Design system
- Palette: off-white `#f5f5f0` light bg, `#111110` dark bg
- Typography: Inter (Google Fonts) — display weight for headlines, regular for body
- Style: editorial, minimal, generous whitespace
- No skill bars, icon grids, "hire me" language, carousels, or 8-project grids

## File map
```
src/
  components/       ← Astro (.astro) and React (.tsx) components
  layouts/
    Base.astro      ← wraps every page
    CaseStudy.astro ← wraps case study pages
  pages/
    index.astro     ← homepage: Hero → Cases → How I Lead → Testimonials → About → Contact
    work/
      workflows-journeys.astro
      ai-native-agentic-experience.astro
      time-management-system.astro
  styles/
    global.css      ← Tailwind v4 @import + @theme + @variant dark
  env.d.ts
public/
  images/work/      ← drop real screenshots here (replace SVG placeholders)
```

## Adding real content
All `🔴 PLACEHOLDER` sections are marked inline. Typical replacements:
- **Testimonial quotes**: edit `src/components/Testimonials.astro`
- **About lists**: edit `src/components/About.astro`
- **Case study details**: each `src/pages/work/*.astro` file has inline `TODO:` comments
- **Screenshots**: place `.png` or `.jpg` files in `public/images/work/` and update `src` attributes

## Custom domain
1. Create `public/CNAME` containing just your domain (e.g. `kishoresudhamalla.design`)
2. Point DNS at GitHub Pages IPs (see `public/CNAME.example`)
3. Remove the `ASTRO_BASE` repo variable (default `/` is correct for a custom domain)

## Node requirement
Node 20+. Run `npm install && npm run dev` once Node is available.
