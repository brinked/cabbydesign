// Builds a multi-page PDF of the design report in the browser (cover, floor
// plan, wall elevations, item schedule) so it can be attached to quote emails.
// The figures are scraped from the mounted Report DOM: each SVG is serialized
// (with the shared <defs> injected so gradients/patterns resolve) and
// rasterized onto a canvas, then placed into the PDF. jsPDF loads lazily so it
// only ships when someone actually submits a quote.
import type { OrderLine } from '../api/client';

/** Letter portrait, points. */
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 48;
const INNER_W = PAGE_W - MARGIN * 2;

interface Figure {
  title: string;
  svg: SVGSVGElement;
}

/** jsPDF's built-in fonts miss the prime marks the app uses for inches (″) —
 *  swap them for ASCII so sizes don't render as garbage glyphs. */
function clean(s: string): string {
  return s.replace(/[″”]/g, '"').replace(/[′’]/g, "'");
}

/** Rasterize an SVG element to a white-background JPEG data URL. */
async function svgToJpeg(svg: SVGSVGElement, maxPx = 1600): Promise<{ url: string; w: number; h: number } | null> {
  try {
    const vb = svg.viewBox.baseVal;
    const w = vb && vb.width > 0 ? vb.width : svg.clientWidth;
    const h = vb && vb.height > 0 ? vb.height : svg.clientHeight;
    if (!w || !h) return null;

    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
    // Standalone SVGs lose the page's CSS. The app's SVG roots carry inline
    // `font-family: inherit`, which would resolve to the default serif here —
    // override it on the clone's own style (style beats the attribute form).
    clone.style.fontFamily = 'Arial, Helvetica, sans-serif';
    // Inject the app-wide gradient/pattern defs the figures reference by id.
    const shared = document.getElementById('svg-shared-defs');
    const sharedDefs = shared?.querySelector('defs');
    if (sharedDefs) clone.insertBefore(sharedDefs.cloneNode(true), clone.firstChild);

    const xml = new XMLSerializer().serializeToString(clone);
    const blobUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('svg rasterize failed'));
        img.src = blobUrl;
      });
      const scale = Math.min(maxPx / w, maxPx / h, 4);
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return { url: canvas.toDataURL('image/jpeg', 0.9), w: canvas.width, h: canvas.height };
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  } catch {
    return null;
  }
}

/** The report's figures: the floor plan + one elevation per wall, with the
 *  section headings they appear under. */
function collectFigures(): Figure[] {
  const out: Figure[] = [];
  for (const section of document.querySelectorAll('.report .report-page')) {
    const svg = section.querySelector<SVGSVGElement>('.report-figure svg');
    if (!svg) continue;
    out.push({ title: clean(section.querySelector('h2')?.textContent ?? 'Drawing'), svg });
  }
  return out;
}

/** Cover details as shown on the report cover page. */
function collectCover(): { title: string; sub: string; meta: string[] } {
  const cover = document.querySelector('.report .report-cover');
  return {
    title: clean(cover?.querySelector('h1')?.textContent ?? 'Design'),
    sub: clean(cover?.querySelector('.cover-sub')?.textContent ?? ''),
    meta: [...(cover?.querySelectorAll('.cover-meta div') ?? [])].map((d) => clean(d.textContent ?? '')).filter(Boolean),
  };
}

/**
 * Build the report PDF from the currently mounted Report page.
 * Returns base64 (no data: prefix), or null if generation fails.
 */
