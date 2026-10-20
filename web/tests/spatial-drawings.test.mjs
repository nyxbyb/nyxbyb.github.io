import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SPATIAL_MODEL as model } from '../room/spatial-model.js';
import { boundarySegments, doorPlanGeometry, elevationPanels, elevationSVG, lightingPoints, perspectiveSVG, planSVG, sectionGeometry, sectionSVG } from '../room/spatial-drawings.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} ≠ ${b}`);
const room = id => model.zones.find(z => z.id === id);
const furniture = id => model.furniture.find(f => f.id === id);
const inPolygon = (point, polygons) => polygons.some(p => point[0] >= Math.min(...p.map(p => p[0])) && point[0] <= Math.max(...p.map(p => p[0])) && point[1] >= Math.min(...p.map(p => p[1])) && point[1] <= Math.max(...p.map(p => p[1])));

test('door drawing hinges and leaf directions follow each numbered opening', () => {
  for (const door of model.openings.filter(o => o.operation === 'hinged')) {
    const drawn = doorPlanGeometry(door);
    assert.deepEqual(drawn.hinge, door[door.hinge]);
    near(Math.hypot(drawn.open[0] - drawn.hinge[0], drawn.open[1] - drawn.hinge[1]), drawn.width);
    const expected = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }[door.swing];
    near((drawn.open[0] - drawn.hinge[0]) / drawn.width, expected[0]);
    near((drawn.open[1] - drawn.hinge[1]) / drawn.width, expected[1]);
  }
  assert.equal(doorPlanGeometry(model.openings.find(o => o.id === 'D02')).sweep, 0);
  assert.equal(doorPlanGeometry(model.openings.find(o => o.id === 'D03')).sweep, 1);
});

test('L-shaped and disconnected zones produce real boundary segments, not fictitious bounding-box walls', () => {
  assert.deepEqual(boundarySegments('living', 'south').map(s => [s.a, s.b]), [[[0, 9], [6, 9]], [[6, 10.5], [10, 10.5]]]);
  assert.deepEqual(boundarySegments('living', 'west').map(s => [s.a, s.b]), [[[0, 5.6], [0, 9]], [[6, 9], [6, 10.5]]]);
  assert.equal(boundarySegments('entry', 'north').length, 2);
  near(boundarySegments('living').reduce((sum, s) => sum + s.length, 0), 29.8);
  const south = elevationPanels('living', 'south');
  assert.deepEqual(south[0].openings.map(o => o.id), ['D09', 'V06']);
  assert.equal(south[1].openings.length, 0);
  assert.ok(elevationSVG('living', 'south').includes('2 / 2'));
});

test('south and west elevations reverse the view and tabletop objects retain their support height', () => {
  const north = elevationPanels('bedroom', 'north')[0];
  near(north.openings.find(o => o.id === 'V01').left, .75);
  const south = elevationPanels('bedroom', 'south')[0];
  near(south.openings.find(o => o.id === 'D03').left, .2);
  const west = elevationPanels('bedroom', 'west')[0];
  near(west.furniture.find(f => f.id === 'F-B03').left, .47);
  const study = elevationPanels('study', 'north')[0];
  for (const id of ['F-S06', 'F-S07']) {
    const monitor = study.furniture.find(f => f.id === id);
    near(monitor.baseHeight, .74);
    near(monitor.baseHeight + monitor.height, 1.16);
  }
});

test('the longitudinal section cuts the actual bed, sofa, oval table and glazing', () => {
  const section = sectionGeometry();
  assert.deepEqual(section.zones.map(z => z.id), ['bedroom', 'entry', 'living', 'garden']);
  for (const id of ['F-B01', 'F-B02', 'F-L01', 'F-L02']) {
    const f = furniture(id), cut = section.furniture.find(f => f.id === id);
    assert.ok(cut, `${id} missing at x=2.4`);
    near(cut.top, f.baseHeight + f.height);
    if (f.shape !== 'ellipse') { near(cut.a, f.rect.y); near(cut.b, f.rect.y + f.rect.d); }
  }
  const oval = section.furniture.find(f => f.id === 'F-L02');
  assert.ok(oval.a > furniture('F-L02').rect.y);
  assert.ok(oval.b < furniture('F-L02').rect.y + furniture('F-L02').rect.d);
  for (const [wallId, windowId] of [['W01', 'V01'], ['W03', 'V06']]) {
    const wall = section.walls.find(w => w.wallId === wallId), opening = model.openings.find(o => o.id === windowId);
    assert.equal(wall.openingId, windowId);
    assert.deepEqual(wall.parts.find(p => p.kind === 'glass'), { bottom: opening.sill, top: opening.head, kind: 'glass' });
    assert.ok(!wall.parts.some(p => p.kind === 'wall' && p.bottom === 0 && p.top === model.ceilingHeight));
  }
  assert.ok(sectionSVG('en').includes('2.70 m'));
  assert.ok(!sectionSVG('en').includes('2.80 m'));
});

