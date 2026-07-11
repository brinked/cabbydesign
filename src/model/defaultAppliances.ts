// Built-in grill/griddle inventory imported from the original CabDesign tool.
// These are the units we carry brand-accurate 3D models for (see
// model/appliances.ts appliance3dModel) — they ship as the default inventory
// so consumers get real appliances (and real 3D heads) with no admin setup.
// The admin Appliances panel can extend/override this list; it only seeds
// when the server inventory is empty.
import type { ApplianceItem } from './types';

export const DEFAULT_GRILL_APPLIANCES: ApplianceItem[] = [
  { id: 'blz32', category: 'grill', brand: 'Blaze', model: 'BLZ-4-LTE2', name: 'LTE 32', msrp: 2000 },
  { id: 'blz40', category: 'grill', brand: 'Blaze', model: 'BLZ-5-LTE2', name: 'LTE 40"', msrp: 2200 },
  { id: 'blzpro', category: 'grill', brand: 'Blaze', model: 'BLZ-5-LTE-PRO', name: 'LTE Pro 40"', msrp: 2600 },
  { id: 'nap32', category: 'grill', brand: 'Napoleon', model: 'BIG32', name: '700 BIG32', msrp: 3000 },
  { id: 'nap38', category: 'grill', brand: 'Napoleon', model: 'BIG38', name: '700 BIG38', msrp: 3400 },
  { id: 'nap44', category: 'grill', brand: 'Napoleon', model: 'BIG44', name: '700 BIG44', msrp: 3800 },
  { id: 'xo32', category: 'grill', brand: 'XO', model: 'XLT32', name: 'XLT 32', msrp: 2500 },
  { id: 'xo40', category: 'grill', brand: 'XO', model: 'XLT40', name: 'XLT 40"', msrp: 2700 },
  { id: 'lg75', category: 'griddle', brand: 'Le Griddle', model: 'OML75', name: 'Commercial 75', msrp: 1800 },
  { id: 'lg105', category: 'griddle', brand: 'Le Griddle', model: 'OML105', name: 'Commercial 105', msrp: 2100 },
];