export async function buildReportPdf(lines: OrderLine[]): Promise<string | null> {
  try {
    const { jsPDF } = await import('jspdf');
    const doc = new jsPDF({ unit: 'pt', format: 'letter' });
    const cover = collectCover();
    const snapshot = document.querySelector<HTMLImageElement>('.report .cover-render')?.src ?? null;

    // ---------- cover ----------
    let y = 120;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor('#5b5bd6');
    doc.text('CABDESIGN — DESIGN REPORT', MARGIN, y);
    y += 34;
    doc.setFontSize(26);
    doc.setTextColor('#1f2430');
    const titleLines = doc.splitTextToSize(cover.title, INNER_W) as string[];
    doc.text(titleLines, MARGIN, y);
    y += titleLines.length * 30 + 4;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    doc.setTextColor('#5b6472');
    if (cover.sub) {
      doc.text(cover.sub, MARGIN, y);
      y += 26;
    }
    for (const m of cover.meta) {
      doc.text(m, MARGIN, y);
      y += 17;
    }
    if (snapshot) {
      try {
        const props = doc.getImageProperties(snapshot);
        const iw = Math.min(INNER_W, 460);
        const ih = (props.height / props.width) * iw;
        doc.addImage(snapshot, 'PNG', MARGIN, y + 14, iw, Math.min(ih, PAGE_H - y - MARGIN - 14));
      } catch {
        /* snapshot is optional */
      }
    }

    // ---------- floor plan + elevations ----------
    for (const fig of collectFigures()) {
      const img = await svgToJpeg(fig.svg);
      if (!img) continue;
      doc.addPage();
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.setTextColor('#1f2430');
      doc.text(fig.title, MARGIN, MARGIN + 8);
      const maxH = PAGE_H - MARGIN * 2 - 30;
      const scale = Math.min(INNER_W / img.w, maxH / img.h);
      doc.addImage(img.url, 'JPEG', MARGIN, MARGIN + 26, img.w * scale, img.h * scale);
    }

    // ---------- item schedule ----------
    const showPrices = lines.some((l) => l.price);
    const cols = showPrices
      ? [
          { key: 'n', label: '#', x: MARGIN, w: 26 },
          { key: 'name', label: 'Item', x: MARGIN + 30, w: 226 },
          { key: 'location', label: 'Location', x: MARGIN + 262, w: 96 },
          { key: 'size', label: 'Size (W × D × H)', x: MARGIN + 364, w: 92 },
          { key: 'price', label: 'Price', x: MARGIN + 462, w: INNER_W - 462, right: true },
        ]
      : [
          { key: 'n', label: '#', x: MARGIN, w: 26 },
          { key: 'name', label: 'Item', x: MARGIN + 30, w: 250 },
          { key: 'location', label: 'Location', x: MARGIN + 286, w: 110 },
          { key: 'size', label: 'Size (W × D × H)', x: MARGIN + 402, w: INNER_W - 402 },
        ];
    doc.addPage();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.text('Item Schedule', MARGIN, MARGIN + 8);
    let ty = MARGIN + 36;
    const header = () => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor('#5b6472');
      for (const c of cols) doc.text(c.label, 'right' in c && c.right ? c.x + c.w : c.x, ty, 'right' in c && c.right ? { align: 'right' } : undefined);
      ty += 8;
      doc.setDrawColor('#e3e6ea');
      doc.line(MARGIN, ty, PAGE_W - MARGIN, ty);
      ty += 14;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor('#1f2430');
    };
    header();
    for (const l of lines) {
      const nameLines = doc.splitTextToSize(clean(l.name), cols[1].w) as string[];
      const rowH = Math.max(1, nameLines.length) * 12 + 6;
      if (ty + rowH > PAGE_H - MARGIN) {
        doc.addPage();
        ty = MARGIN + 12;
        header();
      }
      doc.text(String(l.n ?? ''), cols[0].x, ty);
      doc.text(nameLines, cols[1].x, ty);
      doc.text(clean(l.location), cols[2].x, ty);
      doc.text(clean(l.size), cols[3].x, ty);
      if (showPrices) {
        const c = cols[4];
        doc.text(clean(l.price) || '—', c.x + c.w, ty, { align: 'right' });
      }
      ty += rowH;
    }

    return doc.output('datauristring').split(',')[1] ?? null;
  } catch {
    return null;
  }
}
