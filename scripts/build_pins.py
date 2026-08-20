#!/usr/bin/env python3
"""
Build Pinterest pin images (1000x1500, 2:3) + a bulk-upload CSV for every
free template in the Rotahr template library.

Input : /tmp/templates.json  (bun run scripts/dump-templates.ts > /tmp/templates.json)
Output: /home/user/rotahr-pins/images/<slug>.png
        /home/user/rotahr-pins/pinterest-pins.csv   (filled after upload step)

Usage : python3 scripts/build_pins.py [slug ...]
"""

import base64
import html
import json
import os
import subprocess
import sys
import tempfile

CATALOG = "/tmp/templates.json"
OUT_DIR = "/home/user/rotahr-pins/images"
PDF_DIR = "/home/user/rotahr/public/templates"
LOGO = "/home/user/rotahr/public/logo-white-trans.png"
CHROME = "/usr/bin/google-chrome"

NAVY = "#0A1427"
NAVY_2 = "#0f1c35"
FLAME_A = "#ff6b35"
FLAME_B = "#e8365d"

# Per-template pin creative: (headline shown on the image, benefit kicker line)
# Deliberately hand-written per template -- not derived from the name.
PIN_COPY = {
    "fridge-freezer-temperature-log": (
        "Fridge &amp; Freezer<br>Temperature Log",
        "Named units. Two checks a day. Corrective action column.",
    ),
    "cooking-cooling-temperature-log": (
        "Cooking &amp; Cooling<br>Temperature Log",
        "Core temps, start and end times, automatic use-by date.",
    ),
    "delivery-check-record": (
        "Delivery Check<br>Record",
        "Log every goods-in: temp, condition, date codes, vehicle.",
    ),
    "haccp-corrective-action-log": (
        "HACCP Corrective<br>Action Log",
        "Prove you fixed it. The page inspectors actually ask for.",
    ),
    "weekly-staff-rota": (
        "Weekly Staff<br>Rota",
        "Seven days, hours totalled, wage cost per person.",
    ),
    "shift-swap-request-form": (
        "Shift Swap<br>Request Form",
        "Stop agreeing cover by text and losing track of it.",
    ),
    "holiday-request-form": (
        "Holiday Request<br>Form",
        "One page. Dates, cover, balance left, manager sign-off.",
    ),
    "kitchen-opening-closing-checklist": (
        "Kitchen Opening &amp;<br>Closing Checklist",
        "Open right, close safe. Nothing left on overnight.",
    ),
    "bar-opening-closing-checklist": (
        "Bar Opening &amp;<br>Closing Checklist",
        "Set up, cash down, lock up. Every step in order.",
    ),
    "front-of-house-opening-closing-checklist": (
        "Front of House<br>Open &amp; Close",
        "Floor ready before doors. Reset done before anyone leaves.",
    ),
    "first-aid-emergency-steps": (
        "First Aid &amp;<br>Emergency Steps",
        "Print it. Stick it on the wall. Burns, cuts, choking, scalds.",
    ),
    "fire-safety-checklist": (
        "Fire Safety<br>Checklist",
        "Extinguishers, exits, suppression, drills. Signed and dated.",
    ),
    "accident-incident-report-form": (
        "Accident &amp; Incident<br>Report Form",
        "Record it properly the first time. Witnesses included.",
    ),
    "daily-weekly-cleaning-schedule": (
        "Daily &amp; Weekly<br>Cleaning Schedule",
        "Who cleans what, when, and who initialled it.",
    ),
    "deep-clean-schedule": (
        "Deep Clean<br>Schedule",
        "Extraction, ovens, behind the line. Planned, not panicked.",
    ),
    "new-staff-induction-checklist": (
        "New Staff<br>Induction Checklist",
        "Day one done properly. Nothing forgotten, nothing repeated.",
    ),
    "staff-training-record": (
        "Staff Training<br>Record",
        "Training matrix with certificate expiry dates that flag early.",
    ),
    "probation-review-form": (
        "Probation<br>Review Form",
        "A fair, written review instead of a corridor conversation.",
    ),
    "stock-count-sheet": (
        "Stock Count<br>Sheet",
        "Count once, write once. Opening, closing, usage, value.",
    ),
    "wastage-log": (
        "Wastage<br>Log",
        "Find out what you're actually throwing away, and why.",
    ),
    "par-level-order-sheet": (
        "Par Level<br>Order Sheet",
        "Set the par once. Order the gap. Stop over-ordering.",
    ),
    "cellar-check-line-cleaning-log": (
        "Cellar Check &amp;<br>Line Cleaning Log",
        "Cellar temps and line cleans on one signed sheet.",
    ),
    "spirit-stocktake-sheet": (
        "Spirit<br>Stocktake Sheet",
        "Bottle counts, expected vs actual, variance in plain numbers.",
    ),
    "housekeeping-room-checklist": (
        "Housekeeping<br>Room Checklist",
        "Room-ready standard your team can follow without asking.",
    ),
    "guest-incident-log": (
        "Guest Incident<br>&amp; Complaint Log",
        "Track what happened, what you did, and how it ended.",
    ),
    "daily-takings-sheet": (
        "Daily Takings<br>Sheet",
        "Cash up in five minutes. Float, card, cash, variance.",
    ),
    "tips-tronc-distribution-sheet": (
        "Tips &amp; Tronc<br>Distribution Sheet",
        "Split tips by hours worked, transparently, on paper.",
    ),
}


