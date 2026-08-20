#!/usr/bin/env python3
"""
Generates the free template library artefacts from the TypeScript catalog.

    bun run scripts/dump-templates.ts > /tmp/templates.json
    python3 scripts/build_templates.py [slug ...]

Writes public/templates/<slug>.pdf, .xlsx and .csv. Output is committed to the
repo on purpose: Vercel has no Chrome, so nothing can be rendered at request or
build time, and static files are CDN-cached for free.

Pass one or more slugs to build a subset (used for design previews).
"""

import base64
import csv
import html
import json
import os
import subprocess
import sys
import tempfile

import xlsxwriter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "public", "templates")
CATALOG = "/tmp/templates.json"

NAVY = "#0f1c35"
NAVY_DEEP = "#0A1427"
FLAME_A = "#ff6b35"
FLAME_B = "#e8365d"
INK = "#101826"
MUTED = "#5b6879"
LINE = "#c8d0dc"
ZEBRA = "#f4f6f9"

CHROME = "/usr/bin/google-chrome"


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #

def logo_data_uri():
    path = os.path.join(ROOT, "public", "logo-white-trans.png")
    with open(path, "rb") as fh:
        return "data:image/png;base64," + base64.b64encode(fh.read()).decode()


def esc(s):
    return html.escape(s, quote=True)


def cols_for(sheet, include_extra=False):
    cols = list(sheet.get("columns") or [])
    if include_extra:
        cols += list(sheet.get("extraColumns") or [])
    return cols


# --------------------------------------------------------------------------- #
# PDF (branded HTML -> headless Chrome)
# --------------------------------------------------------------------------- #

CSS = """
@page {{ size: A4 {orient}; margin: 0; }}
* {{ box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
html, body {{ margin: 0; padding: 0; font-family: 'Barlow', Arial, sans-serif; color: {ink}; }}
.page {{ padding: 0 0 10mm 0; }}
.band {{ background: {navy}; color: #fff; padding: 7mm 10mm 6mm 10mm; }}
.band .top {{ display: flex; align-items: center; justify-content: space-between; }}
.band img {{ height: 7mm; }}
.tag {{ font-size: 8pt; letter-spacing: .16em; text-transform: uppercase;
        color: #b9c4d6; font-weight: 600; }}
h1 {{ font-size: {h1}pt; line-height: 1.1; margin: 4mm 0 1.5mm 0; font-weight: 700; }}
.sub {{ font-size: 8.5pt; color: #b9c4d6; margin: 0; }}
.rule {{ height: 1.6mm; background: linear-gradient(90deg, {fa}, {fb}); }}
.body {{ padding: 6mm 10mm 0 10mm; }}
.fields {{ display: flex; gap: 4mm; margin-bottom: 5mm; align-items: flex-end; }}
.field {{ flex: 1; }}
.field .lab {{ font-size: 7.5pt; text-transform: uppercase; letter-spacing: .1em;
               color: {muted}; font-weight: 600; margin-bottom: 1mm; }}
.field .box {{ border: 0.35mm solid {line}; border-radius: 1.2mm; height: 8mm; }}
table {{ width: 100%; border-collapse: collapse; }}
th {{ background: {navy}; color: #fff; text-align: left; padding: 2mm 1.8mm;
      font-size: 8pt; font-weight: 600; border: 0.3mm solid {navy}; vertical-align: top; }}
th .hint {{ display: block; font-size: 6.5pt; font-weight: 400; color: #a9b6ca;
            margin-top: .6mm; line-height: 1.15; }}
td {{ border: 0.3mm solid {line}; height: {rowh}mm; padding: 1.4mm 1.8mm;
      font-size: 8.5pt; vertical-align: middle; }}
tr:nth-child(even) td {{ background: {zebra}; }}
td.task {{ font-size: 8.5pt; }}
tr.section td {{ background: {navy_deep}; color: #fff; font-weight: 700; height: 6mm;
                 font-size: 8pt; text-transform: uppercase; letter-spacing: .08em; }}
tr.section td {{ border-color: {navy_deep}; }}
.steps {{ margin: 0; padding: 0; list-style: none; }}
.steps li {{ display: flex; gap: 3mm; padding: 2.2mm 0; border-bottom: 0.3mm solid {line};
             font-size: 9.5pt; line-height: 1.35; }}
.steps .n {{ flex: 0 0 6mm; height: 6mm; border-radius: 50%;
             background: linear-gradient(135deg, {fa}, {fb}); color: #fff;
             font-size: 8pt; font-weight: 700; display: flex; align-items: center;
             justify-content: center; }}
.grp {{ font-size: 9pt; font-weight: 700; text-transform: uppercase;
        letter-spacing: .08em; color: {navy}; margin: 4mm 0 2mm 0; }}
.formrow {{ display: flex; align-items: flex-end; gap: 3mm; margin-bottom: 3.2mm; }}
.formrow .lab {{ flex: 0 0 58mm; font-size: 8.5pt; font-weight: 600; }}
.formrow .line {{ flex: 1; border-bottom: 0.3mm solid {line}; height: 6.5mm; }}
.notes {{ margin-top: 5mm; padding: 3mm 4mm; background: {zebra};
          border-left: 1.2mm solid {fa}; border-radius: 0 1.2mm 1.2mm 0; }}
.notes p {{ margin: 0 0 1.4mm 0; font-size: 7.5pt; color: {muted}; line-height: 1.35; }}
.notes p:last-child {{ margin-bottom: 0; }}
.foot {{ display: flex; justify-content: space-between; align-items: baseline;
         margin-top: 4mm; font-size: 7pt; color: {muted}; }}
.foot b {{ color: {navy}; font-weight: 700; }}
"""


