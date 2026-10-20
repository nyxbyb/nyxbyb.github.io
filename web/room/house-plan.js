/* Concept geometry in metres. These control lines are not construction dimensions. */
const NS = 'http://www.w3.org/2000/svg';
const UNIT = 60;
const ORIGIN = { x: 140, y: 180 };
const rectPolygon = (x, y, w, d) => [[x, y], [x + w, y], [x + w, y + d], [x, y + d]];

export const HOUSE_PLAN_GEOMETRY = [
  { id: 'living', label: { zh: '起居 · 书与茶', en: 'Living · books & tea' }, area: 40, polygons: [rectPolygon(0, 5.6, 10, 3.4), rectPolygon(6, 9, 4, 1.5)], labelAt: [4.95, 8.25] },
  { id: 'study', label: { zh: '独立书房', en: 'Independent study' }, area: 14, polygons: [rectPolygon(6, 10.5, 4, 3.5)], labelAt: [8.05, 13.05] },
  { id: 'bedroom', label: { zh: '主卧', en: 'Primary bedroom' }, area: 17.64, polygons: [rectPolygon(0, 0, 4.2, 4.2)], labelAt: [2.1, 3.43] },
  { id: 'kitchen', label: { zh: '餐厨', en: 'Kitchen & dining' }, area: 21.6, polygons: [rectPolygon(10, 5.6, 4, 5.4)], labelAt: [11.75, 10.55] },
  { id: 'flex', label: { zh: '客房 · 多用室', en: 'Guest · multipurpose' }, area: 13.86, polygons: [rectPolygon(7, 0, 3.3, 4.2)], labelAt: [8.65, 2.23] },
  { id: 'reserve', label: { zh: '未来预留室', en: 'A room for later' }, area: 15.54, polygons: [rectPolygon(10.3, 0, 3.7, 4.2)], labelAt: [12.15, 3.35] },
  { id: 'bath', label: { zh: '两处卫浴', en: 'Two bathrooms' }, area: 11.76, polygons: [rectPolygon(4.2, 0, 2.8, 4.2)], labelAt: [5.6, 1.55] },
  { id: 'entry', label: { zh: '玄关 · 家务 · 回廊', en: 'Entry · utility · gallery' }, area: 31.6, polygons: [rectPolygon(0, 4.2, 14, 1.4), rectPolygon(10, 11, 4, 3)], labelAt: [11.65, 12.85] },
  { id: 'garden', label: { zh: '内庭 · 雨与树', en: 'Courtyard · rain & trees' }, area: 30, outdoor: true, polygons: [rectPolygon(0, 9, 6, 5)], labelAt: [2.7, 12.98] }
];

const px = x => ORIGIN.x + x * UNIT;
const py = y => ORIGIN.y + y * UNIT;
const rounded = n => Math.round(n * 1000) / 1000;
const polygonPath = polygon => polygon.map(([x, y], index) => `${index ? 'L' : 'M'}${rounded(px(x))} ${rounded(py(y))}`).join(' ') + 'Z';
const t = (value, lang) => value[lang === 'en' ? 'en' : 'zh'];
const areaLabel = (area, lang) => `${Number(area.toFixed(1))} ${lang === 'en' ? 'm²' : '㎡'}`;

function element(name, attributes = {}, parent) {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
  parent?.append(node);
  return node;
}

function text(parent, x, y, value, attributes = {}) {
  const node = element('text', { x, y, ...attributes }, parent);
  node.textContent = value;
  return node;
}

function metricRect(parent, x, y, width, depth, attributes = {}) {
  return element('rect', { x: px(x), y: py(y), width: width * UNIT, height: depth * UNIT, ...attributes }, parent);
}

function metricLine(parent, x1, y1, x2, y2, attributes = {}) {
  return element('line', { x1: px(x1), y1: py(y1), x2: px(x2), y2: py(y2), ...attributes }, parent);
}

function metricEllipse(parent, x, y, rx, ry, attributes = {}) {
  return element('ellipse', { cx: px(x), cy: py(y), rx: rx * UNIT, ry: ry * UNIT, ...attributes }, parent);
}