def read_catalog():
    with open(CATALOG) as f:
        return json.load(f)


def data_uri(path):
    ext = os.path.splitext(path)[1].lstrip(".").lower()
    mime = "image/png" if ext == "png" else "image/jpeg"
    with open(path, "rb") as f:
        return "data:%s;base64,%s" % (mime, base64.b64encode(f.read()).decode())


def render_pdf_page1(slug, workdir):
    """Render page 1 of the template PDF to a PNG for use as the pin preview."""
    pdf = os.path.join(PDF_DIR, slug + ".pdf")
    if not os.path.exists(pdf):
        return None
    stem = os.path.join(workdir, slug + "-p1")
    subprocess.run(
        ["pdftoppm", "-png", "-r", "110", "-f", "1", "-l", "1", pdf, stem],
        check=True,
        capture_output=True,
    )
    for cand in (stem + "-1.png", stem + "-01.png", stem + "-001.png"):
        if os.path.exists(cand):
            return cand
    return None


STAGE_INNER_W = 1000 - (58 * 2) - (16 * 2)
STAGE_MAX_H = 640

FORMAT_WORDS = ("printable pdf", "editable excel", "csv", "xlsx", ".pdf")


def headline_size(headline):
    longest = max(len(part) for part in headline.split("<br>"))
    if longest <= 16:
        return 82
    if longest <= 20:
        return 74
    if longest <= 24:
        return 66
    return 58


def png_dims(path):
    out = subprocess.run(
        ["identify", "-format", "%w %h", path], capture_output=True, text=True
    ).stdout.split()
    return int(out[0]), int(out[1])


def pin_bullets(tpl, limit=3, maxlen=68):
    """Pick the genuinely specific 'what's included' lines, skipping format boilerplate."""
    picked = []
    for item in tpl.get("whatsIncluded", []):
        low = item.lower()
        if any(w in low for w in FORMAT_WORDS):
            continue
        text = item
        if len(text) > maxlen:
            cut = text[:maxlen].rsplit(" ", 1)[0]
            text = cut + "..."
        picked.append(text)
        if len(picked) == limit:
            break
    return picked


