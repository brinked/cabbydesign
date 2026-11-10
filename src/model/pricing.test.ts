import { describe, expect, it } from 'vitest';
import { evalFormula, tryFormula } from './pricing';

const vars = { W: 30, D: 24, H: 34.5 };

describe('price formulas', () => {
  it('evaluates the standard box formula', () => {
    expect(evalFormula('W*D + 500', vars)).toBe(1220);
  });

  it('respects precedence and parentheses', () => {
    expect(evalFormula('2 + 3 * 4', vars)).toBe(14);
    expect(evalFormula('(2 + 3) * 4', vars)).toBe(20);
    expect(evalFormula('((W*D)+900)*(H/34.5)', vars)).toBe(1620);
  });

  it('reports a bad formula instead of throwing', () => {
    const r = tryFormula('W * * D', vars);
    expect(r.error).toBeTruthy();
    expect(tryFormula('W*D + 500', vars)).toEqual({ price: 1220 });
  });

  it('rejects anything that is not arithmetic on W, D, H', () => {
    expect(tryFormula('alert(1)', vars).error).toBeTruthy();
    expect(tryFormula('X + 1', vars).error).toBeTruthy();
  });
});
