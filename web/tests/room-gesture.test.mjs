import test from 'node:test';
import assert from 'node:assert/strict';
import {createObjectTapGesture} from '../room/world.js';

const point=(pointerId,clientX=10,clientY=10,button=0)=>({pointerId,clientX,clientY,button});
test('room object selection accepts a single tap and rejects a drag that returns to its origin',()=>{
  const gesture=createObjectTapGesture();gesture.down(point(1));assert.equal(gesture.up(point(1,13)),true);
  gesture.down(point(2));gesture.move(point(2,40));gesture.move(point(2));assert.equal(gesture.up(point(2)),false);
});
test('neither release order of a pinch activates an object, and the next tap still works',()=>{
  for(const order of [[1,2],[2,1]]){
    const gesture=createObjectTapGesture();gesture.down(point(1));gesture.down(point(2,110,110));
    for(const id of order)assert.equal(gesture.up(point(id,id===1?10:110,id===1?10:110)),false);
    assert.equal(gesture.active,false);gesture.down(point(3));assert.equal(gesture.up(point(3)),true);
  }
});
test('cancelled or unrelated pointer releases and secondary clicks do not select a room object',()=>{
  const gesture=createObjectTapGesture();gesture.down(point(1));assert.equal(gesture.up(point(9)),false);
  gesture.cancel(point(1));assert.equal(gesture.up(point(1)),false);assert.equal(gesture.active,false);
  gesture.down(point(2));gesture.down(point(3));gesture.cancel(point(3));assert.equal(gesture.up(point(2)),false);
  gesture.down(point(4,10,10,2));assert.equal(gesture.up(point(4)),false);
});
