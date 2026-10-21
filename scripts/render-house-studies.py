"""Rasterize original fixed-camera model studies with a depth buffer.
This draws architectural geometry from source; it does not edit generated images.
Run with the system Python (NumPy, Pillow, PyMuPDF).
"""
import json
import csv
import subprocess
from pathlib import Path
import numpy as np
from PIL import Image
import pymupdf

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'web/public/docs/drawings'
REF = ROOT / 'tmp/house-v4'
OUT.mkdir(parents=True, exist_ok=True)
REF.mkdir(parents=True, exist_ok=True)
source = """
import {SPATIAL_MODEL as model} from './web/room/spatial-model.js';
import {perspectiveSVG,planSVG,elevationSVG,sectionSVG,teaDetailSVG,teaCabinetSVG,courtyardBoundarySVG,estateSVG,estateDetailSVG} from './web/room/spatial-drawings.js';
console.log(JSON.stringify({model,views:model.cameras.map(c=>({id:c.id==='C-tea'?'tea':c.roomId,scene:perspectiveSVG(c.id,'zh',true),plan:['reserve','gym','media','pool','outer'].includes(c.roomId)?estateDetailSVG(c.roomId):planSVG({selected:c.roomId,layer:'cameras'})})),plan:planSVG(),routes:planSVG({layer:'routes'}),openings:planSVG({layer:'openings'}),lighting:planSVG({layer:'lighting'}),services:planSVG({layer:'services'}),section:sectionSVG(),studies:{'tea-ritual':teaDetailSVG('zh','ritual'),'tea-services':teaDetailSVG('zh','services'),'tea-audio':teaDetailSVG('zh','audio'),'tea-cabinet':teaCabinetSVG('zh'),'courtyard-boundary':courtyardBoundarySVG('zh'),'estate':estateSVG('zh')},elevations:model.zones.filter(z=>!z.outdoor).flatMap(z=>['north','east','south','west'].map(d=>({id:z.id+'-'+d,svg:elevationSVG(z.id,d)})))}));
"""
data = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', source], cwd=ROOT))

def raster(scene):
    width, height = scene['width'], scene['height']
    rgb = np.full((height, width, 3), [244, 240, 231], dtype=np.uint8)
    depth = np.zeros((height, width), dtype=np.float64)
    focal = scene['focal']
    for face in scene['faces']:
        pts = np.array(face['points'])
        screen = np.column_stack((600 + focal * pts[:, 0] / pts[:, 2], 365 - focal * pts[:, 1] / pts[:, 2]))
        color = tuple(int(face['fill'].lstrip('#')[i:i+2], 16) for i in [0, 2, 4])
        for i in range(1, len(pts)-1):
            ids = [0, i, i+1]
            a, b, c = screen[ids]
            x0 = max(0, int(np.floor(min(a[0], b[0], c[0]))))
            x1 = min(width-1, int(np.ceil(max(a[0], b[0], c[0]))))
            y0 = max(0, int(np.floor(min(a[1], b[1], c[1]))))
            y1 = min(height-1, int(np.ceil(max(a[1], b[1], c[1]))))
            if x0 > x1 or y0 > y1:
                continue
            denominator = (b[1]-c[1])*(a[0]-c[0])+(c[0]-b[0])*(a[1]-c[1])
            if abs(denominator) < 1e-8:
                continue
            xx, yy = np.meshgrid(np.arange(x0,x1+1)+.5, np.arange(y0,y1+1)+.5)
            u = ((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/denominator
            v = ((c[1]-a[1])*(xx-c[0])+(a[0]-c[0])*(yy-c[1]))/denominator
            w = 1-u-v
            inv = u/pts[ids[0],2]+v/pts[ids[1],2]+w/pts[ids[2],2]
            local_depth = depth[y0:y1+1,x0:x1+1]
            mask = (u>=-1e-9)&(v>=-1e-9)&(w>=-1e-9)&(inv>local_depth)
            local_depth[mask] = inv[mask]
            rgb[y0:y1+1,x0:x1+1][mask] = color
    return Image.fromarray(rgb)

for view in data['views']:
    img = raster(view['scene'])
    img.save(REF / (view['id']+'-geometry.png'))
    img.save(OUT / (view['id']+'-geometry.png'), optimize=True)
    svg = view['plan']
    (REF / (view['id']+'-plan.svg')).write_text(svg)
    if view['id'] in ['reserve','gym','media','pool','outer']:
        (OUT / (view['id']+'-plan.svg')).write_text(svg)
    doc = pymupdf.open(stream=svg.encode(), filetype='svg')
    doc[0].get_pixmap(matrix=pymupdf.Matrix(1.5,1.5), alpha=False).save(REF / (view['id']+'-plan.png'))
for name in ['plan','routes','openings','lighting','services','section']:
    (OUT / (name+'.svg')).write_text(data[name])
for e in data['elevations']:
    (OUT / (e['id']+'.svg')).write_text(e['svg'])
for name, svg in data['studies'].items():
    (OUT / (name+'.svg')).write_text(svg)
    (REF / (name+'.svg')).write_text(svg)
    doc = pymupdf.open(stream=svg.encode(), filetype='svg')
    doc[0].get_pixmap(matrix=pymupdf.Matrix(2,2), alpha=False).save(REF / (name+'.png'))
(OUT / 'spatial-model.json').write_text(json.dumps(data['model'],ensure_ascii=False,indent=2))
with (OUT / 'furniture.csv').open('w', encoding='utf-8-sig', newline='') as stream:
    writer = csv.writer(stream, lineterminator='\n')
    writer.writerow(['code','room','name_zh','name_en','width_m','depth_m','height_m','phase'])
    for item in data['model']['furniture'] + data['model']['estate']['wing']['furniture'] + data['model']['estate']['outdoorFurniture']:
        r = item['rect']
        writer.writerow([item['id'],item['roomId'],item['label']['zh'],item['label']['en'],r['w'],r['d'],item['height'],item.get('phase', 'phase-2' if item['id'].startswith('EF') else 'phase-1')])
print(f"Saved {len(data['views'])} fixed-camera studies and model-derived SVG sheets.")
