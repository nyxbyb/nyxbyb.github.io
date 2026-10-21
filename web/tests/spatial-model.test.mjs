import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SPATIAL_MODEL as model, roomById, wallById, cameraByRoomId } from '../room/spatial-model.js';

const house = JSON.parse(await readFile(new URL('../public/data/house.json', import.meta.url)));
const EPS = 1e-7;
const near = (a, b) => Math.abs(a - b) < EPS;
const bounds = polygon => ({ x: Math.min(...polygon.map(p => p[0])), y: Math.min(...polygon.map(p => p[1])), right: Math.max(...polygon.map(p => p[0])), bottom: Math.max(...polygon.map(p => p[1])) });
const inside = (point, polygons) => polygons.some(polygon => {
  const b = bounds(polygon);
  return point[0] >= b.x - EPS && point[0] <= b.right + EPS && point[1] >= b.y - EPS && point[1] <= b.bottom + EPS;
});
const onSegment = (p, a, b) => near((p[0] - a[0]) * (b[1] - a[1]), (p[1] - a[1]) * (b[0] - a[0])) && p[0] >= Math.min(a[0], b[0]) - EPS && p[0] <= Math.max(a[0], b[0]) + EPS && p[1] >= Math.min(a[1], b[1]) - EPS && p[1] <= Math.max(a[1], b[1]) + EPS;
const distanceToSegment = (point, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dy);
};
const distanceToRect = ([x, y], r) => Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.d));
const sampleLine = (a, b, step = .04) => {
  const count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
  return Array.from({ length: count + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / count, a[1] + (b[1] - a[1]) * i / count]);
};

// Remove only walkable openings: a window cannot make a walking path legal.
const solidWalls = model.walls.flatMap(wall => {
  const axis = near(wall.a[0], wall.b[0]) ? 1 : 0;
  const start = Math.min(wall.a[axis], wall.b[axis]), end = Math.max(wall.a[axis], wall.b[axis]);
  const holes = model.openings.filter(o => o.wallId === wall.id && o.type !== 'window').map(o => [Math.min(o.a[axis], o.b[axis]), Math.max(o.a[axis], o.b[axis])]).sort((a, b) => a[0] - b[0]);
  const segments = [];
  let cursor = start;
  for (const [a, b] of [...holes, [end, end]]) {
    if (a > cursor + EPS) {
      const p = [...wall.a], q = [...wall.a];
      p[axis] = cursor; q[axis] = a;
      segments.push({ id: wall.id, a: p, b: q });
    }
    cursor = b;
  }
  return segments;
});

test('one metre model retains the nine published regions and consistent drawing heights', () => {
  assert.equal(model.units, 'm');
  assert.deepEqual(model.coordinateSystem.north, [0, -1]);
  assert.deepEqual(new Set(model.zones.map(z => z.id)), new Set(house.rooms.map(z => z.id)));
  for (const zone of model.zones) {
    const area = zone.polygons.reduce((sum, polygon) => { const b = bounds(polygon); return sum + (b.right - b.x) * (b.bottom - b.y); }, 0);
    assert.ok(near(area, zone.area), `${zone.id}: geometry / area disagreement`);
    assert.ok(near(zone.area, house.rooms.find(r => r.id === zone.id).area));
    assert.equal(roomById(zone.id), zone);
  }
  for (const key of ['zones', 'spaces', 'walls', 'openings', 'furniture', 'routes', 'cameras']) {
    assert.equal(new Set(model[key].map(item => item.id)).size, model[key].length, `${key}: duplicate ids`);
  }
  assert.ok(near(model.zones.filter(z => !z.outdoor).reduce((a, z) => a + z.area, 0), 166));
  assert.equal(model.envelope.grossArea, model.envelope.netArea + model.envelope.grossAllowance);
  assert.equal(model.ceilingHeight, 2.7);
});

