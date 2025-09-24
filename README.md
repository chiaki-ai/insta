# insta

Simple Instagram Graph API poster.

## Repo Layout
- `veg-poster/post.mjs` — Node 18+ ESM script to create + publish media.
- `veg-poster/.env.example` — Copy to `.env` for local runs.
- `veg-poster/prompts/caption.txt` — Prompt for future LLM captioning.
- `veg-poster/inbox/` — Staging folder for local images (posting needs a public URL).
- `.github/workflows/post.yml` — GitHub Actions workflow (manual dispatch).

## Deploy (GitHub Actions)
1. Add repository secrets:
   - `IG_BUSINESS_ID` — Instagram Business Account ID
   - `IG_ACCESS_TOKEN` — Long‑lived IG access token
   - `DEFAULT_LOCATION` — Optional default location (e.g., `奈良`)
2. Trigger the workflow:
   - GitHub → Actions → `Post to Instagram` → `Run workflow`
   - Enter `image_url` (publicly accessible image URL)

The workflow runs `node veg-poster/post.mjs <image_url>` with env from secrets.

## Local Run
1. Copy `veg-poster/.env.example` to `veg-poster/.env` and fill values.
2. From repo root:

```sh
node veg-poster/post.mjs "https://your-cdn.example.com/tomato_harvest_nara.jpg"
```

Note: Instagram Graph API requires a public `image_url` (no local file paths).

## Notes
- `post.mjs` includes a minimal `.env` loader; no external deps required.
- Captions use a simple fallback; can integrate an LLM later.
- If you want scheduled posting or local-image uploads (e.g., to S3/R2) before posting, open an issue and I’ll wire it up.

