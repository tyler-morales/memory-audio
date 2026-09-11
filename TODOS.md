# TODOS

## Status

| Area | Status | Notes |
|------|--------|-------|
| Audio spike (mime + record/play) | Done | `web/src/lib/recorder.ts` — mp4/webm negotiation, live peaks |
| Space + join (name/color) | Done | Unlisted token, localStorage member |
| Stack + create Memory + clips | Done | FAB, R2/D1 upload, reorder |
| Player waveform | Done | Rectangular bars, dividers, seek, scroll |
| Replies / notes / nest | Done | Timed reply, notes, one-level nest |
| Polling + docs | Done | 4–5s poll, README + docs/PRODUCT.md |
| GitHub + Cloudflare | In progress | Repo + D1 live; R2 enable + first `workers.dev` deploy remaining |

## Refactor / deleted-consolidated

- Single `replies` table covers timed replies, notes, and nested replies (no separate notes table).
- Shared peak downsampling on client at record time; server stores JSON only.
- Deleted duplicate `clipAbsolute` in TapeWaveform — uses `clipPositionToAbsolute`.
- Waveform is discrete **clip blocks** (not one merged bar); tap a block to play from its start.

## Review follow-ups (from code review)

- [x] 20 MB upload cap on clips/replies
- [x] Atomic clip reorder via `D1.batch`
- [x] Reset tape `clipIndex` when clip set changes
- [x] RecordButton double-stop guard
- [ ] Signed member tokens (X-Member-Id is forgeable within a space)
- [ ] N+1 on memory list at larger scale
- [ ] UNIQUE(memory_id, position) on clips

## Later

- [ ] PWA service worker / add-to-home-screen
- [ ] Optional Space passcode
- [ ] Push when someone replies
- [ ] Transcription
- [ ] Delete own audio
- [ ] Flutter native shell if browser capture limits hurt
- [x] GitHub repo (`tyler-morales/memory-audio`)
- [x] Cloudflare D1 `memory-audio` (`bb74a41e-5e89-4a8c-99d6-818d191e3347`)
- [ ] Enable R2 in dashboard (one-time) + create `memory-audio` bucket
- [ ] First `workers.dev` deploy (`npm run deploy`)
- [ ] Optional: connect GitHub → Workers Builds for push-to-deploy