function drawWindow(parent, x1, y1, x2, y2) {
  metricLine(parent, x1, y1, x2, y2, { class: 'hp-window' });
  const vertical = x1 === x2;
  metricLine(parent, x1 + (vertical ? -0.048 : 0), y1 + (vertical ? 0 : -0.048), x2 + (vertical ? -0.048 : 0), y2 + (vertical ? 0 : -0.048), { class: 'hp-window-light' });
  metricLine(parent, x1 + (vertical ? 0.048 : 0), y1 + (vertical ? 0 : 0.048), x2 + (vertical ? 0.048 : 0), y2 + (vertical ? 0 : 0.048), { class: 'hp-window-light' });
  const distance = Math.hypot(x2 - x1, y2 - y1);
  const pieces = Math.max(1, Math.round(distance / 1.2));
  for (let i = 0; i <= pieces; i++) {
    const x = x1 + (x2 - x1) * i / pieces, y = y1 + (y2 - y1) * i / pieces;
    metricLine(parent, x + (vertical ? -0.06 : 0), y + (vertical ? 0 : -0.06), x + (vertical ? 0.06 : 0), y + (vertical ? 0 : 0.06), { class: 'hp-window-light' });
  }
}

// Door leaves and arcs show the intended operation; openings remain conceptual.
function northSwing(parent, hingeX, y, width, hingeRight = true) {
  const endX = hingeX + (hingeRight ? -width : width);
  metricLine(parent, hingeX, y, hingeX, y - width, { class: 'hp-door' });
  element('path', { d: `M${px(endX)} ${py(y)} A${width * UNIT} ${width * UNIT} 0 0 ${hingeRight ? 1 : 0} ${px(hingeX)} ${py(y - width)}`, class: 'hp-door-arc' }, parent);
}

function drawDimensions(parent) {
  const h = (a, b, y, label, baseline) => {
    const x1 = px(a), x2 = px(b);
    element('line', { x1, y1: y, x2, y2: y, class: 'hp-dimension' }, parent);
    for (const x of [x1, x2]) {
      element('line', { x1: x - 3, y1: y + 3, x2: x + 3, y2: y - 3, class: 'hp-dimension-tick' }, parent);
      element('line', { x1: x, y1: y + 8, x2: x, y2: baseline, class: 'hp-extension' }, parent);
    }
    text(parent, (x1 + x2) / 2, y - 9, label, { class: 'hp-dimension-label', 'text-anchor': 'middle' });
  };
  h(0, 14, 108, '14.0 m', 166);
  h(0, 4.2, 150, '4.2', 169);
  h(4.2, 7, 150, '2.8', 169);
  h(7, 10.3, 150, '3.3', 169);
  h(10.3, 14, 150, '3.7', 169);
  h(0, 6, 1060, '6.0 m', 1034);
  const vertical = (x, start, end, label, baseline) => {
    const y1 = py(start), y2 = py(end);
    element('line', { x1: x, y1, x2: x, y2, class: 'hp-dimension' }, parent);
    for (const y of [y1, y2]) {
      element('line', { x1: x - 3, y1: y + 3, x2: x + 3, y2: y - 3, class: 'hp-dimension-tick' }, parent);
      element('line', { x1: x - 8, y1: y, x2: baseline, y2: y, class: 'hp-extension' }, parent);
    }
    text(parent, x + 16, (y1 + y2) / 2, label, { class: 'hp-dimension-label', 'text-anchor': 'middle', transform: `rotate(90 ${x + 16} ${(y1 + y2) / 2})` });
  };
  vertical(1025, 0, 14, '14.0 m', 994);
  vertical(98, 9, 14, '5.0 m', 126);
}

