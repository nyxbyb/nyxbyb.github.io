import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { HOUSE_PLAN_GEOMETRY } from '../room/house-plan.js';

const house = JSON.parse(await readFile(new URL('../public/data/house.json', import.meta.url)));
const polygonArea = polygon => Math.abs(polygon.reduce((sum, [x, y], index) => {
  const [nextX, nextY] = polygon[(index + 1) % polygon.length];
  return sum + x * nextY - nextX * y;
}, 0)) / 2;
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} ≠ ${expected}`);

test('the drawn room polygons agree with the published areas and separate courtyard from gross floor area', () => {
  assert.deepEqual(new Set(HOUSE_PLAN_GEOMETRY.map(zone => zone.id)), new Set(house.rooms.map(room => room.id)));
  for (const zone of HOUSE_PLAN_GEOMETRY) {
    const room = house.rooms.find(room => room.id === zone.id);
    near(zone.polygons.reduce((sum, polygon) => sum + polygonArea(polygon), 0), room.area);
    near(zone.area, room.area);
    assert.deepEqual(zone.label, room.label);
    assert.equal(Boolean(zone.outdoor), room.zone === 'outdoor');
  }
  const net = house.rooms.filter(room => room.zone !== 'outdoor').reduce((sum, room) => sum + room.area, 0);
  near(net, 166);
  near(net, house.assumptions.netProgramArea);
  near(net + house.assumptions.wallAndServiceAllowance, house.assumptions.grossFloorArea);
  near(house.rooms.find(room => room.id === 'garden').area, house.assumptions.courtyardArea);
  assert.equal(house.assumptions.grossFloorArea, 200);
  assert.equal(house.assumptions.courtyardArea, 30);
});

test('the plan partitions its envelope once with no lost or overlapping floor regions', () => {
  // These concept polygons are orthogonal rectangles. Sampling each 0.1 m cell
  // checks the full envelope, including the L-shaped return and outdoor notch.
  const boxes = HOUSE_PLAN_GEOMETRY.flatMap(zone => zone.polygons.map(polygon => ({
    id: zone.id,
    minX: Math.min(...polygon.map(point => point[0])), maxX: Math.max(...polygon.map(point => point[0])),
    minY: Math.min(...polygon.map(point => point[1])), maxY: Math.max(...polygon.map(point => point[1]))
  })));
  for (let xIndex = 0; xIndex < 140; xIndex++) {
    for (let yIndex = 0; yIndex < 140; yIndex++) {
      const x = (xIndex + .5) / 10, y = (yIndex + .5) / 10;
      const hits = boxes.filter(box => x > box.minX && x < box.maxX && y > box.minY && y < box.maxY);
      assert.equal(hits.length, 1, `Plan overlap or gap at ${x},${y}`);
      assert.equal(hits[0].id === 'garden', x < 6 && y > 9);
    }
  }
});

test('the four enclosed rooms remain distinct from bathrooms and the service program is counted', () => {
  assert.equal(house.assumptions.enclosedRooms, 4);
  assert.deepEqual(house.rooms.filter(room => room.zone === 'private').map(room => room.id).sort(), ['bedroom', 'flex', 'reserve', 'study']);
  near(house.rooms.find(room => room.id === 'entry').area, 12 + 14 * 1.4);
  near(house.rooms.find(room => room.id === 'bath').area, 7 + 2.72 + 2.04);
  for (const room of house.rooms) {
    for (const lang of ['zh', 'en']) {
      for (const field of ['label', 'subtitle', 'dimensions', 'narrative']) assert.ok(room[field][lang].trim());
      assert.ok(room.materials[lang].length >= 3);
      assert.ok(room.practical[lang].length >= 2);
    }
  }
});
