# Custom domain setup — kishoresudhamalla.com

This is a prep document only. Nothing here has been applied yet: no DNS
changes, no repo settings changes, no `astro.config.mjs` changes. The résumé
link to `kishoresudhamalla.com` stays as-is and does not need to change for
any of this.

## Current state

- **DNS**: Cloudflare nameservers. The apex (`kishoresudhamalla.com`) and
  `www` are both proxied through Cloudflare and currently serve a GoDaddy
  website builder template.
- **Email**: Zoho Mail MX records and SPF record on this domain. These must
  be kept throughout the migration or email stops working.
- **Site**: this repo deploys to GitHub Pages at
  `kishoresudhamalla1.github.io` via `.github/workflows/deploy.yml`.

## Target GitHub Pages DNS records

- **A records** (apex domain, DNS-only — not proxied):
  - `185.199.108.153`
  - `185.199.109.153`
  - `185.199.110.153`
  - `185.199.111.153`
- **AAAA records** (apex domain, DNS-only — not proxied):
  - `2606:50c0:8000::153`
  - `2606:50c0:8001::153`
  - `2606:50c0:8002::153`
  - `2606:50c0:8003::153`
- **CNAME record** (`www`, DNS-only — not proxied):
  - `www` → `kishoresudhamalla1.github.io`

## Steps, in order

1. **Verify the domain with GitHub.** In GitHub account settings → Pages →
   add a custom domain verification, and add the TXT record GitHub gives you
   to Cloudflare DNS. Do this before touching the A/AAAA/CNAME records.
2. **Change DNS in Cloudflare.** Replace the existing apex and `www` records
   with the A/AAAA/CNAME records above. Set them to **DNS-only** (grey
   cloud, not proxied) at first, so GitHub can issue the TLS certificate
   directly. Leave the Zoho MX and SPF records untouched.
3. **Remove the GoDaddy site.** Once DNS points at GitHub Pages, decommission
   the GoDaddy website builder site so it stops being served from this
   domain.
4. **Only then set the custom domain in this repo.** Go to Settings → Pages,
   enter `kishoresudhamalla.com`, save, and once GitHub confirms the domain
   is verified and the certificate is issued, enable "Enforce HTTPS."
5. **Verify.** Confirm `https://kishoresudhamalla.com` and
   `https://www.kishoresudhamalla.com` both load the site over HTTPS, and
   confirm email (Zoho) still sends and receives normally.
6. **Only then set `ASTRO_SITE`.** In this repo's Settings → Secrets and
   variables → Actions → Variables, set `ASTRO_SITE` to
   `https://kishoresudhamalla.com`. Leave `ASTRO_BASE` unset (root `/` is
   correct for a custom domain). This is the last step — setting it earlier
   would point sitemap/canonical URLs at the custom domain before it's
   actually live.

## Not done by this document

- No DNS record has been changed.
- No GitHub repo setting has been changed.
- `astro.config.mjs` has not been changed (it still reads `ASTRO_SITE` from
  the environment, defaulting to the `.github.io` URL, which is correct
  until step 6 above).
