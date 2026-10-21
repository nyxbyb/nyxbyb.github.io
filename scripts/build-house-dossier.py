#!/usr/bin/env python3
"""Build CHITING's concept-coordination booklet from the web spatial model.

Run with the bundled Python runtime (ReportLab required).  The JavaScript
model is imported by Node, never transcribed into a second geometry model.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from hashlib import sha256
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output/pdf/迟庭-住宅设计册.pdf"
PUBLIC = ROOT / "web/public/docs/迟庭-住宅设计册.pdf"
TMP = ROOT / "tmp/pdfs"
W, H = landscape(A4)
MARGIN = 42
PAPER = colors.HexColor("#F5F2EA")
INK = colors.HexColor("#29342F")
MUTED = colors.HexColor("#68736A")
LINE = colors.HexColor("#CECFC4")
WOOD = colors.HexColor("#B79C76")
GREEN = colors.HexColor("#657965")
PALE_GREEN = colors.HexColor("#E0E6DA")
WATER = colors.HexColor("#6D8790")
DATE = "2026-10-21"
REVISION = "03"


def register_fonts():
    paths = {
        "Song": "/System/Library/Fonts/Supplemental/Songti.ttc",
        "Sans": "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    }
    for name, path in paths.items():
        if not Path(path).exists():
            raise FileNotFoundError(f"Required CJK font not found: {path}")
        pdfmetrics.registerFont(TTFont(name, path))


def load_model():
    module = ROOT / "web/room/spatial-model.js"
    js = """const m=await import(process.argv[1]);
const keys=['SPATIAL_MODEL','HOUSE_MODEL','MODEL','spatialModel','houseModel','model','default'];
let v=keys.map(k=>m[k]).find(v=>v&&typeof v==='object'&&v.zones&&v.walls);
if(!v) v=Object.values(m).find(v=>v&&typeof v==='object'&&v.zones&&v.walls);
console.log(JSON.stringify(v||m));"""
    result = subprocess.run(["node", "--input-type=module", "-e", js, module.as_uri()],
                            cwd=ROOT, capture_output=True, text=True, check=True)
    model = json.loads(result.stdout)
    (TMP / "spatial-model.json").write_text(json.dumps(model, ensure_ascii=False, indent=2))
    return model


def zh(value, fallback=""):
    if isinstance(value, dict):
        return str(value.get("zh", value.get("en", fallback)))
    return str(value if value is not None else fallback)


def point(value):
    if isinstance(value, (list, tuple)):
        return float(value[0]), float(value[1])
    return float(value.get("x", 0)), float(value.get("y", value.get("z", 0)))


def rect_points(item):
    if item.get("polygon"):
        return [point(p) for p in item["polygon"]]
    if item.get("points"):
        return [point(p) for p in item["points"]]
    r = item.get("rect", item.get("bounds", item))
    if isinstance(r, (list, tuple)):
        x, y, w, h = r
    else:
        x, y = r.get("x", 0), r.get("y", r.get("z", 0))
        w, h = r.get("w", r.get("width", 0)), r.get("d", r.get("h", r.get("depth", r.get("height", 0))))
    return [(x, y), (x + w, y), (x + w, y + h), (x, y + h)]


def centroid(points):
    return sum(p[0] for p in points) / len(points), sum(p[1] for p in points) / len(points)


class Book:
    def __init__(self, path, model, house):
        self.c = canvas.Canvas(str(path), pagesize=(W, H), pageCompression=1)
        self.c.setTitle(f"迟庭 - 住宅设计册 / Revision {REVISION}")
        self.c.setAuthor("Caelum - 迟庭概念协调研究")
        self.c.setSubject("同一空间模型的平面、门窗家具、立面与生活场景")
        self.model, self.house = model, house
        self.rooms = {r["id"]: r for r in house["rooms"]}
        self.page = 0
        self.zones = model.get("zones", [])
        self.spaces = model.get("spaces", [])
        if isinstance(self.spaces, dict):
            self.spaces = [{"id": k, **v} for k, v in self.spaces.items()]
        self.furniture = model.get("furniture", [])
        self.openings = model.get("openings", [])
        self.walls = model.get("walls", [])
        self.routes = model.get("routes", [])
        self.cameras = model.get("cameras", [])
        self.tea = model.get("tea", {})
        self.estate = model.get("estate", {})
        self.courtyard_boundary = model.get("courtyardBoundary", {})
        self.level = model.get("ceilingHeight", model.get("height", 2.8))
        if not isinstance(self.level, (float, int)):
            self.level = 2.8
        self.index = []

    def text(self, x, y, value, size=10, font="Sans", color=INK):
        self.c.setFillColor(color)
        self.c.setFont(font, size)
        self.c.drawString(x, y, str(value))

    def para(self, value, x, y, width, size=10, leading=None, color=INK, font="Sans"):
        style = ParagraphStyle("p", fontName=font, fontSize=size, leading=leading or size * 1.65,
                               textColor=color, wordWrap="CJK", alignment=TA_LEFT,
                               spaceAfter=0, allowWidows=0, allowOrphans=0)
        p = Paragraph(escape(str(value)).replace("\n", "<br/>"), style)
        _, height = p.wrap(width, H)
        p.drawOn(self.c, x, y - height)
        return y - height

    def rule(self, x, y, width, color=LINE, weight=.5):
        self.c.setStrokeColor(color)
        self.c.setLineWidth(weight)
        self.c.line(x, y, x + width, y)

    def start(self, code, title, subtitle=""):
        if self.page:
            self.c.showPage()
        self.page += 1
        self.index.append((self.page, code, title))
        self.c.setFillColor(PAPER)
        self.c.rect(0, 0, W, H, fill=1, stroke=0)
        self.text(MARGIN, H - 31, "迟庭  /  CHITING", 9, "Song", MUTED)
        self.text(W - MARGIN - 158, H - 31, f"REVISION {REVISION}   /   {DATE}", 7, "Helvetica", MUTED)
        self.rule(MARGIN, H - 44, W - 2 * MARGIN)
        self.text(MARGIN, H - 83, title, 24, "Song")
        self.text(MARGIN, H - 102, code, 8, "Helvetica", MUTED)
        if subtitle:
            self.para(subtitle, MARGIN + 70, H - 94, W - 2 * MARGIN - 70, 8.5, 13, MUTED)
        self.rule(MARGIN, 37, W - 2 * MARGIN)
        self.text(MARGIN, 22, "概念协调研究  ·  米制模型 / 图中尺寸优先，不可从缩印图量取", 7, "Sans", MUTED)
        self.text(W - MARGIN - 27, 22, f"{self.page:02d}", 8, "Helvetica", MUTED)

    def section_label(self, title, x, y):
        self.text(x, y, title, 13, "Song")
        self.rule(x, y - 10, 230)
        return y - 28

    def column(self, title, paragraphs, x, y, width):
        self.text(x, y, title, 15, "Song")
        y -= 25
        for text in paragraphs:
            y = self.para(text, x, y, width, 10, 17) - 15
        return y

    def table(self, headers, rows, x, y, widths, size=8.4, row_min=29, padding=14, line_factor=1.5):
        self.c.setFillColor(PALE_GREEN)
        self.c.rect(x, y - 28, sum(widths), 28, fill=1, stroke=0)
        xx = x
        for heading, width in zip(headers, widths):
            self.text(xx + 7, y - 18, heading, size, "Sans")
            xx += width
        y -= 28
        for row in rows:
            heights = []
            for value, width in zip(row, widths):
                style = ParagraphStyle("cell", fontName="Sans", fontSize=size, leading=size * line_factor,
                                       wordWrap="CJK", textColor=INK)
                p = Paragraph(escape(str(value)).replace("\n", "<br/>"), style)
                _, h = p.wrap(width - 14, H)
                heights.append((p, h))
            h = max(row_min, max(cell[1] for cell in heights) + padding)
            self.rule(x, y - h, sum(widths))
            xx = x
            for (p, ph), width in zip(heights, widths):
                p.drawOn(self.c, xx + 7, y - padding / 2 - ph)
                xx += width
            y -= h
        return y

    def room_name(self, ident):
        if ident in {"outside", "gallery", "vestibule", "bath-main", "bath-wc", "bath-lobby"}:
            return {"outside": "室外", "gallery": "回廊", "vestibule": "玄关家务", "bath-main": "完整浴室", "bath-wc": "客用洗手间", "bath-lobby": "湿区前室"}[ident]
        return zh(self.rooms.get(ident, {}).get("label", ident))

    def svg_image(self, filename):
        """Render the exported same-model SVG without reinterpreting geometry."""
        source = ROOT / "web/public/docs/drawings" / filename
        if not source.exists():
            raise FileNotFoundError(f"Export the final model drawing first: {source}")
        digest = sha256(source.read_bytes()).hexdigest()[:12]
        output = TMP / f"{source.stem}-{digest}.png"
        if output.exists(): return output
        program = """import sys,fitz
