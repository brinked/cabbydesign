import { Fragment, useState } from 'react';
import type { OrderLine } from '../api/client';
import type { CatalogItem } from '../model/types';
import SubmitOrderModal from './SubmitOrderModal';
import RequestQuoteModal from './RequestQuoteModal';
import { ALL_FINISHES, DOOR_STYLE_LABELS, TOEKICK_H, catalogById, handleCount } from '../model/catalog';
import { LINE_LABELS, NA_COUNTER_RATE_PER_SQFT, itemFinishId, naVariantFor } from '../model/newage';
import { money } from '../model/pricing';
import { appliancePrice } from '../model/appliances';
import { mergedHandles } from '../model/companyCatalog';
import { countertopById } from '../model/countertops';
import { appliedEnds, counterAreaSqft, finishedEnds, footprintW, itemNumbers, itemOnIsland, itemPrice, reservesFor, roughInConflict, roughInHost, useStore } from '../state/store';
import { useSession } from '../state/session';
import { MAX_PANEL_W } from '../three/cabinet3d';
import { TopViewSvg } from './TopView';
import { WallElevationSvg, useFinish } from './WallsView';
import { DimH, DimV, RoughInGlyph, fmtIn } from './svg';
import type { Design, RoughIn, RoughInKind, Wall } from '../model/types';

