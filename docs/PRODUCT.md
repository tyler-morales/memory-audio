# Product guide — Memory Space

## Why

Stay close to people when you can’t be in the same room. Capture short voice bites through the day; others listen and talk back into the tape — async, audio-first, not a call.

## Mental model

Each **Memory** is a **shared tape**:

1. The creator lays down the **spine** (ordered **Clips**). They can keep adding and reordering.
2. Everyone else **replies on the tape** (pause → reply at that moment) or leaves a **Note** under it.
3. Starting a new Memory starts a new conversation.

## Access

- Create a Space → get `/s/{token}`.
- Share the link. Anyone with it can join with a **display name + color** (stored in the browser).
- No directory, no SEO. Friends-and-family threat model.
- Beta host is a Cloudflare `workers.dev` URL (HTTPS, no custom domain). The Space token is still the lock.

## Flows

### Create a Memory

1. FAB on the stack → new Memory → player opens in capture mode.
2. Record one or more **clip blocks** (tap start / tap stop). Each take becomes its own block on the tape — listeners tap a block to hear it from the start.
3. Others see the Memory on the stack (polling).

### Reply on the tape

1. Open a Memory → Play.
2. Pause → **Reply here** → record.
3. Reply appears as a colored tick on the waveform and in “On the tape”.

### Note

**Add note** records a voice comment not pinned to a time (listed under Notes).

### Nested reply

On any top-level reply/note, **Reply** records one nested level only.

## Accessibility

- Real `<button>` / `<a>` controls; visible `:focus-visible` rings.
- Waveform is a keyboard slider (←/→).
- Join dialog is `role="dialog"` with labels.
- Recording is tap-to-toggle, not hold-to-record.