def build_html(t, logo, rowh):
    sheet = t["sheet"]
    land = sheet["orientation"] == "landscape"
    cols = cols_for(sheet)
    ncols = max(len(cols), 1)
    css = CSS.format(
        orient="landscape" if land else "portrait",
        ink=INK, navy=NAVY, navy_deep=NAVY_DEEP, fa=FLAME_A, fb=FLAME_B,
        muted=MUTED, line=LINE, zebra=ZEBRA, rowh=rowh,
        h1=19 if land else 17,
    )

    fields = "".join(
        f'<div class="field"><div class="lab">{esc(f)}</div><div class="box"></div></div>'
        for f in sheet["headerFields"]
    )

    parts = []
    if sheet["kind"] in ("log", "checklist"):
        head = "".join(
            f'<th style="width:{(c.get("width") or 2) * 100 / sum((x.get("width") or 2) for x in cols):.2f}%">'
            f'{esc(c["name"])}'
            + (f'<span class="hint">{esc(c["hint"])}</span>' if c.get("hint") else "")
            + "</th>"
            for c in cols
        )
        rows = []
        if sheet["kind"] == "log":
            for _ in range(sheet.get("rowCount") or 12):
                rows.append("<tr>" + "<td></td>" * ncols + "</tr>")
        else:
            for sec in sheet.get("sections") or []:
                rows.append(
                    f'<tr class="section"><td colspan="{ncols}">{esc(sec["title"])}</td></tr>'
                )
                for r in sec["rows"]:
                    rows.append(
                        f'<tr><td class="task">{esc(r)}</td>'
                        + "<td></td>" * (ncols - 1)
                        + "</tr>"
                    )
        parts.append(f"<table><thead><tr>{head}</tr></thead><tbody>{''.join(rows)}</tbody></table>")
    elif sheet["kind"] == "form":
        for sec in sheet.get("sections") or []:
            parts.append(f'<div class="grp">{esc(sec["title"])}</div>')
            for r in sec["rows"]:
                parts.append(
                    f'<div class="formrow"><div class="lab">{esc(r)}</div>'
                    f'<div class="line"></div></div>'
                )
    else:  # guide
        for sec in sheet.get("sections") or []:
            parts.append(f'<div class="grp">{esc(sec["title"])}</div><ul class="steps">')
            for i, r in enumerate(sec["rows"], 1):
                parts.append(f'<li><span class="n">{i}</span><span>{esc(r)}</span></li>')
            parts.append("</ul>")

    notes = "".join(f"<p>{esc(n)}</p>" for n in sheet["footerNotes"])

    return f"""<!doctype html><html><head><meta charset="utf-8">
<title>{esc(t['name'])}</title><style>{css}</style></head><body>
<div class="page">
  <div class="band">
    <div class="top">
      <img src="{logo}" alt="Rotahr">
      <div class="tag">Free template &middot; rotahr.com/templates</div>
    </div>
    <h1>{esc(t['name'])}</h1>
    <p class="sub">{esc(t['metaDescription'])}</p>
  </div>
  <div class="rule"></div>
  <div class="body">
    <div class="fields">{fields}</div>
    {''.join(parts)}
    <div class="notes">{notes}</div>
    <div class="foot">
      <span>Free to print, copy and use in your venue. No attribution required.</span>
      <span><b>Rotahr</b> &middot; rota, HACCP, stock and payroll in one app &middot; rotahr.com</span>
    </div>
  </div>
</div></body></html>"""


