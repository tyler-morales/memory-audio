import { TAPE_EMOJIS } from "../lib/emoji";

type Props = {
  timeLabel: string;
  disabled?: boolean;
  busy?: boolean;
  onPick: (emoji: string) => void;
};

export function EmojiPicker({ timeLabel, disabled, busy, onPick }: Props) {
  return (
    <div className="emoji-picker">
      <p className="emoji-picker__label" id="emoji-picker-label">
        React at {timeLabel}
      </p>
      <div
        className="emoji-picker__row"
        role="group"
        aria-labelledby="emoji-picker-label"
        aria-disabled={disabled || busy}
      >
        {TAPE_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="emoji-picker__btn"
            aria-label={`Drop ${emoji} at ${timeLabel}`}
            disabled={disabled || busy}
            onClick={() => onPick(emoji)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <p className="emoji-picker__hint">
        Tap the waveform to pick a moment, then drop an emoji — works while playing.
      </p>
    </div>
  );
}

export function EmojiPopup({
  emoji,
  name,
  timeLabel,
}: {
  emoji: string;
  name: string;
  timeLabel: string;
}) {
  return (
    <div className="emoji-popup" role="status" aria-live="polite">
      <span className="emoji-popup__mark" aria-hidden>
        {emoji}
      </span>
      <span>
        <strong>{name}</strong>
        {timeLabel ? ` · ${timeLabel}` : ""}
      </span>
    </div>
  );
}
