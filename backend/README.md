# Genealogie backend

This lightweight Express server exposes a `/api/family-data` endpoint that accepts the edited dataset and commits it back to the GitHub repository. The server uses the GitHub REST API via [`@octokit/rest`](https://github.com/octokit/rest.js) and can be deployed to any Node-friendly host (Render, Railway, Fly.io, etc.).

## Configuration

Copy `.env.example` to `.env` and fill in the values:

| Variable | Description |
| --- | --- |
| `GITHUB_TOKEN` | Fine-grained PAT with `contents:write` permission on the repo. |
| `GITHUB_OWNER` / `GITHUB_REPO` | Target repository coordinates. |
| `GITHUB_BRANCH` | Branch to update (defaults to `dev`). |
| `TARGET_DATA_FILES` | Comma-separated file paths to update with the new dataset. |
| `API_AUTH_TOKEN` | (Optional) Shared secret required in `x-api-key` header. |
| `CORS_ALLOW_ORIGIN` | Origins allowed to call the API (defaults to `*`). |

## Running locally

```bash
npm install
npm run backend
```

The server listens on `http://localhost:8788` by default. When testing locally, update `window.GENEA_API_CONFIG.baseUrl` in `index.html` (or via devtools) to `http://localhost:8788` so the frontend sends requests to the local backend.

## Deploying

Deploy `backend/server.js` to your hosting provider and set the same environment variables there. Point `window.GENEA_API_CONFIG.baseUrl` to the deployed URL and, if you enabled `API_AUTH_TOKEN`, also set `window.GENEA_API_CONFIG.apiKey` so the frontend can authenticate requests.