test('numbered doors and windows attach to their walls, adjoining spaces and valid heights', () => {
  for (const opening of model.openings) {
    const wall = wallById(opening.wallId);
    assert.ok(wall, `${opening.id}: missing wall`);
    assert.ok(onSegment(opening.a, wall.a, wall.b) && onSegment(opening.b, wall.a, wall.b), `${opening.id}: detached opening`);
    assert.ok(opening.head > opening.sill && opening.head <= wall.height);
    assert.ok(opening.label.zh && opening.label.en);
    assert.equal(opening.spaceIds.length, 2);
    const midpoint = [(opening.a[0] + opening.b[0]) / 2, (opening.a[1] + opening.b[1]) / 2];
    const vertical = near(opening.a[0], opening.b[0]);
    const sides = vertical ? [[midpoint[0] - .01, midpoint[1]], [midpoint[0] + .01, midpoint[1]]] : [[midpoint[0], midpoint[1] - .01], [midpoint[0], midpoint[1] + .01]];
    for (const id of opening.spaceIds.filter(id => id !== 'outside')) {
      const space = model.spaces.find(space => space.id === id);
      assert.ok(space && sides.some(point => inside(point, space.polygons)), `${opening.id}: does not touch ${id}`);
    }
    if (opening.type !== 'window') assert.equal(opening.sill, 0);
  }
  for (const wall of model.walls) {
    const axis = near(wall.a[0], wall.b[0]) ? 1 : 0;
    const holes = model.openings.filter(o => o.wallId === wall.id).map(o => ({ id: o.id, min: Math.min(o.a[axis], o.b[axis]), max: Math.max(o.a[axis], o.b[axis]) })).sort((a, b) => a.min - b.min);
    for (let i = 1; i < holes.length; i++) assert.ok(holes[i].min >= holes[i - 1].max - EPS, `${holes[i].id} overlaps ${holes[i - 1].id}`);
  }
});

test('all physical spaces connect to the entrance through doors or open passages, including the courtyard and both bathrooms', () => {
  const reached = new Set(['outside']);
  const walkable = model.openings.filter(o => o.type !== 'window');
  let previous;
  do {
    previous = reached.size;
    for (const opening of walkable) if (opening.spaceIds.some(id => reached.has(id))) opening.spaceIds.forEach(id => reached.add(id));
  } while (reached.size > previous);
  for (const space of model.spaces) assert.ok(reached.has(space.id), `${space.id} has no legal entrance`);
  assert.equal(model.openings.find(o => o.id === 'D09').operation, 'sliding');
  assert.ok(model.openings.some(o => o.spaceIds.includes('bath-wc') && o.type === 'door'));
});

test('furniture footprints and camera positions remain in their own spaces', () => {
  for (const item of model.furniture) {
    const zone = roomById(item.roomId), r = item.rect;
    assert.ok(item.label.zh && item.label.en);
    assert.ok(r.w > 0 && r.d > 0 && item.height > 0);
    for (const corner of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]]) assert.ok(inside(corner, zone.polygons), `${item.id} outside ${item.roomId}`);
    if (item.spaceId) {
      const space = model.spaces.find(space => space.id === item.spaceId);
      assert.ok(inside([r.x + r.w / 2, r.y + r.d / 2], space.polygons), `${item.id} outside ${item.spaceId}`);
    }
    if (item.parentId) {
      const support = model.furniture.find(f => f.id === item.parentId);
      assert.ok(support, `${item.id}: missing supporting furniture`);
      assert.equal(item.baseHeight, support.baseHeight + support.height, `${item.id}: floats above / cuts through its support`);
      assert.equal(item.blocking, false, `${item.id}: tabletop object must not duplicate the floor obstacle`);
      const s = support.rect;
      assert.ok(r.x >= s.x && r.y >= s.y && r.x + r.w <= s.x + s.w && r.y + r.d <= s.y + s.d, `${item.id}: overhangs its support`);
    }
  }
  assert.ok(model.cameras.length >= model.zones.length);
  for (const zone of model.zones) assert.equal(model.cameras.filter(c => c.id === 'C-' + zone.id).length, 1);
  for (const camera of model.cameras.filter(c => c.scope !== 'estate')) {
    if (camera.id === 'C-' + camera.roomId) assert.equal(cameraByRoomId(camera.roomId), camera);
    assert.ok(inside(camera.position, roomById(camera.roomId).polygons), `${camera.id}: camera outside its room`);
    assert.ok(inside(camera.target, roomById(camera.roomId).polygons), `${camera.id}: target outside its room`);
    assert.ok(camera.eyeHeight > 1 && camera.eyeHeight < model.ceilingHeight);
    assert.ok(camera.fov >= 45 && camera.fov <= 80);
    for (const item of model.furniture.filter(item => item.blocking)) assert.ok(distanceToRect(camera.position, item.rect) > .05, `${camera.id} intersects ${item.id}`);
  }
  assert.deepEqual(cameraByRoomId('living').position, [9.4, 6.5]);
  assert.equal(model.furniture.filter(item => item.type === 'monitor' && item.roomId === 'study').length, 2);
  assert.deepEqual(model.furniture.filter(item => ['hob', 'sink'].includes(item.type)).map(item => item.parentId).sort(), ['F-K01', 'F-K02', 'F-L10', 'F-R01']);
});