function drawWalls(parent) {
  const outer = (x1, y1, x2, y2) => metricLine(parent, x1, y1, x2, y2, { class: 'hp-wall hp-wall-outer' });
  const inner = (x1, y1, x2, y2) => metricLine(parent, x1, y1, x2, y2, { class: 'hp-wall' });
  for (const [a, b] of [[0, .75], [3.45, 4.65], [6.55, 7.5], [9.8, 10.85], [13.55, 14]]) outer(a, 0, b, 0);
  for (const [a, b] of [[.75, 3.45], [4.65, 6.55], [7.5, 9.8], [10.85, 13.55]]) drawWindow(parent, a, 0, b, 0);
  outer(0, 0, 0, 5.9); drawWindow(parent, 0, 5.9, 0, 8.55); outer(0, 8.55, 0, 9);
  outer(0, 9, .45, 9); drawWindow(parent, .45, 9, 5.5, 9); outer(5.5, 9, 6, 9);
  outer(6, 9, 6, 10.8); drawWindow(parent, 6, 10.8, 6, 13.5); outer(6, 13.5, 6, 14);
  outer(6, 14, 6.7, 14); drawWindow(parent, 6.7, 14, 9.3, 14); outer(9.3, 14, 12.2, 14); outer(13.2, 14, 14, 14);
  outer(14, 14, 14, 9.2); drawWindow(parent, 14, 6.2, 14, 9.2); outer(14, 6.2, 14, 0);
  for (const x of [4.2, 7, 10.3]) inner(x, 0, x, 4.2);
  for (const [a, b] of [[0, 3.1], [4, 5.9], [6.8, 8.85], [9.75, 12.7], [13.6, 14]]) inner(a, 4.2, b, 4.2);
  for (const [a, b] of [[0, 2.4], [4.2, 9.7], [11.2, 14]]) inner(a, 5.6, b, 5.6);
  inner(4.2, 2.5, 5.9, 2.5); inner(6.7, 2.5, 7, 2.5);
  inner(5.8, 2.5, 5.8, 3.05); inner(5.8, 3.85, 5.8, 4.2);
  inner(6, 10.5, 10, 10.5);
  inner(10, 9.2, 10, 12.1); inner(10, 13, 10, 14);
  inner(10, 11, 11, 11); inner(12.2, 11, 14, 11);
  northSwing(parent, 4, 4.2, .9);
  northSwing(parent, 6.8, 4.2, .9);
  northSwing(parent, 9.75, 4.2, .9);
  northSwing(parent, 13.6, 4.2, .9);
  northSwing(parent, 6.7, 2.5, .8);
  // The study enters from the vestibule, leaving its courtyard window seat clear.
  metricLine(parent, 10, 13, 9.1, 13, { class: 'hp-door' });
  element('path', { d: `M${px(10)} ${py(12.1)} A${.9 * UNIT} ${.9 * UNIT} 0 0 0 ${px(9.1)} ${py(13)}`, class: 'hp-door-arc' }, parent);
  northSwing(parent, 13.2, 14, 1);
  // Sliding leaf at the compact guest WC avoids a swing through the basin.
  metricLine(parent, 5.76, 2.7, 5.76, 3.5, { class: 'hp-door' });
  metricLine(parent, 5.83, 2.7, 5.83, 3.5, { class: 'hp-door-arc' });
}

