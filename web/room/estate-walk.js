import {SPATIAL_MODEL as M} from './spatial-model.js';
import {planSVG,estateDetailSVG} from './spatial-drawings.js';

const coreIds=['entry','kitchen','living','garden','reserve','study','bedroom','bath','flex'];
export const WALK_ORDER=['entry','kitchen','living','garden','outer','pool','gym','media','reserve','study','bedroom','bath','flex'];
const words={
 title:['慢慢走，回到生活里。','Walk slowly. Make room for life.'],close:['结束漫游','Leave the walk'],previous:['上一处','Previous'],next:['下一处','Next'],directory:['全屋目录','All thirteen places'],image:['材质影像','Material image'],geometry:['同视点几何','Geometry view'],drawing:['定位图纸','Locate on plan'],locate:['此刻，在这里','You are here'],route:['这一段，怎样走','The way between places'],initial:['从归家入口到这里','From the entrance to here'],home:['回到这间的设计册 ↗','Read this room’s design notes ↗'],estate:['回到园居总图 ↗','Return to the estate drawing ↗'],loading:['影像正在载入。','Loading the view.'],fallback:['材质影像暂不可用，已显示同视点几何。','The material image is unavailable. Showing the matching model view.'],failed:['影像暂不可用，可继续看定位图纸、门窗和路径。','Images are unavailable. The coordinated plan, openings and route remain accessible.'],credit:['同模型固定视点 · 材质意向，非建成实景','MODEL-COORDINATED VIEW · MATERIAL STUDY, NOT A BUILT PROJECT'],geometryCredit:['同模型几何 · 门窗、家具与视点可对照','SHARED MODEL · OPENINGS, FURNITURE AND CAMERA'],drawingCredit:['概念图纸 · 假想基地与朝向待真实项目确认','CONCEPT DRAWING · SITE AND ORIENTATION TO BE CONFIRMED'],hint:['← → 换一处 · Home / End 到首尾 · Esc 返回','← → next place · Home / End first / last · Esc return'],start:['从入户门开始，沿回廊慢慢看。','Begin at the entrance and follow the gallery.'],doors:['经过','Via'],viewpoint:['视点','Viewpoint'],arrival:['刚刚走来','Arriving from'],future:['后期生活翼 / 室外愿景','LATER WING / OUTDOOR HORIZON'],core:['主宅 / 内庭','CORE HOUSE / INNER COURT'],jump:['选择任意一处，路线仍沿门廊与步道连接。','Choose any place; the route follows doors, galleries and garden paths.']
};
const extraLabels={gallery:{zh:'回廊',en:'Gallery'},changing:{zh:'更衣淋浴',en:'Changing & shower'},media:{zh:'影音室',en:'Media room'},gym:{zh:'健身房',en:'Garden gym'},pool:{zh:'泳池与池畔',en:'Pool and deck'},outer:{zh:'外庭',en:'Outer garden'}};
const intentions={
 entry:['放下包，让今天在门内缓一缓。','Put down the day before entering the house.'],kitchen:['围着一餐，照顾具体的生活。','A meal gives everyday life a place to gather.'],living:['烧水、落座、听一段音乐。','Heat the water, take a seat, listen to a record.'],garden:['从同一扇门走出，看见窗内的灯。','Step through the same door and see the light within.'],reserve:['临窗展纸，在木与墨之间留下空白。','Unroll paper by the window; leave space between timber and ink.'],study:['让工作可以专注，也可以关门结束。','A room for concentration, with a door that can close.'],bedroom:['把光与声音放轻，给睡眠留白。','Lower the light and sound; leave room for sleep.'],bath:['清洗、更衣，再回到安静。','Wash, change, and return to quiet.'],flex:['平日留白，偶尔留给来客。','An open purpose, with room for an occasional guest.'],outer:['内庭之外，树、步道与几个独立的生活片段。','Beyond the court: trees, paths and a few separate rooms for living.'],pool:['越过独立池门，沿池畔慢慢走。','Enter through the pool’s own gate and follow the deck.'],gym:['在庭园里伸展，训练之后就近更衣。','Stretch beside the garden, then change nearby.'],media:['从西侧步道进门，把声音留在独立的小屋。','Enter from the west path and keep the sound in its own room.']
};
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const textOf=(value,lang)=>typeof value==='string'?value:value?.[lang]||value?.zh||'';
const keyOf=id=>id==='outside'?'outer':id;