test('the full walking widths pass through real openings and avoid walls and occupied furniture', () => {
  for (const route of model.routes) {
    assert.ok(route.width >= .75);
    for (let i = 1; i < route.points.length; i++) {
      const a = route.points[i - 1], b = route.points[i];
      assert.ok(near(a[0], b[0]) || near(a[1], b[1]), `${route.id}: expected orthogonal route`);
      for (const point of sampleLine(a, b)) {
        for (const wall of solidWalls) assert.ok(distanceToSegment(point, wall.a, wall.b) >= route.width / 2 - EPS, `${route.id} crosses / squeezes past ${wall.id} at ${point}`);
        for (const item of model.furniture.filter(item => item.blocking)) assert.ok(distanceToRect(point, item.rect) >= route.width / 2 - EPS, `${route.id} collides with ${item.id} at ${point}`);
      }
    }
  }
});

test('hinged doors keep the full opening sweep free of occupied furniture', () => {
  for (const door of model.openings.filter(o => o.operation === 'hinged')) {
    const hinge = door[door.hinge];
    const closed = door.hinge === 'a' ? door.b : door.a;
    const width = Math.hypot(door.b[0] - door.a[0], door.b[1] - door.a[1]);
    const direction = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[door.swing];
    const startAngle = Math.atan2(closed[1] - hinge[1], closed[0] - hinge[0]);
    const finishAngle = Math.atan2(direction[1], direction[0]);
    const turn = Math.atan2(Math.sin(finishAngle - startAngle), Math.cos(finishAngle - startAngle));
    for (let step = 0; step <= 24; step++) {
      const angle = startAngle + turn * step / 24;
      const end = [hinge[0] + Math.cos(angle) * width, hinge[1] + Math.sin(angle) * width];
      for (const point of sampleLine(hinge, end)) {
        for (const item of model.furniture.filter(item => item.blocking)) assert.ok(distanceToRect(point, item.rect) > .03, `${door.id} swing hits ${item.id}`);
        for (const camera of model.cameras) assert.ok(Math.hypot(point[0] - camera.position[0], point[1] - camera.position[1]) > .05, `${door.id} swing hits ${camera.id}`);
      }
    }
  }
});

test('tea has useful counter depth, supported fixtures, a clear working aisle and independent scent storage', () => {
  const counter = model.furniture.find(f => f.id === model.tea.counterId), table = model.furniture.find(f => f.id === model.tea.tableId);
  assert.ok(counter.rect.w >= 2.5 && counter.rect.d >= .6);
  assert.ok(table.rect.y - counter.rect.y - counter.rect.d >= 1.19, 'cabinet-to-table working aisle');
  assert.equal(model.furniture.filter(f => f.parentId === counter.id).length, 4);
  assert.ok(model.tea.storage.find(s => s.id === 'ST03').label.zh.includes('托盘'));
  assert.equal(model.tea.storage.find(s => s.id === 'ST04').thermalBreak, true);
  near(model.tea.storage.reduce((sum, s) => sum + s.rect.w, 0), counter.rect.w);
  for (const point of model.tea.points) {
    assert.ok(inside(point.position, roomById('living').polygons), `${point.id}: outside living`);
    assert.ok(point.position[2] > 0 && point.position[2] <= model.ceilingHeight);
    for (const lang of ['zh', 'en']) assert.ok(point.label[lang] && point.description[lang] && point.spec[lang]);
  }
  assert.equal(model.tea.scent.flameFree, true);
  assert.ok(model.tea.scent.disabledSceneIds.includes('tea'));
  assert.ok(!model.tea.scenes.find(s => s.id === 'tea').pointIds.includes('TA01'));
  assert.ok(model.tea.scenes.find(s => s.id === 'solitude').pointIds.includes('TA01'));
  const scent = model.furniture.find(f => f.id === model.tea.scent.furnitureId);
  assert.equal(scent.parentId, 'F-L08');
  assert.ok(counter.rect.x - scent.rect.x > 6, 'separate aroma and dry tea');
  for (const f of model.furniture.filter(f => f.parentId === table.id)) {
    const r = f.rect, t = table.rect;
    for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.d], [r.x + r.w, r.y + r.d]]) assert.ok(((x - t.x - t.w / 2) / (t.w / 2)) ** 2 + ((y - t.y - t.d / 2) / (t.d / 2)) ** 2 <= 1, `${f.id} overhangs the round table`);
  }
  assert.equal(model.furniture.filter(f => f.parentId === table.id).length, 3);
  assert.equal(model.openings.find(o => o.id === 'D09').leafCount, 1);
  near(model.openings.find(o => o.id === 'D09').clearWidth, 1.2);
});

