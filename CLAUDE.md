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
  components/       ← Nav, Footer, CaseHero, DecisionBlock, ContentNeeded,
                      ConfidentialityNotice, SignalChain, Experience, …
  layouts/
    Base.astro      ← wraps every page
  lib/
    cursorGrid.ts   ← hero cursor-reactive grid
  pages/
    index.astro     ← homepage (hero, how I work, selected work, AI Lab, …)
    about.astro, ai-lab.astro, thinking.astro, resume.astro
    ai-lab/patterns.astro ← mounts src/ai-labs (client:only="react")
    work/
      time-management.astro
      flows-journeys-playbooks.astro
      chatbot-to-agentic.astro   ← stub, content needed
      design-ops.astro           ← linked from the AI Lab
  ai-labs/          ← 12 simulated agent-UX demos (React); shared harness in _shared/, shell index.tsx, registry.ts
  styles/
    global.css      ← Tailwind v4 @import + @theme + @variant dark
```
Old case-study URLs redirect to the new pages (see `redirects` in astro.config.mjs).

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

## Motion
- Tokens live in `src/styles/global.css` (`--dur-*`, `--ease-*`, `--dist-*`) and are mirrored in `src/lib/motion.ts`. Use them; don't add one-off durations.
- Scroll entrance: put `data-reveal` on a **section or group**, never on each paragraph. Hero uses `.enter` with `--tier` instead.
- Animate `transform` and `opacity`. The one deliberate exception is the work-card `flex-grow` (its content is faded around the move so text never visibly re-wraps).
- Every loop, video or canvas must pause off-screen (`watchVisibility`) and respect `prefers-reduced-motion`.
- Conditional state on a shared child selector goes through custom properties, one concrete rule per element (Lightning CSS merge bug; see `pages/index.astro`).