function drawFurniture(parent) {
  const cabinet = (x, y, w, d, options = {}) => {
    metricRect(parent, x, y, w, d, { class: 'hp-cabinet', ...options });
    const count = Math.max(1, Math.round(Math.max(w, d) / .55));
    for (let i = 1; i < count; i++) {
      if (w >= d) metricLine(parent, x + w * i / count, y, x + w * i / count, y + d, { class: 'hp-joinery-line' });
      else metricLine(parent, x, y + d * i / count, x + w, y + d * i / count, { class: 'hp-joinery-line' });
    }
  };
  const roundTable = (x, y, rx, ry = rx) => metricEllipse(parent, x, y, rx, ry, { class: 'hp-table' });
  const chair = (x, y, rotation = 0) => {
    const group = element('g', { transform: `rotate(${rotation} ${px(x)} ${py(y)})` }, parent);
    metricRect(group, x - .25, y - .24, .5, .48, { class: 'hp-seat', rx: 7 });
    metricRect(group, x - .25, y - .27, .5, .09, { class: 'hp-seat-back', rx: 3 });
  };
  const plant = (x, y, size = .28) => {
    metricEllipse(parent, x, y, size * .55, size * .55, { class: 'hp-planter' });
    for (const [angle, scale] of [[0, 1], [70, .9], [145, 1.05], [215, .9], [285, 1]]) {
      metricEllipse(parent, x, y - size * .25, size * .3, size * .72, { class: 'hp-leaf', transform: `rotate(${angle} ${px(x)} ${py(y)})`, opacity: .82 * scale });
    }
  };
  // Living room: furniture follows the courtyard rather than a television wall.
  metricRect(parent, 1.05, 6.3, 4.45, 2.15, { class: 'hp-rug', rx: 6 });
  for (let x = 1.22; x < 5.4; x += .15) metricLine(parent, x, 6.43, x, 8.32, { class: 'hp-rug-weave' });
  cabinet(.12, 5.7, 2.06, .36);
  cabinet(4.45, 5.7, 4.9, .36);
  metricRect(parent, 1.25, 6.32, 3.1, .9, { class: 'hp-upholstery', rx: 10 });
  metricRect(parent, 1.37, 6.4, 2.86, .17, { class: 'hp-seat-back', rx: 4 });
  for (const x of [2.3, 3.3]) metricLine(parent, x, 6.64, x, 7.1, { class: 'hp-upholstery-line' });
  metricRect(parent, 1.25, 6.5, .18, .66, { class: 'hp-seat-back', rx: 4 });
  metricRect(parent, 4.17, 6.5, .18, .66, { class: 'hp-seat-back', rx: 4 });
  roundTable(3.0, 7.7, .7, .4);
  metricEllipse(parent, 3.02, 7.7, .11, .11, { class: 'hp-ceramic' });
  for (const x of [2.65, 3.32]) metricEllipse(parent, x, 7.7, .045, .045, { class: 'hp-ceramic' });
  chair(5.15, 7.17, 50); roundTable(5.6, 7.65, .19); plant(.46, 8.5, .35);
  metricRect(parent, 6.55, 9.4, 2.65, .44, { class: 'hp-bench', rx: 4 });
  roundTable(8.38, 8.03, .68); chair(8.36, 7.08); chair(7.36, 8.04, -90); chair(9.34, 8.04, 90);
  plant(9.45, 6.4, .32);
  // Primary bedroom: 1.8 × 2.0 m bed, full-height 0.6 m joinery.
  cabinet(.15, .18, .6, 3.55);
  metricRect(parent, 1.5, .85, 1.8, 2.0, { class: 'hp-bed', rx: 5 });
  metricRect(parent, 1.5, .72, 1.8, .16, { class: 'hp-headboard', rx: 2 });
  for (const x of [1.63, 2.48]) metricRect(parent, x, 1.02, .66, .37, { class: 'hp-pillow', rx: 7 });
  metricLine(parent, 1.55, 1.55, 3.25, 1.55, { class: 'hp-upholstery-line' });
  metricRect(parent, 1.0, .86, .36, .42, { class: 'hp-table', rx: 3 });
  metricRect(parent, 3.43, .86, .36, .42, { class: 'hp-table', rx: 3 });
  // Guest bed remains reversible; its unfolded footprint is deliberately visible.
  metricRect(parent, 7.43, 1.36, 2.05, 1.9, { class: 'hp-future-footprint', rx: 3 });
  metricRect(parent, 7.43, .42, 2.05, .84, { class: 'hp-upholstery', rx: 6 });
  metricRect(parent, 7.55, .5, 1.82, .14, { class: 'hp-seat-back', rx: 3 });
  metricLine(parent, 8.46, .72, 8.46, 1.17, { class: 'hp-upholstery-line' });
  cabinet(9.64, .4, .48, 2.4);
  metricRect(parent, 7.18, 3.38, 1.3, .58, { class: 'hp-table', rx: 3 });
  chair(7.83, 3.02, 180);
  // Reserve room: dashed furniture, no premature fixed use.
  metricRect(parent, 11.1, 1.2, 1.8, .8, { class: 'hp-future-footprint', rx: 3 });
  metricRect(parent, 10.5, .2, .56, 2.5, { class: 'hp-future-footprint' });
  chair(12, 2.35, 180); plant(13.45, .5, .25);
  // Full bathroom, guest WC and a small shared lobby.
  metricRect(parent, 4.35, .15, 1.3, 1.25, { class: 'hp-wet-floor' });
  metricLine(parent, 4.35, .15, 5.65, 1.4, { class: 'hp-fixture-light' });
  metricLine(parent, 5.65, .15, 4.35, 1.4, { class: 'hp-fixture-light' });
  metricEllipse(parent, 5.0, .76, .05, .05, { class: 'hp-ceramic' });
  cabinet(4.35, 1.78, 1.1, .52);
  metricEllipse(parent, 4.9, 2.04, .29, .16, { class: 'hp-ceramic' });
  metricRect(parent, 6.12, .22, .52, .23, { class: 'hp-fixture', rx: 3 });
  metricEllipse(parent, 6.38, .7, .23, .35, { class: 'hp-fixture' });
  metricEllipse(parent, 6.38, .68, .135, .21, { class: 'hp-fixture-light' });
  metricRect(parent, 4.45, 2.68, .5, .2, { class: 'hp-fixture', rx: 3 });
  metricEllipse(parent, 4.7, 3.12, .22, .32, { class: 'hp-fixture' });
  metricRect(parent, 5.18, 2.68, .43, .36, { class: 'hp-fixture', rx: 4 });
  metricEllipse(parent, 5.4, 2.85, .13, .09, { class: 'hp-fixture-light' });
  // A genuinely useful study, overlooking the courtyard to the west.
  cabinet(6.13, 10.65, 1.5, .33);
  cabinet(9.48, 10.72, .37, 1.1);
  cabinet(9.48, 13.22, .37, .5);
  metricRect(parent, 6.4, 11.05, 2.1, .8, { class: 'hp-table', rx: 3 });
  metricRect(parent, 7.13, 11.15, .65, .11, { class: 'hp-equipment', rx: 2 });
  metricLine(parent, 7.45, 11.27, 7.45, 11.43, { class: 'hp-fixture-light' });
  metricLine(parent, 7.25, 11.43, 7.65, 11.43, { class: 'hp-fixture-light' });
  chair(7.5, 12.2, 180); plant(6.43, 13.5, .26);
  // Kitchen keeps sink and extraction on one service edge.
  cabinet(10.25, 5.76, 3.57, .62);
  cabinet(13.18, 6.38, .64, 3.1);
  metricRect(parent, 12.05, 5.83, .75, .44, { class: 'hp-equipment', rx: 3 });
  for (const x of [12.25, 12.58]) for (const y of [5.94, 6.13]) metricEllipse(parent, x, y, .075, .075, { class: 'hp-fixture-light' });
  metricRect(parent, 13.29, 7.42, .41, .65, { class: 'hp-fixture', rx: 5 });
  metricLine(parent, 13.49, 7.35, 13.49, 7.6, { class: 'hp-fixture-light' });
  metricRect(parent, 13.18, 10.1, .64, .7, { class: 'hp-cabinet', rx: 2 });
  metricLine(parent, 13.67, 10.25, 13.67, 10.65, { class: 'hp-joinery-line' });
  metricRect(parent, 11.15, 8.02, .9, 1.8, { class: 'hp-table', rx: 5 });
  for (const y of [8.43, 9.37]) { chair(10.8, y, -90); chair(12.4, y, 90); }
  chair(11.6, 7.66); chair(11.6, 10.16, 180);
  // Utility / entry: appliance, cleaning store, coats and somewhere to sit.
  cabinet(12.4, 11.15, 1.4, .72);
  metricEllipse(parent, 12.77, 11.51, .21, .21, { class: 'hp-fixture-light' });
  metricRect(parent, 13.2, 11.31, .42, .36, { class: 'hp-fixture', rx: 4 });
  cabinet(13.3, 12.25, .52, 1.5);
  metricRect(parent, 10.17, 11.42, .42, 1.35, { class: 'hp-bench', rx: 3 });
  metricRect(parent, 11.5, 13.33, 1.85, .43, { class: 'hp-entry-mat', rx: 2 });
}