def build_html(tpl, category_name, preview_png, logo_uri):
    slug = tpl["slug"]
    headline, kicker = PIN_COPY[slug]
    fsize = headline_size(headline)
    preview_uri = data_uri(preview_png) if preview_png else ""

    cropped = False
    if preview_png:
        pw, ph = png_dims(preview_png)
        cropped = (STAGE_INNER_W * ph / pw) > STAGE_MAX_H

    preview_block = (
        '<img class="sheet" src="%s" alt="">' % preview_uri
        if preview_uri
        else '<div class="sheet" style="height:420px"></div>'
    )
    if cropped:
        preview_block += '<div class="fade"></div>'

    bullets = "".join(
        '<div class="b"><i></i><span>%s</span></div>' % html.escape(b)
        for b in pin_bullets(tpl)
    )

    return """<!doctype html>
<html><head><meta charset="utf-8">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width:1000px; height:1500px; }
  body {
    font-family:'Barlow', sans-serif;
    background:%(navy)s;
    color:#fff;
    overflow:hidden;
    position:relative;
  }
  .glow {
    position:absolute; top:-320px; left:-160px;
    width:900px; height:900px; border-radius:50%%;
    background:radial-gradient(circle, rgba(255,107,53,.30) 0%%, rgba(232,54,93,.10) 45%%, rgba(10,20,39,0) 72%%);
  }
  .glow2 {
    position:absolute; bottom:-360px; right:-240px;
    width:820px; height:820px; border-radius:50%%;
    background:radial-gradient(circle, rgba(232,54,93,.22) 0%%, rgba(10,20,39,0) 70%%);
  }
  .wrap {
    position:relative; z-index:2;
    width:1000px; height:1500px;
    padding:58px 58px 46px;
    display:flex; flex-direction:column;
  }
  .top { display:flex; align-items:center; justify-content:space-between; }
  .top img { height:38px; }
  .pill {
    font-size:20px; font-weight:800; letter-spacing:.16em; text-transform:uppercase;
    padding:11px 22px; border-radius:100px; color:#fff;
    background:linear-gradient(100deg,%(fa)s,%(fb)s);
  }
  .kicker {
    margin-top:44px;
    font-size:23px; font-weight:800; letter-spacing:.2em; text-transform:uppercase;
    background:linear-gradient(100deg,%(fa)s,%(fb)s);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }
  h1 {
    margin-top:16px;
    font-size:%(fsize)spx; font-weight:800; line-height:.98; letter-spacing:-.018em;
  }
  .kick {
    margin-top:20px; font-size:26px; line-height:1.34; font-weight:500;
    color:rgba(255,255,255,.80); max-width:830px;
  }
  .chips { margin-top:26px; display:flex; gap:12px; }
  .chip {
    font-size:19px; font-weight:700; letter-spacing:.1em;
    padding:10px 20px; border-radius:9px;
    border:1.5px solid rgba(255,255,255,.28); color:rgba(255,255,255,.94);
    background:rgba(255,255,255,.05);
  }
  .stage {
    margin-top:32px; position:relative;
    max-height:%(stagemax)spx;
    border-radius:14px; overflow:hidden;
    background:linear-gradient(180deg,rgba(255,255,255,.13),rgba(255,255,255,.02));
    padding:16px 16px 0;
  }
  .sheet {
    width:100%%; display:block;
    border-radius:8px 8px 0 0;
    background:#fff;
    box-shadow:0 -2px 60px rgba(0,0,0,.5);
  }
  .fade {
    position:absolute; left:0; right:0; bottom:0; height:210px;
    background:linear-gradient(180deg,rgba(10,20,39,0) 0%%,rgba(10,20,39,.72) 42%%,%(navy)s 78%%);
  }
  .bullets { margin-top:30px; display:flex; flex-direction:column; gap:15px; }
  .b { display:flex; align-items:flex-start; gap:15px; }
  .b i {
    flex:0 0 auto; width:13px; height:13px; margin-top:10px; border-radius:4px;
    background:linear-gradient(100deg,%(fa)s,%(fb)s);
  }
  .b span {
    font-size:24px; font-weight:500; line-height:1.32; color:rgba(255,255,255,.84);
  }
  .foot { margin-top:auto; padding-top:34px; display:flex; align-items:flex-end; justify-content:space-between; }
  .url { font-size:37px; font-weight:800; letter-spacing:-.01em; }
  .url span {
    background:linear-gradient(100deg,%(fa)s,%(fb)s);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent;
  }
  .note {
    font-size:21px; font-weight:600; color:rgba(255,255,255,.62);
    text-align:right; line-height:1.4;
  }
</style></head>
<body>
  <div class="glow"></div><div class="glow2"></div>
  <div class="wrap">
    <div class="top">
      <img src="%(logo)s" alt="Rotahr">
      <div class="pill">Free download</div>
    </div>
    <div class="kicker">%(cat)s</div>
    <h1>%(headline)s</h1>
    <div class="kick">%(kick)s</div>
    <div class="chips"><div class="chip">PDF</div><div class="chip">EXCEL</div><div class="chip">CSV</div></div>
    <div class="stage">
      %(preview)s
    </div>
    <div class="bullets">%(bullets)s</div>
    <div class="foot">
      <div class="url">rotahr.com<span>/templates</span></div>
      <div class="note">No email.<br>No signup.</div>
    </div>
  </div>
</body></html>""" % {
        "navy": NAVY,
        "fa": FLAME_A,
        "fb": FLAME_B,
        "fsize": fsize,
        "stagemax": STAGE_MAX_H,
        "logo": logo_uri,
        "cat": html.escape(category_name.upper()),
        "headline": headline,
        "kick": html.escape(kicker),
        "preview": preview_block,
        "bullets": bullets,
    }


def shoot(html_str, out_png, workdir):
    src = os.path.join(workdir, "pin.html")
    with open(src, "w") as f:
        f.write(html_str)
    subprocess.run(
        [
            CHROME,
            "--headless",
            "--no-sandbox",
            "--disable-gpu",
            "--hide-scrollbars",
            "--force-device-scale-factor=1",
            "--window-size=1000,1500",
            "--default-background-color=00000000",
            "--screenshot=" + out_png,
            "file://" + src,
        ],
        check=True,
        capture_output=True,
        timeout=120,
    )


def main():
    only = set(sys.argv[1:])
    cat = read_catalog()
    cat_names = {c["id"]: c["name"] for c in cat["categories"]}
    os.makedirs(OUT_DIR, exist_ok=True)
    logo_uri = data_uri(LOGO)

    made, missing_copy = [], []
    with tempfile.TemporaryDirectory() as workdir:
        for tpl in cat["templates"]:
            slug = tpl["slug"]
            if only and slug not in only:
                continue
            if slug not in PIN_COPY:
                missing_copy.append(slug)
                print("!!  no pin copy for %s -- skipped" % slug)
                continue
            preview = render_pdf_page1(slug, workdir)
            if not preview:
                print("!!  no PDF for %s" % slug)
            out = os.path.join(OUT_DIR, slug + ".png")
            shoot(build_html(tpl, cat_names[tpl["category"]], preview, logo_uri), out, workdir)
            size = os.path.getsize(out)
            dims = subprocess.run(
                ["identify", "-format", "%wx%h", out], capture_output=True, text=True
            ).stdout.strip()
            print("ok  %-44s %s  %6.0f KB" % (slug, dims, size / 1024))
            made.append(slug)

    print("\n%d pin image(s) written to %s" % (len(made), OUT_DIR))
    if missing_copy:
        print("MISSING PIN COPY: %s" % ", ".join(missing_copy))
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
