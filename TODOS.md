# TODOS

## Status

| Area | Status | Notes |
|------|--------|-------|
| Audio spike (mime + record/play) | Done | `web/src/lib/recorder.ts` — mp4/webm negotiation, live peaks |
| Space + join (name/color) | Done | Unlisted token, localStorage member |
| Stack + create Memory + clips | Done | FAB, R2/D1 upload, reorder, editable title |
| Player waveform | Done | Rectangular bars, dividers, seek, scroll; live recording block grows and the tape follows the playhead |
| Clip trim | Done | Creator drags left/right edges of a block; WAV re-encode; Save publishes |
| Replies / notes / nest | Done | Timed reply, notes, one-level nest |
| Emoji replies on tape | Done | SoundCloud-style timed emoji on clip blocks |
| Polling + docs | Done | 4–5s poll, README + docs/PRODUCT.md |
| System light/dark | Done | OS `prefers-color-scheme`; sand/ink + amber (no teal chrome) |
| GitHub + Cloudflare | Done | https://memory-audio.tyler-morales-dev.workers.dev — D1 + R2 |
| Local D1 emoji_replies 500 | Done | Applied `0002_emoji_replies`; `wrangler dev` now applies pending local migrations |

## Refactor / deleted-consolidated

- Single `replies` table covers timed replies, notes, and nested replies (no separate notes table).
- Shared peak downsampling on client at record time; server stores JSON only.
- Deleted duplicate `clipAbsolute` in TapeWaveform — uses `clipPositionToAbsolute`.
- Waveform bar layout (saved vs live recording) lives in `web/src/lib/waveform.ts`; TapeWaveform renders it.
- Deleted `ClipEditSheet` — trim is inline on the block (drag left/right edges; no dialog / middle-cut).
- Clip trim is client-side (decode → slice samples → WAV). Replacing a saved block deletes the old clip on Save (pinned replies/emoji on that block go with it).
- Removed clip reorder UI (creator edits are draft → Save).
- Timed **emoji replies** live in `emoji_replies` (not the voice `replies` table) so audio uploads stay required for voice.
- Memory cards show creator name as the heading; title is now the card/player heading (untitled falls back to “{name}’s memory”).
- Title PATCH updates `title` and `updated_at` in one statement (no extra `touchMemory` round-trip).
- Hardcoded dark colors in `app.css` folded into light/dark tokens; UI follows OS `prefers-color-scheme`.
- Primary chrome dropped teal `#2a9d8f` for sand/ink (ink buttons in light, cream in dark) with amber accent.
- Local Memory 500 (`no such table: emoji_replies`) fixed by applying `0002`; worker `dev` script applies pending D1 migrations so this doesn’t recur.
- Memory title column (`0003_memory_title`); creator-only PATCH `/memories/:id`.

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
- [x] R2 bucket `memory-audio` + first `workers.dev` deploy
- [x] Apply `0003_memory_title` on remote D1 (`npm run db:migrate:remote -w worker`)
- [ ] Optional: connect GitHub → Workers Builds for push-to-deploy