def page_count(path):
    r = subprocess.run(["pdfinfo", path], capture_output=True, text=True)
    for line in r.stdout.splitlines():
        if line.startswith("Pages:"):
            return int(line.split(":")[1])
    return 0


def render_pdf(t, logo, rowh, out):
    with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as fh:
        fh.write(build_html(t, logo, rowh))
        src = fh.name
    cmd = [
        CHROME, "--headless", "--disable-gpu", "--no-sandbox",
        "--no-pdf-header-footer", "--virtual-time-budget=3000",
        f"--print-to-pdf={out}", "file://" + src,
    ]
    r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    os.unlink(src)
    if not os.path.exists(out) or os.path.getsize(out) < 2000:
        raise RuntimeError(f"pdf failed for {t['slug']}: {r.stderr[-800:]}")


def build_pdf(t, logo):
    """Renders, then shrinks the row height until the sheet fits one page.

    A one-page sheet is the whole point — a temperature log that prints as two
    pages gets half filled in and the second page gets lost.
    """
    out = os.path.join(OUT_DIR, t["slug"] + ".pdf")
    land = t["sheet"]["orientation"] == "landscape"
    ladder = [8.0, 7.4, 7.0, 6.6, 6.2, 5.8, 5.4, 5.0, 4.6] if land else \
             [8.5, 8.0, 7.5, 7.0, 6.6, 6.2, 5.8, 5.4, 5.0, 4.6]
    for rowh in ladder:
        render_pdf(t, logo, rowh, out)
        if page_count(out) <= 1:
            return out
    print(f"  !!  {t['slug']} still spills onto a second page — trim its rows")
    return out


# --------------------------------------------------------------------------- #
# XLSX
# --------------------------------------------------------------------------- #

