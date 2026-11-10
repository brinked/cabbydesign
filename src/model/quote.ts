// The estimate behind the report: every line, subtotal and total for a design,
// for the account viewing it. Pure — no React, no store reads — so the same
// numbers can be unit-tested and reused (report, order email, quote request).
import type { CatalogPrefs, DealerPrefs } from '../api/client';
import type { ApplianceBrands, ApplianceItem, CatalogItem, Design, HandleItem, PanelRates } from './types';
import { ALL_FINISHES, DOOR_STYLE_LABELS, MAX_PANEL_W, catalogById, handleCount } from './catalog';
import { NA_COUNTER_RATE_PER_SQFT, itemFinishId, naVariantFor } from './newage';
import { money } from './pricing';
import { appliancePrice } from './appliances';
import { mergedHandles } from './companyCatalog';
import { pergolaAreaSqft, pergolaColumnRateFor, pergolaColumns, pergolaRateFor } from './pergola';
import { appliedEnds, counterAreaSqft, finishedEnds, itemNumbers, itemOnIsland, itemPrice, panelHeight } from '../state/store';

export interface QuoteInput {
  design: Design;
  /** Admin base (cost) formulas by catalog id. */
  pricing: Record<string, string>;
  /** Admin retail formulas by catalog id. */
  retailPricing: Record<string, string>;
  appliances: ApplianceItem[];
  applianceBrands: ApplianceBrands;
  handles: HandleItem[];
  pergolaRates: Record<string, number>;
  panelRates: PanelRates;
  catalogPrefs: CatalogPrefs | null | undefined;
  prefs: DealerPrefs | null | undefined;
  role: string | undefined;
  /** Guests + homeowner/company accounts: never shown prices. */
  isConsumer: boolean;
  /** Sales tax percent. */
  taxRate: number;
}

export type Quote = ReturnType<typeof computeQuote>;

