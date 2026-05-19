# Shared Assets

Runtime assets shared across the cultuvilla workspace (logos, icons, imagery).

## Layout

- `icons/` — SVG icons and logo marks
- `images/` — raster imagery (photos, illustrations)
- `web/` — web-specific assets (og:image, social previews)

## Usage

Master copies of every asset live here. Web-served static files (favicon, public images Next.js needs to ship as-is) should be copied or symlinked into [`apps/web/public/`](../../../apps/web/public/) — that's the directory Next.js exposes at the site root.

When adding a new asset, prefer SVG for marks/icons and WebP/PNG for raster imagery. Keep filenames lowercase-kebab-case.
