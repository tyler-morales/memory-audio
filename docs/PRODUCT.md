# Product guide — Memory Space

## Why

Stay close to people when you can’t be in the same room. Capture short voice bites through the day; others listen and talk back into the tape — async, audio-first, not a call.

## Mental model

Each **Memory** is a **shared tape** with an optional **title**:

1. The creator names the Memory (editable on the player) and lays down the **spine** (ordered **Clips**). They can keep adding.
2. Anyone can **drop an emoji** at the playhead (while playing or paused) — it sits on the clip like a SoundCloud comment.
3. Anyone can **reply on the tape** (pause → reply at that moment) or leave a **Note** under it.
4. Starting a new Memory starts a new conversation.

## Access

- Create a Space → get `/s/{token}`.
- Share the link. Anyone with it can join with a **display name + color** (stored in the browser).
- No directory, no SEO. Friends-and-family threat model.
- Beta host: https://memory-audio.tyler-morales-dev.workers.dev (HTTPS, no custom domain). The Space token is still the lock.

## Flows

### Create a Memory

1. FAB on the stack → new Memory → player opens in capture mode.
2. Creator types a **title** in the player header (Enter or blur saves). Untitled memories show “{name}’s memory”.
3. Record one or more **clip blocks** (tap start / tap stop). While you record, the block grows with the take and the tape scrolls to keep the playhead in view. Each take becomes its own block — listeners tap a block to cue it, tap the bars to seek, then press Play.
4. Creator drags the **left or right edge** of a block to trim it. **Save** publishes the edited tape.
5. Others see the Memory on the stack (polling).

### Trim a clip

1. On a recorded block, drag the left edge right (drop a false start) or the right edge left (drop a trailing pause).
2. Keyboard: focus a trim handle, ←/→ to nudge, Enter to apply, Escape to cancel.
3. The block shrinks to the keep region, then the audio is rewritten (unsaved until **Save**).
4. Saving a replacement of an already-published block drops replies and emoji pinned to that block.

### Emoji on the tape

1. Join the space. Play or tap a moment on a clip’s waveform.
2. Pick an emoji from the palette — it posts at the **current playhead**, even while audio is playing.
3. Emojis sit on the block at that timestamp. Tap one to seek there; as the playhead passes, a bubble shows who left it.

Allowed reactions: ❤️ 😂 😮 😢 🔥 👏 🙌 💯 😍 👍 🎉 😭 🤔 ✨

### Reply on the tape

1. Open a Memory → Play.
2. Pause → **Reply here** → record.
3. Reply appears as a colored tick on the waveform and in “On the tape”.

### Note

**Add note** records a voice comment not pinned to a time (listed under Notes).

### Nested reply

On any top-level reply/note, **Reply** records one nested level only.

## Accessibility

- Appearance follows the system light/dark setting (`prefers-color-scheme`); native controls use `color-scheme`.
- Surfaces are sand/ink; primary actions are ink (light) or cream (dark) with amber accent and terracotta danger (WCAG AA).
- Real `<button>` / `<a>` controls; visible `:focus-visible` rings.
- Waveform seek: tap bars or keyboard ←/→ (sr-only ±1s).
- Clip trim handles are sliders on the block edges (drag or ←/→, Enter to apply, Escape to cancel).
- Emoji palette is a labelled button group; marks on the tape are buttons with author + time.
- Join dialog is `role="dialog"` with labels.
- Memory title is a labelled text field in the player header (creator) or an `<h1>` (everyone else).
- Recording is tap-to-toggle, not hold-to-record.