test('tea refill and cleanup stay clear of furniture and do not cross main circulation', () => {
  const mainPoints = model.routes.flatMap(route => route.points.slice(1).flatMap((b, i) => sampleLine(route.points[i], b).map(p => ({ p, radius: route.width / 2 }))));
  for (const route of model.tea.routes) for (let i = 1; i < route.points.length; i++) for (const p of sampleLine(route.points[i - 1], route.points[i])) {
    for (const f of model.furniture.filter(f => f.blocking)) assert.ok(distanceToRect(p, f.rect) >= route.width / 2 - EPS, `${route.id} hits ${f.id}`);
    for (const main of mainPoints) assert.ok(Math.hypot(p[0] - main.p[0], p[1] - main.p[1]) >= route.width / 2 + main.radius - EPS, `${route.id} crosses a primary walking band`);
  }
  assert.ok(model.tea.listening.angleDegrees > 59 && model.tea.listening.angleDegrees < 61);
  near(model.tea.listening.sideDistances.left, model.tea.listening.sideDistances.right);
});

test('art studio has a separate brush sink, drying and drawers that open without blocking the entrance', () => {
  const studio = model.furniture.filter(f => f.roomId === 'reserve');
  for (const type of ['art-counter', 'scroll-stand', 'drying-rack', 'sink']) assert.ok(studio.some(f => f.type === type));
  const sink = studio.find(f => f.type === 'sink');
  assert.equal(sink.parentId, 'F-R01');
  const drawer = studio.find(f => f.openedRect);
  for (const f of studio.filter(f => f.blocking && f.id !== drawer.id)) {
    const r = f.rect, d = drawer.openedRect;
    assert.ok(r.x + r.w <= d.x || d.x + d.w <= r.x || r.y + r.d <= d.y || d.y + d.d <= r.y, `open drawer hits ${f.id}`);
  }
  const route = model.routes.find(r => r.id === 'R04');
  for (let i = 1; i < route.points.length; i++) for (const p of sampleLine(route.points[i - 1], route.points[i])) assert.ok(distanceToRect(p, drawer.openedRect) >= route.width / 2 - EPS);
});

test('estate separates hypothetical land, original core, later wing and outdoor water/deck areas', () => {
  const e = model.estate;
  near(e.bounds.w * e.bounds.d, 1190);
  near(e.program.filter(p => p.phase === 'phase-2').reduce((s, p) => s + p.netArea, 0), 60);
  near(e.program.filter(p => p.phase === 'phase-2').reduce((s, p) => s + p.grossArea, 0), 72);
  near(e.areaSummary.totalGrossArea, 272);
  near(e.areaSummary.totalNetArea, 226);
  const pool = e.program.find(p => p.id === 'pool'), deck = e.program.find(p => p.id === 'pool-deck');
  near(pool.rect.w * pool.rect.d, pool.area);
  near(deck.rect.w * deck.rect.d - pool.area, deck.area);
  for (const p of e.program.filter(p => !p.includedInCore)) {
    assert.ok(p.rect.x >= e.bounds.x && p.rect.y >= e.bounds.y && p.rect.x + p.rect.w <= e.bounds.x + e.bounds.w && p.rect.y + p.rect.d <= e.bounds.y + e.bounds.d);
    for (const q of e.program.filter(q => q.id !== p.id && !q.includedInCore)) {
      if (new Set([p.id, q.id]).has('pool-deck') && new Set([p.id, q.id]).has('pool')) continue;
      assert.ok(p.rect.x + p.rect.w <= q.rect.x || q.rect.x + q.rect.w <= p.rect.x || p.rect.y + p.rect.d <= q.rect.y || q.rect.y + q.rect.d <= p.rect.y, `${p.id} overlaps ${q.id}`);
    }
  }
});

