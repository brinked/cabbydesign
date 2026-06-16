import { useEffect, useState } from 'react';

/**
 * A number input that lets you type freely and only validates on blur/Enter.
 * Clamping on every keystroke (the naive approach) corrupts mid-typing values:
 * typing "66" into a min-12 field clamps the first "6" to "12", then appends
 * the next "6" → "126". Buffering the text and committing once avoids that.
 */
export function NumberField({
  value,
  min,
  max,
  step,
  round,
  disabled,
  className,
  title,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  step?: number;
  /** Snap the committed value to this increment (e.g. 0.25). */
  round?: number;
  disabled?: boolean;
  className?: string;
  title?: string;
  onCommit: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  // Reflect external changes only while the user isn't typing.
  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const v = parseFloat(text);
    if (Number.isNaN(v)) {
      setText(String(value));
      return;
    }
    let r = Math.min(max, Math.max(min, v));
    if (round) r = Math.round(r / round) * round;
    r = Math.round(r * 100) / 100;
    setText(String(r));
    if (r !== value) onCommit(r);
  };

  return (
    <input
      type="number"
      className={className}
      title={title}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
