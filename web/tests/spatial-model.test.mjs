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
  assert.equal(model.cameras.length, model.zones.length);
  for (const camera of model.cameras) {
    assert.equal(cameraByRoomId(camera.roomId), camera);
    assert.ok(inside(camera.position, roomById(camera.roomId).polygons), `${camera.id}: camera outside its room`);
    assert.ok(inside(camera.target, roomById(camera.roomId).polygons), `${camera.id}: target outside its room`);
    assert.ok(camera.eyeHeight > 1 && camera.eyeHeight < model.ceilingHeight);
    assert.ok(camera.fov >= 45 && camera.fov <= 80);
    for (const item of model.furniture.filter(item => item.blocking)) assert.ok(distanceToRect(camera.position, item.rect) > .05, `${camera.id} intersects ${item.id}`);
  }
  assert.deepEqual(cameraByRoomId('living').position, [9.4, 6.5]);
  assert.equal(model.furniture.filter(item => item.type === 'monitor' && item.roomId === 'study').length, 2);
  assert.deepEqual(model.furniture.filter(item => ['hob', 'sink'].includes(item.type)).map(item => item.parentId).sort(), ['F-K01', 'F-K02']);
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
