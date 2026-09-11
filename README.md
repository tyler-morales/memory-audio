# Memory Space

Audio-first shared memories for friends and family. Open a private link, pick a name, and talk into a shared tape — no accounts, no conference call.

## Product terms

| Term | Meaning |
|------|---------|
| **Space** | Private room. The URL `/s/{token}` is the lock. |
| **Memory** | One card on the stack — a shared tape with an editable title. |
| **Clip** | Spine audio on a Memory. Only the creator adds/reorders/appends. |
| **Reply** | Anyone’s voice on the tape (timestamp) or nested under another reply. |
| **Note** | Non-threaded voice comment below the tape. |
| **Emoji reply** | A reaction dropped at a moment on a clip block (SoundCloud-style). |

## Screens

1. **Stack** — vertical list of Memories (title + creator) + FAB to create one.
2. **Player** — discrete clip **blocks** on the tape (tap a block to cue its start; tap the waveform to seek; Play starts audio). While recording, the new block grows and the tape follows the playhead. Creator names the Memory in the header, drags a block’s left or right edge to trim, then **Save**. Emoji reactions, pause-to-reply, notes, append.

## Local development

```bash
npm install
npm run db:migrate:local   # required once (and again if local D1 is wiped)
# terminal 1 — API + SPA assets
npm run build -w web
npm run dev -w worker
# terminal 2 — Vite with /api proxy (optional while iterating UI)
npm run dev -w web
```

`npm run dev -w worker` applies pending local D1 migrations on startup.

If you see **Internal Server Error** / `no such table: spaces` or `emoji_replies`, run `npm run db:migrate:local` and reload. After a local DB reset, create a **new** space from `/` (old `/s/...` links won’t survive).

- Worker: http://127.0.0.1:8787  
- Vite: http://127.0.0.1:5173 (proxies `/api` to the worker)

## Tests

```bash
npm test
```

## Deploy

Live beta (no custom domain): **https://memory-audio.tyler-morales-dev.workers.dev**

GitHub: [tyler-morales/memory-audio](https://github.com/tyler-morales/memory-audio)

```bash
npm run db:migrate:remote -w worker   # only when migrations change
npm run deploy
```

Optional: in the Cloudflare dashboard, Worker → **Settings → Builds**, connect this GitHub repo for push-to-deploy. Until then, deploy from a machine logged into Wrangler.

## Audio notes (MVP spike)

- Prefer `audio/mp4` on iOS Safari; `audio/webm;codecs=opus` elsewhere (`pickRecorderMime`).
- Tap to start / tap to stop (max 90s). Peaks computed while recording for waveform UI.
- Creator can trim/cut a clip in the browser (re-encoded as WAV) before Save.
- Playback never auto-starts.

## Appearance

The UI follows the device **light** or **dark** appearance (`prefers-color-scheme`). There is no in-app theme toggle.

Chrome uses a **sand + ink** palette (warm paper / charcoal) with amber accents and terracotta danger — not teal. Primary actions are ink on light and cream on dark.
