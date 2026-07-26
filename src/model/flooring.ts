// Patio surfaces the kitchen can sit on. The pad under the design used to be a
// flat poured-concrete colour; these are the selectable finishes for it.
//
// Each entry names a scanned PBR set in /textures (`<tex>-color.jpg` and
// `<tex>-normal.jpg`) plus the real-world size of one texture tile, so the
// pattern lands at true scale. `base` is the flat colour used until the scan
// loads — and if it never does, the pad still reads correctly.
import type { FlooringKind } from './types';

export interface FlooringOption {
  id: FlooringKind;
  name: string;
  desc: string;
  /** Flat fallback colour. */
  base: string;
  /** Scanned texture set basename in /textures (omitted = colour only). */
  tex?: string;
  /** Real-world size of one texture tile, inches. */
  texScale?: number;
  /** Surface roughness — pavers are honed, concrete is matte. */
  roughness: number;
}

export const FLOORING: FlooringOption[] = [
  { id: 'concrete', name: 'Poured Concrete', desc: 'broom-finish slab', base: '#d8d6cf', roughness: 0.95 },
  {
    id: 'marble-pavers',
    name: 'Marble Pavers',
    desc: 'tumbled Ice White, running bond',
    base: '#e8e6df',
    tex: 'marble-pavers',
    // The scan holds ~16 courses of running-bond pavers per tile, so the tile
    // has to span ~16 courses of real stone: 192" gives roughly 12"-high
    // pavers. (At 48" they came out 3" and read as a blurry wash.)
    texScale: 192,
    roughness: 0.55,
  },
];

export const DEFAULT_FLOORING: FlooringKind = 'concrete';

export function flooringById(id: FlooringKind | undefined): FlooringOption {
  return FLOORING.find((f) => f.id === id) ?? FLOORING[0];
}
