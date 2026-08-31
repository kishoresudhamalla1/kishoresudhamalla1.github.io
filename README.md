# Kishore Kumar Sudhamalla — Portfolio

Astro v5 · Tailwind CSS v4 · Framer Motion · GitHub Pages

## Getting started

Requires **Node.js 20+**.

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # builds to dist/
npm run preview  # serve the production build locally
```

## Adding your real content

Search for `🔴` across the project — every placeholder is marked with that prefix. The main ones:

| Location | What to replace |
|---|---|
| `src/components/Testimonials.astro` | 3 real quotes with names and context |
| `src/components/About.astro` | "What I'm chasing" and "What frustrates me" lists |
| `src/pages/work/*.astro` | Case study decisions, metrics, team details |
| `public/images/work/*.svg` | Real screenshots (PNG/JPG, 1200×675 or 16:9) |
| `src/components/Footer.astro` | LinkedIn URL if different |

## Deploying to GitHub Pages

One manual step (can't be automated): go to your repo **Settings → Pages** and set **Source: GitHub Actions**.

After that, every push to `main` triggers the deploy workflow automatically.

### Without a custom domain
Set two repository variables (**Settings → Secrets and variables → Actions → Variables**):
- `ASTRO_SITE` = `https://yourusername.github.io`
- `ASTRO_BASE` = `/your-repo-name`

### With a custom domain (~$10–15/yr from any registrar)
See `public/CNAME.example`. Leave the two repo variables unset.

## Design decisions

- **Tailwind v4** uses CSS-based config — all tokens are in `src/styles/global.css` inside `@theme {}`. There is no `tailwind.config.js`.
- **Dark mode** is class-based (`.dark` on `<html>`), toggled by `DarkModeToggle.tsx`, persisted to `localStorage`.
- **Framer Motion** is used only in React components (`HeroSection.tsx`, `CaseStudyCards.tsx`, `ScrollReveal.tsx`) hydrated with `client:load` or `client:visible`. Everything else is static Astro.
- **Device mockups** are CSS browser chrome frames with a `<slot>` for the screenshot image. SVG placeholders ship by default.

## Page structure

```
/                          → Homepage (Hero, Cases, How I Lead, Testimonials, About, Contact)
/work/workflows-journeys   → Case study 1 (AI, listed first)
/work/ai-native-agentic-experience → Case study 2
/work/time-management-system       → Case study 3
```
