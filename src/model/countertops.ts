// Selectable countertop materials, independent of the cabinet finish. Each is a
// procedural look (no image assets): granite = dense speckle, quartzite = soft
// veining, concrete = matte mottle, solid = light marble. The 3D engine builds
// a canvas texture from these specs (see countertopTexture in three/cabinet3d).

export type CounterCategory = 'solid' | 'granite' | 'quartzite' | 'concrete';

export interface Countertop {
  id: string;
  name: string;
  category: CounterCategory;
  /** Base fill color (hex). */
  base: string;
  /** Granite speckle colors. */
  flecks?: string[];
  /** Quartzite / marble vein color. */
  vein?: string;
  /** Matte surface (concrete) — no clear-coat, higher roughness. */
  matte?: boolean;
}

export const DEFAULT_COUNTERTOP = 'classic-white';

export const COUNTERTOPS: Countertop[] = [
  // ---- Solid / marble ----
  { id: 'classic-white', name: 'Classic White', category: 'solid', base: '#ece9e2', vein: '#c9c6bd' },
  { id: 'carrara', name: 'Carrara Marble', category: 'solid', base: '#eceef0', vein: '#aeb4ba' },

  // ---- Granite ----
  { id: 'absolute-black', name: 'Absolute Black', category: 'granite', base: '#17191c', flecks: ['#2b2f34', '#3c424a'] },
  { id: 'black-galaxy', name: 'Black Galaxy', category: 'granite', base: '#0e0f12', flecks: ['#caa64a', '#d9d4c8', '#8a7d5a'] },
  { id: 'uba-tuba', name: 'Uba Tuba', category: 'granite', base: '#1f261d', flecks: ['#3c4a32', '#b9a86a', '#5a6347'] },
  { id: 'steel-grey', name: 'Steel Grey', category: 'granite', base: '#6d7175', flecks: ['#4a4d51', '#9aa0a4', '#34373a'] },
  { id: 'santa-cecilia', name: 'Santa Cecilia', category: 'granite', base: '#b39a6b', flecks: ['#7a5b34', '#e6dcc4', '#2e2a22', '#9c7d4e'] },
  { id: 'giallo-ornamental', name: 'Giallo Ornamental', category: 'granite', base: '#ccbb95', flecks: ['#a98f5e', '#efe7d2', '#6f5c3e'] },
  { id: 'new-venetian-gold', name: 'New Venetian Gold', category: 'granite', base: '#c6b189', flecks: ['#9a7b4f', '#efe6d0', '#5b4a33', '#b08d3c'] },

  // ---- Quartzite ----
  { id: 'taj-mahal', name: 'Taj Mahal', category: 'quartzite', base: '#ddd1b9', vein: '#c2b393' },
  { id: 'white-macaubas', name: 'White Macaubas', category: 'quartzite', base: '#e9e8e3', vein: '#a9adac' },
  { id: 'mont-blanc', name: 'Mont Blanc', category: 'quartzite', base: '#e4e4e1', vein: '#b7babc' },
  { id: 'sea-pearl', name: 'Sea Pearl', category: 'quartzite', base: '#8e958d', vein: '#6c736b' },

  // ---- Concrete ----
  { id: 'natural-concrete', name: 'Natural Concrete', category: 'concrete', base: '#b7b6b2', matte: true },
  { id: 'grey-concrete', name: 'Grey Concrete', category: 'concrete', base: '#8f9094', matte: true },
  { id: 'charcoal-concrete', name: 'Charcoal Concrete', category: 'concrete', base: '#54575b', matte: true },
];

export const COUNTER_CATEGORY_LABELS: Record<CounterCategory, string> = {
  solid: 'Marble / Solid',
  granite: 'Granite',
  quartzite: 'Quartzite',
  concrete: 'Concrete',
};

export function countertopById(id: string | undefined): Countertop {
  return COUNTERTOPS.find((c) => c.id === id) ?? COUNTERTOPS[0];
}
