import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SPATIAL_MODEL as model} from '../room/spatial-model.js';
import {DESIGN_CHAPTERS,MATERIALS,LIGHTING_SCENES,SERVICES,LIFE_SCENARIOS} from '../room/design-content.js';
const file=path=>readFile(new URL(path,import.meta.url));

test('published drawings and camera references retain the current shared model, not a stale house revision',async()=>{
 const snapshot=JSON.parse(await file('../public/docs/drawings/spatial-model.json'));
 assert.deepEqual(snapshot,model,'Re-export drawings when any shared geometry or camera changes.');
 for(const c of model.cameras){
  const png=await file('../public/docs/drawings/'+c.roomId+'-geometry.png');
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),750);
  const jpg=await file('../room/assets/house-v2/'+c.roomId+'.jpg');assert.equal(jpg.readUInt16BE(0),0xffd8);assert.ok(jpg.length>50000);
 }
 for(const name of ['plan','routes','openings','lighting','services','section'])assert.match((await file('../public/docs/drawings/'+name+'.svg')).toString(),/<svg[\s>]/);
 for(const z of model.zones.filter(z=>!z.outdoor))for(const d of ['north','east','south','west'])assert.match((await file('../public/docs/drawings/'+z.id+'-'+d+'.svg')).toString(),/<svg[\s>]/);
});

test('the complete professional dossier and public design briefs are available and mirrored',async()=>{
 const pdf=await file('../public/docs/迟庭-住宅设计册.pdf');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>100000);
 assert.deepEqual(pdf,await file('../../output/pdf/迟庭-住宅设计册.pdf'));
 for(const name of ['未来住宅设计简报','住宅设计交付体系','居住者与生活场景','更新指南'])assert.deepEqual(await file('../public/docs/'+name+'.md'),await file('../../docs/'+name+'.md'));
});

test('professional chapters cover daily use and maintenance in both languages',()=>{
 assert.deepEqual(DESIGN_CHAPTERS.map(c=>c.id),['inhabitant','coordination','sections','materials','systems','furnishing','scenarios','delivery']);
 assert.equal(MATERIALS.length,6);assert.equal(LIGHTING_SCENES.length,4);assert.ok(SERVICES.some(s=>s.id==='research'));assert.ok(SERVICES.some(s=>s.id==='housekeeping'));assert.equal(LIFE_SCENARIOS.length,6);
 for(const list of [DESIGN_CHAPTERS,MATERIALS,LIGHTING_SCENES,SERVICES,LIFE_SCENARIOS])for(const item of list)for(const [key,value]of Object.entries(item)){if(['id','color'].includes(key))continue;for(const lang of ['zh','en'])assert.ok(Array.isArray(value[lang])?value[lang].length>0:typeof value[lang]==='string'&&value[lang].trim(),`${item.id}.${key}.${lang}`);}
});
