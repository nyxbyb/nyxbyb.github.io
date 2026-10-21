import {SPATIAL_MODEL as M} from './spatial-model.js';
import {teaDetailSVG,teaCabinetSVG,courtyardBoundarySVG,estateSVG} from './spatial-drawings.js';

// Geometry and equipment positions stay in the spatial model. This module only
// presents the tea-room and garden studies, with native controls and SVG exports.
const media={...import.meta.glob(['./assets/house-v3/*.jpg','!./assets/house-v3/reserve.jpg'],{eager:true,query:'?url',import:'default'}),...import.meta.glob('./assets/house-v4/*.jpg',{eager:true,query:'?url',import:'default'})};
const photographs=Object.fromEntries(Object.entries(media).map(([p,url])=>[p.split('/').pop().replace('.jpg',''),url]));
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};

export function createLivingStudies({getLanguage,rerender}){
 let teaLayer='ritual',teaMood='evening',scene='tea',phase='all';
 const L=v=>typeof v==='string'?v:v?.[getLanguage()]||v?.zh||'';
 const say=(zh,en)=>getLanguage()==='en'?en:zh;
 const name=x=>L(x.label||x.name||x.title)||x.id;
 const description=x=>L(x.description||x.strategy||x.spec);
 const link=(label,path)=>{const a=el('a',label,'dossier-link');a.href=path+(path.startsWith('./docs/')?'?rev='+M.version:'');a.target='_blank';a.rel='noopener';return a;};
 function tool(label,active,action){const b=el('button',label);b.type='button';b.dataset.focusKey=label;b.setAttribute('aria-pressed',String(active));b.addEventListener('click',()=>{action();rerender();});return b;}
 function card(x){const a=el('article',null,'dossier-card');a.append(el('small',x.id,'dossier-kicker'),el('h3',name(x)),el('p',description(x)));if(x.species)a.append(el('p',L(x.species),'dossier-secondary'));if(x.spec&&L(x.spec)!==description(x))a.append(el('small',L(x.spec)));if(Number.isFinite(x.area))a.append(el('small',`${x.area} m² · ${x.includedInCore?say('已含主宅','within core'):x.areaBasis==='gross'?say('概念建面','gross concept'):String(x.areaBasis).startsWith('outdoor')?say('室外另列','outdoor, separate'):say('净功能','net program')}`));return a;}
 function sheet(svg){const n=el('div',null,'dossier-sheet study-sheet');n.innerHTML=svg;return n;}
 function photo(id,caption){const geometryId=id.startsWith('tea')?'tea':id;const f=el('figure',null,'study-image'),image=el('img');image.src=photographs[id]||`./docs/drawings/${geometryId}-geometry.png?rev=${M.version}`;image.alt=caption;image.loading='lazy';image.addEventListener('error',()=>{if(image.dataset.fallback){image.hidden=true;f.querySelector('.dossier-footnote').textContent=say('影像与几何暂不可用，请切回茶水、灯光或同墙图纸。','Both images are unavailable. Return to the tea, services or boundary drawings.');return;}image.dataset.fallback='true';image.src=`./docs/drawings/${geometryId}-geometry.png?rev=${M.version}`;f.append(el('p',say('材质影像暂不可用，显示同模型几何。','Material image unavailable; showing the model view.'),'dossier-footnote'));});f.append(image,el('figcaption',caption));return f;}
 function table(headers,items){const wrap=el('div',null,'schedule-wrap'),t=el('table',null,'dossier-table'),head=el('tr'),body=el('tbody');headers.forEach(h=>head.append(el('th',h)));const th=el('thead');th.append(head);for(const row of items){const tr=el('tr');row.forEach(v=>tr.append(el('td',String(v??''))));body.append(tr);}t.append(th,body);wrap.append(t);return wrap;}
 function section(body,title){body.append(el('h3',title,'study-section-title'));}

 function tea(body){
  const t=M.tea;
  const strip=el('div',null,'study-intro-strip');
  strip.append(el('span',say('40㎡ · 起居与茶','40 m² · Living & tea')),el('span',say('水、声、光、香分开控制','Water, sound, light and scent separately controlled')),el('span','REV.'+String(M.version).padStart(2,'0')));
  body.append(strip);
  const tools=el('div',null,'dossier-tools');
  const layers=[['ritual','茶水与收纳','Tea & storage'],['services','灯光与插座','Light & outlets'],['audio','听音与独处','Listening'],['cabinet','茶柜立面','Tea cabinet'],['boundary','室内外同一面墙','One shared wall'],['material','茶席影像','Tea image']];
  for(const [id,zh,en]of layers)tools.append(tool(say(zh,en),teaLayer===id,()=>teaLayer=id));
  body.append(tools);
  if(teaLayer==='material'){const moods=el('div',null,'dossier-tools');moods.append(tool(say('日光','Daylight'),teaMood==='day',()=>teaMood='day'),tool(say('入夜','Evening'),teaMood==='evening',()=>teaMood='evening'));body.append(moods,photo(teaMood==='day'?'tea':'tea-evening',say('C-tea · 同一茶席的材质与灯光意向；位置以同模型图纸为准，非照度计算。','C-tea · One tea setting, studied in material and light. Model drawings control positions; this is not a lighting calculation.')),link(say('对照茶席几何视图 ↗','Compare the tea geometry ↗'),'./docs/drawings/tea-geometry.png'));}
  else{
   const svg=teaLayer==='cabinet'?teaCabinetSVG(getLanguage()):teaLayer==='boundary'?courtyardBoundarySVG(getLanguage()):teaDetailSVG(getLanguage(),teaLayer);
   body.append(sheet(svg),link(say('单独放大 / 下载此图 SVG ↗','Enlarge / download this SVG ↗'),`./docs/drawings/${teaLayer==='boundary'?'courtyard-boundary':teaLayer==='cabinet'?'tea-cabinet':'tea-'+teaLayer}.svg`));
  }
  if(teaLayer==='boundary'){
   body.append(el('p',say('室内与庭院使用同一面 W03：固定窗 V06 与推拉门 D09。低窗台、实墙柱、窗头及檐底在两侧相同；庭院边界也在总图中定位。','Interior and courtyard share W03: fixed window V06 and sliding door D09. Both faces have the same sill, solid piers, opening heads and soffit; the garden boundary is located on the site plan.'),'dossier-lede'));
   const pair=el('div',null,'study-image-pair');pair.append(photo('living',say('C-living · 从室内看庭院','C-living · Inside looking out')),photo('garden',say('C-garden · 从庭院看室内','C-garden · Outside looking in')));body.append(pair);
  }
  section(body,say('把一个晚上，慢慢过完。','An evening, without hurry.'));
  const sceneTools=el('div',null,'dossier-tools study-scenes');
  const scenes=t.scenes||[];
  for(const x of scenes)sceneTools.append(tool(name(x),scene===x.id,()=>{scene=x.id;teaLayer=x.layer||({tea:'ritual',music:'audio',clean:'services',solitude:'audio'}[x.id]||'ritual');}));
  body.append(sceneTools);
  const selected=scenes.find(x=>x.id===scene)||scenes[0];if(selected){const c=card(selected);c.classList.add('study-scene');c.setAttribute('aria-live','polite');body.append(c);}
  const steps=el('ol',null,'tea-sequence');for(const x of t.steps||[]){const li=el('li');li.append(el('strong',name(x)),el('span',description(x)));steps.append(li);}body.append(steps);
  section(body,say('台面、柜内和手边。','On the counter, in the cabinet, within reach.'));
  const stations=el('div',null,'dossier-grid');for(const x of t.stations||[])stations.append(card(x));body.append(stations);
  if(t.storage?.length)body.append(table([say('编号 / 收纳','Code / storage'),say('归位方式','How it returns')],t.storage.map(x=>[x.id+' · '+name(x),description(x)])));
  section(body,say('有位置的设备，才是可继续深化的设计。','Located equipment makes the next design step possible.'));
  body.append(table([say('点位','Point'),say('用途与预留','Use & intent'),say('模型坐标 x / y / z · m','Model x / y / z · m')],(t.points||[]).map(x=>[x.id+' · '+name(x),L(x.spec||x.description),(x.position||[]).map(n=>Number(n).toFixed(2)).join(' / ')])));
  if(t.listening)body.append(card({id:'LISTENING',label:{zh:'一个主听位，其余座位自由。',en:'One listening seat; room to sit elsewhere.'},description:t.listening.description}));
  if(t.scent)body.append(card(t.scent));
  body.append(el('p',say('灯位、插座和水点是概念功能预留，尚未完成回路、负荷、管径与防水构造。灯光数值为试灯起点；音箱按实际型号试听调整。泡茶时关闭扩香，茶叶与香品分柜。','Lights, outlets and water points are functional allowances; circuits, loads, pipework and waterproof details remain to be designed. Lighting settings are trial intentions; speaker positions need the actual equipment. Switch scent off while tasting tea, and store tea and fragrance separately.'),'dossier-footnote'));
  body.append(link(say('阅读园居与茶室深化说明 ↗','Read the tea-room and garden brief ↗'),'./docs/园居与茶室深化.md'));
 }

 function estate(body){
  const e=M.estate;
  body.append(el('p',say('这是一块用于检验关系的假想地块，并非已经选定的土地。主宅、扩建与室外面积分别列出；方位、边界和植物仍需随真实基地调整。','This is an assumed site for testing relationships, not a selected property. House, additions and outdoor areas are listed separately; orientation, boundaries and plants remain site-dependent.'),'dossier-lede'));
  const metrics=el('dl',null,'study-metrics');for(const [value,label]of [[e.bounds.area,say('㎡ 假想用地','m² assumed site')],[e.areaSummary.coreGrossArea,say('㎡ 主宅建面','m² core gross')],[e.areaSummary.additionalGrossArea,say('㎡ 新增生活翼','m² additional wing')],[e.areaSummary.poolWaterArea,say('㎡ 室外池水','m² outdoor water')]]){const group=el('div');group.append(el('dt',label),el('dd',String(value)));metrics.append(group);}body.append(metrics);
  const tools=el('div',null,'dossier-tools');tools.append(tool(say('完整园居','Whole garden'),phase==='all',()=>phase='all'));
  for(const p of e.phases||[])tools.append(tool(name(p),phase===String(p.id),()=>phase=String(p.id)));
  body.append(tools,sheet(estateSVG(getLanguage(),phase)),link(say('放大园居总图 SVG ↗','Enlarge the garden masterplan SVG ↗'),'./docs/drawings/estate.svg'));
  section(body,say('沿着园路，走进下一处。','Follow the garden path into the next room.'));
  body.append(el('p',say('从总图进入固定视点，再沿门、回廊与园路继续走。每处可切换同模型几何与平面定位。','Enter a fixed viewpoint from the plan, then continue through doors, the gallery and garden paths. Each stop has a model view and a plan location.'),'dossier-lede'));
  const views=el('div',null,'study-image-pair');
  for(const [id,zh,en] of [['media','影音室','Media room'],['gym','健身房','Gym'],['pool','泳池与池畔','Pool & terrace'],['outer','外庭','Outer garden']]){
   const item=el('article',null,'dossier-card');item.append(el('h3',say(zh,en)),photo(id,`C-${id} · ${say(zh,en)}`));
   const controls=el('div',null,'dossier-tools'),open=el('button',say('走进'+zh+' ↗','Enter '+en+' ↗'));open.type='button';open.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('caelum:walk',{detail:{id}})));controls.append(open);item.append(controls);views.append(item);
  }
  body.append(views);
  const phases=el('div',null,'dossier-grid');for(const p of e.phases||[])phases.append(card(p));body.append(phases);
  section(body,say('房子之外，添加什么，也承担什么。','What to add, and what it asks of you.'));
  const program=el('div',null,'dossier-grid');for(const p of e.program||[])program.append(card(p));body.append(program);
  if(e.areaSummary){const a=e.areaSummary;body.append(card({id:'AREA / 分开计算',label:{zh:'主宅与扩展分开记账。',en:'Keep house and expansion areas separate.'},description:a.description||a.note}));}
  section(body,say('树不是装饰，是二十年后的尺度。','A tree is a scale measured in decades.'));
  const plants=el('div',null,'dossier-grid');for(const p of e.planting||[])plants.append(card(p));body.append(plants);
  body.append(card({id:'GARDEN CARE',label:{zh:'留下照料的路径。',en:'Leave room for care.'},description:{zh:'内庭用于看树、坐下与落雨；外庭容纳散步、运动和季节。预留灌溉检修、落叶收集与园具收纳，不把树根、池水和屋基混成一处。桂花是温暖气候的候选；寒冷或热带基地另做适生树种表。',en:'Keep the inner court for sitting, rain and a tree; the outer garden holds walking, movement and seasons. Allow access for irrigation, leaves and garden tools, keeping roots, pool water and foundations distinct. Sweet osmanthus is a warm-climate candidate; cold or tropical sites need a different local planting schedule.'}}));
  if(e.poolSafety)body.append(card({id:'POOL / 泳池',label:{zh:'泳池有自己的边界。',en:'The pool has its own boundary.'},description:e.poolSafety.description||e.poolSafety.note}));
  body.append(link(say('树种、听音与庭园的官方参考 ↗','Official sources for planting, sound and gardens ↗'),'./docs/园居与茶室深化.md'));
 }
 return {tea,estate};
}