// Spatial links and point sequences belong to the shared model. The fallback
// only lists actual doors/passages; it never invents a straight walking line.
export function findWalkRoute(from,to,model=M){
 if(from===to)return {from,to,segments:[],gateIds:[]};
 const walk=model.walk||model.estate?.walk;
 const connections=walk?.connections||walk?.links||[];
 const edges=connections.length?connections:[...model.openings,...(model.estate?.wing?.openings||[])].filter(o=>o.type==='door'||o.type==='passage').map(o=>({id:o.id,from:keyOf(o.connects[0]),to:keyOf(o.connects[1]),gateIds:[o.id]}));
 const queue=[{id:from,segments:[],distance:0}],distances=new Map([[from,0]]),seen=new Set();
 while(queue.length){
  queue.sort((a,b)=>a.distance-b.distance);const current=queue.shift();if(seen.has(current.id))continue;seen.add(current.id);
  if(current.id===to)return {from,to,segments:current.segments,gateIds:current.segments.flatMap(s=>s.gateIds||s.openingIds||[])};
  for(const edge of edges){
   const pair=edge.connects||edge.rooms||[edge.from,edge.to],a=keyOf(pair[0]),b=keyOf(pair[1]);
   if(!a||!b||![a,b].includes(current.id))continue;
   const next=current.id===a?b:a;if(seen.has(next))continue;
   const reverse=current.id===b,points=edge.points?[...edge.points]:undefined;
   const gates=edge.gateIds||edge.openingIds||[];
   const segment={...edge,walkFrom:current.id,walkTo:next,gateIds:reverse?[...gates].reverse():[...gates],points:points?(reverse?points.reverse():points):undefined};
   const segments=[...current.segments,segment],length=edge.points?.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p[0]-edge.points[i][0],p[1]-edge.points[i][1]),0)||1,distance=current.distance+length;
   if(distance>=(distances.get(next)??Infinity))continue;
   distances.set(next,distance);queue.push({id:next,segments,distance});
  }
 }
 return {from,to,segments:[],gateIds:[]};
}

