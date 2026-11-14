# SEO and Performance Audit

## Present implementation

`index.html` contains the production title, description, canonical URL, robots
directive, Open Graph metadata, Twitter metadata, Organization/WebSite JSON-LD,
and a sitemap/robots pair exists under `public/`.

## Corrections still required before SEO sign-off

- Replace the Vite favicon and placeholder JSON-LD logo with a real Aashvo brand
  asset.
- Use the confirmed production domain consistently once a custom domain is
  activated.
- Add crawlable public listing/city routes only when backed by real records.
- Keep dashboards, authentication, and personal pages out of search indexes.
- Measure Lighthouse/Core Web Vitals on the deployed revision.

## Current build signal

The current production build passes. The main JavaScript bundle is approximately
453 kB uncompressed and 114 kB gzip. Route-level splitting and image delivery
should be measured and prioritized after the live backend is enabled.

No Lighthouse or Search Console result is claimed because those tools and live
credentials were not available in this workspace.
