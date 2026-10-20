import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateHouse} from '../room/helpers.js';
const house=JSON.parse(readFileSync(new URL('../public/data/house.json',import.meta.url)));
test('the house program validates without changing source data',()=>{const before=JSON.stringify(house);assert.equal(validateHouse(house),house);assert.equal(JSON.stringify(house),before);});
test('malformed bilingual content cannot replace the usable house fallback',()=>{
  for(const change of [h=>h.rooms[0].practical.zh={},h=>h.rooms[0].materials.en='oak',h=>delete h.rooms[1].label.en,h=>h.rooms[0].area=Infinity,h=>h.rooms[1].id='living']){const input=structuredClone(house);change(input);assert.throws(()=>validateHouse(input));}
});
test('gross, net and outdoor areas must remain independent and reconcile',()=>{
  for(const change of [h=>h.assumptions.grossFloorArea=230,h=>h.assumptions.netProgramArea=196,h=>h.assumptions.courtyardArea=0,h=>h.rooms.at(-1).zone='public']){const input=structuredClone(house);change(input);assert.throws(()=>validateHouse(input));}
});
