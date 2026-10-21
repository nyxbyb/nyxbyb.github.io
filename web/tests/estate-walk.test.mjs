import test from 'node:test';
import assert from 'node:assert/strict';
import {findWalkRoute,WALK_ORDER} from '../room/estate-walk.js';
import {SPATIAL_MODEL} from '../room/spatial-model.js';

test('walking to a room uses model junctions and preserves the reversed gate order',()=>{
 const model={walk:{connections:[
  {id:'wet-to-pool',from:'changing',to:'pool',gateIds:['ED02','PG01'],points:[[19,19],[16.5,19],[16.5,17],[8,17],[8,19.2]]},
  {id:'gym-to-changing',from:'gym',to:'changing',gateIds:['ED04'],points:[[19,17],[19,19]]},
  {id:'plant',from:'plant',to:'service',gateIds:['ED05'],points:[[23,19],[26,19]]}
 ]}};
 const before=JSON.stringify(model),route=findWalkRoute('pool','gym',model);
 assert.deepEqual(route.gateIds,['PG01','ED02','ED04']);
 assert.deepEqual(route.segments.map(s=>s.id),['wet-to-pool','gym-to-changing']);
 assert.deepEqual(route.segments[0].points[0],[8,19.2]);
 assert.equal(route.segments[0].walkFrom,'pool');assert.equal(route.segments[0].walkTo,'changing');
 assert.deepEqual(route.segments[0].points.at(-1),route.segments[1].points[0]);
 assert.equal(JSON.stringify(model),before,'Changing direction must not mutate shared model paths.');
 assert.deepEqual(findWalkRoute('pool','plant',model).segments,[],'Unconnected rooms must not get an invented line.');
});

test('the walk retains nine core places and adds four distinct estate destinations',()=>{
 assert.equal(WALK_ORDER.length,13);assert.equal(new Set(WALK_ORDER).size,13);
 for(const id of ['living','study','bedroom','kitchen','flex','reserve','bath','entry','garden','media','gym','pool','outer'])assert.ok(WALK_ORDER.includes(id));
});

test('route choice minimizes the distance walked rather than the number of named segments',()=>{
 const model={walk:{connections:[
  {id:'long-loop',from:'entry',to:'media',points:[[0,0],[0,20],[20,20],[20,0]],gateIds:['PG01']},
  {id:'entry-path',from:'entry',to:'garden',points:[[0,0],[10,0]],gateIds:['D01']},
  {id:'wing-path',from:'garden',to:'media',points:[[10,0],[20,0]],gateIds:['ED03']}
 ]}};
 const route=findWalkRoute('entry','media',model);
 assert.deepEqual(route.segments.map(s=>s.id),['entry-path','wing-path']);
 assert.deepEqual(route.gateIds,['D01','ED03']);
});

test('returning from the media room reaches the house without entering changing or the pool',()=>{
 assert.deepEqual(findWalkRoute('media','entry',SPATIAL_MODEL).gateIds,['ED03','D01']);
 const studio=findWalkRoute('media','reserve',SPATIAL_MODEL);
 assert.ok(studio.segments.length>0);
 assert.ok(studio.gateIds.includes('D06'));
 assert.ok(!studio.gateIds.includes('ED02')&&!studio.gateIds.includes('PG01'));
});