def build_xlsx(t):
    sheet = t["sheet"]
    cols = cols_for(sheet, include_extra=True)
    out = os.path.join(OUT_DIR, t["slug"] + ".xlsx")
    wb = xlsxwriter.Workbook(out)
    ws = wb.add_worksheet(t["name"][:31])

    f_title = wb.add_format({"bold": True, "font_size": 16, "font_color": "#FFFFFF",
                             "bg_color": NAVY, "font_name": "Barlow", "valign": "vcenter",
                             "indent": 1})
    f_sub = wb.add_format({"font_size": 9, "font_color": "#5b6879", "font_name": "Barlow",
                           "italic": True, "text_wrap": True, "valign": "top"})
    f_lab = wb.add_format({"bold": True, "font_size": 10, "font_name": "Barlow",
                           "font_color": NAVY})
    f_in = wb.add_format({"bottom": 1, "border_color": LINE, "font_name": "Barlow"})
    f_head = wb.add_format({"bold": True, "font_size": 10, "font_color": "#FFFFFF",
                            "bg_color": NAVY, "font_name": "Barlow", "text_wrap": True,
                            "valign": "vcenter", "align": "left", "border": 1,
                            "border_color": NAVY})
    f_cell = wb.add_format({"border": 1, "border_color": LINE, "font_name": "Barlow",
                            "font_size": 10, "valign": "vcenter", "text_wrap": True})
    f_cellz = wb.add_format({"border": 1, "border_color": LINE, "font_name": "Barlow",
                             "font_size": 10, "valign": "vcenter", "bg_color": ZEBRA,
                             "text_wrap": True})
    f_sec = wb.add_format({"bold": True, "font_size": 10, "font_color": "#FFFFFF",
                           "bg_color": NAVY_DEEP, "font_name": "Barlow", "border": 1,
                           "border_color": NAVY_DEEP, "valign": "vcenter"})
    f_note = wb.add_format({"font_size": 9, "font_color": "#5b6879", "font_name": "Barlow",
                            "text_wrap": True, "valign": "top"})
    f_time = wb.add_format({"border": 1, "border_color": LINE, "font_name": "Barlow",
                           "font_size": 10, "valign": "vcenter", "num_format": "hh:mm"})

    ncols = max(len(cols), 4)
    last = ncols - 1

    ws.set_row(0, 30)
    ws.merge_range(0, 0, 0, last, t["name"], f_title)
    ws.set_row(1, 26)
    ws.merge_range(1, 0, 1, last, t["metaDescription"], f_sub)

    r = 3
    for i, fld in enumerate(sheet["headerFields"]):
        ws.write(r, 0, fld, f_lab)
        span_end = min(last, 3)
        if span_end > 1:
            ws.merge_range(r, 1, r, span_end, "", f_in)
        else:
            ws.write_blank(r, 1, "", f_in)
        r += 1
    r += 1

    widths = [(c.get("width") or 2) for c in cols] or [2, 2, 2, 2]
    for i, w in enumerate(widths):
        ws.set_column(i, i, 6 + w * 5.2)

    header_row = None
    if sheet["kind"] in ("log", "checklist"):
        header_row = r
        ws.set_row(r, 34)
        for i, c in enumerate(cols):
            label = c["name"] + (f"\n({c['hint']})" if c.get("hint") else "")
            ws.write(r, i, label, f_head)
        r += 1

        names = [c["name"].lower() for c in cols]
        try:
            i_start = names.index("start time")
            i_end = names.index("end time")
            i_el = names.index("elapsed")
        except ValueError:
            i_start = i_end = i_el = -1

        def data_row(rr, first_val=None):
            for i in range(len(cols)):
                fmt = f_cellz if (rr - (header_row + 1)) % 2 else f_cell
                if i == 0 and first_val is not None:
                    ws.write(rr, i, first_val, fmt)
                elif i in (i_start, i_end) and i >= 0:
                    ws.write_blank(rr, i, "", f_time)
                elif i == i_el and i_el >= 0:
                    a = xlsxwriter.utility.xl_rowcol_to_cell(rr, i_start)
                    b = xlsxwriter.utility.xl_rowcol_to_cell(rr, i_end)
                    ws.write_formula(
                        rr, i, f'=IF(OR({a}="",{b}=""),"",TEXT({b}-{a},"[h]:mm"))', fmt
                    )
                else:
                    ws.write_blank(rr, i, "", fmt)

        if sheet["kind"] == "log":
            for _ in range(sheet.get("rowCount") or 12):
                ws.set_row(r, 20)
                data_row(r)
                r += 1
        else:
            for sec in sheet.get("sections") or []:
                ws.set_row(r, 20)
                ws.merge_range(r, 0, r, last, sec["title"].upper(), f_sec)
                r += 1
                for task in sec["rows"]:
                    ws.set_row(r, 20)
                    data_row(r, task)
                    r += 1
    elif sheet["kind"] == "form":
        ws.set_column(0, 0, 42)
        ws.set_column(1, max(1, last), 26)
        for sec in sheet.get("sections") or []:
            ws.set_row(r, 20)
            ws.merge_range(r, 0, r, last, sec["title"].upper(), f_sec)
            r += 1
            for field in sec["rows"]:
                ws.write(r, 0, field, f_lab)
                if last > 1:
                    ws.merge_range(r, 1, r, last, "", f_in)
                else:
                    ws.write_blank(r, 1, "", f_in)
                ws.set_row(r, 20)
                r += 1
            r += 1
    else:  # guide
        ws.set_column(0, 0, 6)
        ws.set_column(1, 1, 110)
        for sec in sheet.get("sections") or []:
            ws.merge_range(r, 0, r, 1, sec["title"].upper(), f_sec)
            r += 1
            for i, step in enumerate(sec["rows"], 1):
                ws.write(r, 0, i, f_cell)
                ws.write(r, 1, step, f_cell)
                ws.set_row(r, 30)
                r += 1
            r += 1

    r += 1
    for note in sheet["footerNotes"]:
        ws.merge_range(r, 0, r, last, "• " + note, f_note)
        ws.set_row(r, 16)
        r += 1
    r += 1
    ws.merge_range(
        r, 0, r, last,
        "Free template from Rotahr — rota, HACCP, stock and payroll in one app. "
        "rotahr.com/templates",
        f_note,
    )

    if header_row is not None:
        ws.freeze_panes(header_row + 1, 0)
        ws.repeat_rows(header_row)
        ws.autofilter(header_row, 0, header_row, last)
    ws.set_landscape() if sheet["orientation"] == "landscape" else ws.set_portrait()
    ws.set_paper(9)  # A4
    ws.fit_to_pages(1, 0)
    ws.set_margins(0.3, 0.3, 0.4, 0.4)
    wb.close()
    return out