test('ambient lighting stays in each actual physical space, including both disconnected entry regions', () => {
  const points = lightingPoints();
  for (const point of points) assert.ok(inPolygon(point.position, room(point.roomId).polygons), `${point.id} outside its room`);
  for (const point of points.filter(p => p.kind === 'ambient')) {
    const space = model.spaces.find(s => s.id === point.spaceId);
    assert.ok(inPolygon(point.position, space.polygons));
  }
  assert.equal(points.filter(p => p.roomId === 'entry' && p.kind === 'ambient').length, 2);
});

test('plan and perspective preserve oval tables, nonzero tree crowns and supported monitors', () => {
  const svg = planSVG();
  assert.ok(svg.includes('data-canopy="F-G02"'));
  assert.ok(svg.indexOf('data-furniture="F-L14"') < svg.indexOf('data-furniture="F-L01"'), 'rug must not cover sofa');
  const scene = perspectiveSVG('living', 'zh', true);
  assert.equal(scene.targetHeight, scene.eyeHeight);
  assert.equal(scene.doorState, 'closed');
  assert.ok(scene.faces.every(f => f.points.every(p => p.every(Number.isFinite))));
  const crown = scene.faces.filter(f => f.sourceId === 'F-G02');
  near(Math.max(...crown.flatMap(f => f.points.map(p => p[1]))) + scene.eyeHeight, furniture('F-G02').height);
  assert.ok(crown.some(f => f.points.length === 20));
  assert.ok(scene.faces.some(f => f.sourceId === 'F-L02' && f.points.length === 20));
  const study = perspectiveSVG('study', 'en', true);
  for (const id of ['F-S06', 'F-S07']) {
    const points = study.faces.filter(f => f.sourceId === id).flatMap(f => f.points);
    assert.ok(points.length);
    near(Math.min(...points.map(p => p[1])) + study.eyeHeight, .74);
    near(Math.max(...points.map(p => p[1])) + study.eyeHeight, 1.16);
  }
  for (const f of scene.faces.filter(f => f.sourceId === 'V06')) {
    const height = Math.max(...f.points.map(p => p[1])) - Math.min(...f.points.map(p => p[1]));
    const spread = Math.max(...f.points.flatMap(a => f.points.map(b => Math.hypot(a[0] - b[0], a[2] - b[2]))));
    assert.ok(height <= .4 || spread <= .1, 'an opaque pane would incorrectly hide the courtyard');
  }
});

test('opposite dining chair rows face the table in the perspective geometry', () => {
  const scene = perspectiveSVG('kitchen', 'en', true), camera = model.cameras.find(c => c.roomId === 'kitchen');
  const dx = camera.target[0] - camera.position[0], dy = camera.target[1] - camera.position[1], len = Math.hypot(dx, dy), forward = [dx / len, dy / len], right = [-forward[1], forward[0]];
  for (const id of ['F-K05', 'F-K07']) {
    const chair = furniture(id), top = scene.faces.filter(f => f.sourceId === id).flatMap(f => f.points).filter(p => Math.abs(p[1] + camera.eyeHeight - chair.height) < 1e-7);
    assert.ok(top.length);
    const worldY = top.map(p => camera.position[1] + right[1] * p[0] + forward[1] * p[2]);
    if (chair.rotation === 180) assert.ok(Math.min(...worldY) >= chair.rect.y + chair.rect.d - .1);
    else assert.ok(Math.max(...worldY) <= chair.rect.y + .1);
  }
});


test('interior ceilings occlude outdoor tree crowns above the wall head without covering the courtyard',()=>{
 const scene=perspectiveSVG('living','zh',true);
 const faces=scene.faces.filter(f=>f.sourceId==='ceiling:living');
 assert.ok(faces.length);
 for(const f of faces)for(const point of f.points)near(point[1]+scene.eyeHeight,model.ceilingHeight);
 assert.ok(!scene.faces.some(f=>f.sourceId==='ceiling:garden'));
});
