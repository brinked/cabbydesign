import { Fragment } from 'react';
import { TOEKICK_H, catalogById } from '../model/catalog';
import { money } from '../model/pricing';
import { appliancePrice } from '../model/appliances';
import { PANEL_RATE_PER_SQFT, itemNumbers, itemOnIsland, itemPrice, reservesFor, useStore } from '../state/store';
import { useSession } from '../state/session';
import { MAX_PANEL_W } from '../three/cabinet3d';
import { TopViewSvg } from './TopView';
import { WallElevationSvg, useFinish } from './WallsView';
import { fmtIn } from './svg';

export default function Report() {
  const design = useStore((s) => s.design);
  const pricing = useStore((s) => s.pricing);
  const snapshot = useStore((s) => s.snapshot3d);
  const setTab = useStore((s) => s.setTab);
  const appliances = useStore((s) => s.appliances);
  const applianceBrands = useStore((s) => s.applianceBrands);
  const prefs = useSession((s) => s.prefs);
  const taxRate = useSession((s) => s.taxRate);
  const logo = useSession((s) => s.user?.logo) ?? '';
  const fin = useFinish(design.finishId);
  const numbers = itemNumbers(design);

  // Dealer pricing preferences. Default to showing marked-up pricing.
  const showPricing = prefs?.showPricing ?? true;
  const priceMode = prefs?.priceMode ?? 'marked_up';
  const isMarkedUp = priceMode === 'marked_up';
  // percent markup multiplies; flat markup adds a fixed $ to each cabinet line.
  const factor = isMarkedUp && prefs?.markupMode !== 'flat' ? 1 + (prefs?.marginPct ?? 0) / 100 : 1;
  const flatPerCab = isMarkedUp && prefs?.markupMode === 'flat' ? prefs?.flatAmount ?? 0 : 0;
  const taxExempt = prefs?.taxExempt ?? false;
  // panels mark up by percent only (flat is "per cabinet"); cabinets add the flat.
  const panelMk = (n: number) => money(n * factor);
  const cabMk = (n: number) => money(n * factor + flatPerCab);

  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const designName = design.doorStyle === 'shaker' ? 'Vibe' : 'Euro';
  const rate = PANEL_RATE_PER_SQFT;

  // Cabinet line items (cabinet price only — panels are itemized separately).
  const lines = [...design.items]
    .sort((a, b) => (numbers.get(a.id) ?? 0) - (numbers.get(b.id) ?? 0))
    .map((it) => {
      const cat = catalogById(it.catalogId);
      const p = itemPrice(design, it, pricing);
      const wall = design.walls.find((w) => w.id === it.wallId);
      // cabinet line = box (drawers/add-ons baked into the formula) + trays
      const price = p.cabinet + p.trays;
      return { it, cat, wall, price, error: p.error, n: numbers.get(it.id) ?? 0 };
    });
  const cabinetSubtotal = lines.reduce((s, l) => s + (l.error ? 0 : l.price), 0);
  const hasErrors = lines.some((l) => l.error);

  // Applied end panels — grouped by size (depth × panel height), with quantity.
  const panelH = (it: (typeof design.items)[number]) => {
    const cat = catalogById(it.catalogId);
    return Math.max(0, it.h - (cat.lane === 'floor' ? TOEKICK_H : 0));
  };
  const endGroups = new Map<string, { w: number; h: number; qty: number; unit: number; nums: Set<number> }>();
  for (const it of design.items) {
    const cat = catalogById(it.catalogId);
    if (cat.category === 'appliance') continue;
    const nEnds = (it.endL ? 1 : 0) + (it.endR ? 1 : 0);
    if (!nEnds) continue;
    const h = panelH(it);
    const key = `${it.d}x${h}`;
    const unit = Math.round(((it.d * h) / 144) * rate * 100) / 100;
    const g = endGroups.get(key) ?? { w: it.d, h, qty: 0, unit, nums: new Set<number>() };
    g.qty += nEnds;
    g.nums.add(numbers.get(it.id) ?? 0);
    endGroups.set(key, g);
  }
  const endRows = [...endGroups.values()]
    .map((g) => ({ ...g, nums: [...g.nums].sort((a, b) => a - b) }))
    .sort((a, b) => b.w * b.h - a.w * a.h);
  const endSubtotal = endRows.reduce((s, g) => s + g.unit * g.qty, 0);

  // Applied back panels (islands) — combined into a single summed line.
  let backCount = 0;
  let backArea = 0;
  for (const it of design.items) {
    const cat = catalogById(it.catalogId);
    if (cat.category === 'appliance' || !itemOnIsland(design, it)) continue;
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

  // Marked-up subtotals (percent factor, plus a flat $ on each priced cabinet).
  const pricedCabCount = lines.filter((l) => l.cat.category !== 'appliance' && !l.error).length;
  const cabinetSubtotalMk = cabinetSubtotal * factor + flatPerCab * pricedCabCount;
  const panelSubtotalMk = (endSubtotal + backSubtotal) * factor;
  const subtotalMk = cabinetSubtotalMk + panelSubtotalMk + applianceSubtotal;
  const taxAmount = isMarkedUp && !taxExempt ? (subtotalMk * taxRate) / 100 : 0;
  const grandTotal = subtotalMk + taxAmount;

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
          <button className="btn-primary" onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* Cover */}
      <section className="report-page report-cover">
        {logo && <img className="cover-logo" src={logo} alt="Company logo" />}
        <div className="cover-rule" />
        <h1>{design.name || 'Untitled Design'}</h1>
        <p className="cover-sub">
          {design.client ? `Prepared for ${design.client} · ` : ''}
          {date}
        </p>
        <p className="cover-meta">Finish: {fin.name}</p>
        {snapshot && <img className="cover-render" src={snapshot} alt="3D rendering" />}
        <p className="cover-foot">Design Report — plan, elevations &amp; estimate</p>
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

      {/* Schedule & pricing */}
      <section className="report-page">
        <h2>Item Schedule &amp; Estimate</h2>
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
                <td>{l.cat.name}</td>
                <td>{l.wall?.name ?? '—'}</td>
                <td>
                  {fmtIn(l.it.w)} × {fmtIn(l.it.d)} × {fmtIn(l.it.h)}
                </td>
                {showPricing && (
                  <td className="num">{l.cat.category === 'appliance' ? '—' : l.error ? 'formula error' : cabMk(l.price)}</td>
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
                    Applied End Panel <span className="panel-cabs">(cabinet {g.nums.join(', ')})</span>
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

        {showPricing && (
          <p className="report-note">
            Applied end and back panels bill at {money(rate * factor)}/sq ft (panel height excludes the 4″ toe kick) in the{' '}
            {designName} ({design.doorStyle === 'shaker' ? 'shaker' : 'flat'}) design; island cabinets receive finished back
            panels automatically, split into panels of {MAX_PANEL_W}″ max. Appliances shown for visual reference are not
            priced.
          </p>
        )}
      </section>
    </div>
  );
}