function drawGarden(parent) {
  metricRect(parent, .17, 9.17, 5.65, 4.66, { class: 'hp-garden-boundary', rx: 3 });
  metricRect(parent, .45, 9.17, 4.95, 1.1, { class: 'hp-deck' });
  for (let x = .58; x < 5.4; x += .18) metricLine(parent, x, 9.2, x, 10.23, { class: 'hp-deck-line' });
  metricRect(parent, 1.05, 9.55, 2.25, .42, { class: 'hp-bench', rx: 3 });
  for (const [x, y, r] of [[1.0, 12.4, .37], [4.7, 10.9, .22], [4.8, 12.3, .3], [1.25, 10.75, .26]]) metricEllipse(parent, x, y, r, r * .7, { class: 'hp-garden-stone' });
  const tree = element('g', { class: 'hp-tree' }, parent);
  const cx = 3.0, cy = 11.5;
  for (const [x, y, r] of [[0, 0, .76], [.65, -.2, .61], [.3, -.69, .62], [-.42, -.59, .64], [-.67, .05, .63], [-.24, .61, .63], [.52, .47, .63]]) {
    metricEllipse(tree, cx + x, cy + y, r, r * .85, { class: 'hp-tree-canopy' });
  }
  metricLine(tree, cx, cy + .3, cx, cy - .33, { class: 'hp-tree-trunk' });
  metricLine(tree, cx, cy - .05, cx - .36, cy - .4, { class: 'hp-tree-trunk' });
  metricLine(tree, cx, cy + .1, cx + .4, cy - .2, { class: 'hp-tree-trunk' });
  metricEllipse(parent, cx, cy + .24, .07, .07, { class: 'hp-tree-trunk' });
}

