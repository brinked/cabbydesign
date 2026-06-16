// Tiny safe arithmetic-expression evaluator for pricing formulas.
// Supports: numbers, + - * / ( ), and the variables W, D, H (inches).
// Example: "150 + 9.5*W + 2*D"

export interface FormulaVars {
  W: number;
  D: number;
  H: number;
}

type Token = { kind: 'num'; value: number } | { kind: 'var'; name: keyof FormulaVars } | { kind: 'op'; op: string };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      const value = Number(src.slice(i, j));
      if (Number.isNaN(value)) throw new Error(`Bad number near "${src.slice(i, j)}"`);
      tokens.push({ kind: 'num', value });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      let j = i;
      while (j < src.length && /[a-zA-Z]/.test(src[j])) j++;
      const name = src.slice(i, j).toUpperCase();
      if (name !== 'W' && name !== 'D' && name !== 'H') throw new Error(`Unknown variable "${name}" (use W, D, H)`);
      tokens.push({ kind: 'var', name: name as keyof FormulaVars });
      i = j;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push({ kind: 'op', op: ch });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${ch}"`);
  }
  return tokens;
}

export function evalFormula(src: string, vars: FormulaVars): number {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const isOp = (op: string) => {
    const t = peek();
    return t !== undefined && t.kind === 'op' && t.op === op;
  };

  function parseExpr(): number {
    let v = parseTerm();
    while (isOp('+') || isOp('-')) {
      const op = (tokens[pos++] as { op: string }).op;
      const rhs = parseTerm();
      v = op === '+' ? v + rhs : v - rhs;
    }
    return v;
  }

  function parseTerm(): number {
    let v = parseFactor();
    while (isOp('*') || isOp('/')) {
      const op = (tokens[pos++] as { op: string }).op;
      const rhs = parseFactor();
      v = op === '*' ? v * rhs : v / rhs;
    }
    return v;
  }

  function parseFactor(): number {
    if (isOp('-')) {
      pos++;
      return -parseFactor();
    }
    if (isOp('(')) {
      pos++;
      const v = parseExpr();
      if (!isOp(')')) throw new Error('Missing ")"');
      pos++;
      return v;
    }
    const t = tokens[pos++];
    if (!t) throw new Error('Unexpected end of formula');
    if (t.kind === 'num') return t.value;
    if (t.kind === 'var') return vars[t.name];
    throw new Error(`Unexpected "${(t as { op: string }).op}"`);
  }

  if (tokens.length === 0) return 0;
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('Unexpected trailing input');
  if (!Number.isFinite(result)) throw new Error('Formula did not produce a number');
  return result;
}

export function tryFormula(src: string, vars: FormulaVars): { price: number; error?: string } {
  try {
    return { price: Math.round(evalFormula(src, vars) * 100) / 100 };
  } catch (e) {
    return { price: 0, error: e instanceof Error ? e.message : String(e) };
  }
}

export function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}
