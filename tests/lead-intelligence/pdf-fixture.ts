/**
 * Builds a tiny, valid PDF (Helvetica text at absolute positions + URI link annotations) for offline tests.
 * Used to mimic the FSAI enforcement-order table layout with synthetic businesses; no real FSAI data is committed.
 */
export type FixtureText = { s: string; x: number; y: number };
export type FixtureLink = { url: string; rect: [number, number, number, number] };
export type FixturePage = { texts: FixtureText[]; links?: FixtureLink[] };

const esc = (s: string) => s.replace(/[\\()]/g, m => `\\${m}`).replace(/[^\x20-\x7e]/g, c => {
  const code = c.charCodeAt(0); return code < 256 ? `\\${code.toString(8).padStart(3, "0")}` : "?";
});

export function buildPdf(pages: FixturePage[], size: [number, number] = [842, 595]): Uint8Array {
  const objects: string[] = [];
  const add = (body: string) => { objects.push(body); return objects.length; };
  const catalog = add(""); const pagesObj = add(""); const font = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
  const kids: number[] = [];
  for (const p of pages) {
    const stream = p.texts.map(t => `BT /F1 8 Tf ${t.x} ${t.y} Td (${esc(t.s)}) Tj ET`).join("\n");
    const content = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
    const annots = (p.links ?? []).map(l => add(`<< /Type /Annot /Subtype /Link /Rect [${l.rect.join(" ")}] /Border [0 0 0] /A << /S /URI /URI (${esc(l.url)}) >> >>`));
    kids.push(add(`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${size[0]} ${size[1]}] /Resources << /Font << /F1 ${font} 0 R >> >> /Contents ${content} 0 R${annots.length ? ` /Annots [${annots.map(a => `${a} 0 R`).join(" ")}]` : ""} >>`));
  }
  objects[catalog - 1] = `<< /Type /Catalog /Pages ${pagesObj} 0 R >>`;
  objects[pagesObj - 1] = `<< /Type /Pages /Kids [${kids.map(k => `${k} 0 R`).join(" ")}] /Count ${kids.length} >>`;
  let out = "%PDF-1.4\n"; const offsets: number[] = [];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(out, "latin1")); out += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.map(o => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

const ddmmyyyy = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
export type FixtureOrder = { served: Date; lifted?: Date | null; premises: string[]; address: string[]; county: string; servedOn: string[]; businessType: string[]; orderUrl?: string };

/** One page in the FSAI Closure/Prohibition layout (x positions copied from the live PDF header). */
export function fsaiPage(orders: FixtureOrder[], withHeader = true): FixturePage {
  const texts: FixtureText[] = []; const links: FixtureLink[] = [];
  if (withHeader) {
    texts.push({ s: "Closure Orders", x: 338, y: 556 },
      { s: "Date Served", x: 32, y: 474 }, { s: "Date Lifted", x: 101, y: 474 }, { s: "Premises", x: 169, y: 474 }, { s: "Address", x: 259, y: 474 },
      { s: "County", x: 388, y: 474 }, { s: "Served On", x: 459, y: 474 }, { s: "Business", x: 510, y: 474 }, { s: "Type", x: 510, y: 462 },
      { s: "Issuing Agency", x: 569, y: 474 }, { s: "Legislation", x: 661, y: 474 }, { s: "Enforcement", x: 722, y: 474 }, { s: "Order", x: 722, y: 462 });
  }
  let y = withHeader ? 445 : 520;
  for (const o of orders) {
    const col = (x: number, lines: string[]) => lines.forEach((s, i) => texts.push({ s, x, y: y - i * 11 }));
    col(32, [ddmmyyyy(o.served)]); if (o.lifted) col(101, [ddmmyyyy(o.lifted)]);
    col(169, o.premises); col(259, o.address); col(388, [o.county]); col(459, o.servedOn); col(510, o.businessType);
    col(569, ["Health Service", "Executive"]); col(661, ["FSAI Act 1998"]); col(722, ["Closure Order"]);
    if (o.orderUrl) links.push({ url: o.orderUrl, rect: [722, y - 12, 788, y + 10] });
    y -= 11 * Math.max(o.premises.length, o.address.length, o.servedOn.length, o.businessType.length, 2) + 15;
  }
  texts.push({ s: "Page : 1 of 1", x: 700, y: 30 });
  return { texts, links };
}