export default function Report() {
  const design = useStore((s) => s.design);
  const pricing = useStore((s) => s.pricing);
  const retailPricing = useStore((s) => s.retailPricing);
  const snapshot = useStore((s) => s.snapshot3d);
  const setTab = useStore((s) => s.setTab);
  const quoteOpen = useStore((s) => s.quoteOpen);
  const setQuoteOpen = useStore((s) => s.setQuoteOpen);
  const appliances = useStore((s) => s.appliances);
  const applianceBrands = useStore((s) => s.applianceBrands);
  const handles = useStore((s) => s.handles);
  const catalogPrefs = useSession((s) => s.catalogPrefs);
  const prefs = useSession((s) => s.prefs);
  const role = useSession((s) => s.user?.role);
  const sessionStatus = useSession((s) => s.status);
  const openAuth = useSession((s) => s.openAuth);
  const isGuest = sessionStatus === 'guest';
  /** Consumers: guests + homeowner/company accounts — no pricing, quote flow. */
  const isConsumer = isGuest || role === 'homeowner' || role === 'company';
  const taxRate = useSession((s) => s.taxRate);
  const logo = useSession((s) => s.user?.logo) ?? '';
  const fin = useFinish(design.finishId);
  const numbers = itemNumbers(design);

  const round2 = (n: number) => Math.round(n * 100) / 100;

  // Spec summary values for the cover/report.
  const doorStyleLabel = DOOR_STYLE_LABELS[design.doorStyle] ?? design.doorStyle;
  const counterSqft = counterAreaSqft(design);
  const totalHandles = design.items.reduce((n, it) => n + handleCount(catalogById(it.catalogId), it.w), 0);

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
  const designName = design.doorStyle === 'shaker' ? 'Vibe' : design.doorStyle === 'flat' ? 'Euro' : DOOR_STYLE_LABELS[design.doorStyle] ?? design.doorStyle;
  const { applied: rate, finished: finRate } = useStore((s) => s.panelRates);

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
  const panelH = (it: (typeof design.items)[number]) => {
    const cat = catalogById(it.catalogId);
    return Math.max(0, it.h - (cat.lane === 'floor' ? TOEKICK_H : 0));
  };
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
    if (cat.category === 'appliance' || cat.line || !itemOnIsland(design, it)) continue;
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
  const handleSubtotal = handle ? totalHandles * handleUnit : 0;

  // Marked-up subtotals (percent factor, plus a flat $ on each priced cabinet).
  const cabinetSubtotalMk = cabinetSubtotalDisplayed;
  const panelSubtotalMk = (endSubtotal + backSubtotal) * factor;
  const subtotalMk = cabinetSubtotalMk + panelSubtotalMk + applianceSubtotal + handleSubtotal + naCounterEstimate;
  const taxAmount = isMarkedUp && !taxExempt ? (subtotalMk * taxRate) / 100 : 0;
  const grandTotal = subtotalMk + taxAmount;

  // Order-submission line items (cabinets + appliances) for the review email.
  const [orderOpen, setOrderOpen] = useState(false);
  // Consumer PDF-download gate ("email me my design").
  const [pdfGateOpen, setPdfGateOpen] = useState(false);
  const orderLines: OrderLine[] = [
    ...lines.map((l) => ({
      n: l.n,
      name: lineName(l.cat, l.it),
      location: l.wall?.name ?? '',
      size: `${fmtIn(l.it.w)} × ${fmtIn(l.it.d)} × ${fmtIn(l.it.h)}`,
      price: !showPricing ? '' : l.cat.category === 'appliance' ? '—' : l.error ? 'formula error' : l.price <= 0 ? '—' : money(l.displayed),
    })),
    ...applianceLines.map((l) => ({
      n: l.n,
      name: l.p.label,
      location: design.walls.find((w) => w.id === l.it.wallId)?.name ?? '',
      size: '',
      price: !showPricing ? '' : money(l.p.total),
    })),
  ];

  return (
    <div className="report">
      <div className="report-toolbar no-print">
        <span>
          {snapshot ? '3D view attached.' : 'Tip: open the 3D tab and click “Save view to report” to include a rendering.'}
        </span>
        <div>
          {!snapshot && (
            <button className="btn-ghost" onClick={() => setTab('3d')}>
              Open 3D view
            </button>
          )}
          {!isConsumer && (
            <button className="btn-ghost" onClick={() => setOrderOpen(true)}>
              Submit order for review
            </button>
          )}
          {isConsumer && (
            <button className="btn-primary" onClick={() => setQuoteOpen(true)}>
              Request a free quote
            </button>
          )}
          {isGuest ? (
            // Downloading the plan requires a (free, verified) account.
            <button
              className="btn-ghost"
              onClick={() => openAuth('Create a free account to download your design as a PDF — and keep it saved for later.')}
            >
              Save / Download PDF
            </button>
          ) : (
            <button className={isConsumer ? 'btn-ghost' : 'btn-primary'} onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {orderOpen && (
        <SubmitOrderModal
          design={design}
          lines={orderLines}
          total={showPricing ? money(grandTotal) : ''}
          showPricing={showPricing}
          onClose={() => setOrderOpen(false)}
        />
      )}

      {quoteOpen && isConsumer && (
        <RequestQuoteModal
          design={design}
          lines={orderLines}
          total={showPricing ? money(grandTotal) : ''}
          onClose={() => setQuoteOpen(false)}
        />
      )}

      {pdfGateOpen && isConsumer && (
        <RequestQuoteModal
          design={design}
          lines={orderLines}
          total={showPricing ? money(grandTotal) : ''}
          variant="design"
          onClose={() => setPdfGateOpen(false)}
        />
      )}

      {/* Cover */}
      <section className="report-page report-cover">
        {logo && <img className="cover-logo" src={logo} alt="Company logo" />}
        <div className="cover-rule" />
        <h1>{design.name || 'Untitled Design'}</h1>
        <p className="cover-sub">
          {design.client ? `Prepared for ${design.client} · ` : ''}
          {date}
        </p>
        <div className="cover-meta">
          <div>
            Cabinet line: {LINE_LABELS[line]}
            {design.kitchenType === 'indoor' ? ' · Indoor kitchen' : ' · Outdoor kitchen'}
          </div>
          <div>
            Finish: {fin.group ? `${fin.group} · ` : ''}
            {fin.name}
          </div>
          {!isNewAge && <div>Door style: {doorStyleLabel}</div>}
          <div>
            Countertop: {countertopById(design.counterId).name}, {fmtIn(design.counterThickness)} thick ({counterSqft} sq ft)
          </div>
          <div>Gas: {design.gasType === 'ng' ? 'Natural Gas' : design.gasType === 'lp' ? 'Liquid Propane' : 'Not specified'}</div>
          <div>Handles: {totalHandles}</div>
        </div>
        {snapshot && <img className="cover-render" src={snapshot} alt="3D rendering" />}
        <p className="cover-foot">{showPricing ? <>Design Report — plan, elevations &amp; estimate</> : 'Design Report — plan & elevations'}</p>
      </section>

      {/* Plan */}
      <section className="report-page">
        <h2>Floor Plan</h2>
        <div className="report-figure">
          <TopViewSvg />
        </div>
      </section>

      {/* Elevations */}
      {design.walls.map((wall, i) => (
        <section className="report-page" key={wall.id}>
          <h2>
            Elevation {String.fromCharCode(65 + i)} — {wall.name}
          </h2>
          <p className="report-note">
            Wall {fmtIn(wall.length)} long × {fmtIn(wall.height)} high
          </p>
          <div className="report-figure">
            <WallElevationSvg
              wall={wall}
              items={design.items}
              fin={fin}
              showHeightDim
              numbers={numbers}
              reserve={reservesFor(design).get(wall.id)}
            />
          </div>
        </section>
      ))}

      {/* Rough-in schedule — utility stub-out locations & measurements */}
      {design.roughIns.length > 0 && <RoughInSchedule design={design} numbers={numbers} />}

      {/* Schedule & pricing */}
      <section className="report-page">
        <h2>{showPricing ? <>Item Schedule &amp; Estimate</> : 'Item Schedule'}</h2>
        <table className="schedule">
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th>Location</th>
              <th>Size (W × D × H)</th>
              {showPricing && <th className="num">Price</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.it.id}>
                <td>{l.n}</td>
                <td>{lineName(l.cat, l.it)}</td>
                <td>{l.wall?.name ?? '—'}</td>
                <td>
                  {fmtIn(l.it.w)} × {fmtIn(l.it.d)} × {fmtIn(l.it.h)}
                </td>
                {showPricing && (
                  <td className="num">
                    {l.cat.category === 'appliance' ? '—' : l.error ? 'formula error' : l.price <= 0 ? '—' : money(l.displayed)}
                  </td>
                )}
              </tr>
            ))}
            {lines.length === 0 && (
              <tr>
                <td colSpan={showPricing ? 5 : 4} style={{ textAlign: 'center', color: '#888' }}>
                  No items placed yet.
                </td>
              </tr>
            )}
          </tbody>
          {showPricing && (
            <tfoot>
              <tr>
                <td colSpan={4}>Cabinets subtotal{hasErrors ? ' (some formulas need attention)' : ''}</td>
                <td className="num">{money(cabinetSubtotalMk)}</td>
              </tr>
            </tfoot>
          )}
        </table>

        {(endRows.length > 0 || backCount > 0) && (
          <table className="schedule" style={{ marginTop: 22 }}>
            <thead>
              <tr>
                <th>Applied Panel</th>
                <th>Design</th>
                <th>Size (W × H)</th>
                <th className="num">Qty</th>
                {showPricing && <th className="num">Unit</th>}
                {showPricing && <th className="num">Total</th>}
              </tr>
            </thead>
            <tbody>
              {endRows.map((g, i) => (
                <tr key={`e${i}`}>
                  <td>
                    {g.kind === 'applied' ? 'Applied End Panel' : 'Finished End'} <span className="panel-cabs">(cabinet {g.nums.join(', ')})</span>
                  </td>
                  <td>{designName}</td>
                  <td>
                    {fmtIn(g.w)} × {fmtIn(g.h)}
                  </td>
                  <td className="num">{g.qty}</td>
                  {showPricing && <td className="num">{panelMk(g.unit)}</td>}
                  {showPricing && <td className="num">{panelMk(g.unit * g.qty)}</td>}
                </tr>
              ))}
              {backCount > 0 && (
                <tr>
                  <td>Applied Back Panels (island)</td>
                  <td>{designName}</td>
                  <td>{(backArea / 144).toFixed(1)} sq ft total</td>
                  <td className="num">{backCount}</td>
                  {showPricing && <td className="num">—</td>}
                  {showPricing && <td className="num">{panelMk(backSubtotal)}</td>}
                </tr>
              )}
            </tbody>
            {showPricing && (
              <tfoot>
                <tr>
                  <td colSpan={5}>Applied panels subtotal</td>
                  <td className="num">{money(panelSubtotalMk)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {applianceLines.length > 0 && (
          <table className="schedule" style={{ marginTop: 22 }}>
            <thead>
              <tr>
                <th>#</th>
                <th>Cabinet</th>
                <th>Appliance</th>
                {showPricing && <th className="num">Price</th>}
              </tr>
            </thead>
            <tbody>
              {applianceLines.map((l) => (
                <Fragment key={l.it.id}>
                  <tr>
                    <td>{l.n}</td>
                    <td>{l.cat.name}</td>
                    <td>{l.p.byCustomer ? `Customer-supplied: ${l.p.label}` : l.p.label}</td>
                    {showPricing && (
                      <td className="num">
                        {l.p.byCustomer ? 'by customer' : money(applianceUnit(l.p.applianceMsrp, l.p.applianceNet))}
                      </td>
                    )}
                  </tr>
                  {l.p.liner && (
                    <tr className="appliance-liner-row">
                      <td></td>
                      <td></td>
                      <td>↳ Insulated liner — {l.p.liner.brand} {l.p.liner.model}</td>
                      {showPricing && <td className="num">{money(applianceUnit(l.p.linerMsrp, l.p.linerNet))}</td>}
                    </tr>
                  )}
                  {l.p.panelCharge > 0 && (
                    <tr className="appliance-liner-row">
                      <td></td>
                      <td></td>
                      <td>↳ Custom cabinet-matched panel (panel-ready)</td>
                      {showPricing && <td className="num">{money(l.p.panelCharge)}</td>}
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
            {showPricing && (
              <tfoot>
                <tr>
                  <td colSpan={3}>Appliances subtotal</td>
                  <td className="num">{money(applianceSubtotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        )}

        {totalHandles > 0 && (
          <table className="schedule" style={{ marginTop: 22 }}>
            <thead>
              <tr>
                <th>Hardware</th>
                <th className="num">Qty</th>
                {showPricing && <th className="num">Unit</th>}
                {showPricing && <th className="num">Price</th>}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  {handle ? (
                    <span className="handle-cell">
                      {handle.photo && <img className="handle-thumb" src={handle.photo} alt="" />}
                      {handle.name || 'Cabinet handle'}
                    </span>
                  ) : (
                    'Cabinet handles (no handle selected)'
                  )}
                </td>
                <td className="num">{totalHandles}</td>
                {showPricing && <td className="num">{handle ? money(handleUnit) : '—'}</td>}
                {showPricing && <td className="num">{handle ? money(handleSubtotal) : '—'}</td>}
              </tr>
            </tbody>
          </table>
        )}

        {showPricing && naCounterEstimate > 0 && (
          <table className="schedule" style={{ marginTop: 22 }}>
            <thead>
              <tr>
                <th>Countertops</th>
                <th className="num">Area</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>NewAge stainless steel countertops (estimate — final order uses NewAge's fixed-size tops)</td>
                <td className="num">{counterSqft} sq ft</td>
                <td className="num">{money(naCounterEstimate)}</td>
              </tr>
            </tbody>
          </table>
        )}

        {showPricing && (
          <table className="schedule" style={{ marginTop: 22 }}>
            <tfoot>
              <tr>
                <td colSpan={5}>Subtotal</td>
                <td className="num">{money(subtotalMk)}</td>
              </tr>
              {isMarkedUp && !taxExempt && (
                <tr>
                  <td colSpan={5}>Sales tax ({taxRate}%)</td>
                  <td className="num">{money(taxAmount)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={5}>{isMarkedUp && !taxExempt ? 'Total' : 'Estimate total'}</td>
                <td className="num">
                  <b>{money(grandTotal)}</b>
                </td>
              </tr>
            </tfoot>
          </table>
        )}

        {showPricing && !isNewAge && (
          <p className="report-note">
            Applied end and back panels bill at {money(rate * factor)}/sq ft (panel height excludes the 4″ toe kick) in the{' '}
            {designName} ({doorStyleLabel.toLowerCase()}) design; island cabinets receive finished back
            panels automatically, split into panels of {MAX_PANEL_W}″ max. Appliances shown for visual reference are not
            priced.
          </p>
        )}
        {showPricing && isNewAge && (
          <p className="report-note">
            NewAge Products modular units are factory-built at set sizes with integrated handles — prices shown are the
            per-SKU retail prices for the selected door &amp; finish. Grills, kamados and fridges are sold separately unless
            selected above. Countertop pricing is an estimate; the final order is assembled from NewAge's fixed-size
            stainless tops.
          </p>
        )}

        {(() => {
          const wf = lines
            .filter((l) => l.it.waterfallL || l.it.waterfallR)
            .map((l) => `#${l.n} ${[l.it.waterfallL ? 'left' : '', l.it.waterfallR ? 'right' : ''].filter(Boolean).join(' & ')}`);
          return wf.length ? (
            <p className="report-note">
              <b>Waterfall countertop edges:</b> {wf.join(', ')} — the countertop wraps down the side to the floor in the{' '}
              {fmtIn(design.counterThickness)} slab.
            </p>
          ) : null;
        })()}
      </section>
    </div>
  );
}

const ROUGHIN_LABEL: Record<RoughInKind, string> = {
  plumbing: 'Plumbing stub-out',
  electrical: 'Electrical outlet',
  gas: 'Gas stub-out',
};

/**
 * A dedicated report page listing every plumbing / electrical / gas rough-in with
 * the measurements a trade needs to set them: horizontal distance from each wall
 * end and the height off the finished floor, both to the CENTER of the stub, plus
 * the opening size. Each wall that carries rough-ins gets a dimensioned elevation.
 */
function RoughInSchedule({ design, numbers }: { design: Design; numbers: Map<string, number> }) {
  const wallsWithRough = design.walls
    .map((wall, i) => ({
      wall,
      letter: String.fromCharCode(65 + i),
      rough: design.roughIns.filter((r) => r.wallId === wall.id).sort((a, b) => a.x - b.x),
    }))
    .filter((w) => w.rough.length > 0);

  // Flat, wall-ordered list for the measurement table.
  const rows = wallsWithRough.flatMap(({ wall, letter, rough }) =>
    rough.map((r) => {
      const host = roughInHost(design, r);
      return {
        r,
        wall,
        letter,
        hostNum: host ? numbers.get(host.id) ?? null : null,
        conflict: roughInConflict(design, r),
      };
    }),
  );

  return (
    <section className="report-page">
      <h2>Rough-In Schedule</h2>
      <p className="report-note">
        All measurements are to the <b>center</b> of each stub-out. Horizontal distances are along the wall from the noted
        end; heights are from the finished floor.
      </p>

      {wallsWithRough.map(({ wall, letter, rough }) => (
        <div className="report-figure" key={wall.id} style={{ marginBottom: 18 }}>
          <h3 style={{ margin: '0 0 6px', fontSize: 14 }}>
            Rough-In Elevation {letter} — {wall.name}
          </h3>
          <RoughInWallDiagram wall={wall} rough={rough} design={design} numbers={numbers} />
        </div>
      ))}

      <table className="schedule" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>Type</th>
            <th>Wall</th>
            <th>Behind</th>
            <th className="num">From left</th>
            <th className="num">From right</th>
            <th className="num">Ctr. height</th>
            <th className="num">Bottom</th>
            <th className="num">Opening (W × H)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ r, wall, letter, hostNum, conflict }) => (
            <tr key={r.id}>
              <td>{ROUGHIN_LABEL[r.kind]}</td>
              <td>
                {letter} — {wall.name}
              </td>
              <td>{hostNum != null ? `Cabinet ${hostNum}` : conflict ? 'Not behind a cabinet' : 'Open wall'}</td>
              <td className="num">{fmtIn(r.x)}</td>
              <td className="num">{fmtIn(Math.max(0, wall.length - r.x))}</td>
              <td className="num">{fmtIn(r.y)}</td>
              <td className="num">{fmtIn(Math.max(0, r.y - r.h / 2))}</td>
              <td className="num">
                {fmtIn(r.w)} × {fmtIn(r.h)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Dimensioned elevation for a single wall's rough-ins: each stub carries a
 *  height dimension (floor → center, stacked on the left) and a from-left
 *  distance (stacked below the floor), with faint base-cabinet context. */
function RoughInWallDiagram({ wall, rough, design, numbers }: { wall: Wall; rough: RoughIn[]; design: Design; numbers: Map<string, number> }) {
  const floorY = wall.height;
  const leftPad = 12 + rough.length * 5; // stacked vertical (height) dims
  const rightPad = 8;
  const topPad = 6;
  const bottomPad = 14 + rough.length * 5; // stacked horizontal (from-left) dims + overall
  const viewW = wall.length + leftPad + rightPad;
  const viewH = wall.height + topPad + bottomPad;

  const floorItems = design.items.filter((it) => it.wallId === wall.id && catalogById(it.catalogId).lane === 'floor');
  const overallY = floorY + 9 + rough.length * 5;

  return (
    <svg viewBox={`${-leftPad} ${-topPad} ${viewW} ${viewH}`} style={{ width: '100%', display: 'block', fontFamily: 'inherit' }} className="elevation-svg">
      {!wall.ghost && <rect x={0} y={0} width={wall.length} height={wall.height} fill="#fbfbfc" stroke="#e3e6ea" strokeWidth={0.3} />}
      <line x1={-leftPad} y1={floorY} x2={wall.length + rightPad} y2={floorY} stroke="#c9cdd3" strokeWidth={0.5} />

      {/* faint base-cabinet silhouettes for context */}
      {floorItems.map((it) => {
        const w = footprintW(it);
        const n = numbers.get(it.id);
        return (
          <g key={it.id}>
            <rect x={it.x} y={floorY - it.h} width={w} height={it.h} fill="#f1f2f4" stroke="#dfe2e6" strokeWidth={0.3} />
            {n != null && (
              <text x={it.x + w / 2} y={floorY - it.h / 2} textAnchor="middle" dominantBaseline="central" fontSize={4} fill="#b6bcc4">
                {n}
              </text>
            )}
          </g>
        );
      })}

      {rough.map((r, i) => {
        const cyc = floorY - r.y; // stub center, svg y
        const colX = -3 - i * 5; // vertical-dim column in the left margin
        const rowY = floorY + 7 + i * 5; // horizontal-dim row below the floor
        const conflict = roughInConflict(design, r);
        return (
          <g key={r.id}>
            {/* guide lines linking the stub to its dimensions */}
            <line x1={colX} y1={cyc} x2={r.x} y2={cyc} stroke="#b9bec7" strokeWidth={0.2} strokeDasharray="1.2 1" />
            <line x1={r.x} y1={cyc} x2={r.x} y2={rowY} stroke="#b9bec7" strokeWidth={0.2} strokeDasharray="1.2 1" />
            <g transform={`translate(${r.x - r.w / 2} ${cyc - r.h / 2})`}>
              <RoughInGlyph kind={r.kind} w={r.w} h={r.h} conflict={conflict} />
            </g>
            <circle cx={r.x} cy={cyc} r={0.5} fill="#5b6472" />
            <DimV y1={cyc} y2={floorY} x={colX} label={fmtIn(r.y)} />
            <DimH x1={0} x2={r.x} y={rowY} label={fmtIn(r.x)} />
          </g>
        );
      })}

      {/* overall wall length */}
      <DimH x1={0} x2={wall.length} y={overallY} />
    </svg>
  );
}
