import { beforeEach, describe, expect, it } from 'vitest';
import { checkDesign } from './validate';
import { useStore } from '../state/store';

const s = () => useStore.getState();
const check = () => checkDesign(s().design, s().appliances, 4);
const titles = () => check().map((i) => i.title);

beforeEach(() => {
  useStore.setState({ appliances: [] });
  s().startDesign({ kitchenType: 'outdoor', line: 'ext', shape: 'straight', lengths: [200], starter: false });
});

describe('design check', () => {
  it('has nothing to say about an empty design or a sensible starter', () => {
    expect(check()).toEqual([]);
    s().startDesign({ kitchenType: 'outdoor', line: 'ext', shape: 'straight', lengths: [168], starter: true });
    expect(check().filter((i) => i.level !== 'tip')).toEqual([]);
  });

  it('flags a grill with no counter beside it, and clears when a cabinet is added', () => {
    const wall = s().design.walls[0].id;
    s().addItem(wall, 'out-grill');
    expect(titles().some((t) => t.startsWith('No counter space beside'))).toBe(true);
    s().addItem(wall, 'base-2door');
    expect(titles().some((t) => t.startsWith('No counter space beside'))).toBe(false);
  });

  it('warns about a fridge right next to the grill and a wall cabinet above it', () => {
    const wall = s().design.walls[0].id;
    s().addItem(wall, 'out-grill');
    s().addItem(wall, 'out-fridge');
    s().addItem(wall, 'wall-2door');
    const t = titles();
    expect(t.some((x) => x.includes('right next to the'))).toBe(true);
    expect(t.some((x) => x.startsWith('Wall cabinet above'))).toBe(true);
    expect(check()[0].level).toBe('warning'); // most serious first
  });

  it('reports cabinets that no longer fit their wall, with somewhere to jump to', () => {
    const wall = s().design.walls[0].id;
    s().addItem(wall, 'base-2door');
    s().addItem(wall, 'base-2door');
    s().updateWall(wall, { length: 40 });
    const problems = check().filter((i) => i.level === 'problem');
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0].wallId).toBe(wall);
    expect(problems[0].itemId).toBeTruthy();
  });

  it('flags a blocked window and an appliance too wide for its cabinet', () => {
    const wall = s().design.walls[0].id;
    s().addItem(wall, 'base-2door');
    s().addOpening(wall, 'door');
    s().updateOpening(s().design.openings[0].id, { x: 15 });
    expect(titles().some((t) => t.includes('is blocked'))).toBe(true);

    useStore.setState({ appliances: [{ id: 'big', category: 'grill', brand: 'X', model: 'Big', name: 'Big grill', msrp: 1, cutoutW: 50 }] });
    s().addItem(wall, 'out-grill');
    const grill = s().design.items.find((i) => i.catalogId.startsWith('out-grill'))!;
    s().updateItem(grill.id, { appliance: { mode: 'inventory', applianceId: 'big', withLiner: true } });
    expect(titles().some((t) => t.includes('too narrow for its appliance'))).toBe(true);
  });
});