const SVG_STYLE = `
.house-plan-svg{display:block;width:100%;height:auto;color:#534f46;overflow:visible;font-family:Georgia,"Noto Serif SC","Songti SC",serif}
.house-plan-svg *{vector-effect:non-scaling-stroke}
.house-plan-svg .hp-zone-hit{stroke:transparent;stroke-width:1.2;transition:fill .22s ease,stroke .22s ease;cursor:pointer}
.house-plan-svg .house-zone[data-id="living"] .hp-zone-hit{fill:#f3ede2}.house-plan-svg .house-zone[data-id="study"] .hp-zone-hit{fill:#f1eadd}
.house-plan-svg .house-zone[data-id="bedroom"] .hp-zone-hit{fill:#f4efe7}.house-plan-svg .house-zone[data-id="kitchen"] .hp-zone-hit{fill:#eeebe2}
.house-plan-svg .house-zone[data-id="flex"] .hp-zone-hit{fill:#f4f0e9}.house-plan-svg .house-zone[data-id="reserve"] .hp-zone-hit{fill:#f6f2eb}
.house-plan-svg .house-zone[data-id="bath"] .hp-zone-hit{fill:#e8e9e3}.house-plan-svg .house-zone[data-id="entry"] .hp-zone-hit{fill:#eeebe5}
.house-plan-svg .house-zone[data-id="garden"] .hp-zone-hit{fill:#e8ecdf}.house-plan-svg .house-zone:hover .hp-zone-hit{fill:#e7dccb}
.house-plan-svg .house-zone.is-selected .hp-zone-hit{fill:#e5d4ba;stroke:#b38a5c;stroke-width:1.4}
.house-plan-svg .house-zone[data-id="garden"].is-selected .hp-zone-hit{fill:#d9e1c9;stroke:#86966d}
.house-plan-svg .house-zone:focus{outline:none}.house-plan-svg .house-zone:focus-visible .hp-zone-hit{stroke:#805d3e;stroke-width:3;stroke-dasharray:4 3}
.house-plan-svg .hp-wall{stroke:#746c5d;stroke-width:3.3;fill:none;stroke-linecap:square}.house-plan-svg .hp-wall-outer{stroke-width:5.4}
.house-plan-svg .hp-window{stroke:#86a09b;stroke-width:1.25;fill:none}.house-plan-svg .hp-window-light{stroke:#9baaa3;stroke-width:.6}
.house-plan-svg .hp-door{stroke:#9a8b76;stroke-width:1.05;fill:none}.house-plan-svg .hp-door-arc{stroke:#aaa18f;stroke-width:.6;fill:none}
.house-plan-svg .hp-cabinet{fill:#d8c5a7;stroke:#a89577;stroke-width:.75}.house-plan-svg .hp-joinery-line{stroke:#bba887;stroke-width:.6}
.house-plan-svg .hp-table{fill:#d9bd96;stroke:#ac8f69;stroke-width:.9}.house-plan-svg .hp-seat{fill:#e5dcc9;stroke:#b3a58e;stroke-width:.8}.house-plan-svg .hp-seat-back{fill:#d2c4ac;stroke:#b3a58e;stroke-width:.7}
.house-plan-svg .hp-upholstery{fill:#ded9cc;stroke:#b9b09e;stroke-width:.85}.house-plan-svg .hp-upholstery-line{stroke:#c0b5a0;stroke-width:.65}.house-plan-svg .hp-bed{fill:#e8e0d1;stroke:#b7ac98;stroke-width:.8}.house-plan-svg .hp-headboard{fill:#c9b28e;stroke:#ae9470;stroke-width:.7}.house-plan-svg .hp-pillow{fill:#f7f2e8;stroke:#c9bfad;stroke-width:.6}
.house-plan-svg .hp-rug{fill:#e8dfcb;stroke:#cabda2;stroke-width:.7}.house-plan-svg .hp-rug-weave{stroke:#d7cbb5;stroke-width:.35}.house-plan-svg .hp-bench{fill:#cbb28b;stroke:#ae9470;stroke-width:.8}
.house-plan-svg .hp-ceramic{fill:#f5eee1;stroke:#a59b85;stroke-width:.7}.house-plan-svg .hp-equipment{fill:#a5a79b;stroke:#7f8579;stroke-width:.8}
.house-plan-svg .hp-future-footprint{fill:none;stroke:#b6aa96;stroke-width:.9;stroke-dasharray:4 3}.house-plan-svg .hp-wet-floor{fill:#d9dfd7;stroke:#a6b4a9;stroke-width:.8}
.house-plan-svg .hp-fixture{fill:#f1f3ed;stroke:#a4b0a4;stroke-width:.75}.house-plan-svg .hp-fixture-light{fill:none;stroke:#a4b0a4;stroke-width:.65}.house-plan-svg .hp-entry-mat{fill:#b8b5a1;stroke:#969a84;stroke-width:.6}
.house-plan-svg .hp-planter{fill:#b3a284;stroke:#968264;stroke-width:.7}.house-plan-svg .hp-leaf{fill:#8f9b7c;stroke:#7e8d6c;stroke-width:.45}
.house-plan-svg .hp-garden-boundary{fill:none;stroke:#a4ae90;stroke-width:.65;stroke-dasharray:3 5}.house-plan-svg .hp-deck{fill:#d9c7a9;stroke:#b7a17e;stroke-width:.75}.house-plan-svg .hp-deck-line{stroke:#bfaa88;stroke-width:.55}.house-plan-svg .hp-garden-stone{fill:#d3d3bf;stroke:#b3b8a1;stroke-width:.55}
.house-plan-svg .hp-tree-canopy{fill:#a4b38c;fill-opacity:.35;stroke:#8fa07a;stroke-width:.6}.house-plan-svg .hp-tree-trunk{fill:#95886b;stroke:#95886b;stroke-width:1.1}
.house-plan-svg .hp-dimension,.house-plan-svg .hp-extension{stroke:#b8b1a2;stroke-width:.55}.house-plan-svg .hp-extension{opacity:.65}.house-plan-svg .hp-dimension-tick{stroke:#9d9584;stroke-width:.85}.house-plan-svg .hp-dimension-label{fill:#8d8678;font:12px Georgia,serif;letter-spacing:.05em}
.house-plan-svg .hp-label{fill:#514e42;font-size:16px;letter-spacing:.06em}.house-plan-svg .hp-area{fill:#91836e;font-size:11.5px;letter-spacing:.03em}.house-plan-svg .hp-small-label{fill:#9b917f;font-size:10px;letter-spacing:.04em}.house-plan-svg .hp-page-note{fill:#9a9485;font-size:11px;letter-spacing:.04em}.house-plan-svg .hp-header-label{fill:#8e8371;font-size:10px;letter-spacing:.22em}
.house-plan-svg .hp-north{fill:#7c7969;stroke:none}.house-plan-svg .hp-scale{fill:#95866d}.house-plan-svg .hp-scale-light{fill:#ddd2bf}
@media(prefers-reduced-motion:reduce){.house-plan-svg .hp-zone-hit{transition:none}}
`;