test('estate gates connect arrival, inner court, wing and a separately enclosed pool', () => {
  const e = model.estate, south = e.boundaries.find(b => b.id === 'EB04'), pool = e.poolSafety;
  assert.equal(south.opening.id, 'EG01');
  assert.equal(pool.gate.selfClosing, true); assert.equal(pool.gate.selfLatching, true);
  assert.ok(onSegment(pool.gate.a, [pool.rect.x, pool.rect.y], [pool.rect.x + pool.rect.w, pool.rect.y]));
  assert.ok(onSegment(pool.gate.b, [pool.rect.x, pool.rect.y], [pool.rect.x + pool.rect.w, pool.rect.y]));
  const fences = [...e.boundaries.map(b => ({ ...b, holes: b.openings || (b.opening ? [b.opening] : []) })), ...e.wing.walls.map(w => ({ ...w, holes: e.wing.openings.filter(o => o.wallId === w.id) }))];
  fences.push(...[[[pool.rect.x, pool.rect.y], [pool.rect.x + pool.rect.w, pool.rect.y]], [[pool.rect.x + pool.rect.w, pool.rect.y], [pool.rect.x + pool.rect.w, pool.rect.y + pool.rect.d]], [[pool.rect.x, pool.rect.y + pool.rect.d], [pool.rect.x + pool.rect.w, pool.rect.y + pool.rect.d]], [[pool.rect.x, pool.rect.y], [pool.rect.x, pool.rect.y + pool.rect.d]]].map(([a, b], i) => ({ id: `PF${i + 1}`, a, b, holes: i === 0 ? [pool.gate] : [] })));
  for (const route of [...e.paths, e.wing.mediaAccess]) for (let i = 1; i < route.points.length; i++) {
    const a = route.points[i - 1], b = route.points[i];
    for (const fence of fences) {
      const vertical = nearBoolean(fence.a[0], fence.b[0]);
      if (vertical === nearBoolean(a[0], b[0])) continue;
      const p = vertical ? [fence.a[0], a[1]] : [a[0], fence.a[1]];
      if (onSegment(p, a, b) && onSegment(p, fence.a, fence.b)) assert.ok(fence.holes.some(o => o.type !== 'window' && o.type !== 'blackout-window' && onSegment(p, o.a, o.b)), `${route.id || 'media'} crosses closed ${fence.id}`);
    }
    for (const p of sampleLine(a, b)) for (const f of e.wing.furniture.filter(f => f.blocking !== false)) assert.ok(distanceToRect(p, f.rect) >= route.width / 2 - EPS, `${route.id || 'media'} hits ${f.id}`);
  }
  const reached = new Set(['outside']);
  for (let i = 0; i < 4; i++) for (const door of e.wing.openings.filter(o => o.type === 'door')) if (door.connects.some(id => reached.has(id))) door.connects.forEach(id => reached.add(id));
  for (const id of ['gym', 'changing', 'plant', 'media']) assert.ok(reached.has(id));
});

function nearBoolean(a, b) { return Math.abs(a - b) < EPS; }


test('Chinese painting desk keeps a usable knee bay and a separate eastern brush-sink pedestal', () => {
  const desk=model.furniture.find(f=>f.id==='F-R01'), chair=model.furniture.find(f=>f.id==='F-R03'), bay=desk.kneeSpace, sink=desk.sinkPedestal;
  assert.ok(bay.w>=1.1 && bay.clearHeight>=.72);
  assert.ok(chair.rect.x>=bay.x && chair.rect.x+chair.rect.w<=bay.x+bay.w);
  assert.ok(sink.x>=bay.x+bay.w);
  assert.equal(desk.height,.8);
  assert.equal(model.furniture.some(f=>f.roomId==='reserve'&&f.type==='easel'),false);
});

