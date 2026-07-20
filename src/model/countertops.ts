// Selectable countertop materials, independent of the cabinet finish. Each is a
// procedural look (no image assets): granite = dense speckle, quartzite = soft
// veining, concrete = matte mottle, solid = light marble. The 3D engine builds
// a canvas texture from these specs (see countertopTexture in three/cabinet3d).

export type CounterCategory = 'solid' | 'granite' | 'quartzite' | 'concrete' | 'metal' | 'dekton';

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
  /** Secondary vein color (Dekton marble looks). */
  vein2?: string;
  /** Accent streak colors (rust / inky blue hints in the Onirika designs). */
  accents?: string[];
  /** Dekton pattern style driving the texture painter. */
  style?: 'marble' | 'soft' | 'limestone' | 'cement' | 'volcanic' | 'speckle';
  /** Thicker, higher-contrast main veining (dramatic marble designs). */
  boldVeins?: boolean;
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

  // ---- Dekton (Cosentino ultracompact) ----
  // Onirika marble designs
  { id: 'dk-awake', name: 'Dekton Awake', category: 'dekton', style: 'marble', boldVeins: true, base: '#eff0ee', vein: '#9fa8b2', vein2: '#c3c9cf', accents: ['#b46a45', '#5b6b85'] },
  { id: 'dk-trance', name: 'Dekton Trance', category: 'dekton', style: 'marble', boldVeins: true, base: '#e7e3dc', vein: '#8093a6', vein2: '#b3aca1', accents: ['#a96a48'] },
  { id: 'dk-somnia', name: 'Dekton Somnia', category: 'dekton', style: 'marble', matte: true, base: '#191a1c', vein: '#7d6a55', vein2: '#cbb9a4', accents: ['#8f4f33'] },
  { id: 'dk-morpheus', name: 'Dekton Morpheus', category: 'dekton', style: 'marble', matte: true, base: '#edeae4', vein: '#a89a88', vein2: '#c9beb0' },
  // marble & stone looks
  { id: 'dk-natura', name: 'Dekton Natura', category: 'dekton', style: 'marble', base: '#f0efeb', vein: '#b8bcbf', vein2: '#d3d5d7' },
  { id: 'dk-marina', name: 'Dekton Marina', category: 'dekton', style: 'marble', base: '#f0efec', vein: '#9aa0a6', vein2: '#c5c9cc' },
  { id: 'dk-keena', name: 'Dekton Keena', category: 'dekton', style: 'marble', base: '#f0efe9', vein: '#a9b3ab', vein2: '#c8cec6', accents: ['#cf9a70'] },
  { id: 'dk-inuk', name: 'Dekton Inuk', category: 'dekton', style: 'soft', base: '#f2f4f4', vein: '#ccd3d6' },
  { id: 'dk-nara', name: 'Dekton Nara', category: 'dekton', style: 'soft', base: '#ddd0b8', vein: '#c3b291' },
  // limestone / honed stone
  { id: 'dk-polar', name: 'Dekton Polar', category: 'dekton', style: 'limestone', matte: true, base: '#eae7de', vein: '#d6d2c6' },
  { id: 'dk-sandik', name: 'Dekton Sandik', category: 'dekton', style: 'limestone', matte: true, base: '#e3d7bd', vein: '#c6b28f' },
  // granite / industrial
  { id: 'dk-granite', name: 'Dekton Granite', category: 'dekton', style: 'speckle', matte: true, base: '#8d8d8b', flecks: ['#5a5a58', '#c9c7c2', '#3a3a38', '#a39c8f'] },
  { id: 'dk-kreta', name: 'Dekton Kreta', category: 'dekton', style: 'cement', matte: true, base: '#9a9a98' },
  { id: 'dk-soke', name: 'Dekton Soke', category: 'dekton', style: 'cement', matte: true, base: '#7e7f80', vein: '#65666a' },
  { id: 'dk-trillium', name: 'Dekton Trillium', category: 'dekton', style: 'volcanic', matte: true, base: '#4a453f', accents: ['#2e2b28', '#6b6259', '#8a7f72', '#23211f'] },

  // ---- Concrete ----
  { id: 'natural-concrete', name: 'Natural Concrete', category: 'concrete', base: '#b7b6b2', matte: true },
  { id: 'grey-concrete', name: 'Grey Concrete', category: 'concrete', base: '#8f9094', matte: true },
  { id: 'charcoal-concrete', name: 'Charcoal Concrete', category: 'concrete', base: '#54575b', matte: true },

  // ---- Metal (NewAge modular kitchens) ----
  { id: 'na-stainless', name: 'Stainless Steel (NewAge)', category: 'metal', base: '#c7cacd' },
];

export const COUNTER_CATEGORY_LABELS: Record<CounterCategory, string> = {
  solid: 'Marble / Solid',
  granite: 'Granite',
  quartzite: 'Quartzite',
  concrete: 'Concrete',
  metal: 'Stainless Steel',
  dekton: 'Dekton',
};

export function countertopById(id: string | undefined): Countertop {
  return COUNTERTOPS.find((c) => c.id === id) ?? COUNTERTOPS[0];
}
