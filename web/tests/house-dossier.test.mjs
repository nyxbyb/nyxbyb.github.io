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
  const viewId=c.id==='C-tea'?'tea':c.roomId;
  const png=await file('../public/docs/drawings/'+viewId+'-geometry.png');
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),750);
  const folder=['reserve','media','gym','pool','outer'].includes(viewId)?'house-v4/':['living','garden','tea'].includes(viewId)?'house-v3/':'house-v2/';
  const jpg=await file('../room/assets/'+folder+viewId+'.jpg');assert.equal(jpg.readUInt16BE(0),0xffd8);assert.ok(jpg.length>50000);
 }
 for(const name of ['plan','routes','openings','lighting','services','section','tea-ritual','tea-services','tea-audio','tea-cabinet','courtyard-boundary','estate'])assert.match((await file('../public/docs/drawings/'+name+'.svg')).toString(),/<svg[\s>]/);
 for(const z of model.zones.filter(z=>!z.outdoor))for(const d of ['north','east','south','west'])assert.match((await file('../public/docs/drawings/'+z.id+'-'+d+'.svg')).toString(),/<svg[\s>]/);
 for(const id of ['reserve','media','gym','pool','outer'])assert.match((await file('../public/docs/drawings/'+id+'-plan.svg')).toString(),/<svg[\s>]/);
 const schedule=(await file('../public/docs/drawings/furniture.csv')).toString().trim().split(/\r?\n/);
 const catalog=[...model.furniture,...model.estate.wing.furniture,...model.estate.outdoorFurniture];
 assert.equal(schedule.length,catalog.length+1,'The downloadable schedule must include the garden wing as well as the core.');
 for(const f of catalog)assert.ok(schedule.some(line=>line.startsWith(f.id+',')),`Missing furniture: ${f.id}`);
});

test('the complete professional dossier and public design briefs are available and mirrored',async()=>{
 const pdf=await file('../public/docs/迟庭-住宅设计册.pdf');assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert.ok(pdf.length>100000);
 assert.deepEqual(pdf,await file('../../output/pdf/迟庭-住宅设计册.pdf'));
 for(const name of ['未来住宅设计简报','住宅设计交付体系','居住者与生活场景','更新指南','园居与茶室深化'])assert.deepEqual(await file('../public/docs/'+name+'.md'),await file('../../docs/'+name+'.md'));
});

test('professional chapters cover daily use and maintenance in both languages',()=>{
 assert.deepEqual(DESIGN_CHAPTERS.map(c=>c.id),['tea','estate','inhabitant','coordination','sections','materials','systems','furnishing','scenarios','delivery']);
 assert.equal(MATERIALS.length,6);assert.equal(LIGHTING_SCENES.length,4);assert.ok(SERVICES.some(s=>s.id==='research'));assert.ok(SERVICES.some(s=>s.id==='housekeeping'));assert.equal(LIFE_SCENARIOS.length,6);
 for(const list of [DESIGN_CHAPTERS,MATERIALS,LIGHTING_SCENES,SERVICES,LIFE_SCENARIOS])for(const item of list)for(const [key,value]of Object.entries(item)){if(['id','color'].includes(key))continue;for(const lang of ['zh','en'])assert.ok(Array.isArray(value[lang])?value[lang].length>0:typeof value[lang]==='string'&&value[lang].trim(),`${item.id}.${key}.${lang}`);}
});