test('estate fixed cameras stay in the intended rooms or safe dry outdoor surfaces', () => {
  const e=model.estate;
  assert.equal(model.version,4);
  assert.equal(model.cameras.length,14);
  assert.equal(e.wing.furniture.length,15);
  assert.equal(e.outdoorFurniture.length,4);
  for(const id of ['media','gym','pool','outer']){
    const c=model.cameras.find(c=>c.id==='C-'+id);
    assert.equal(c.scope,'estate');
    assert.equal(c.eyeHeight,c.targetHeight);
    assert.ok(c.fov>=45&&c.fov<=80);
    if(['media','gym'].includes(id)){
      const r=e.program.find(p=>p.id===id).rect;
      assert.ok(inside(c.position,[[[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.d],[r.x,r.y+r.d]]]));
    }else{
      const r=e.bounds;
      assert.ok(c.position[0]>r.x&&c.position[0]<r.x+r.w&&c.position[1]>r.y&&c.position[1]<r.y+r.d);
      const pool=e.program.find(p=>p.id==='pool').rect;
      assert.ok(distanceToRect(c.position,pool)>.1,'a photographic point cannot stand in pool water');
    }
    for(const f of [...model.furniture,...e.wing.furniture,...e.outdoorFurniture].filter(f=>f.blocking!==false))assert.ok(distanceToRect(c.position,f.rect)>.05,c.id+' intersects '+f.id);
  }
  for(const o of e.wing.openings){
    const w=e.wing.walls.find(w=>w.id===o.wallId);
    assert.ok(onSegment(o.a,w.a,w.b)&&onSegment(o.b,w.a,w.b));
    assert.ok(o.head>o.sill&&o.head<=w.height);
  }
});

test('the continuous house walk uses real gates and keeps full-width walking bands clear', () => {
  const e=model.estate,p=e.poolSafety,r=p.rect;
  const fences=[...model.walls.map(w=>({...w,holes:model.openings.filter(o=>o.wallId===w.id&&!o.type.includes('window'))})),...e.wing.walls.map(w=>({...w,holes:e.wing.openings.filter(o=>o.wallId===w.id&&!o.type.includes('window'))})),...e.boundaries.map(b=>({...b,holes:b.openings||(b.opening?[b.opening]:[])})),...[[[r.x,r.y],[r.x+r.w,r.y]],[[r.x+r.w,r.y],[r.x+r.w,r.y+r.d]],[[r.x,r.y+r.d],[r.x+r.w,r.y+r.d]],[[r.x,r.y],[r.x,r.y+r.d]]].map(([a,b],i)=>({id:'PF'+i,a,b,holes:i===0?[p.gate]:[]}))];
  const segments=fences.flatMap(w=>{
    const axis=near(w.a[0],w.b[0])?1:0,start=Math.min(w.a[axis],w.b[axis]),end=Math.max(w.a[axis],w.b[axis]),holes=w.holes.map(o=>[Math.min(o.a[axis],o.b[axis]),Math.max(o.a[axis],o.b[axis])]).sort((a,b)=>a[0]-b[0]),parts=[];let cursor=start;
    for(const[a,b]of[...holes,[end,end]]){if(a>cursor+EPS){const p=[...w.a],q=[...w.a];p[axis]=cursor;q[axis]=a;parts.push({id:w.id,a:p,b:q});}cursor=Math.max(cursor,b);}return parts;
  });
  const objects=[...model.furniture,...e.wing.furniture,...e.outdoorFurniture].filter(f=>f.blocking!==false);
  const graph=model.walk,byId=id=>graph.stations.find(s=>s.id===id);
  for(const route of graph.connections){
    assert.deepEqual(route.points[0],byId(route.from).position,route.id+' start');
    assert.deepEqual(route.points.at(-1),byId(route.to).position,route.id+' end');
    assert.ok(route.width>=.75);
    for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i];assert.ok(near(a[0],b[0])||near(a[1],b[1]));
      for(const p of sampleLine(a,b)){
        for(const wall of segments)assert.ok(distanceToSegment(p,wall.a,wall.b)>=route.width/2-EPS,route.id+' hits '+wall.id+' at '+p);
        for(const f of objects)assert.ok(distanceToRect(p,f.rect)>=route.width/2-EPS,route.id+' hits '+f.id+' at '+p);
      }
    }
  }
  const reached=new Set(['entry']);for(let step=0;step<graph.stations.length;step++)for(const c of graph.connections)if(reached.has(c.from)||reached.has(c.to)){reached.add(c.from);reached.add(c.to);}
  assert.equal(reached.size,graph.stations.length);
  assert.ok(graph.connections.some(c=>c.from==='changing'&&c.to==='outer'&&!c.gateIds.includes('PG01')),'the wing must return home without entering the pool enclosure');
  const mediaReturn=graph.connections.find(c=>c.from==='media'&&c.to==='outer');
  assert.ok(mediaReturn,'the media room needs its own exterior return, without detouring through changing');
  assert.deepEqual(mediaReturn.gateIds,['ED03']);
  assert.ok(mediaReturn.points.every(([x])=>x<19),'the return stays on the west garden path');
});