# --------------------------------------------------------------------------- #
# CSV
# --------------------------------------------------------------------------- #

def build_csv(t):
    sheet = t["sheet"]
    cols = cols_for(sheet, include_extra=True)
    out = os.path.join(OUT_DIR, t["slug"] + ".csv")
    with open(out, "w", newline="", encoding="utf-8") as fh:
        w = csv.writer(fh)
        w.writerow([t["name"]])
        for f in sheet["headerFields"]:
            w.writerow([f, ""])
        w.writerow([])
        if sheet["kind"] in ("log", "checklist"):
            w.writerow([c["name"] for c in cols])
            if sheet["kind"] == "log":
                for _ in range(sheet.get("rowCount") or 12):
                    w.writerow([""] * len(cols))
            else:
                for sec in sheet.get("sections") or []:
                    w.writerow([sec["title"].upper()])
                    for task in sec["rows"]:
                        w.writerow([task] + [""] * (len(cols) - 1))
        else:
            for sec in sheet.get("sections") or []:
                w.writerow([sec["title"].upper()])
                for i, row in enumerate(sec["rows"], 1):
                    w.writerow([row, ""] if sheet["kind"] == "form" else [i, row])
                w.writerow([])
        w.writerow([])
        for n in sheet["footerNotes"]:
            w.writerow([n])
        w.writerow(["Free template from Rotahr — rotahr.com/templates"])
    return out


# --------------------------------------------------------------------------- #

def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    data = json.load(open(CATALOG))
    wanted = set(sys.argv[1:])
    logo = logo_data_uri()
    built = 0
    for t in data["templates"]:
        if wanted and t["slug"] not in wanted:
            continue
        build_pdf(t, logo)
        build_xlsx(t)
        build_csv(t)
        built += 1
        print(f"  ok  {t['slug']}")
    print(f"built {built} template(s) -> {OUT_DIR}")


if __name__ == "__main__":
    main()
