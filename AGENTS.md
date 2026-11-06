# Repository Guidelines

## Structure
- `site/` is the complete static website published by GitHub Pages. Its entry point is `site/index.html`.
- `site/scripts/app.js` controls the genealogy editor; `timeline.js` and `chronology-tree.js` implement the time views. The external family-chart library is loaded from a CDN, not built in this repository.
- `site/styles/`, `site/includes/` and `site/assets/images/` contain the active presentation resources. Keep browser URLs relative so the site works under `preview-site/` too.
- `site/data/principal.json` and `site/data/racine.json` are independent editable datasets. Do not merge them just because their contents match.
- `backend/` is the separate Express service that commits edits to GitHub. Shared source configuration lives in `backend/data-sources.js`.
- `scripts/serve.js` serves only `site/` and saves edits locally. `scripts/check-site.js` verifies the deployment resources. `scripts/import-carto.py` is a manual import tool.
- `docs/sources/`, `docs/rapports/` and `docs/maquettes/` hold genealogical documents, reports and historical interface drafts. They are not deployed.
- `tests/` contains Node.js tests for deployment resources and save routing.

## Commands and Verification
- Use Node.js 20 or newer; CI uses Node.js 22. Install with `npm ci`.
- `npm run edit` opens the local editor on port 3000, with local persistence; use `PORT` to change the port.
- `npm run backend` starts the GitHub persistence API, loading `backend/.env`.
- `npm run check` verifies local resources, source paths, JSON and relationship references.
- `npm test` runs Node.js tests, including writes only to temporary datasets.
- There is no Rollup build or Cypress example suite. Do not recreate the old library structure.

## Deployment
- `.github/workflows/deploy.yml` publishes `site/` on pushes to `master`, preserving the existing preview directory.
- `.github/workflows/deploy-dev.yml` publishes `site/` into `preview-site/` on pushes to `dev`, replacing old preview files.
- Both workflows validate the site and share a concurrency group because they write to `gh-pages`.
- The Render backend is deployed separately. Keep frontend source ids, backend configuration and repository file paths aligned.

## Coding and Data
- Use JavaScript modules in the browser and CommonJS for Node.js tools, with 2-space indentation and the surrounding semicolon style.
- Preserve dataset contents when moving files; change internal resource paths only as needed. Back up data outside the repository before bulk transformations.
- Keep credentials in local environment files or hosting configuration. `GITHUB_TOKEN` needs `contents:write` on the intended repository.
- Use concise imperative commit messages. Describe affected dataset paths and validation in PRs.

## Map Rendering
- The person panel uses MapLibre and Carto Positron. Keep the canvas in the DOM, give it an explicit size, and resize after mounting.
- If a map is blank, check asset loading and CSP restrictions for Carto tiles, sprites and glyphs.
