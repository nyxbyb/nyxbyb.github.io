import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { safeURL, readPreference, writePreference, selectBooks, validateRoom } from '../room/helpers.js';

test('room links reject executable protocols while preserving genuine published articles', async () => {
  for (const url of ['javascript:alert(1)','data:text/html,x','file:///etc/passwd','vbscript:msgbox(1)']) assert.equal(safeURL(url),null);
  assert.equal(safeURL('./#sec-map'),'https://nyxbyb.github.io/web/#sec-map');
  const articles=JSON.parse(await readFile(new URL('../public/data/articles.json',import.meta.url)));
  assert.ok(articles.length>100);
  assert.ok(articles.every(a=>safeURL(a.url)?.startsWith('https://')));
});

test('the configured shelf uses real books and preserves all source records', async () => {
  const config=validateRoom(JSON.parse(await readFile(new URL('../public/data/room.json',import.meta.url))));
  const graph=JSON.parse(await readFile(new URL('../public/data/graph.json',import.meta.url)));
  const before=JSON.stringify(graph);const shelf=selectBooks(graph,config.reading);
  assert.deepEqual(shelf.map(n=>n.title),config.reading.titles);
  assert.equal(JSON.stringify(graph),before);
  assert.ok(selectBooks(graph,{limit:1000}).length<=6);
  assert.deepEqual(selectBooks(null),[]);
});

test('blocked browser storage leaves the room usable and reports a failed save', () => {
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('blocked');}});
  try {assert.equal(readPreference('caelum_lang','zh'),'zh');assert.equal(writePreference('note','hello'),false);} finally{delete globalThis.localStorage;}
});

test('invalid room configuration fails explicitly rather than exposing partial editor data', () => {
  for(const input of [null,[],{}, {version:2}, {version:1,intro:{},tea:{},plant:{},music:{}}]) assert.throws(()=>validateRoom(input));
});
