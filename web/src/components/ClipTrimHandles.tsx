import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { applyHandleDelta, MIN_KEEP_MS } from "../lib/audioEdit";
import { formatDuration } from "../lib/timeline";

type Props = {
  clipIndex: number;
  durationMs: number;
  keepStartMs: number;
  keepEndMs: number;
  pxPerMs: number;
  disabled?: boolean;
  onChange: (next: { keepStartMs: number; keepEndMs: number }) => void;
  onCommit: () => void;
  onCancel: () => void;
};

const KEY_STEP_MS = 50;
const KEY_STEP_LARGE_MS = 500;
const HANDLE_W = 16;

export function ClipTrimHandles({
  clipIndex,
  durationMs,
  keepStartMs,
  keepEndMs,
  pxPerMs,
  disabled = false,
  onChange,
  onCommit,
  onCancel,
}: Props) {
  const dragRef = useRef<{
    edge: "start" | "end";
    originX: number;
    keepStartMs: number;
    keepEndMs: number;
    pointerId: number;
  } | null>(null);

  function startDrag(edge: "start" | "end", event: PointerEvent<HTMLButtonElement>) {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      edge,
      originX: event.clientX,
      keepStartMs,
      keepEndMs,
      pointerId: event.pointerId,
    };
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId || pxPerMs <= 0) return;
    event.preventDefault();
    const deltaMs = (event.clientX - drag.originX) / pxPerMs;
    onChange(
      applyHandleDelta(
        { keepStartMs: drag.keepStartMs, keepEndMs: drag.keepEndMs, durationMs },
        drag.edge,
        deltaMs,
      ),
    );
  }

  function endDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onCommit();
  }

  function cancelDrag(event: PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    onCancel();
  }

  function nudge(edge: "start" | "end", deltaMs: number) {
    onChange(
      applyHandleDelta({ keepStartMs, keepEndMs, durationMs }, edge, deltaMs),
    );
  }

  function onKeyDown(edge: "start" | "end", event: KeyboardEvent<HTMLButtonElement>) {
    const step = event.shiftKey ? KEY_STEP_LARGE_MS : KEY_STEP_MS;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      nudge(edge, step);
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      nudge(edge, -step);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onCommit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    }
  }

  const startLeft = keepStartMs * pxPerMs;
  const endLeft = Math.max(startLeft, keepEndMs * pxPerMs - HANDLE_W);

  return (
    <>
      <button
        type="button"
        className="clip-block__trim clip-block__trim--start"
        style={{ left: startLeft }}
        aria-label={`Trim start of clip ${clipIndex}. Arrow keys adjust, Enter applies, Escape cancels`}
        role="slider"
        aria-orientation="horizontal"
        aria-valuemin={0}
        aria-valuemax={Math.max(0, keepEndMs - MIN_KEEP_MS)}
        aria-valuenow={keepStartMs}
        aria-valuetext={formatDuration(keepStartMs)}
        disabled={disabled}
        onPointerDown={(e) => startDrag("start", e)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onKeyDown={(e) => onKeyDown("start", e)}
      />
      <button
        type="button"
        className="clip-block__trim clip-block__trim--end"
        style={{ left: endLeft }}
        aria-label={`Trim end of clip ${clipIndex}. Arrow keys adjust, Enter applies, Escape cancels`}
        role="slider"
        aria-orientation="horizontal"
        aria-valuemin={Math.min(durationMs, keepStartMs + MIN_KEEP_MS)}
        aria-valuemax={durationMs}
        aria-valuenow={keepEndMs}
        aria-valuetext={formatDuration(keepEndMs)}
        disabled={disabled}
        onPointerDown={(e) => startDrag("end", e)}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={cancelDrag}
        onKeyDown={(e) => onKeyDown("end", e)}
      />
    </>
  );
}