export function mountEstateWalk({getLanguage,getRoom,images,onReturnRoom,onReturnEstate}){
 const dialog=node('dialog',null,'estate-walk');dialog.id='estate-walk';dialog.setAttribute('aria-labelledby','walk-title');
 const head=node('header',null,'walk-head'),identity=node('div');
 identity.append(node('p','CHITING / A HOUSE WITH TIME','walk-eyebrow'));
 const heading=node('h2');heading.id='walk-title';heading.tabIndex=-1;identity.append(heading);
 const close=node('button',null,'walk-close');close.type='button';close.id='walk-close';
 head.append(identity,close);
 const body=node('div',null,'walk-body'),visual=node('section',null,'walk-visual');
 const tabs=node('div',null,'walk-view-tools');tabs.setAttribute('role','group');
 const viewButtons={};for(const value of ['image','geometry','drawing']){const b=node('button');b.type='button';b.id='walk-'+value;b.dataset.walkView=value;viewButtons[value]=b;tabs.append(b);}
 const figure=node('figure',null,'walk-figure'),picture=node('div',null,'walk-picture'),image=node('img');image.id='walk-picture';image.decoding='async';
 const drawing=node('div',null,'walk-drawing');drawing.id='walk-sheet';drawing.hidden=true;
 const status=node('p',null,'walk-image-status');status.id='walk-image-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 picture.append(image,drawing,status);const caption=node('figcaption');caption.id='walk-image-credit';figure.append(picture,caption);visual.append(tabs,figure);
 const aside=node('aside',null,'walk-aside'),intro=node('div',null,'walk-intro'),number=node('p',null,'walk-count'),subtitle=node('p',null,'walk-intention');number.id='walk-count';subtitle.id='walk-intention';intro.append(number,subtitle);
 const mapHeading=node('h3'),map=node('div',null,'walk-map');map.id='walk-map';
 const routeHeading=node('h3'),routeText=node('p',null,'walk-route-text'),routeCodes=node('p',null,'walk-route-codes');routeText.id='walk-route-text';routeCodes.id='walk-route-codes';
 const returnButton=node('button',null,'walk-return');returnButton.type='button';returnButton.id='walk-return';
 aside.append(intro,mapHeading,map,routeHeading,routeText,routeCodes,returnButton);body.append(visual,aside);
 const footer=node('footer',null,'walk-footer'),stepper=node('div',null,'walk-stepper'),previous=node('button',null,'walk-step'),next=node('button',null,'walk-step');previous.id='walk-previous';next.id='walk-next';previous.type=next.type='button';
 const directory=node('details',null,'walk-directory'),summary=node('summary'),list=node('nav');list.id='walk-directory';directory.append(summary,list);
 const hint=node('p',null,'walk-hint');stepper.append(previous,next);footer.append(stepper,directory,hint);dialog.append(head,body,footer);document.body.append(dialog);
 let selected='entry',mode='image',routeFrom='entry',epoch=0,returnHash='',opener=null,route=null,returning=false;
 const lang=()=>getLanguage()==='en'?'en':'zh';
 const tr=key=>words[key][lang()==='en'?1:0];
 const label=id=>textOf(getRoom?.(id)?.label||M.zones.find(z=>z.id===id)?.label||M.walk?.stations?.find(s=>s.id===id)?.label||extraLabels[id],lang());
 const camera=id=>M.cameras.find(c=>c.id==='C-'+id)||M.cameras.find(c=>c.roomId===id);
 const pointFor=id=>(M.walk||M.estate.walk)?.stations?.find(s=>s.id===id)?.position||camera(id)?.position||M.zones.find(z=>z.id===id)?.labelAt||(()=>{const p=M.estate.program.find(p=>p.id===id),r=p?.rect;return r?[r.x+r.w/2,r.y+r.d/2]:M.estate.paths.find(p=>p.id==='EP03').points[1];})();
 const geometryURL=id=>new URL('./docs/drawings/'+id+'-geometry.png?rev='+M.version,location.href).href;
 function setHash(){const hash='#walk-'+selected;if(location.hash!==hash)history.replaceState(null,'',location.pathname+location.search+hash);}
 function renderDrawing(){
  drawing.innerHTML=['reserve','media','gym','pool','outer'].includes(selected)?estateDetailSVG(selected,lang()):planSVG({selected,lang:lang(),layer:'furniture'});
  for(const el of drawing.querySelectorAll('[tabindex]')){el.removeAttribute('tabindex');el.removeAttribute('role');el.removeAttribute('aria-pressed');}
 }
 function setMode(value){mode=value;for(const [id,b]of Object.entries(viewButtons))b.setAttribute('aria-pressed',String(mode===id));renderImage();}
 function renderImage(){
  const current=++epoch;image.hidden=true;drawing.hidden=mode!=='drawing';status.hidden=mode==='drawing';status.textContent=tr('loading');
  renderDrawing();caption.textContent=mode==='drawing'?tr('drawingCredit'):mode==='geometry'?tr('geometryCredit'):tr('credit');
  if(mode==='drawing')return;
  const geometry=geometryURL(selected),material=images[selected],first=mode==='geometry'||!material?geometry:material;
  const load=(source,fallback=false)=>{const probe=new Image();probe.onload=()=>{if(current!==epoch||!dialog.open)return;image.src=source;image.hidden=false;image.alt=label(selected)+' · '+(camera(selected)?.id||'')+(fallback||mode==='geometry'?' · '+tr('geometry'):' · '+tr('image'));status.hidden=!fallback;status.textContent=fallback?tr('fallback'):'';if(fallback)caption.textContent=tr('geometryCredit');};probe.onerror=()=>{if(current!==epoch||!dialog.open)return;if(!fallback&&source!==geometry){load(geometry,true);return;}image.hidden=true;drawing.hidden=false;status.hidden=false;status.textContent=tr('failed');caption.textContent=tr('drawingCredit');};probe.src=source;};
  load(first,mode==='image'&&!material);
 }
 function renderMap(){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),bounds=M.estate.bounds;svg.setAttribute('viewBox',`${bounds.x-1} ${bounds.y-1} ${bounds.w+2} ${bounds.d+2}`);svg.setAttribute('role','group');svg.setAttribute('aria-label',tr('locate')+' · '+label(selected));
  const add=(tag,attrs)=>{const el=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))el.setAttribute(k,v);svg.append(el);return el;};
  const rect=(r,fill,stroke='#b7b8a6')=>add('rect',{x:r.x,y:r.y,width:r.w,height:r.d,fill,stroke,'stroke-width':.1});
  rect(M.estate.bounds,'#e5e9dc');
  for(const p of M.estate.program.filter(p=>!['studio','core'].includes(p.id)).sort((a,b)=>(a.id==='pool-deck'?-1:0)-(b.id==='pool-deck'?-1:0)))rect(p.rect,p.id==='pool'?'#b7d1ce':p.id==='pool-deck'?'#d9c8a6':'#d2d8c4');
  for(const z of M.zones)for(const p of z.polygons)add('polygon',{points:p.map(p=>p.join(',')).join(' '),fill:z.id===selected?'#d7bd96':z.outdoor?'#dbe2ce':'#eee7d9',stroke:'#b5ad99','stroke-width':.1});
  for(const r of [...M.routes,...M.estate.paths].filter(r=>r.kind!=='vehicle'))add('polyline',{points:r.points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#faf7ef','stroke-width':r.width||.75,'stroke-linecap':'round','stroke-linejoin':'round'});
  for(const p of M.estate.planting)add('circle',{cx:p.position[0],cy:p.position[1],r:p.canopyRadius,fill:'#a9b992','fill-opacity':.5,stroke:'#8b9c78','stroke-width':.08});
  const segment=(a,b,color,width=.14)=>add('line',{x1:a[0],y1:a[1],x2:b[0],y2:b[1],stroke:color,'stroke-width':width});
  const wallWithOpenings=(wall,holes,color,width)=>{
   const a=wall.a,b=wall.b,dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy;
   const t=p=>((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length2,at=t=>[a[0]+dx*t,a[1]+dy*t];
   const cuts=holes.map(o=>[t(o.a),t(o.b)].sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]);let cursor=0;
   for(const[start,end]of[...cuts,[1,1]]){if(start>cursor)segment(at(cursor),at(start),color,width);cursor=Math.max(cursor,end);}
  };
  for(const wall of [...M.walls,...M.estate.wing.walls])wallWithOpenings(wall,[...M.openings,...M.estate.wing.openings].filter(o=>o.wallId===wall.id),'#aaa18b',.14);
  for(const b of M.estate.boundaries)wallWithOpenings(b,b.openings||(b.opening?[b.opening]:[]),b.kind==='privacy-wall'?'#95917c':'#99a685',.18);
  const pool=M.estate.poolSafety,pr=pool.rect,pa=[pr.x,pr.y],pb=[pr.x+pr.w,pr.y],pc=[pr.x+pr.w,pr.y+pr.d],pd=[pr.x,pr.y+pr.d];
  wallWithOpenings({a:pa,b:pb},[pool.gate],'#72938b',.14);segment(pb,pc,'#72938b');segment(pc,pd,'#72938b');segment(pd,pa,'#72938b');
  for(const s of route?.segments||[])if(s.points?.length>1)add('polyline',{'data-walk-route':s.id,points:s.points.map(p=>p.join(',')).join(' '),fill:'none',stroke:'#9e7251','stroke-width':.26,'stroke-linecap':'round','stroke-linejoin':'round'});
  for(const [i,id]of WALK_ORDER.entries()){
   const p=pointFor(id),marker=add('g',{'data-walk-place':id,role:'button',tabindex:0,'aria-label':label(id),'aria-pressed':String(selected===id),class:'walk-map-place'}),circle=document.createElementNS(ns,'circle'),text=document.createElementNS(ns,'text');
   circle.setAttribute('cx',p[0]);circle.setAttribute('cy',p[1]);circle.setAttribute('r',selected===id ? .83 : .67);circle.setAttribute('fill',selected===id?'#647551':'#f6f3e9');circle.setAttribute('stroke','#778269');circle.setAttribute('stroke-width','.1');
   text.setAttribute('x',p[0]);text.setAttribute('y',p[1]+.23);text.setAttribute('text-anchor','middle');text.setAttribute('font-size','.64');text.setAttribute('fill',selected===id?'#fffbed':'#69765b');text.textContent=String(i+1).padStart(2,'0');text.setAttribute('pointer-events','none');marker.append(circle,text);
   marker.addEventListener('click',()=>go(id));marker.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();go(id);}});
  }
  const c=camera(selected);if(c){const p=c.position,dx=c.target[0]-p[0],dy=c.target[1]-p[1],n=Math.hypot(dx,dy)||1,d=[dx/n,dy/n],r=[-d[1],d[0]],spread=Math.tan(c.fov*Math.PI/360)*1.8,left=[p[0]+d[0]*1.8+r[0]*spread,p[1]+d[1]*1.8+r[1]*spread],right=[p[0]+d[0]*1.8-r[0]*spread,p[1]+d[1]*1.8-r[1]*spread];add('polygon',{points:[p,left,right].map(p=>p.join(',')).join(' '),fill:'#6a7e56','fill-opacity':.2,stroke:'#647551','stroke-width':.1,'pointer-events':'none'});}
  map.replaceChildren(svg);
 }
 function render(){
  const index=WALK_ORDER.indexOf(selected);heading.textContent=label(selected);close.textContent=tr('close')+' ×';close.setAttribute('aria-label',tr('close'));number.textContent=String(index+1).padStart(2,'0')+' / 13 — '+tr(coreIds.includes(selected)?'core':'future');subtitle.textContent=intentions[selected][lang()==='en'?1:0];
  for(const [id,b]of Object.entries(viewButtons))b.textContent=tr(id);tabs.setAttribute('aria-label',lang()==='en'?'View type':'漫游视图');mapHeading.textContent=tr('locate');routeHeading.textContent=tr(routeFrom==='entry'&&selected!=='entry'?'initial':'route');
  route=findWalkRoute(routeFrom,selected);
  const routePlaces=route.segments.map(s=>label(s.walkFrom)+' → '+label(s.walkTo));
  routeText.textContent=selected===routeFrom?tr('start'):label(routeFrom)+' → '+label(selected)+(routePlaces.length?' · '+routePlaces.join(' / '):'');
  routeCodes.textContent=(camera(selected)?.id||'')+(route.gateIds.length?' · '+tr('doors')+' '+route.gateIds.join(' → '):'');
  returnButton.textContent=tr(coreIds.includes(selected)?'home':'estate');
  const prevId=WALK_ORDER[(index+WALK_ORDER.length-1)%WALK_ORDER.length],nextId=WALK_ORDER[(index+1)%WALK_ORDER.length];previous.replaceChildren(node('small','← '+tr('previous')),node('span',label(prevId)));next.replaceChildren(node('small',tr('next')+' →'),node('span',label(nextId)));summary.textContent=tr('directory')+' / 13';list.setAttribute('aria-label',tr('directory'));list.replaceChildren();
  for(const [i,id]of WALK_ORDER.entries()){const b=node('button');b.type='button';b.dataset.walkRoom=id;b.setAttribute('aria-pressed',String(selected===id));b.append(node('small',String(i+1).padStart(2,'0')),node('span',label(id)));b.addEventListener('click',()=>go(id));list.append(b);}
  hint.textContent=tr('hint');renderMap();for(const [id,b]of Object.entries(viewButtons))b.setAttribute('aria-pressed',String(mode===id));renderImage();
 }
 function go(id){if(!WALK_ORDER.includes(id))return;routeFrom=selected;selected=id;setHash();const active=document.activeElement,roomFocus=active?.dataset?.walkRoom,mapFocus=active?.getAttribute?.('data-walk-place');render();if(roomFocus)list.querySelector(`[data-walk-room="${id}"]`)?.focus({preventScroll:true});if(mapFocus)map.querySelector(`[data-walk-place="${id}"]`)?.focus({preventScroll:true});}
 function open(id='entry'){
  if(!WALK_ORDER.includes(id))id='entry';
  if(dialog.open){if(selected!==id)go(id);return;}
  opener=document.activeElement;returning=false;returnHash=location.hash.startsWith('#walk-')?'':location.hash;routeFrom='entry';selected=id;mode='image';dialog.showModal();setHash();render();heading.focus({preventScroll:true});document.body.classList.add('walk-open');
 }
 function closeWalk(){dialog.close();}
 close.addEventListener('click',closeWalk);previous.addEventListener('click',()=>go(WALK_ORDER[(WALK_ORDER.indexOf(selected)+WALK_ORDER.length-1)%WALK_ORDER.length]));next.addEventListener('click',()=>go(WALK_ORDER[(WALK_ORDER.indexOf(selected)+1)%WALK_ORDER.length]));
 for(const [value,b]of Object.entries(viewButtons))b.addEventListener('click',()=>setMode(value));
 returnButton.addEventListener('click',()=>{const id=selected;returning=true;closeWalk();if(coreIds.includes(id))onReturnRoom?.(id);else onReturnEstate?.();});
 dialog.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=WALK_ORDER.indexOf(selected);go(event.key==='Home'?WALK_ORDER[0]:event.key==='End'?WALK_ORDER.at(-1):WALK_ORDER[(i+(event.key==='ArrowRight'?1:WALK_ORDER.length-1))%WALK_ORDER.length]);});
 dialog.addEventListener('close',()=>{epoch++;document.body.classList.remove('walk-open');if(location.hash.startsWith('#walk-'))history.replaceState(null,'',location.pathname+location.search+returnHash);if(!returning&&opener?.isConnected)opener.focus({preventScroll:true});returning=false;});
 const linked=()=>{const id=location.hash.match(/^#walk-([a-z]+)$/)?.[1];if(WALK_ORDER.includes(id))open(id);else if(dialog.open)closeWalk();};
 const external=event=>{if(WALK_ORDER.includes(event.detail?.id))open(event.detail.id);};
 window.addEventListener('hashchange',linked);document.addEventListener('caelum:walk',external);linked();
 return {open,translate:()=>{if(dialog.open)render();},destroy:()=>{epoch++;window.removeEventListener('hashchange',linked);document.removeEventListener('caelum:walk',external);if(dialog.open)dialog.close();dialog.remove();}};
}
