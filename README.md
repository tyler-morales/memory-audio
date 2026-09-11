# Memory Space

Audio-first shared memories for friends and family. Open a private link, pick a name, and talk into a shared tape — no accounts, no conference call.

## Product terms

| Term | Meaning |
|------|---------|
| **Space** | Private room. The URL `/s/{token}` is the lock. |
| **Memory** | One card on the stack — a shared tape. |
| **Clip** | Spine audio on a Memory. Only the creator adds/reorders/appends. |
| **Reply** | Anyone’s voice on the tape (timestamp) or nested under another reply. |
| **Note** | Non-threaded voice comment below the tape. |

## Screens

1. **Stack** — vertical list of Memories + FAB to create one.
2. **Player** — discrete clip **blocks** on the tape (tap a block to play from its start), pause-to-reply, notes, creator append/reorder.

## Local development

```bash
npm install
npm run db:migrate:local
# terminal 1 — API + (after web build) assets
npm run build -w web
npm run dev -w worker
# terminal 2 — Vite with /api proxy (optional while iterating UI)
npm run dev -w web
```

- Worker: http://127.0.0.1:8787  
- Vite: http://127.0.0.1:5173 (proxies `/api` to the worker)

## Tests

```bash
npm test
```

## Deploy

Live beta uses Cloudflare’s free `workers.dev` URL (no custom domain required):

`https://memory-audio.<your-subdomain>.workers.dev`

D1 is already provisioned. First-time R2: open [R2 in the dashboard](https://dash.cloudflare.com/?to=/:account/r2/overview) and click **Enable R2** (free), then:

```bash
npx wrangler r2 bucket create memory-audio
npm run db:migrate:remote -w worker
npm run deploy
```

GitHub: `https://github.com/tyler-morales/memory-audio`. Push to `main` after connecting the Worker to the repo in **Workers → Settings → Builds** if you want auto-deploys. Until then, `npm run deploy` from a machine logged into Wrangler.

## Audio notes (MVP spike)

- Prefer `audio/mp4` on iOS Safari; `audio/webm;codecs=opus` elsewhere (`pickRecorderMime`).
- Tap to start / tap to stop (max 90s). Peaks computed while recording for waveform UI.
- Playback never auto-starts.
