import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

// CSS is bundled by Vite; load the same pure input/search implementation in Node.
const source = (await readFile(new URL('../starmap/interaction.js', import.meta.url), 'utf8')).replace("import './interaction.css';", '');
const { matchesBookQuery, searchBooks, panAndZoom, createPointerGesture, INITIAL_VIEW } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('book search matches title and author, Unicode width/case and multiple terms without altering nodes', () => {
  const nodes = [{title:'苏东坡传',author:'林语堂'}, {title:'The Stranger',author:'Albert Camus'}, {title:'苏东坡诗词',author:'苏轼'}];
  const before = JSON.stringify(nodes);
  assert.deepEqual(searchBooks(nodes, '苏东坡 林语堂').map(x => x.index), [0]);
  assert.equal(matchesBookQuery(nodes[1], 'ＴＨＥ camus'), true);
  assert.deepEqual(searchBooks(nodes, '苏东坡', [2]).map(x => x.index), [2]);
  assert.deepEqual(searchBooks(nodes, '不存在'), []);
  assert.equal(JSON.stringify(nodes), before);
});

function fixture(zoom = 1) {
  let view = { ...INITIAL_VIEW, zoom }, taps = 0;
  const gesture = createPointerGesture({ getView:()=>view, setView:v=>{view=v;}, viewport:()=>({width:1000,height:800}), onTap:()=>{taps++;} });
  return { gesture, view:()=>view, taps:()=>taps };
}

test('pointer jitter permits selection while dragging, returning, and cancellation never click', () => {
  const a = fixture();
  a.gesture.down({id:1,x:10,y:10}); a.gesture.move({id:1,x:12,y:11}); a.gesture.up({id:1,x:12,y:11});
  assert.equal(a.taps(),1);
  a.gesture.down({id:2,x:10,y:10}); a.gesture.move({id:2,x:30,y:10}); a.gesture.move({id:2,x:10,y:10}); a.gesture.up({id:2,x:10,y:10});
  assert.equal(a.taps(),1);
  a.gesture.down({id:3,x:10,y:10}); a.gesture.cancel(); a.gesture.up({id:3,x:10,y:10});
  assert.equal(a.taps(),1);
});

test('one-finger gesture rotates normally and pans at a closer zoom', () => {
  const a = fixture(); a.gesture.down({id:1,x:10,y:10}); a.gesture.move({id:1,x:30,y:20});
  assert.ok(a.view().rotY > INITIAL_VIEW.rotY); assert.equal(a.view().focusX,0);
  const b = fixture(3); b.gesture.down({id:1,x:10,y:10}); b.gesture.move({id:1,x:30,y:20});
  assert.equal(b.view().rotY,INITIAL_VIEW.rotY); assert.notEqual(b.view().focusX,0);
});

test('pinch updates scale and focus without selecting when either finger lifts', () => {
  const a = fixture(); a.gesture.down({id:1,x:400,y:400}); a.gesture.down({id:2,x:600,y:400});
  a.gesture.move({id:2,x:700,y:400});
  assert.equal(a.view().zoom,1.5);
  a.gesture.up({id:2,x:700,y:400}); a.gesture.up({id:1,x:400,y:400});
  assert.equal(a.taps(),0);
});

function project(view, point, width=1000, height=800) {
  const x=point.x-view.focusX,y=point.y-view.focusY,z=point.z-view.focusZ;
  const half=Math.min(width,height)/2-80;
  return {x:width/2+(x*Math.cos(view.rotY)+z*Math.sin(view.rotY))*half*view.zoom,
    y:height/2+(y*Math.cos(view.rotX)-(-x*Math.sin(view.rotY)+z*Math.cos(view.rotY))*Math.sin(view.rotX))*half*view.zoom};
}

test('zoom and pan preserve the intended screen anchor even at side-on rotations', () => {
  for(const rotY of [0.6,Math.PI/2,-Math.PI/2]) {
    const view={...INITIAL_VIEW,rotY}, point={x:.2,y:.1,z:-.3};
    const before=project(view,point);
    const next=panAndZoom(view,{width:1000,height:800,fromX:before.x,fromY:before.y,toX:before.x+20,toY:before.y-15,scale:2});
    const after=project(next,point);
    assert.ok(Math.abs(after.x-before.x-20)<1e-8); assert.ok(Math.abs(after.y-before.y+15)<1e-8);
  }
});

test('zoom bounds prevent extreme or zero scale', () => {
  const move={width:1000,height:800,fromX:500,fromY:400,toX:500,toY:400};
  assert.equal(panAndZoom(INITIAL_VIEW,{...move,scale:1000}).zoom,30);
  assert.equal(panAndZoom(INITIAL_VIEW,{...move,scale:0}).zoom,.1);
});