export function computeQuote(input: QuoteInput) {
  const { design, pricing, retailPricing, appliances, applianceBrands, handles, pergolaRates, catalogPrefs, prefs, role, isConsumer, taxRate } = input;
  const numbers = itemNumbers(design);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Spec summary values for the cover/report.
  const doorStyleLabel = DOOR_STYLE_LABELS[design.doorStyle] ?? design.doorStyle;
  const counterSqft = counterAreaSqft(design);
  const totalHandles = design.items.reduce((n, it) => {
    // items with their OWN pull (hidden cabinets) bill on their own handle
    // below; the built-in tab pull carries no hardware charge at all
    if (it.handleId) return n;
    return n + handleCount(catalogById(it.catalogId), it.w);
  }, 0);
  // Per-item pull overrides (hidden cabinets) grouped by inventory handle.
  const ownPulls = new Map<string, number>();
  for (const it of design.items) {
    if (!it.handleId || it.handleId === 'tab' || it.handleId === 'none') continue;
    ownPulls.set(it.handleId, (ownPulls.get(it.handleId) ?? 0) + handleCount(catalogById(it.catalogId), it.w));
  }

  // Pricing preferences. Default to showing marked-up pricing. Consumers
  // (guests + homeowner/company accounts) never see pricing on the report —
  // they request a quote instead.
  const showPricing = isConsumer ? false : prefs?.showPricing ?? true;
  const priceMode = prefs?.priceMode ?? 'marked_up';
  const isMarkedUp = priceMode === 'marked_up';
  const isContractor = role === 'contractor';
  const taxExempt = prefs?.taxExempt ?? false;

  // Dealer markup (not used for contractors). percent multiplies; flat adds per cabinet.
  const factor = !isContractor && isMarkedUp && prefs?.markupMode !== 'flat' ? 1 + (prefs?.marginPct ?? 0) / 100 : 1;
  const flatPerCab = !isContractor && isMarkedUp && prefs?.markupMode === 'flat' ? prefs?.flatAmount ?? 0 : 0;

  // Contractor pricing: % off retail (retail formula, fall back to base) or the
  // contractor's own per-cabinet formulas (fall back to retail, then base).
  const contractorMode = prefs?.contractorMode ?? 'retail_discount';
  const retailDiscount = isContractor ? prefs?.retailDiscountPct ?? 0 : 0;
  const retailMap = { ...pricing, ...retailPricing };
  const ownMap = { ...pricing, ...retailPricing, ...(prefs?.ownPricing ?? {}) };

  /** Final displayed cabinet line price (box + trays) for the current account. */
  const cabinetDisplayed = (it: (typeof design.items)[number], costP: ReturnType<typeof itemPrice>): number => {
    // NewAge units carry fixed retail (SKU) pricing — no markup/discount applies.
    if (catalogById(it.catalogId).naPricing) return costP.cabinet;
    const trays = costP.trays;
    if (isContractor && isMarkedUp) {
      const box =
        contractorMode === 'own'
          ? itemPrice(design, it, ownMap).cabinet
          : itemPrice(design, it, retailMap).cabinet * (1 - retailDiscount / 100);
      return round2(box) + trays;
    }
    // dealer markup (factor/flat), or cost mode (factor 1, flat 0)
    return round2((costP.cabinet + trays) * factor + flatPerCab);
  };

  // panels mark up by the dealer percent only (1 for contractors / cost mode).
  const panelMk = (n: number) => money(n * factor);

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  // Panel style name on the report: EXT product names for the outdoor HDPE
  // styles, the door-style label itself for indoor wood styles.
  // marketing name only — "Vibe (groove frame)" → "Vibe"
  const designName = (DOOR_STYLE_LABELS[design.doorStyle] ?? design.doorStyle).split(' (')[0];
  const { applied: rate, finished: finRate } = input.panelRates;

  // NewAge designs: item names carry the SKU for the selected finish; the
  // stainless countertop gets an area-based estimate (final order uses
  // NewAge's fixed-size top SKUs).
  const line = design.line ?? 'ext';
  const isNewAge = line !== 'ext';
  const naCounterEstimate = isNewAge && design.counterId === 'na-stainless' ? round2(counterSqft * NA_COUNTER_RATE_PER_SQFT) : 0;
  // NewAge line items: name + the finish actually chosen for that cabinet +
  // its SKU (per-cabinet series/finish overrides included).
  const lineName = (cat: CatalogItem, it: (typeof design.items)[number]) => {
    if (!cat.naPricing) return cat.name;
    const fid = itemFinishId(design, it, cat);
    const nv = naVariantFor(cat, fid);
    const f = ALL_FINISHES.find((x) => x.id === fid);
    return nv ? `${cat.name} · ${f?.name ?? fid} · SKU ${nv.sku}` : cat.name;
  };

  // Cabinet line items (cabinet price only — panels are itemized separately).
  const lines = [...design.items]
    .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0))
    .map((it) => {
      const cat = catalogById(it.catalogId);
      const p = itemPrice(design, it, pricing);
      const wall = design.walls.find((w) => w.id === it.wallId);
      // cost line (box + trays) and the final displayed price for this account
      const price = p.cabinet + p.trays;
      const displayed = cat.category === 'appliance' || p.error ? 0 : cabinetDisplayed(it, p);
      return { it, cat, wall, price, displayed, error: p.error, n: numbers.get(it.id) ?? 0 };
    });
  const cabinetSubtotal = lines.reduce((s, l) => s + (l.error ? 0 : l.price), 0);
  const cabinetSubtotalDisplayed = lines.reduce((s, l) => s + (l.error || l.price <= 0 ? 0 : l.displayed), 0);
  const hasErrors = lines.some((l) => l.error);

  // Applied end panels — grouped by size (depth × panel height), with quantity.
  // same panel height the editor prices with (honours "panels to floor")
  const panelH = (it: (typeof design.items)[number]) => panelHeight(design, it);
  const endGroups = new Map<string, { kind: 'applied' | 'finished'; w: number; h: number; qty: number; unit: number; nums: Set<number> }>();
  for (const it of design.items) {
    const h = panelH(it);
    // applied end panels + finished ends (side in finished material), each at
    // its own admin-managed $/sqft rate
    for (const [kind, sides, r] of [
      ['applied', appliedEnds(it), rate],
      ['finished', finishedEnds(it), finRate],
    ] as const) {
      const n = (sides.l ? 1 : 0) + (sides.r ? 1 : 0);
      if (!n) continue;
      const key = `${kind}|${it.d}x${h}`;
      const unit = Math.round(((it.d * h) / 144) * r * 100) / 100;
      const g = endGroups.get(key) ?? { kind, w: it.d, h, qty: 0, unit, nums: new Set<number>() };
      g.qty += n;
      g.nums.add(numbers.get(it.id) ?? 0);
      endGroups.set(key, g);
    }
  }
  const endRows = [...endGroups.values()]
    .map((g) => ({ ...g, nums: [...g.nums].sort((a, b) => a - b) }))
    .sort((a, b) => (a.kind === b.kind ? b.w * b.h - a.w * a.h : a.kind === 'applied' ? -1 : 1));
  const endSubtotal = endRows.reduce((s, g) => s + g.unit * g.qty, 0);

  // Applied back panels (islands) — combined into a single summed line.
  let backCount = 0;
  let backArea = 0;
  for (const it of design.items) {
    const cat = catalogById(it.catalogId);
    // NewAge metal units are finished on all sides — no applied back panels.
    // A hidden cabinet's doors ARE the island back there, so no panel either
    // (matches itemPrice).
    if (cat.category === 'appliance' || cat.line || cat.hidden || !itemOnIsland(design, it)) continue;
    backCount += Math.ceil(it.w / MAX_PANEL_W);
    backArea += it.w * panelH(it);
  }
  const backSubtotal = Math.round((backArea / 144) * rate * 100) / 100;

  // Appliances chosen on grill/fridge/burner cabinets. Priced at MSRP for the
  // customer (marked_up) or the dealer's net cost (cost mode). The dealer's
  // brand discount is their margin, so appliances skip the cabinet markup.
  const applianceLines = [...design.items]
    .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0))
    .map((it) => ({
      it,
      cat: catalogById(it.catalogId),
      n: numbers.get(it.id) ?? 0,
      p: appliancePrice(it.appliance, appliances, applianceBrands, priceMode),
    }))
    .filter((l) => l.p.label); // only cabinets with an appliance selected
  const applianceUnit = (msrp: number, net: number) => (isMarkedUp ? msrp : net);
  const applianceSubtotal = applianceLines.reduce((s, l) => s + l.p.total, 0);

  // Cabinet handles: the selected handle priced across the whole design.
  // Retail (customer) in marked-up mode, dealer cost in cost mode.
  const handle = mergedHandles(handles, catalogPrefs).find((h) => h.id === design.handleId);
  const handleUnit = handle ? (isMarkedUp ? handle.retail : handle.dealer) : 0;
  // pulls chosen per cabinet (hidden cabinets) add at their own handle price
  const ownPullsCost = [...ownPulls.entries()].reduce((sum, [hid, count]) => {
    const h = handles.find((x) => x.id === hid);
    return sum + (h ? count * (isMarkedUp ? h.retail : h.dealer) : 0);
  }, 0);
  const handleSubtotal = (handle ? totalHandles * handleUnit : 0) + ownPullsCost;

  // Marked-up subtotals (percent factor, plus a flat $ on each priced cabinet).
  const cabinetSubtotalMk = cabinetSubtotalDisplayed;
  const panelSubtotalMk = (endSubtotal + backSubtotal) * factor;
  // Pergola: footprint sq ft x the admin's rate for the model, plus a charge
  // per column (an extra column every maxSpanFt; a side mounted to the house
  // drops that whole row).
  const pergolaObj = design.pergola;
  const pergolaSqft = pergolaObj ? pergolaAreaSqft(pergolaObj) : 0;
  const pergolaRate = pergolaObj ? pergolaRateFor(pergolaObj.model, pergolaRates) : 0;
  const pergolaCols = pergolaObj ? pergolaColumns(pergolaObj).total : 0;
  const pergolaColRate = pergolaObj ? pergolaColumnRateFor(pergolaObj.model, pergolaRates) : 0;
  const pergolaTotal = Math.round((pergolaSqft * pergolaRate + pergolaCols * pergolaColRate) * 100) / 100;

  const subtotalMk = cabinetSubtotalMk + panelSubtotalMk + applianceSubtotal + handleSubtotal + naCounterEstimate + pergolaTotal;
  const taxAmount = isMarkedUp && !taxExempt ? (subtotalMk * taxRate) / 100 : 0;
  const grandTotal = subtotalMk + taxAmount;

  return {
    numbers,
    round2,
    doorStyleLabel,
    counterSqft,
    totalHandles,
    ownPulls,
    showPricing,
    priceMode,
    isMarkedUp,
    isContractor,
    taxExempt,
    factor,
    flatPerCab,
    panelMk,
    date,
    designName,
    rate,
    finRate,
    line,
    isNewAge,
    naCounterEstimate,
    lineName,
    lines,
    cabinetSubtotal,
    cabinetSubtotalDisplayed,
    hasErrors,
    endRows,
    endSubtotal,
    backCount,
    backArea,
    backSubtotal,
    applianceLines,
    applianceUnit,
    applianceSubtotal,
    handle,
    handleUnit,
    handleSubtotal,
    cabinetSubtotalMk,
    panelSubtotalMk,
    pergolaObj,
    pergolaSqft,
    pergolaRate,
    pergolaCols,
    pergolaColRate,
    pergolaTotal,
    subtotalMk,
    taxAmount,
    grandTotal,
  };
}