/** A keyboard-accessible, original architectural concept drawing. No network or storage. */
export function createHousePlan(container, { onSelect = () => {}, language = 'zh', selected = 'living' } = {}) {
  if (!container?.replaceChildren) throw new TypeError('A plan container is required.');
  let currentLanguage = language === 'en' ? 'en' : 'zh';
  let currentSelection = HOUSE_PLAN_GEOMETRY.some(zone => zone.id === selected) ? selected : 'living';
  const svg = element('svg', { viewBox: '0 0 1120 1190', class: 'house-plan-svg', role: 'group', 'aria-label': '', xmlns: NS });
  const title = element('title', {}, svg);
  const description = element('desc', {}, svg);
  element('style', {}, svg).textContent = SVG_STYLE;
  const floor = element('g', { class: 'hp-floors' }, svg);
  const groups = new Map();
  for (const zone of HOUSE_PLAN_GEOMETRY) {
    const group = element('g', { class: 'house-zone', 'data-id': zone.id, role: 'button', tabindex: 0, 'aria-pressed': 'false' }, floor);
    element('path', { d: zone.polygons.map(polygonPath).join(' '), class: 'hp-zone-hit' }, group);
    groups.set(zone.id, group);
  }
  const decoration = element('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }, svg);
  drawGarden(decoration);
  drawFurniture(decoration);
  drawWalls(decoration);
  drawDimensions(decoration);
  const labelLayer = element('g', { 'aria-hidden': 'true', 'pointer-events': 'none' }, svg);
  const labels = new Map();
  for (const zone of HOUSE_PLAN_GEOMETRY) {
    const [x, y] = zone.labelAt;
    const label = text(labelLayer, px(x), py(y), '', { class: 'hp-label', 'text-anchor': 'middle' });
    const area = text(labelLayer, px(x), py(y) + 19, '', { class: 'hp-area', 'text-anchor': 'middle' });
    labels.set(zone.id, { label, area });
  }
  const galleryLabel = text(labelLayer, px(7), py(4.89), '', { class: 'hp-small-label', 'text-anchor': 'middle' });
  const indoorCaption = text(labelLayer, 140, 56, '', { class: 'hp-header-label' });
  const stageCaption = text(labelLayer, 980, 56, '', { class: 'hp-header-label', 'text-anchor': 'end' });
  // A north arrow is an assumption, rather than a surveyed site orientation.
  element('path', { d: 'M1045 89 L1038 111 L1045 105 L1052 111 Z', class: 'hp-north' }, labelLayer);
  text(labelLayer, 1045, 78, 'N', { class: 'hp-dimension-label', 'text-anchor': 'middle' });
  for (let i = 0; i < 5; i++) element('rect', { x: 140 + i * UNIT, y: 1110, width: UNIT, height: 5, class: i % 2 ? 'hp-scale-light' : 'hp-scale' }, labelLayer);
  for (const i of [0, 1, 5]) text(labelLayer, 140 + i * UNIT, 1133, i === 5 ? '5 m' : String(i), { class: 'hp-page-note', 'text-anchor': 'middle' });
  const footer = text(labelLayer, 980, 1133, '', { class: 'hp-page-note', 'text-anchor': 'end' });
  const footnote = text(labelLayer, 140, 1163, '', { class: 'hp-page-note' });

  function select(id) {
    if (!groups.has(id)) return false;
    currentSelection = id;
    for (const [zoneId, group] of groups) {
      const active = zoneId === id;
      group.classList.toggle('is-selected', active);
      group.setAttribute('aria-pressed', String(active));
    }
    return true;
  }

  function setLanguage(lang) {
    currentLanguage = lang === 'en' ? 'en' : 'zh';
    const english = currentLanguage === 'en';
    title.textContent = english ? 'A future home · architectural concept plan' : '未来之家 · 建筑概念平面';
    svg.setAttribute('aria-label', title.textContent);
    description.textContent = english
      ? 'Select a room to explore it. 200 square metres gross: 166 square metres of net program and 34 square metres provisional walls and services. A separate 30 square metre courtyard. Four enclosed rooms. Concept dimensions only; not a construction drawing.'
      : '选择空间查看详情。约200平方米总建面，由166平方米净功能分区和34平方米墙体机电预留组成，另有30平方米庭院。四间可关门的房间。图中为概念控制线，并非施工图。';
    for (const zone of HOUSE_PLAN_GEOMETRY) {
      const name = t(zone.label, currentLanguage);
      const area = areaLabel(zone.area, currentLanguage);
      groups.get(zone.id).setAttribute('aria-label', `${name} · ${area}${zone.outdoor ? (english ? ' · outdoors' : ' · 室外') : ''}`);
      const label = labels.get(zone.id);
      label.label.textContent = name;
      label.label.setAttribute('style', `font-size:${english && name.length > 16 ? 13 : 16}px`);
      label.area.textContent = `${area}${zone.outdoor ? (english ? ' / outdoors' : ' / 室外') : zone.id === 'entry' ? (english ? ' / incl. gallery' : ' / 含回廊') : ''}`;
    }
    galleryLabel.textContent = english ? 'GALLERY  1.4 × 14 m · 19.6 m²' : '回廊  1.4 × 14m · 19.6㎡';
    indoorCaption.textContent = english ? 'GROUND FLOOR / A WORKING IDEA' : '一层平面 / 一个持续生长的想法';
    stageCaption.textContent = english ? 'CONCEPT 01' : '概念方案 01';
    footer.textContent = english ? '166 m² net + 34 m² allowance = 200 m² gross' : '净功能 166㎡ ＋ 预留 34㎡ ＝ 总建面约 200㎡';
    footnote.textContent = english ? 'Control lines only · courtyard excluded from indoor area · local architect to verify' : '尺寸为概念控制线；庭院另计。实际净尺寸、墙体与建筑面积须由建筑师复核。';
  }

  const click = event => {
    const group = event.target.closest?.('.house-zone');
    if (!group || !floor.contains(group)) return;
    const id = group.getAttribute('data-id');
    if (select(id)) onSelect(id);
  };
  const keydown = event => {
    const group = event.target.closest?.('.house-zone');
    if (!group || !floor.contains(group)) return;
    const id = group.getAttribute('data-id');
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (select(id)) onSelect(id);
    } else if (['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      const ids = HOUSE_PLAN_GEOMETRY.map(zone => zone.id);
      let index = ids.indexOf(id);
      if (event.key === 'Home') index = 0;
      else if (event.key === 'End') index = ids.length - 1;
      else index = (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + ids.length) % ids.length;
      groups.get(ids[index]).focus();
    }
  };
  svg.addEventListener('click', click);
  svg.addEventListener('keydown', keydown);
  container.replaceChildren(svg);
  setLanguage(currentLanguage);
  select(currentSelection);
  return {
    select,
    setLanguage,
    destroy() {
      svg.removeEventListener('click', click);
      svg.removeEventListener('keydown', keydown);
      svg.remove();
    }
  };
}

export default createHousePlan;
