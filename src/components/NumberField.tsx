import { useEffect, useState } from 'react';

/** Evaluate "+ - * / ( )" arithmetic. Returns null for anything it can't parse. */
function evalArith(src: string): number | null {
  const s = src.replace(/\s+/g, '');
  let i = 0;
  const factor = (): number | null => {
    if (s[i] === '(') {
      i++;
      const v = expr();
      if (s[i] !== ')') return null;
      i++;
      return v;
    }
    if (s[i] === '-') {
      i++;
      const v = factor();
      return v == null ? null : -v;
    }
    if (s[i] === '+') {
      i++;
      return factor();
    }
    const m = /^\d*\.?\d+/.exec(s.slice(i));
    if (!m) return null;
    i += m[0].length;
    return parseFloat(m[0]);
  };
  const term = (): number | null => {
    let v = factor();
    while (v != null && (s[i] === '*' || s[i] === '/')) {
      const op = s[i++];
      const r = factor();
      if (r == null) return null;
      v = op === '*' ? v * r : r === 0 ? null : v / r;
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v != null && (s[i] === '+' || s[i] === '-')) {
      const op = s[i++];
      const r = term();
      if (r == null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  const v = expr();
  return v != null && i === s.length && Number.isFinite(v) ? v : null;
}

/**
 * Evaluate what was typed into a number field: a plain number, an expression
 * ("110-20", "(36+3)/2"), or — when it STARTS with an operator — a change to
 * the current value ("-20" takes 20 off, "+6" adds, "*2" / "x2" doubles,
 * "/2" halves). A leading minus on a field that allows negatives is just a
 * negative number. Returns null when it doesn't parse.
 */
export function evalEntry(text: string, current: number, min: number): number | null {
  let t = text.trim().replace(/[x×]/gi, '*').replace(/÷/g, '/');
  if (!t) return null;
  const relative = /^[+\-*/]/.test(t) && !(t.startsWith('-') && min < 0);
  if (relative) t = `${current}${t}`;
  return evalArith(t);
}

/**
 * A number input that lets you type freely and only validates on blur/Enter.
 * Clamping on every keystroke (the naive approach) corrupts mid-typing values:
 * typing "66" into a min-12 field clamps the first "6" to "12", then appends
 * the next "6" → "126". Buffering the text and committing once avoids that.
 * Entries can do math (see evalEntry): "-20" + Enter takes 20 off a 110" wall.
 */
export function NumberField({
  value,
  min,
  max,
  round,
  disabled,
  className,
  title,
  onCommit,
}: {
  value: number;
  min: number;
  max: number;
  /** Kept for callers; a text field has no spinner step. */
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
    const v = evalEntry(text, value, min);
    if (v == null) {
      setText(String(value));
      return;
    }
    let r = Math.min(max, Math.max(min, v));
    if (round) r = Math.round(r / round) * round;
    r = Math.round(r * 100) / 100;
    setText(String(r));
    if (r !== value) onCommit(r);
  };

  // Apply as the user types (no Enter needed) once the value is a complete,
  // in-range PLAIN number — partial entries like "1" of "12" don't fire early,
  // and an expression or "-20"-style change waits for Enter / blur.
  const live = (t: string) => {
    if (!/^\s*-?\d*\.?\d+\s*$/.test(t)) return;
    const v = parseFloat(t);
    if (!Number.isFinite(v) || v < min || v > max) return;
    let r = round ? Math.round(v / round) * round : v;
    r = Math.round(r * 100) / 100;
    if (r !== value) onCommit(r);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      title={title ? `${title} — type math like -20 or 110-20` : 'Type a number, or math like -20, +6, *2 or 110-20, then Enter'}
      disabled={disabled}
      value={text}
      onFocus={() => setEditing(true)}
      onChange={(e) => {
        setText(e.target.value);
        live(e.target.value);
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
    />
  );
}