from pathlib import Path
d=fitz.open(stream=Path(sys.argv[1]).read_bytes(),filetype='svg')
p=fitz.open('pdf',d.convert_to_pdf())
page=p[0]; scale=2800/max(page.rect.width,page.rect.height)
page.get_pixmap(matrix=fitz.Matrix(scale,scale),alpha=True).save(sys.argv[2])
"""
        candidates = list(dict.fromkeys([sys.executable, "/opt/anaconda3/bin/python3", shutil.which("python3") or "python3"]))
        errors = []
        for interpreter in candidates:
            result = subprocess.run([interpreter, "-c", program, str(source), str(output)], capture_output=True, text=True)
            if result.returncode == 0: return output
            errors.append(f"{interpreter}: {result.stderr.strip()[-180:]}")
        raise RuntimeError("An SVG-capable PyMuPDF Python runtime is required: " + "; ".join(errors))

    def image(self, source, x, y, width, height):
        image = ImageReader(str(source))
        iw, ih = image.getSize()
        factor = min(width / iw, height / ih)
        ww, hh = iw * factor, ih * factor
        self.c.drawImage(image, x + (width - ww) / 2, y + (height - hh) / 2, ww, hh, mask="auto")

    def diagram_page(self, code, title, filename, subtitle, caption=""):
        self.start(code, title, subtitle)
        self.image(self.svg_image(filename), MARGIN, 74, W - 2 * MARGIN, 410)
        if caption: self.para(caption, MARGIN, 62, W - 2 * MARGIN, 8, 13, MUTED)

    def zone_polygon(self, zone):
        if zone.get("polygons"):
            return [point(p) for polygon in zone["polygons"] for p in polygon]
        return rect_points(zone)

    def wall_ends(self, item):
        if "a" in item and "b" in item:
            return point(item["a"]), point(item["b"])
        if "from" in item and "to" in item:
            return point(item["from"]), point(item["to"])
        if "start" in item and "end" in item:
            return point(item["start"]), point(item["end"])
        if "x1" in item:
            return (item["x1"], item["y1"]), (item["x2"], item["y2"])
        return (0, 0), (0, 0)

    def opening_ends(self, item):
        if any(k in item for k in ("a", "from", "start", "x1")):
            return self.wall_ends(item)
        wall = next((w for w in self.walls if w.get("id") == item.get("wall")), None)
        if wall:
            a, b = self.wall_ends(wall)
            length = math.dist(a, b)
            off = item.get("offset", 0)
            width = item.get("width", 1)
            if length:
                u = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
                return (a[0] + u[0] * off, a[1] + u[1] * off), (a[0] + u[0] * (off + width), a[1] + u[1] * (off + width))
        return (0, 0), (0, 0)

    def plan(self, x, y, width, height, rooms=None, labels=True, routes=False,
             cameras=False, furniture=True, openings=True, all_ids=False, crop=None):
        """Draw in a y-down metre coordinate system, mapping into a PDF rectangle."""
        all_points = [p for z in self.zones for p in self.zone_polygon(z)]
        if crop:
            x0, y0, x1, y1 = crop
        else:
            x0 = min((p[0] for p in all_points), default=0) - .55
            y0 = min((p[1] for p in all_points), default=0) - .55
            x1 = max((p[0] for p in all_points), default=14) + .55
            y1 = max((p[1] for p in all_points), default=14) + .55
        scale = min(width / max(x1 - x0, 1), height / max(y1 - y0, 1))
        ox = x + (width - (x1 - x0) * scale) / 2
        oy = y + (height - (y1 - y0) * scale) / 2
        def P(p):
            return ox + (p[0] - x0) * scale, oy + (y1 - p[1]) * scale
        self.c.saveState()
        clip = self.c.beginPath(); clip.rect(x, y, width, height)
        self.c.clipPath(clip, stroke=0)
        for z in self.zones:
            active = not rooms or z.get("id") in rooms
            is_garden = z.get("id") == "garden"
            self.c.setFillColor(PALE_GREEN if is_garden else (colors.HexColor("#E8DFCE") if active else PAPER))
            self.c.setStrokeColor(LINE)
            self.c.setLineWidth(.45)
            for polygon in z.get("polygons", [self.zone_polygon(z)]):
                pts = [point(p) for p in polygon]
                if len(pts) < 3: continue
                path = self.c.beginPath(); path.moveTo(*P(pts[0]))
                for p in pts[1:]: path.lineTo(*P(p))
                path.close(); self.c.drawPath(path, fill=1, stroke=1)
        for wall in self.walls:
            a, b = self.wall_ends(wall)
            self.c.setStrokeColor(INK)
            self.c.setLineWidth(max(.7, float(wall.get("thickness", .12)) * scale))
            self.c.line(*P(a), *P(b))
        if openings:
            for o in self.openings:
                if rooms and not any(room_id in o.get("connects", []) for room_id in rooms):
                    continue
                a, b = self.opening_ends(o)
                self.c.setStrokeColor(PAPER)
                self.c.setLineWidth(.24 * scale)
                self.c.line(*P(a), *P(b))
                self.c.setStrokeColor(WATER if o.get("type") == "window" else WOOD)
                self.c.setLineWidth(.7)
                self.c.line(*P(a), *P(b))
                if o.get("type") == "window":
                    aa, bb = P(a), P(b)
                    self.c.line(aa[0] + 1.7, aa[1] + 1.7, bb[0] + 1.7, bb[1] + 1.7)
                elif o.get("operation") == "hinged":
                    hinge = b if o.get("hinge") == "b" else a
                    other = a if o.get("hinge") == "b" else b
                    direction = {"north": (0, -1), "south": (0, 1), "west": (-1, 0), "east": (1, 0)}.get(o.get("swing"), (0, 1))
                    length = math.dist(a, b)
                    end = (hinge[0] + direction[0] * length, hinge[1] + direction[1] * length)
                    self.c.line(*P(hinge), *P(end))
                    start_angle = math.atan2(other[1] - hinge[1], other[0] - hinge[0])
                    end_angle = math.atan2(end[1] - hinge[1], end[0] - hinge[0])
                    delta = (end_angle - start_angle + math.pi) % (2 * math.pi) - math.pi
                    arc = self.c.beginPath(); arc.moveTo(*P(other))
                    for step in range(1, 17):
                        angle = start_angle + delta * step / 16
                        arc.lineTo(*P((hinge[0] + math.cos(angle) * length, hinge[1] + math.sin(angle) * length)))
                    self.c.setLineWidth(.35); self.c.drawPath(arc, stroke=1)
                if all_ids:
                    cx, cy = P(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2))
                    self.text(cx + 3, cy + 4, o.get("id", ""), 5.3, "Helvetica", WATER)
        if furniture:
            layered = sorted(self.furniture, key=lambda f: (0 if f.get("type") in {"rug", "deck", "shower"} else (2 if f.get("baseHeight", 0) else 1)))
            for f in layered:
                if rooms and f.get("roomId", f.get("room", f.get("zone"))) not in rooms:
                    continue
                pts = rect_points(f)
                if len(pts) < 3:
                    continue
                self.c.setFillColor(colors.HexColor("#F9F7F1"))
                self.c.setStrokeColor(WOOD)
                self.c.setLineWidth(.6)
                if f.get("type") == "tree":
                    cx, cy = P(centroid(pts)); radius = f.get("canopyRadius", 1) * scale
                    self.c.setFillColor(PALE_GREEN); self.c.setStrokeColor(GREEN)
                    self.c.circle(cx, cy, radius, fill=1, stroke=1)
                    self.c.setLineWidth(.4); self.c.circle(cx, cy, radius * .77, fill=0, stroke=1)
                elif f.get("shape") == "ellipse":
                    xs, ys = zip(*(P(p) for p in pts))
                    self.c.ellipse(min(xs), min(ys), max(xs), max(ys), fill=1, stroke=1)
                else:
                    path = self.c.beginPath(); path.moveTo(*P(pts[0]))
                    for p in pts[1:]: path.lineTo(*P(p))
                    path.close(); self.c.drawPath(path, fill=1, stroke=1)
                if all_ids:
                    cx, cy = P(centroid(pts))
                    self.text(cx - 5, cy - 2, f.get("id", ""), 4.7, "Helvetica", MUTED)
        if labels:
            for z in self.zones:
                if rooms and z.get("id") not in rooms:
                    continue
                pts = self.zone_polygon(z)
                at = z.get("labelAt", z.get("labelPoint"))
                cx, cy = P(point(at) if at else centroid(pts))
                name = zh(z.get("label", z.get("name", self.room_name(z.get("id", "")))))
                self.text(cx - min(30, len(name) * 3.5), cy + 1, name, 7.3, "Sans")
                area = z.get("area", self.rooms.get(z.get("id"), {}).get("area"))
                if area:
                    self.text(cx - 12, cy - 10, f"{area:g} m²", 6.3, "Helvetica", MUTED)
        if routes:
            palette = [GREEN, WATER, colors.HexColor("#A37C54"), colors.HexColor("#956C73")]
            for i, route in enumerate(self.routes):
                points = [point(p) for p in route.get("points", route.get("path", []))]
                self.c.setStrokeColor(palette[i % len(palette)])
                self.c.setLineWidth(1.7); self.c.setDash(4, 2)
                path = self.c.beginPath()
                for j, p in enumerate(points):
                    if j: path.lineTo(*P(p))
                    else: path.moveTo(*P(p))
                self.c.drawPath(path, stroke=1)
                self.c.setDash()
                if points:
                    cx, cy = P(points[-1]); self.c.setFillColor(palette[i % len(palette)])
                    self.c.circle(cx, cy, 2.4, fill=1, stroke=0)
        if cameras:
            for camera in self.cameras:
                origin = point(camera.get("position", camera.get("eye", camera.get("from", [0, 0]))))
                target = point(camera.get("target", camera.get("lookAt", [0, 0])))
                a, b = P(origin), P(target)
                self.c.setStrokeColor(WATER); self.c.setLineWidth(.7)
                self.c.line(*a, *b); self.c.setFillColor(WATER); self.c.circle(*a, 3, fill=1, stroke=0)
                self.text(a[0] + 5, a[1] + 3, camera.get("id", ""), 6, "Helvetica", WATER)
        self.c.restoreState()
        return P, scale

    def room_bounds(self, ident):
        z = next(z for z in self.zones if z.get("id") == ident)
        points = self.zone_polygon(z)
        return min(p[0] for p in points), min(p[1] for p in points), max(p[0] for p in points), max(p[1] for p in points)

    def room_edges(self, ident, side):
        """Actual union boundary, including the two depths of L-shaped rooms."""
        zone = next(z for z in self.zones if z.get("id") == ident)
        boxes = []
        for poly in zone["polygons"]:
            boxes.append((min(p[0] for p in poly), min(p[1] for p in poly), max(p[0] for p in poly), max(p[1] for p in poly)))
        def inside(x, y):
            return any(a - 1e-7 <= x <= c + 1e-7 and b - 1e-7 <= y <= d + 1e-7 for a, b, c, d in boxes)
        horizontal = side in {"N", "S"}
        cuts = sorted(set(v for box in boxes for v in ((box[0], box[2]) if horizontal else (box[1], box[3]))))
        result = []
        for a, b, c, d in boxes:
            edge = b if side == "N" else d if side == "S" else c if side == "E" else a
            lo, hi = (a, c) if horizontal else (b, d)
            stops = sorted({lo, hi} | {p for p in cuts if lo < p < hi})
            outward = {"N": (0, -.02), "S": (0, .02), "E": (.02, 0), "W": (-.02, 0)}[side]
            for aa, bb in zip(stops, stops[1:]):
                mid = (aa + bb) / 2
                x, y = (mid, edge) if horizontal else (edge, mid)
                if inside(x + outward[0], y + outward[1]): continue
                start, end = ((aa, edge), (bb, edge)) if horizontal else ((edge, aa), (edge, bb))
                result.append((start, end))
        return result

    def elevation(self, ident, side, x, y, width, height):
        bounds = self.room_bounds(ident)
        x0, y0, x1, y1 = bounds
        horizontal = side in ("N", "S")
        length = x1 - x0 if horizontal else y1 - y0
        base = y + 40
        scale = min((width - 30) / max(length, 1), (height - 59) / self.level)
        ox = x + (width - length * scale) / 2
        def u(p):
            return (p[0] - x0 if side == "N" else x1 - p[0]) if horizontal else (p[1] - y0 if side == "E" else y1 - p[1])
        zone = next(z for z in self.zones if z.get("id") == ident)
        def inside(p):
            # Current polygons are axis-aligned boxes; use their actual union.
            return any(min(v[0] for v in poly) - 1e-6 <= p[0] <= max(v[0] for v in poly) + 1e-6 and
                       min(v[1] for v in poly) - 1e-6 <= p[1] <= max(v[1] for v in poly) + 1e-6
                       for poly in zone["polygons"])
        def on_side(o, a, b):
            if ident not in o.get("connects", []): return False
            if horizontal != (abs(a[1] - b[1]) < 1e-6): return False
            midpoint = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
            inward = {"N": (0, .03), "S": (0, -.03), "E": (-.03, 0), "W": (.03, 0)}[side]
            return inside((midpoint[0] + inward[0], midpoint[1] + inward[1]))
        edges = self.room_edges(ident, side)
        for n, (a, b) in enumerate(edges):
            lo, hi = sorted((u(a), u(b)))
            self.c.setStrokeColor(LINE); self.c.setFillColor(colors.HexColor("#FAF8F2") if n % 2 == 0 else colors.HexColor("#F0ECE2")); self.c.setLineWidth(.6)
            self.c.rect(ox + lo * scale, base, (hi - lo) * scale, self.level * scale, fill=1, stroke=1)
            if len(edges) > 1:
                plane = a[1] if horizontal else a[0]
                self.text(ox + lo * scale + 3, base + self.level * scale - 10, f"{'y' if horizontal else 'x'}={plane:.2f}", 5.6, "Helvetica", MUTED)
        for o in self.openings:
            a, b = self.opening_ends(o)
            if not on_side(o, a, b):
                continue
            start, end = sorted([u(a), u(b)])
            if end <= 0 or start >= length: continue
            start, end = max(start, 0), min(end, length)
            sill = o.get("sill", o.get("sillHeight", 0 if o.get("type") == "door" else .8))
            top = o.get("head", o.get("headHeight", float(sill) + float(o.get("height", 2.2))))
            self.c.setFillColor(colors.HexColor("#DDE7E5") if o.get("type") == "window" else colors.HexColor("#E1D0B5"))
            self.c.setStrokeColor(WATER if o.get("type") == "window" else WOOD)
            self.c.rect(ox + start * scale, base + sill * scale, (end - start) * scale, (top - sill) * scale, fill=1, stroke=1)
            self.text(ox + start * scale + 3, base + top * scale + 3, o.get("id", ""), 6, "Helvetica", MUTED)
        labels = []
        for f in self.furniture:
            if f.get("roomId", f.get("room", f.get("zone"))) != ident:
                continue
            pts = rect_points(f)
            projected = [u(p) for p in pts]
            a, b = max(0, min(projected)), min(length, max(projected))
            if b <= a: continue
            furniture_h = f.get("height", f.get("h", .75))
            if not isinstance(furniture_h, (int, float)) or furniture_h > 3.5:
                furniture_h = .75
            z = f.get("baseHeight", f.get("elevation", f.get("zBase", 0)))
            near_wall = False
            min_x, max_x = min(p[0] for p in pts), max(p[0] for p in pts)
            min_y, max_y = min(p[1] for p in pts), max(p[1] for p in pts)
            for edge_a, edge_b in edges:
                edge_lo, edge_hi = sorted((u(edge_a), u(edge_b)))
                if min(b, edge_hi) <= max(a, edge_lo): continue
                gap = min_y - edge_a[1] if side == "N" else edge_a[1] - max_y if side == "S" else edge_a[0] - max_x if side == "E" else min_x - edge_a[0]
                if -.02 <= gap <= .65:
                    near_wall = True
                    break
            self.c.setFillColor(colors.HexColor("#E9DFCE") if near_wall else colors.HexColor("#F2EEE5"))
            self.c.setStrokeColor(WOOD if near_wall else colors.HexColor("#CFC8B9")); self.c.setLineWidth(.5 if near_wall else .3)
            self.c.rect(ox + a * scale, base + z * scale, (b - a) * scale, furniture_h * scale, fill=1, stroke=1)
            if near_wall and not f.get("parentId") and f.get("type") not in {"rug", "deck", "shower"}:
                labels.append(((a + b) * scale / 2 + ox, f.get("id", "")))
        self.rule(ox - 6, base, length * scale + 12, INK, .9)
        # Three annotation rows, packed into non-overlapping intervals.  Leader
        # lines carry the identifier to the footprint instead of piling text on
        # the actual furniture silhouettes.
        occupied = [[], [], []]
        label_left, label_right = x + 7, x + width - 7
        for anchor, label in sorted(labels):
            tw = pdfmetrics.stringWidth(label, "Helvetica", 5.6)
            best = None
            for row, spans in enumerate(occupied):
                stops = [(label_left - 4, label_left - 4)] + sorted(spans) + [(label_right + 4, label_right + 4)]
                for previous, following in zip(stops, stops[1:]):
                    lo, hi = previous[1] + 4, following[0] - 4
                    if hi - lo < tw: continue
                    left = min(max(anchor - tw / 2, lo), hi - tw)
                    cost = abs(left + tw / 2 - anchor) + row * 2
                    if best is None or cost < best[0]: best = (cost, row, left)
            if best is None: raise RuntimeError(f"No clear annotation slot for {ident} / {side} / {label}")
            _, row, left = best
            occupied[row].append((left, left + tw))
            label_y = base - 11 - row * 9
            centre = left + tw / 2
            self.c.setStrokeColor(LINE); self.c.setLineWidth(.3)
            self.c.line(anchor, base + 1, anchor, base - 4)
            self.c.line(anchor, base - 4, centre, label_y + 6)
            self.text(left, label_y, label, 5.6, "Helvetica", MUTED)
        self.text(x + 6, y + height - 3, f"{side}  /  面向{'北' if side == 'N' else '南' if side == 'S' else '东' if side == 'E' else '西'}墙", 8.5, "Sans")
        self.text(ox, y + 4, f"{length:.2f} m  /  模型净高 {self.level:.2f} m", 6.5, "Sans", MUTED)

    def cover(self):
        self.start("CT-00", "", "")
        self.text(MARGIN, H - 151, "迟庭", 49, "Song")
        self.text(MARGIN + 2, H - 184, "CHITING", 22, "Times-Roman", MUTED)
        self.text(MARGIN + 2, H - 206, "A HOUSE WITH TIME", 10, "Helvetica", MUTED)
        self.para("给工作的专注，也给生活的余地。", MARGIN + 2, 266, 235, 15, 24, INK, "Song")
        self.para("一座庭院住宅的概念协调设计册\n平面 / 门窗 / 家具 / 立面 / 剖面 / 日常", MARGIN + 2, 205, 235, 10, 18, MUTED)
        self.plan(335, 92, 448, 392, labels=False, all_ids=False)
        self.text(MARGIN + 2, 77, "200 m² CONCEPT GFA  /  30 m² COURTYARD", 8, "Helvetica", MUTED)
        self.text(MARGIN + 2, 59, f"Caelum  ·  2026.10  ·  REV {REVISION}", 8, "Helvetica", MUTED)

    def intent(self):
        self.start("CT-01", "让日常成为设计的依据", "BRIEF / 从实际文字与使用场景出发")
        self.column("01  一个人，也能完整生活", ["研究、吃饭、洗衣、储物与休息具有同等的设计地位。首期主屋约200㎡，先完成每日会使用的地方。", "四间独立空间为主卧、书房、多功能客房与可逆画室；健身、影音与泳池放入明确分期，不挤入每个房间。"], MARGIN, 443, 225)
        self.column("02  人与机器分别安放", ["书房容纳思考、判断与设备工作；离开书房后，茶、阅读、音乐和睡眠有各自成立的地方。", "设备选型、散热与电源以实际清单为准；不把住宅变成全天候可见的项目控制台。"], 307, 443, 225)
        self.column("03  美感要经得起使用", ["窗、门、家具、移动路线与空间视图使用同一套米制坐标和编号。先校核能否生活，再讨论画面。", "材料允许触摸、清洁与修补；整齐来自物有所归，也来自愿意保留空处。"], 573, 443, 225)
        self.rule(MARGIN, 180, W - 2 * MARGIN)
        self.para("资料来自公开网站的研究、阅读和文字目录，以及居住者本轮明确提出的生活需求。本文是设计方理解，未转载新随笔，也不从兴趣推断心理或身体状况。", MARGIN, 160, W - 2 * MARGIN, 10, 17, MUTED)

    def general_plan(self):
        self.start("A-01", "全屋家具平面", "同一空间模型 / 门窗与家具编号贯穿本册")
        P, scale = self.plan(40, 67, 548, 405, labels=True, all_ids=True)
        self.c.setStrokeColor(MUTED); self.c.setLineWidth(.5)
        for a, b, offset, label in [((0, 0), (14, 0), 15, "14.00 m 控制线"), ((0, 0), (0, 14), -20, "14.00 m")]:
            pa, pb = P(a), P(b)
            if a[1] == b[1]:
                yy = pa[1] + offset
                self.c.line(pa[0], yy, pb[0], yy)
                for xx in (pa[0], pb[0]): self.c.line(xx, yy - 3, xx, yy + 3)
                self.text((pa[0] + pb[0]) / 2 - 34, yy + 4, label, 6.4, "Sans", MUTED)
            else:
                xx = pa[0] + offset
                self.c.line(xx, pa[1], xx, pb[1])
                for yy in (pa[1], pb[1]): self.c.line(xx - 3, yy, xx + 3, yy)
                self.c.saveState(); self.c.translate(xx - 5, (pa[1] + pb[1]) / 2 - 17); self.c.rotate(90)
                self.text(0, 0, label, 6.4, "Sans", MUTED); self.c.restoreState()
        self.text(66, 431, "N", 8, "Helvetica", GREEN)
        self.c.setStrokeColor(GREEN); self.c.line(69, 405, 69, 425)
        self.c.line(69, 425, 66, 418); self.c.line(69, 425, 72, 418)
        self.text(65, 391, "概念北向", 6, "Sans", MUTED)
        for i in range(4):
            self.c.setFillColor(INK if i % 2 == 0 else PAPER)
            self.c.rect(157 + i * scale, 56, scale, 3.5, fill=1, stroke=1)
        self.text(155, 45, "0", 6, "Helvetica", MUTED)
        self.text(157 + 4 * scale - 7, 45, "4 m", 6, "Helvetica", MUTED)
        x = 616
        self.column("一个完整的家", ["公共：起居书茶、餐厨与庭院。", "私密：主卧、独立书房、多功能客房、可逆画室。", "服务：入口、家务、回廊与集中卫浴。"], x, 436, 180)
        self.para("蓝线 = 窗\n棕线 = 门与木质家具\n浅绿 = 室外庭院\n所有尺寸单位为米", x, 274, 180, 8.5, 16, MUTED)
        self.para("控制线与概念净面积相互协调；34㎡墙体、结构及设备预留仍需在实际场地与结构方案中落实。", x, 163, 180, 8.5, 15, MUTED)

    def movement(self):
        self.start("A-02", "动线与视点", "CIRCULATION / CAMERA REGISTER")
        self.plan(38, 65, 542, 402, labels=False, routes=True, cameras=True)
        rows = [[r.get("id", ""), zh(r.get("label", r.get("name", "生活路径")))] for r in self.routes]
        self.table(["编号", "路径"], rows[:7], 602, 441, [49, 153], size=8.5, row_min=36)
        self.para("主通路、家具与门扇需在同一张图里判断。点线显示生活顺序，并不替代净宽、轮椅转身或疏散核验。", 602, 155, 202, 8.5, 15, MUTED)
        self.para("空间影像的机位由模型记录；画面须同时核对开口方向、窗台高度、家具编号与镜头视角。", 602, 98, 202, 8.5, 15, MUTED)

    def opening_schedule(self, kind):
        label = "门" if kind == "door" else "窗"
        items = [o for o in self.openings if o.get("type") == kind or (kind == "door" and o.get("type") == "passage")]
        self.start("D-01" if kind == "door" else "D-02", f"{label}表与空间关系", "OPENING SCHEDULE / 编号来自空间模型")
        rows = []
        for o in items:
            a, b = self.opening_ends(o)
            width = o.get("width", math.dist(a, b))
            sill = o.get("sill", o.get("sillHeight", 0 if kind == "door" else .8))
            height = o.get("height", o.get("head", 2.2) - sill)
            relation = o.get("rooms", o.get("connects", o.get("room", o.get("zone", ""))))
            if isinstance(relation, list): relation = " / ".join(self.room_name(r) for r in relation)
            else: relation = self.room_name(relation)
            operation = {"hinged": "平开", "sliding": "推拉", "pocket": "入墙移门", "open": "敞开通道", "operable": "可开启", "fixed": "固定玻璃", "fixed-plus-operable": "固定 + 可开启", "operable-obscure": "可开启磨砂高窗"}.get(o.get("operation"), o.get("operation", "概念开口"))
            rows.append([o.get("id", ""), zh(o.get("label", o.get("name", label))), relation, f"{width:.2f}", f"{height:.2f}", f"{sill:.2f}", operation])
        self.table(["编号", "名称", "连接 / 所属空间", "宽 m", "高 m", "窗台 m", "开启概念"], rows, MARGIN, 447, [49, 112, 192, 57, 57, 67, 223 - 0], size=7.9, row_min=25, padding=10)
        self.para("实际订货需补充框洞口、玻璃构造、五金、纱窗、密封、防水与安装节点。门窗表表达当前协调关系，不是采购清单。", MARGIN, 72, W - 2 * MARGIN, 8, 13, MUTED)

    def furniture_schedule(self):
        items = self.furniture
        page_count = max(1, math.ceil(len(items) / 28))
        batch_size = math.ceil(len(items) / page_count)
        for chunk_index, start in enumerate(range(0, len(items), batch_size)):
            part = items[start:start + batch_size]
            self.start(f"F-0{chunk_index + 1}", "家具与器物协调表", "FURNITURE REGISTER / 宽、深、高均读取同一模型")
            rows = []
            for f in part:
                pts = rect_points(f)
                ww = max(p[0] for p in pts) - min(p[0] for p in pts)
                dd = max(p[1] for p in pts) - min(p[1] for p in pts)
                hh = f.get("height", f.get("h", .75))
                if not isinstance(hh, (int, float)): hh = .75
                room_id = f.get("roomId", f.get("room", f.get("zone", "")))
                short_name = {"living": "起居书茶", "study": "独立书房", "bedroom": "主卧", "kitchen": "餐厨", "flex": "多功能客房", "reserve": "可逆画室", "bath": "卫浴", "entry": "入口家务", "garden": "庭院"}.get(room_id, self.room_name(room_id))
                rows.append([f.get("id", ""), short_name, zh(f.get("label", f.get("name", f.get("type", "家具")))), f"{ww:.2f} × {dd:.2f} × {hh:.2f}"])
            split = math.ceil(len(rows) / 2)
            for i, batch in enumerate((rows[:split], rows[split:])):
                self.table(["编号", "空间", "家具 / 设备", "宽 × 深 × 高 m"], batch, MARGIN + i * 390, 447, [43, 83, 120, 122], size=7.6, row_min=24, padding=10, line_factor=1.3)
            self.para("家具为概念占位，材质、五金与净距待深化。地毯、平台与展开状态按模型记录；尺寸并非采购规格。树木高度为景观占位，不是室内家具高度。", MARGIN, 67, W - 2 * MARGIN, 8.1, 13, MUTED)

    def elevations(self, ident, code):
        self.start(code, f"{self.room_name(ident)} · 四向室内立面", "ELEVATIONS / 同模型投影，家具前后关系需结合平面阅读")
        for i, side in enumerate(("N", "E", "S", "W")):
            self.elevation(ident, side, MARGIN + (i % 2) * 392, 263 if i < 2 else 75, 366, 169)
        self.para("实线为近墙家具，淡色为远处投影；近墙编号置于下方，以引线对应。L形分段与南/西镜像读取同一模型；其余编号见总平面。", MARGIN, 59, W - 2 * MARGIN, 7.6, 11, MUTED)

    def sections(self):
        self.start("S-01", "穿过庭院的两个剖切", "SECTIONS / 模型地面与室内净高关系")
        self.para("剖面读取平面边界与同一套家具、门窗高度；屋面、基础与34㎡构造设备预留仍需结构及机电方案协调。", MARGIN, 449, W - 2 * MARGIN, 9, 15, MUTED)
        for idx, axis in enumerate(("x", "y")):
            x, y, ww, hh = MARGIN + 14, 270 if idx == 0 else 96, 730, 155
            cut = 12.2 if axis == "x" else 2.4
            self.text(x, y + hh + 6, f"{'A-A  东西向 / y=12.20m' if axis == 'x' else 'B-B  南北向 / x=2.40m'}", 9, "Sans")
            scale = ww / 14
            base = y + 10
            self.c.setFillColor(colors.HexColor("#E7DFCF")); self.c.setStrokeColor(INK); self.c.setLineWidth(.8)
            for zone in self.zones:
                for polygon in zone["polygons"]:
                    lo_x, hi_x = min(p[0] for p in polygon), max(p[0] for p in polygon)
                    lo_y, hi_y = min(p[1] for p in polygon), max(p[1] for p in polygon)
                    if not ((lo_y < cut < hi_y) if axis == "x" else (lo_x < cut < hi_x)): continue
                    lo, hi = (lo_x, hi_x) if axis == "x" else (lo_y, hi_y)
                    self.c.setStrokeColor(LINE)
                    if not zone.get("outdoor"):
                        self.c.line(x + lo * scale, base + self.level * scale, x + hi * scale, base + self.level * scale)
                    self.text(x + lo * scale + 5, base - 12, zh(zone["label"]), 6, "Sans", MUTED)
            for wall in self.walls:
                a, b = self.wall_ends(wall)
                crosses = min(a[1], b[1]) <= cut <= max(a[1], b[1]) if axis == "x" else min(a[0], b[0]) <= cut <= max(a[0], b[0])
                perpendicular = abs(a[0] - b[0]) < 1e-6 if axis == "x" else abs(a[1] - b[1]) < 1e-6
                if not (crosses and perpendicular): continue
                pos = a[0] if axis == "x" else a[1]
                hole = None
                for opening in self.openings:
                    if opening.get("wallId") != wall.get("id"): continue
                    aa, bb = self.opening_ends(opening)
                    lower, upper = sorted((aa[1], bb[1]) if axis == "x" else (aa[0], bb[0]))
                    if lower <= cut <= upper: hole = opening; break
                self.c.setStrokeColor(INK); self.c.setLineWidth(max(1, wall.get("thickness", .12) * scale))
                if hole:
                    self.c.line(x + pos * scale, base, x + pos * scale, base + hole["sill"] * scale)
                    self.c.line(x + pos * scale, base + hole["head"] * scale, x + pos * scale, base + self.level * scale)
                    if hole.get("type") == "window":
                        self.c.setStrokeColor(WATER); self.c.setLineWidth(.7)
                        self.c.line(x + pos * scale, base + hole["sill"] * scale, x + pos * scale, base + hole["head"] * scale)
                        self.text(x + pos * scale + 4, base + hole["head"] * scale - 11, hole["id"], 6, "Helvetica", WATER)
                else:
                    self.c.line(x + pos * scale, base, x + pos * scale, base + self.level * scale)
            self.rule(x - 9, base, ww + 18, INK, 1.2)
            for f in self.furniture:
                pts = rect_points(f)
                if axis == "x":
                    lo, hi = min(p[0] for p in pts), max(p[0] for p in pts)
                    passes = min(p[1] for p in pts) <= cut <= max(p[1] for p in pts)
                else:
                    lo, hi = min(p[1] for p in pts), max(p[1] for p in pts)
                    passes = min(p[0] for p in pts) <= cut <= max(p[0] for p in pts)
                if not passes: continue
                fh = f.get("height", f.get("h", .75))
                if not isinstance(fh, (int, float)) or fh > 3.5: fh = .75
                self.c.setFillColor(colors.HexColor("#E3D3B8")); self.c.setStrokeColor(WOOD)
                z = f.get("baseHeight", 0)
                self.c.rect(x + lo * scale, base + z * scale, (hi - lo) * scale, fh * scale, fill=1, stroke=1)
                self.text(x + lo * scale + 3, base + (z + fh) * scale + 4, f.get("id", ""), 6, "Helvetica", MUTED)
            self.text(x + ww - 100, base - 27, "+0.00  概念地面", 6.4, "Sans", MUTED)
            self.text(x + ww - 105, base + self.level * scale - 14, f"+{self.level:.2f}  室内净高", 7, "Sans", MUTED)

    def room_detail(self, ident, code, title, notes):
        self.start(code, title, "ROOM COORDINATION / 平面、开口与日常动作一起阅读")
        b = self.room_bounds(ident)
        self.plan(43, 83, 465, 361, rooms=[ident], labels=False, all_ids=True, crop=(b[0] - .3, b[1] - .3, b[2] + .3, b[3] + .3))
        self.column(self.room_name(ident), notes, 553, 426, 239)
        self.para("物品的编号与总平面、家具表一致；此页不增加另一套布局。", MARGIN, 65, 477, 8, 13, MUTED)

    def materials(self):
        self.start("M-01", "触感、材料与可维护性", "MATERIAL PALETTE / 同一套克制的材料语言")
        samples = [("M01", "浅色橡木", "柜门、桌面、干区木作；样板确认色差与维护方式。", "#BBA27C"),
                   ("M02", "矿物感暖白", "普通墙面；先试样，再确认基层、耐擦洗与补修。", "#E5DFD0"),
                   ("M03", "亚麻与棉", "窗帘、软坐与床品；遮光、清洗和替换分别考虑。", "#C7C2B1"),
                   ("M04", "耐水矿物面", "厨房与卫浴；防滑、防水、排水和收口优先。", "#9C9E91"),
                   ("M05", "哑光金属", "龙头、五金与局部设备；避免难以维护的混搭。", "#868C86")]
        for i, (code, title, note, color) in enumerate(samples):
            x = MARGIN + i * 154
            self.c.setFillColor(colors.HexColor(color)); self.c.rect(x, 296, 132, 134, fill=1, stroke=0)
            if i == 0:
                self.c.setStrokeColor(colors.HexColor("#A38B66")); self.c.setLineWidth(.35)
                for line in range(12): self.c.line(x + line * 11 + 3, 296, x + line * 11 + 7, 430)
            self.text(x, 275, code, 8, "Helvetica", MUTED)
            self.text(x, 252, title, 13, "Song")
            self.para(note, x, 233, 132, 9, 15)
        self.para("以上为材料方向与原创示意色块。实际样板、预算、供应商与环保/燃烧性能尚未选定；不以屏幕颜色作为订货标准。", MARGIN, 96, W - 2 * MARGIN, 9, 15, MUTED)

    def lighting(self):
        self.start("L-01", "光、声音与可以关闭的感官", "ATMOSPHERE / 用场景组织，不用设备堆砌")
        rows = [["研究", "窗侧光 + 桌面工作灯", "避免显示器反光；可独立控制，离开时只保留需要的光。"],
                ["茶与阅读", "低亮背景 + 局部阅读光", "茶汤、纸张与人的面部可见；灯具不侵入主听位视线。"],
                ["做饭与家务", "连续操作照明", "身体不遮挡切配、清洗与洗衣位置的工作光。"],
                ["睡眠与夜行", "遮光 + 床边灯 + 低位导光", "床上能操作；夜间到卫生间路径明确。"],
                ["音乐", "主听位、可移动软装与可关闭门窗", "设备与耳位先确定，后用试听校正；吸音材料不能替代隔声构造。"],
                ["香气", "局部、主动使用、可收起", "不默认全屋扩香；存放与热源、阳光和茶具分开。"]]
        self.table(["生活场景", "设计策略", "协调检查"], rows, MARGIN, 445, [100, 220, 438], size=10, row_min=47)
        self.para("色温、照度、显色性、调光与控制回路在样板与灯光计算阶段确定。本页不伪装成已完成的照明计算或声学测量。", MARGIN, 102, W - 2 * MARGIN, 9, 15, MUTED)

    def services(self):
        self.start("ME-01", "隐在日常背后的系统", "SERVICES / 把检修、清洁和更换一并设计")
        rows = [["机器与网络", "设备清单、线缆、路由、数据及备用电源需求", "实测功耗与噪声后核定散热；设备位可开门检修。"],
                ["通风与温控", "卧室夜间、书房机器、厨房与湿区分别校核", "新风、排风与空调路径同步；不因隔声而堵塞通风。"],
                ["水与排水", "厨房、茶清洗、卫浴、洗衣与庭院排水", "热水距离、防水、坡度、存水弯与检修口进入深化。"],
                ["家务与储物", "入口衣鞋、快递、清洁工具、耗材和垃圾", "常用物件可取可归；柜门、抽屉与洗衣设备开启后仍能通行。"],
                ["维修与更换", "五金、灯具、设备、墙地面及窗帘", "保留型号与维护记录；可拆换的构造优先，避免封死检修。"]]
        self.table(["系统", "需要确认", "设计原则"], rows, MARGIN, 444, [115, 300, 343], size=9.8, row_min=57)
        self.para("现阶段只协调空间条件。回路、管径、机组容量、配电、结构与防火均需在实际设备及场地确定后由相应专业计算。", MARGIN, 104, W - 2 * MARGIN, 9, 15, MUTED)

    def life(self):
        self.start("U-01", "在这里过一天", "LIVING SCRIPT / 从动作反查设计")
        scenarios = [("早晨", "起床 → 卫浴 → 更衣 → 早餐 → 书房", "两个人不必互相让路；常用物品在起身后自然可及。"),
                     ("傍晚", "放包换鞋 → 洗手 → 取杯 → 烧水 → 坐下", "备茶、倒水、洗杯、晾干与归柜形成完整回路。"),
                     ("朋友来访", "入口 → 公共坐席 → 用餐 → 客房", "来客可找到卫生间；留宿路线不穿过主卧。"),
                     ("夜间", "收杯 → 关声音与灯 → 卧室 → 夜间卫浴", "工作文件不需先搬开，才能开始休息。")]
        for i, (title, route, note) in enumerate(scenarios):
            x = MARGIN + (i % 2) * 392; y = 438 - (i // 2) * 184
            self.text(x, y, f"0{i + 1}", 27, "Times-Roman", WOOD)
            self.text(x + 48, y + 2, title, 19, "Song")
            self.rule(x, y - 15, 355)
            yy = self.para(route, x, y - 31, 355, 11, 19)
            self.para(note, x, yy - 13, 355, 10, 17, MUTED)

    def areas(self):
        self.start("Q-01", "面积与适度的尺度", "AREA SCHEDULE / 净功能、构造预留与室外分别计算")
        rows = [[self.room_name(r["id"]), f"{r['area']:.2f}", "独立室外，不计入总建面" if r["id"] == "garden" else zh(r.get("dimensions", ""))] for r in self.house["rooms"]]
        self.table(["空间", "面积 m²", "当前控制关系"], rows, MARGIN, 447, [180, 90, 488], size=9.3, row_min=28)
        self.text(MARGIN, 126, "166㎡ 净功能 + 34㎡ 构造设备预留 ≈ 200㎡ 概念建面", 15, "Song")
        self.para("庭院30㎡另列。图纸控制线不是施工净尺寸；实际总建面、计容与雨棚规则需结合场地和当地要求重算。适居尺度还取决于清洁投入、通行距离和日常实际使用范围。", MARGIN, 101, W - 2 * MARGIN, 9, 15, MUTED)

    def tea_and_garden(self):
        if not self.tea or not self.estate:
            raise RuntimeError("REV03 requires the frozen model.tea and model.estate records.")
        drawings = [
            ("T-01", "一席茶，完整的来回", "tea-ritual.svg", "TEA / 柜上烧水，坐下冲泡与慢饮，再清洗归柜", "约0.55m为局部人员服务间隔，并非电壶到桌的全部距离。电热壶留柜，小保温壶短距补水；茶桌的干泡盘和废水盂让人坐着完成冲泡。"),
            ("T-02", "茶区的灯、插座与水", "tea-services.svg", "LIGHT / POWER / WATER / 同一套可追踪点位", "点位表示功能和操作关系。线缆、负荷、回路、防护与给排水构造仍须结合选定设备和项目设计。"),
            ("T-03", "把音乐放在可以坐下的位置", "tea-audio.svg", "LISTENING / 左右对称与主听位的几何试摆", "约60°关系是试听起点；耳高、音箱型号、离墙、反射与低频需实测。茶椅可以听音乐，不假定每一张椅子都是最佳听音位。"),
            ("T-04", "茶柜与物件的归处", "tea-cabinet.svg", "JOINERY / 湿与干、常用与备用分别安放", "柜体、灯具与电器尺寸为概念协调；干茶与精油分柜，湿杯晾干后再收。图中编号回到模型控制表。"),
            ("B-01", "同一面墙，两侧的生活", "courtyard-boundary.svg", "INSIDE / OUTSIDE / 门、窗、窗台、檐口与地面相互核对", "内外共用同一墙段和开口编号；0.24m墙体及屋檐为概念构造研究，防水、滴水、热桥与结构尚需技术深化。"),
            ("G-01", "主屋之外，生活向庭院展开", "estate.svg", "HOUSE / GARDEN / PAVILIONS / 约1190㎡假想地块", "场地边界、泳池隔离、园路、植物与附属空间分别表达。没有选址、实测地形或远山假设，图示不表示当地可建条件已核准。"),
        ]
        for code, title, filename, subtitle, caption in drawings:
            self.diagram_page(code, title, filename, subtitle, caption)
        self.control_register()
        self.estate_program()

    def control_register(self):
        def collect(value, group, found, parent_label=""):
            if isinstance(value, dict):
                if isinstance(value.get("id"), str):
                    record = value
                    if "label" not in value:
                        suffix = {"opening": "步行门", "gate": "出入口", "wing": "生活翼", "walls": "生活翼墙段", "openings": "生活翼门窗"}.get(group, group)
                        title = suffix if group in {"wing", "walls", "openings"} else (parent_label + " · " if parent_label else "") + suffix
                        record = {**value, "label": title}
                    found.setdefault(value["id"], (group, record))
                for key, child in value.items():
                    if isinstance(child, (list, dict)):
                        collect(child, key, found, zh(value.get("label", parent_label)))
            elif isinstance(value, list):
                for child in value: collect(child, group, found, parent_label)
        records = {}
        collect(self.tea, "tea", records)
        collect(self.estate, "estate", records)
        collect(self.courtyard_boundary, "courtyardBoundary", records)
        rows = []
        for ident, (group, item) in records.items():
            description = zh(item.get("description", item.get("note", item.get("detail", item.get("strategy", ""))))).rstrip("。；; ")
            if item.get("spec"):
                description += ("；" if description else "") + zh(item["spec"]).rstrip("。；; ")
            if item.get("roofEdge", {}).get("description"):
                description += ("；" if description else "") + zh(item["roofEdge"]["description"]).rstrip("。；; ")
            details = []
            if item.get("position") and isinstance(item["position"], list):
                details.append("模型坐标 " + ", ".join(f"{v:g}" for v in item["position"] if isinstance(v, (float, int))) + " m")
            if item.get("a") and item.get("b"):
                details.append(f"({', '.join(f'{n:g}' for n in item['a'])}) → ({', '.join(f'{n:g}' for n in item['b'])}) / 线长 {math.dist(point(item['a']), point(item['b'])):.2f}m")
            if isinstance(item.get("rect"), dict):
                rect = item["rect"]
                details.append(f"占位框 {rect.get('w', 0):g} × {rect.get('d', 0):g}m")
            if item.get("connects"):
                names = {"outside": "室外", "gym": "健身", "changing": "淋浴更衣", "plant": "设备", "media": "影音"}
                details.append("连接 " + " / ".join(names.get(v, v) for v in item["connects"]))
            if item.get("wallId"): details.append("所属 " + item["wallId"])
            if item.get("selfClosing"): details.append("自闭")
            if item.get("selfLatching"): details.append("自动扣合")
            for key, title in [("mountHeight", "安装高"), ("mountingHeight", "安装高"), ("height", "高度"), ("area", "面积")]:
                value = item.get(key)
                if isinstance(value, (int, float)):
                    details.append(f"{title} {value:g}" + ("㎡" if key == "area" else "m"))
            if details: description = description + ("；" if description else "") + " / ".join(details)
            rows.append([ident, zh(item.get("label", item.get("name", group))), description or "概念控制条目；几何位置与关系以同源图版为准。"])
        groups, group, consumed = [], [], 0
        for row in rows:
            sizes = []
            for value, width in zip(row, [81, 190, 487]):
                style = ParagraphStyle("measure", fontName="Sans", fontSize=8.5, leading=12.75, wordWrap="CJK")
                p = Paragraph(escape(str(value)), style)
                sizes.append(p.wrap(width - 14, H)[1])
            row_height = max(31, max(sizes) + 12)
            if group and consumed + row_height > 348:
                groups.append(group); group, consumed = [], 0
            group.append(row); consumed += row_height
        if group: groups.append(group)
        for page_index, group in enumerate(groups):
            self.start(f"T-R{page_index + 1}", "茶室与园居 · 控制编号", "REGISTER / 用编号连接图版、设备、收纳与分期")
            self.table(["编号", "项目", "用途、位置与待深化条件"], group, MARGIN, 446, [81, 190, 487], size=8.5, row_min=31, padding=12, line_factor=1.5)
            self.para("本表不替代产品选型、回路、给排水、树木根域或施工规格。数值与描述直接读取本次模型，不建立另一套门窗、家具或点位。", MARGIN, 74, W - 2 * MARGIN, 8, 13, MUTED)

    def estate_program(self):
        self.start("G-02", "园居的尺度与分期", "PHASING / 先让每一期成为完整的生活")
        area = self.estate["areaSummary"]
        program = {item["id"]: item for item in self.estate["program"]}
        core_g, core_n = area["coreGrossArea"], area["coreNetArea"]
        extra_g, extra_n = area["additionalGrossArea"], area["additionalNetArea"]
        total_g, total_n = area["totalGrossArea"], area["totalNetArea"]
        rows = [
            ["首期主屋", f"{core_g:g}㎡建面 / {core_n:g}㎡净功能", f"原{program['studio']['area']:g}㎡可变房用于画室；茶、听音与家务先完成。{area['courtyardArea']:g}㎡内庭另列。"],
            ["第二期生活翼", f"{extra_g:g}㎡新增建面 / {extra_n:g}㎡净功能", f"健身{program['gym']['area']:g}㎡ + 影音{program['media']['area']:g}㎡ + 淋浴/设备服务{program['wing-service']['area']:g}㎡；另{extra_g-extra_n:g}㎡构造预留。"],
            ["第三期泳池", f"{area['poolWaterArea']:g}㎡水面 + {area['poolDeckArea']:g}㎡池畔", "室外面积另列。独立四边围界与自闭、自锁门，与普通园路分开。"],
            ["完整远景", f"{total_g:g}㎡概念建面 / {total_n:g}㎡净功能", f"{total_g-total_n:g}㎡构造设备预留尚需技术落实。{area['parcelArea']:g}㎡仅为假想场地，不能推导真实容积率或覆盖率。"],
        ]
        self.table(["阶段", "面积口径", "这一期需要一起完成的内容"], rows, MARGIN, 444, [115, 221, 422], size=9.2, row_min=44)
        self.column("一棵桂花，先作为候选", ["桂花典型高约3–6m、冠幅3–4.3m，喜排水良好与日照或半阴。先保留外园树位、根域与维护路线；内庭树种不因画面喜好仓促锁定。", "温带可研究鸡爪槭的枝影与季相；热带可研究九里香的局部香花。选址后按品种、土壤、风与维护投入决定。"], MARGIN, 209, 350)
        self.column("少而必要的后台", ["生活翼给换衣、毛巾、湿衣和淋浴留位置；泳池设备、清洁品和园艺工具有可检修的地方。", "首期完成茶与基本庭院，使用后再定运动/影音设备，最后落定泳池。空处仍可以保留为空处。"], 449, 209, 350)

    def garden_sources(self):
        entries = [
            ("Norm Architects / Pavillion House", "附属工作室与音乐、电视、工作功能；与主屋连续的材料和开窗节奏。", "https://normcph.com/project/pavillion-house/"),
            ("John Pawson / Picornell House", "场地、光、庭院与泳池的秩序；不将其坡地和地中海条件直接照搬。", "https://www.johnpawson.com/works/picornell-house"),
            ("NC State / Osmanthus fragrans", "桂花的典型尺度、日照、排水与耐寒分区；品种及本地适生仍待核实。", "https://plants.ces.ncsu.edu/plants/osmanthus-fragrans/"),
            ("NC State / Acer palmatum", "鸡爪槭的遮阴、土壤与风、热条件，作为有限气候备选。", "https://plants.ces.ncsu.edu/plants/acer-palmatum/"),
            ("NParks / Murraya paniculata", "九里香的香花、热带及季风环境与维护条件。", "https://www.nparks.gov.sg/florafaunaweb/flora/2/2/2239"),
            ("Genelec / Studio Monitor Placement", "左右对称、约60°关系与主听位；摆位与房间的共同影响。", "https://www.genelec.com/monitor-placement"),
            ("Ippodo Tea / Tea storage", "茶叶避日光、高温、湿气和强气味；干茶与精油分柜。", "https://ippodotea.com/blogs/frequently-asked-questions/how-should-i-store-my-tea"),
            ("MUJI / Essential oil storage", "原瓶密闭、通风冷暗处，避火源与浴室湿气。", "https://faq.muji.com/エッセンシャルオイルの保存方法を教えてください-65cc5db10182170025c1f65b"),
            ("CDC / Preventing Drowning", "泳池四边隔离与自闭、自锁门；实际设计按所在地核实。", "https://www.cdc.gov/drowning/prevention/index.html"),
            ("Pool Safely / Pool barriers", "独立围界与可控入口，是泳池方案本身的一部分。", "https://www.poolsafely.gov/2017/05/08/summer-safety-barrier-checklist-for-pool-and-spa-owners/"),
        ]
        for i, offset in enumerate((0, 5)):
            self.start(f"R-0{i + 2}", "园居与日常 · 官方资料", "REFERENCES / 研究日期 2026.10.21 / 设计转译与出处分开")
            y = 445
            for title, lesson, url in entries[offset:offset + 5]:
                self.text(MARGIN, y, title, 11, "Helvetica")
                y = self.para(lesson, MARGIN, y - 14, W - 2 * MARGIN, 9, 14) - 7
                display = "faq.muji.com / 精油保存方法（点击查看官方条目）" if "faq.muji.com" in url else url
                self.text(MARGIN, y, display, 8, "Sans" if "faq.muji.com" in url else "Helvetica", MUTED)
                self.c.linkURL(url, (MARGIN, y - 2, min(W - MARGIN, MARGIN + 710), y + 10), relative=0)
                y -= 32
            self.para("以上是可核对的官方研究依据，不表示设计者为迟庭提供服务、产品背书或当地合规确认。选址、样板与实际使用反馈将继续改变方案。", MARGIN, 79, W - 2 * MARGIN, 8.5, 14, MUTED)

    def next_stage(self):
        self.start("P-01", "从概念走向可实施的下一步", "DESIGN DEVELOPMENT / 当前成果的用途与边界")
        rows = [["本轮已协调", "米制模型、九区关系、门窗家具编号、空间机位、生活动线与同源图纸。", "用作沟通、比较、发现矛盾和明确需求。"],
                ["需求核实", "居住人数、设备与藏书清单、做饭与来访习惯、预算、清洁维护投入。", "将兴趣转成具体器物与尺寸，避免凭空定制。"],
                ["场地与方案", "地块、朝向、气候、邻里、隐私、地形、审批条件与结构体系。", "修订开口、遮阳、屋顶、庭院和基础。"],
                ["扩初与样板", "结构机电协调、厨卫、柜体、材料样板、灯光与声学试验。", "形成可比较的规格、数量、预算与维护策略。"],
                ["施工与采购", "节点、图纸、计算、供应商、施工组织、验收与保修。", "由具备当地资质的专业团队实施与签认。"]]
        self.table(["阶段", "工作内容", "用于判断什么"], rows, MARGIN, 446, [111, 359, 288], size=9.3, row_min=56)
        self.para("本册为概念协调设计资料。未选择真实地块，也未完成结构、消防、无障碍、能耗、采光或工程造价核验；不能直接施工或订货。", MARGIN, 109, W - 2 * MARGIN, 9, 15, MUTED)

    def sources(self):
        self.start("R-01", "设计的脉络与资料", "REFERENCES / 原创转译，不借用作者署名或工程背书")
        entries = [("Aino & Alvar Aalto / The Aalto House", "工作与居住既相连又有边界，亲密尺度与朴素材料。", "https://www.alvaraalto.fi/en/architecture/the-aalto-house/"),
                   ("John Pawson / Philippines House", "庭院、回廊、光与公共私密层次的关系。", "https://www.johnpawson.com/works/philippines-house"),
                   ("Norm Architects / Forest Retreat", "木、灰泥与织物的克制触感，室内与自然远景相接。", "https://normcph.com/project/forest-retreat/"),
                   ("Kengo Kuma & Associates / Wood/Peel", "木与植物过滤光线、视线与边缘。", "https://kkaa.co.jp/project/wood-peel/")]
        y = 444
        for title, lesson, url in entries:
            self.text(MARGIN, y, title, 11, "Helvetica")
            y = self.para(lesson, MARGIN, y - 15, W - 2 * MARGIN, 9, 15) - 7
            self.text(MARGIN, y, url, 8, "Helvetica", MUTED)
            self.c.linkURL(url, (MARGIN, y - 2, min(W - MARGIN, MARGIN + pdfmetrics.stringWidth(url, 'Helvetica', 8)), y + 9), relative=0)
            y -= 28
        self.rule(MARGIN, y + 8, W - 2 * MARGIN)
        self.para("官方项目用于研究原则，未复制其平面或项目照片。迟庭的平面、空间模型与本册为独立概念研究；本册不表示上述设计师参与或认可。", MARGIN, y - 7, W - 2 * MARGIN, 9, 15, MUTED)
        self.para("数据源：web/room/spatial-model.js；web/public/data/house.json。\n居住需求依据：公开人物文档、文章与阅读目录，以及本轮明确提出的需求。图册由 scripts/build-house-dossier.py 可重复生成。", MARGIN, 116, W - 2 * MARGIN, 8.5, 15, MUTED)

    def finish(self):
        self.c.save()

    def build(self):
        self.cover(); self.intent(); self.general_plan(); self.movement()
        self.opening_schedule("door"); self.opening_schedule("window")
        self.furniture_schedule()
        for ident, code in [("living", "E-01"), ("study", "E-02"), ("bedroom", "E-03")]:
            self.elevations(ident, code)
        self.sections()
        self.room_detail("kitchen", "A-03", "餐厨与茶的完整回路", ["洗、切、炒顺序与餐椅后退空间分别核对。茶席到水源、清洗、废水和收纳的距离计入使用。", "操作照明、插座、排烟与可检修位置在装修前共同决定。材料耐清洗、能补修，再考虑表面效果。"])
        self.room_detail("bath", "A-04", "卫浴与安静的家务秩序", ["完整浴室与独立客用洗手间集中布置，分别开门。朋友来访时不用进入卧室。", "防水、排风、排水与检修先于装饰。现布局仍需完整净距、无障碍及设备开启检查。"])
        self.materials(); self.lighting(); self.services(); self.life(); self.areas()
        self.tea_and_garden()
        self.next_stage(); self.sources(); self.garden_sources()
        self.finish()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=OUTPUT)
    parser.add_argument("--no-public-copy", action="store_true")
    args = parser.parse_args()
    TMP.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    register_fonts()
    model = load_model()
    snapshot = ROOT / "web/public/docs/drawings/spatial-model.json"
    if model.get("version", 0) >= 3:
        if not snapshot.exists() or json.loads(snapshot.read_text()) != model:
            raise RuntimeError("Export the frozen model and all SVG drawings before building the PDF; the public model snapshot is stale.")
    house = json.loads((ROOT / "web/public/data/house.json").read_text())
    book = Book(args.output, model, house)
    book.build()
    if not args.no_public_copy:
        PUBLIC.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(args.output, PUBLIC)
        assert args.output.read_bytes() == PUBLIC.read_bytes()
    print(json.dumps({"output": str(args.output), "pages": book.page, "model_revision": model.get("revision", model.get("version")), "model_sha256": sha256(json.dumps(model, ensure_ascii=False, sort_keys=True).encode()).hexdigest(), "public_copy": str(PUBLIC) if not args.no_public_copy else None}, ensure_ascii=False))


if __name__ == "__main__":
    main()
