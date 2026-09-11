import { useEffect, useRef } from "react";
import { committedMemoryTitle, MAX_MEMORY_TITLE_CHARS } from "../lib/memoryTitle";

type Props = {
  title: string;
  fallback: string;
  editable: boolean;
  onCommit: (title: string) => Promise<void>;
};

export function MemoryTitle({ title, fallback, editable, onCommit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const skipCommit = useRef(false);
  const titleRef = useRef(title);
  const valueRef = useRef(title);
  const onCommitRef = useRef(onCommit);
  const timerRef = useRef<number>(0);
  titleRef.current = title;
  onCommitRef.current = onCommit;

  useEffect(() => {
    if (!focused.current && inputRef.current) {
      inputRef.current.value = title;
      valueRef.current = title;
    }
  }, [title]);

  useEffect(() => {
    return () => {
      window.clearTimeout(timerRef.current);
      const next = committedMemoryTitle(valueRef.current, titleRef.current);
      if (next != null) void onCommitRef.current(next);
    };
  }, []);

  if (!editable) {
    return <h1>{title.trim() || fallback}</h1>;
  }

  async function commit(raw: string) {
    if (skipCommit.current) {
      skipCommit.current = false;
      return;
    }
    const next = committedMemoryTitle(raw, titleRef.current);
    if (next == null) return;
    await onCommitRef.current(next);
  }

  function queueCommit(raw: string) {
    valueRef.current = raw;
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      void commit(raw);
    }, 400);
  }

  return (
    <h1 className="memory-title">
      <input
        ref={inputRef}
        className="memory-title-input"
        aria-label="Memory title"
        defaultValue={title}
        placeholder={fallback}
        maxLength={MAX_MEMORY_TITLE_CHARS}
        onFocus={() => {
          focused.current = true;
        }}
        onInput={(e) => queueCommit(e.currentTarget.value)}
        onBlur={(e) => {
          focused.current = false;
          window.clearTimeout(timerRef.current);
          valueRef.current = e.currentTarget.value;
          void commit(e.currentTarget.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            skipCommit.current = true;
            window.clearTimeout(timerRef.current);
            e.currentTarget.value = titleRef.current;
            valueRef.current = titleRef.current;
            e.currentTarget.blur();
          }
        }}
      />
    </h1>
  );
}
