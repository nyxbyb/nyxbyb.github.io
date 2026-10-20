/** Original 2D architectural sheets. All geometry comes from spatial-model.js. */
import {SPATIAL_MODEL} from './spatial-model.js';
const M=SPATIAL_MODEL;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const loc=(v,l='zh')=>typeof v==='string'?v:v?.[l]||v?.zh||'';
const n=v=>Number(v.toFixed(3));
const path=points=>points.map((p,i)=>(i?'L':'M')+p.map(n).join(' ')).join(' ')+'Z';
const text=(x,y,s,size=14,fill='#5e6052',extra='')=>`<text x="${n(x)}" y="${n(y)}" font-size="${size}" fill="${fill}" ${extra}>${esc(s)}</text>`;
const line=(a,b,stroke='#888572',width=1,extra='')=>`<line x1="${n(a[0])}" y1="${n(a[1])}" x2="${n(b[0])}" y2="${n(b[1])}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
const rect=(x,y,w,h,fill='#d8c8ad',stroke='#a4947c',extra='')=>`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" fill="${fill}" stroke="${stroke}" stroke-width=".9" ${extra}/>`;
const distance=(a,b)=>Math.hypot(b[0]-a[0],b[1]-a[1]);
export const roomBounds=id=>{const z=M.zones.find(z=>z.id===id),p=z.polygons.flat();return {x:Math.min(...p.map(p=>p[0])),y:Math.min(...p.map(p=>p[1])),w:Math.max(...p.map(p=>p[0]))-Math.min(...p.map(p=>p[0])),d:Math.max(...p.map(p=>p[1]))-Math.min(...p.map(p=>p[1]))};};
export const furnitureRect=f=>Array.isArray(f.rect)?{x:f.rect[0],y:f.rect[1],w:f.rect[2],d:f.rect[3]}:f.rect;
const polygonBounds = polygon => ({x:Math.min(...polygon.map(p=>p[0])),y:Math.min(...polygon.map(p=>p[1])),right:Math.max(...polygon.map(p=>p[0])),bottom:Math.max(...polygon.map(p=>p[1]))});
const contains = (point, polygons) => polygons.some(p => { const b=polygonBounds(p); return point[0]>b.x-1e-7&&point[0]<b.right+1e-7&&point[1]>b.y-1e-7&&point[1]<b.bottom+1e-7; });
export const lightingPoints=()=>M.spaces.filter(s=>!M.zones.find(z=>z.id===s.zoneId).outdoor).map((s,i)=>{
 const boxes=s.polygons.map(polygonBounds),area=boxes.reduce((a,b)=>a+(b.right-b.x)*(b.bottom-b.y),0);
 let position=[0,0];for(const b of boxes){const a=(b.right-b.x)*(b.bottom-b.y);position[0]+=(b.x+b.right)/2*a/area;position[1]+=(b.y+b.bottom)/2*a/area;}
 if(!contains(position,s.polygons)){const b=boxes[0];position=[(b.x+b.right)/2,(b.y+b.bottom)/2];}
 return {id:'L'+String(i+1).padStart(2,'0'),roomId:s.zoneId,spaceId:s.id,position,kind:'ambient'};
}).concat(M.furniture.filter(f=>/desk|tea|counter|basin/.test(f.type)).map((f,i)=>{const r=furnitureRect(f);return {id:'T'+String(i+1).padStart(2,'0'),roomId:f.roomId,position:[r.x+r.w/2,r.y+r.d/2],kind:'task'};}));

export function doorPlanGeometry(o){
 const hinge=o[o.hinge||'a'],closed=o.hinge==='b'?o.a:o.b,width=distance(o.a,o.b),v={north:[0,-1],south:[0,1],east:[1,0],west:[-1,0]}[o.swing]||[0,-1];
 const open=[hinge[0]+v[0]*width,hinge[1]+v[1]*width],a=[closed[0]-hinge[0],closed[1]-hinge[1]],b=[open[0]-hinge[0],open[1]-hinge[1]];
 return {hinge,closed,open,width,sweep:a[0]*b[1]-a[1]*b[0]>0?1:0};
}

/** Actual orthogonal union edges; bounding boxes are never treated as walls. */
export function boundarySegments(roomId,direction){
 const zone=M.zones.find(z=>z.id===roomId),boxes=zone.polygons.map(polygonBounds),xs=[...new Set(boxes.flatMap(b=>[b.x,b.right]))].sort((a,b)=>a-b),ys=[...new Set(boxes.flatMap(b=>[b.y,b.bottom]))].sort((a,b)=>a-b),edges=[];
 const occupied=(x,y)=>contains([x,y],zone.polygons),push=(d,a,b)=>{if(!direction||direction===d)edges.push({direction:d,a,b,length:distance(a,b)});};
 for(let ix=0;ix<xs.length-1;ix++)for(let iy=0;iy<ys.length-1;iy++){
  const x=xs[ix],y=ys[iy],right=xs[ix+1],bottom=ys[iy+1],cx=(x+right)/2,cy=(y+bottom)/2;
  if(!occupied(cx,cy))continue;
  if(!occupied(cx,y-.0001))push('north',[x,y],[right,y]);
  if(!occupied(cx,bottom+.0001))push('south',[x,bottom],[right,bottom]);
  if(!occupied(x-.0001,cy))push('west',[x,y],[x,bottom]);
  if(!occupied(right+.0001,cy))push('east',[right,y],[right,bottom]);
 }
 const horizontal=d=>d==='north'||d==='south';
 edges.sort((a,b)=>a.direction.localeCompare(b.direction)||(horizontal(a.direction)?a.a[1]-b.a[1]||a.a[0]-b.a[0]:a.a[0]-b.a[0]||a.a[1]-b.a[1]));
 const merged=[];for(const e of edges){const previous=merged.at(-1);if(previous&&previous.direction===e.direction&&distance(previous.b,e.a)<1e-7){previous.b=e.b;previous.length=distance(previous.a,previous.b);}else merged.push({...e});}
 return merged;
}
function header(title,code,subtitle,lang){return text(70,44,'迟庭  /  CHITING',16)+text(1010,44,code,11,'#858673','text-anchor="end"')+text(70,78,title,22)+text(70,103,subtitle,11,'#959281');}
function shell(content,{width=1080,height=1120,title='迟庭 · 空间协调图',lang='zh'}={}){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(title)}" style="display:block;width:100%;height:auto;background:#f8f5ee;font-family:Georgia,'Songti SC','Noto Serif SC',serif"><title>${esc(title)}</title><defs><marker id="route-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 1L9 5L0 9" fill="none" stroke="context-stroke" stroke-width="1.6"/></marker></defs>${content}</svg>`;}
export function planSVG({selected='living',lang='zh',layer='furniture',mini=false}={}){
 const u=60,ox=100,oy=150,P=p=>[ox+p[0]*u,oy+p[1]*u];let s='';
 if(!mini)s+=header(lang==='en'?'A coordinated plan':'全屋家具与空间协调',`A-01 / REV.02`,lang==='en'?'One geometry · doors / windows / furniture / views':'同一空间模型 · 门窗 / 家具 / 视点 / 动线',lang);
 for(const z of M.zones){const fill=z.id===selected?'#dfc7a5':z.outdoor?'#e0e5d4':z.id==='bath'?'#e4e7df':'#f0e9dc';s+=`<g class="house-zone" data-id="${z.id}" role="button" tabindex="0" aria-pressed="${z.id===selected}" aria-label="${esc(loc(z.label,lang))}"><path class="hp-zone-hit" d="${z.polygons.map(p=>path(p.map(P))).join(' ')}" fill="${fill}" stroke="transparent" stroke-width="3"/></g>`;}
 // A tree is furniture too: its intended root zone remains explicit in the model.
 for(const f of [...M.furniture].sort((a,b)=>(/rug|deck/.test(a.type)?0:1)-(/rug|deck/.test(b.type)?0:1))){const r=furnitureRect(f);if(!r)continue;const [x,y]=P([r.x,r.y]),w=r.w*u,h=r.d*u;let fill=/bed|sofa|chair/.test(f.type)?'#e4dccc':/shower|wc|sink|basin/.test(f.type)?'#eef0e9':/tree|plant/.test(f.type)?'#adb998':/equipment|speaker|monitor/.test(f.type)?'#8f9689':'#d4bd99';s+=`<g class="plan-furniture" data-furniture="${esc(f.id)}" pointer-events="none">`;
 if(/tree/.test(f.type)){const radius=(f.canopyRadius||Math.max(r.w,r.d)/2)*u;s+=`<ellipse data-canopy="${esc(f.id)}" cx="${x+w/2}" cy="${y+h/2}" rx="${radius}" ry="${radius}" fill="${fill}" fill-opacity=".45" stroke="#91a078"/>`+rect(x,y,w,h,'#8f8d6a','none');}else{
  if(f.shape==='ellipse')s+=`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="#b0a38b"/>`;else s+=rect(x,y,w,h,fill,'#b0a38b',`rx="${/bed|sofa|chair/.test(f.type)?4:1}"`);
  if(/bed/.test(f.type))s+=rect(x+w*.08,y+h*.06,w*.36,h*.17,'#f8f4e9','#c4bca9')+rect(x+w*.56,y+h*.06,w*.36,h*.17,'#f8f4e9','#c4bca9');
  if(/shelf|cabinet|wardrobe|counter/.test(f.type)){for(let k=1;k<Math.max(2,Math.ceil(Math.max(w,h)/36));k++){const t=k/Math.max(2,Math.ceil(Math.max(w,h)/36));s+=w>h?line([x+w*t,y],[x+w*t,y+h],'#b6a27f',.6):line([x,y+h*t],[x+w,y+h*t],'#b6a27f',.6);}}
  if(/sofa/.test(f.type))s+=line([x+w*.04,y+h*.2],[x+w*.96,y+h*.2],'#b5a994',2);
  if(f.type==='chair'){s+=`<g transform="rotate(${f.rotation||0} ${x+w/2} ${y+h/2})">`+line([x+w*.08,y+h*.13],[x+w*.92,y+h*.13],'#a89a80',2.2)+'</g>';}
 }
 if(layer==='furniture'&&!mini&&w>25&&h>16)s+=text(x+w/2,y+h/2+3,f.id,8,'#827763','text-anchor="middle"');s+='</g>';}
 for(const wall of M.walls){const a=wall.a,b=wall.b,len=distance(a,b);let cuts=M.openings.filter(o=>o.wallId===wall.id).map(o=>[distance(a,o.a)/len,distance(a,o.b)/len].sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]);let t=0;const point=t=>P([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);for(const [start,end]of [...cuts,[1,1]]){if(start>t)s+=line(point(t),point(start),'#736b5b',wall.kind==='exterior'?5:3);t=Math.max(t,end);}}
 for(const o of M.openings){const a=P(o.a),b=P(o.b),isWindow=o.type==='window',col=isWindow?'#7e9a95':'#a38b68';if(isWindow){s+=line(a,b,col,2);const v=o.a[0]===o.b[0];s+=line([a[0]+(v?3:0),a[1]+(v?0:3)],[b[0]+(v?3:0),b[1]+(v?0:3)],col,.6);}else if(o.type==='passage'){s+=line(a,b,'#c5b9a4',.6,'stroke-dasharray="2 5"');}else if(/slid|pocket/.test(o.operation)){const v=o.a[0]===o.b[0];s+=line(a,b,col,1)+line([a[0]+(v?3:0),a[1]+(v?0:3)],[b[0]+(v?3:0),b[1]+(v?0:3)],col,.7);}else{const d=doorPlanGeometry(o),hinge=P(d.hinge),closed=P(d.closed),leaf=P(d.open);s+=line(hinge,leaf,col,1)+`<path data-door="${esc(o.id)}" d="M${closed.join(' ')} A${d.width*u} ${d.width*u} 0 0 ${d.sweep} ${leaf.join(' ')}" fill="none" stroke="${col}" stroke-width=".6"/>`;}
 if(layer==='openings'&&!mini)s+=text((a[0]+b[0])/2+6,(a[1]+b[1])/2-9,o.id,10,col);}
 if(layer==='routes'){const colors=['#a67551','#75886a','#8d8195'];M.routes.forEach((r,i)=>{s+=`<polyline points="${r.points.map(p=>P(p).join(',')).join(' ')}" fill="none" stroke="${colors[i%3]}" stroke-opacity=".12" stroke-width="${(r.width||.75)*u}" stroke-linecap="round" stroke-linejoin="round" pointer-events="none"/><polyline points="${r.points.map(p=>P(p).join(',')).join(' ')}" fill="none" stroke="${colors[i%3]}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#route-arrow)" pointer-events="none"/>`;});}
 if(layer==='cameras'||mini){for(const c of M.cameras.filter(c=>!mini||c.roomId===selected)){const p=c.position,t=c.target,dx=t[0]-p[0],dy=t[1]-p[1],len=Math.hypot(dx,dy),d=[dx/len,dy/len],r=[-d[1],d[0]],spread=Math.tan((c.fov||65)*Math.PI/360)*1.6,tip=P(p),left=P([p[0]+d[0]*1.6+r[0]*spread,p[1]+d[1]*1.6+r[1]*spread]),right=P([p[0]+d[0]*1.6-r[0]*spread,p[1]+d[1]*1.6-r[1]*spread]);s+=`<path d="${path([tip,left,right])}" fill="#8b9b7c" fill-opacity=".14" stroke="#7b8b6c" stroke-width="1" pointer-events="none"/><circle cx="${tip[0]}" cy="${tip[1]}" r="4" fill="#687c58" pointer-events="none"/>`;if(!mini)s+=text(tip[0]+7,tip[1]-7,c.id||'C',11,'#637855');}}
 if(layer==='lighting'){for(const p of lightingPoints()){const [x,y]=P(p.position);s+=`<circle cx="${x}" cy="${y}" r="${p.kind==='task'?7:11}" fill="#d9bd74" fill-opacity=".5" stroke="#ac925c"/>`+line([x-5,y],[x+5,y],'#957e50',1)+line([x,y-5],[x,y+5],'#957e50',1)+text(x+13,y-9,p.id,10,'#957e50');}}
 if(layer==='services'){for(const f of M.furniture.filter(f=>/equipment|washer|sink|shower|wc|speaker|hob/.test(f.type))){const r=furnitureRect(f),[x,y]=P([r.x+r.w/2,r.y+r.d/2]),wet=/sink|shower|wc|washer/.test(f.type);s+=`<circle cx="${x}" cy="${y}" r="12" fill="${wet?'#d7e3e2':'#ded7c8'}" stroke="${wet?'#809b9b':'#9b896c'}"/>`+text(x+17,y+4,f.id,9);}}
 if(!mini){for(const z of M.zones){const p=P(z.labelAt);s+=text(p[0],p[1],loc(z.label,lang),lang==='en'?11:14,'#605a4e','text-anchor="middle" pointer-events="none"')+text(p[0],p[1]+19,z.area+' m²',11,'#9d8d75','text-anchor="middle" pointer-events="none"');}s+=line([100,125],[940,125],'#b5ae9c',.7)+text(520,118,'14.0 m',12,'#9d9684','text-anchor="middle"');s+=text(970,170,'N*',13)+line([980,210],[980,180],'#8c8f78',1.4,'marker-end="url(#route-arrow)"');s+=text(100,1044,lang==='en'?'166 m² net + 34 m² allowance = 200 m² gross; courtyard 30 m² separate.':'净功能166㎡ + 构造设备预留34㎡ = 概念建面200㎡；庭院30㎡另列。',12)+text(100,1070,lang==='en'?'Control geometry, not construction clear dimensions. *North is a working assumption.':'概念控制线，非施工净尺寸。*北向为研究假设，需随基地调整。',11,'#9d9886');}
 return shell(s,{height:mini?1040:1120,title:lang==='en'?'Chiting coordinated house plan':'迟庭 · 同模型全屋平面',lang});
}

const onSegment=(p,a,b)=>Math.abs((b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]))<.01&&p[0]>=Math.min(a[0],b[0])-.01&&p[0]<=Math.max(a[0],b[0])+.01&&p[1]>=Math.min(a[1],b[1])-.01&&p[1]<=Math.max(a[1],b[1])+.01;
export function elevationPanels(roomId,direction='north'){
 const horizontal=['north','south'].includes(direction),reverse=['south','west'].includes(direction);
 return boundarySegments(roomId,direction).map(segment=>{
  const axis=p=>horizontal?p[0]-segment.a[0]:p[1]-segment.a[1],len=segment.length;
  const project=(a,b)=>{const min=Math.max(0,Math.min(a,b)),max=Math.min(len,Math.max(a,b));return {left:reverse?len-max:min,width:max-min};};
  const openings=M.openings.filter(o=>onSegment(o.a,segment.a,segment.b)&&onSegment(o.b,segment.a,segment.b)).map(o=>({...o,...project(axis(o.a),axis(o.b))}));
  const furniture=M.furniture.filter(f=>f.roomId===roomId&&!/rug|deck|tree/.test(f.type)).map(f=>{
   const r=furnitureRect(f),near=direction==='north'?r.y-segment.a[1]:direction==='south'?segment.a[1]-r.y-r.d:direction==='west'?r.x-segment.a[0]:segment.a[0]-r.x-r.w;
   const start=horizontal?r.x-segment.a[0]:r.y-segment.a[1],end=start+(horizontal?r.w:r.d);
   return {...f,...project(start,end),near};
  }).filter(f=>f.near>=-.001&&f.near<=1.05&&f.width>.001).sort((a,b)=>a.near-b.near||(a.baseHeight||0)-(b.baseHeight||0));
  return {...segment,reverse,openings,furniture};
 });
}

export function elevationSVG(roomId,direction='north',lang='zh'){
 const panels=elevationPanels(roomId,direction),wallHeight=M.ceilingHeight,ox=100;
 let s=header(loc(M.zones.find(z=>z.id===roomId).label,lang)+(lang==='en'?' · interior elevations':' · 室内立面'),'A-02 / '+direction.toUpperCase(),lang==='en'?'Actual boundary segments; south / west reverse correctly. Near-wall objects are projected.':'按真实边界分段；南／西向已镜像。近墙家具投影，编号与平面一致。',lang),top=150;
 for(const [index,panel]of panels.entries()){
  const scale=Math.min(78,880/panel.length),base=top+wallHeight*scale;
  const coordinate=`[${panel.a.map(n).join(',')}] → [${panel.b.map(n).join(',')}] m`;
  s+=text(ox,top-18,`${index+1} / ${panels.length}  ·  ${coordinate}`,11,'#97917f');
  s+=rect(ox,top,panel.length*scale,wallHeight*scale,'#eee8dc','#a59a84');
  for(const o of panel.openings){const x=ox+o.left*scale,w=o.width*scale,glazed=o.type==='window'||o.operation==='sliding';s+=rect(x,base-o.head*scale,w,(o.head-o.sill)*scale,glazed?'#d9e2d7':o.type==='passage'?'#f8f5ee':'#cdb896',glazed?'#87a09b':'#aa9272')+text(x+w/2,base-o.head*scale-8,o.id,10,'#8a8f76','text-anchor="middle"');if(glazed)s+=line([x+w/2,base-o.head*scale],[x+w/2,base-o.sill*scale],'#8fa09b',1);}
  for(const f of panel.furniture){const x=ox+f.left*scale,w=f.width*scale,h=f.height*scale,z=(f.baseHeight||0)*scale,fill=/equipment|speaker|monitor|hob/.test(f.type)?'#91988c':/bed|sofa/.test(f.type)?'#e3dac8':'#d3bd99';s+=rect(x,base-z-h,w,h,fill,'#b39e7e',f.near>.3?'opacity=".58"':'')+text(x+w/2,base+18,f.id,9,'#9b8c76','text-anchor="middle"');if(/shelf|wardrobe|cabinet/.test(f.type)){for(let i=1;i<4;i++)s+=line([x+w*i/4,base-z-h],[x+w*i/4,base-z],'#ad9776',.6);}}
  s+=line([ox-8,base],[ox+panel.length*scale+8,base],'#7b7568',2)+line([ox,base+48],[ox+panel.length*scale,base+48],'#aaa18d',.7)+text(ox+panel.length*scale/2,base+42,panel.length.toFixed(2)+' m',12,'#958b78','text-anchor="middle"');
  top=base+100;
 }
 s+=text(ox,top-8,lang==='en'?`Concept ceiling ${wallHeight.toFixed(2)} m. Heights and assemblies await project development.`:`研究层高 ${wallHeight.toFixed(2)}m；门窗、构造与设备高度仍需项目深化。`,11,'#9a937f');
 return shell(s,{height:top+28,title:'迟庭 · '+roomId+' '+direction+' elevation',lang});
}
export function sectionGeometry(cutX=2.4){
 const zones=M.zones.flatMap(z=>z.polygons.map(polygonBounds).filter(b=>cutX>b.x&&cutX<b.right).map(b=>({id:z.id,a:b.y,b:b.bottom,outdoor:z.outdoor,label:z.label}))).sort((a,b)=>a.a-b.a);
 const walls=M.walls.filter(w=>Math.abs(w.a[1]-w.b[1])<1e-7&&cutX>=Math.min(w.a[0],w.b[0])&&cutX<=Math.max(w.a[0],w.b[0])).map(w=>{
  const position=w.a[1],opening=M.openings.find(o=>o.wallId===w.id&&onSegment([cutX,position],o.a,o.b)),parts=[];
  if(!opening)parts.push({bottom:0,top:w.height,kind:'wall'});
  else{if(opening.sill>0)parts.push({bottom:0,top:opening.sill,kind:'wall'});if(opening.head<w.height)parts.push({bottom:opening.head,top:w.height,kind:'wall'});if(opening.type==='window'||opening.operation==='sliding')parts.push({bottom:opening.sill,top:opening.head,kind:'glass'});else if(opening.type==='door')parts.push({bottom:0,top:opening.head,kind:'door'});}
  return {wallId:w.id,position,thickness:w.thickness,openingId:opening?.id,parts};
 });
 const furniture=M.furniture.flatMap(f=>{
  const r=furnitureRect(f),z=f.baseHeight||0;
  if(f.type==='tree')return [{id:f.id,type:f.type,a:r.y+r.d/2-f.canopyRadius,b:r.y+r.d/2+f.canopyRadius,bottom:z+f.height*.4,top:z+f.height,trunk:[r.y,r.y+r.d,z,z+f.height*.55],projection:true}];
  if(cutX<r.x||cutX>r.x+r.w)return [];
  let a=r.y,b=r.y+r.d;
  if(f.shape==='ellipse'){const half=r.d/2*Math.sqrt(Math.max(0,1-((cutX-r.x-r.w/2)/(r.w/2))**2));a=r.y+r.d/2-half;b=r.y+r.d/2+half;}
  return [{id:f.id,type:f.type,a,b,bottom:z,top:z+f.height}];
 });
 return {cutX,zones,walls,furniture};
}

export function sectionSVG(lang='zh'){
 const geometry=sectionGeometry(),u=62,ox=100,base=460,H=M.ceilingHeight;
 let s=header(lang==='en'?'A–A section · one spatial model':'A–A 剖面 · 同一空间模型','A-03 / REV.02',lang==='en'?`Cut x=${geometry.cutX} m, looking east. Tree crown projected beyond the cut.`:`沿 x=${geometry.cutX}m 南北剖切、向东看；树冠为剖切线以东投影。`,lang);
 for(const p of geometry.zones){const x=ox+p.a*u,w=(p.b-p.a)*u;s+=rect(x,base-H*u,w,H*u,p.outdoor?'#e5eadc':'#eee5d5','none');if(!p.outdoor)s+=rect(x,base-H*u-10,w,10,'#b2aa96','#a09884');s+=line([x,base],[x+w,base],'#9c927b',3)+text(x+w/2,base+32,loc(p.label,lang),p.b-p.a<2?9:12,'#77705f','text-anchor="middle"');}
 for(const f of geometry.furniture){const x=ox+f.a*u,w=(f.b-f.a)*u,h=(f.top-f.bottom)*u,y=base-f.top*u;s+=`<g data-section-furniture="${esc(f.id)}">`;if(f.type==='tree'){const t=f.trunk;s+=rect(ox+t[0]*u,base-t[3]*u,(t[1]-t[0])*u,(t[3]-t[2])*u,'#9c9c7a','none','opacity=".5"')+`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="#a7b68d" fill-opacity=".4" stroke="#94a17f"/>`;}else if(/desk|table|tea/.test(f.type)){s+=rect(x,y,w,Math.min(.07*u,h),'#d8bf96','#a7916e')+line([x+w/2,y+h],[x+w/2,y+Math.min(.07*u,h)],'#b5a080',2);}else s+=rect(x,y,w,Math.max(1,h),/bed|sofa/.test(f.type)?'#dfd4bf':'#c5b08e','#a59272');if(!/rug|deck/.test(f.type))s+=text(x+w/2,base+59,f.id,9,'#9c9079','text-anchor="middle"');s+='</g>';}
 for(const wall of geometry.walls){const x=ox+wall.position*u,w=wall.thickness*u;s+=`<g data-section-wall="${esc(wall.wallId)}"${wall.openingId?` data-opening="${esc(wall.openingId)}"`:''}>`;for(const p of wall.parts){const y=base-p.top*u,h=(p.top-p.bottom)*u;if(p.kind==='glass')s+=line([x,y],[x,y+h],'#8ea5a0',1.8);else s+=rect(x-w/2,y,p.kind==='door'?3:w,h,p.kind==='wall'?'#a59b84':'#c9b591','none');}s+='</g>';}
 s+=text(100,560,lang==='en'?'Furniture, openings and ceiling height are read from the shared model. Roof assemblies remain diagrammatic.':'家具、门窗与层高直接读取模型；屋面仅示意，构造、坡度、结构和排水待深化。',11,'#938c79')+text(100,588,lang==='en'?`Concept indoor height ${H.toFixed(2)} m · original sectional drawing, not a construction detail.`:`室内研究高度${H.toFixed(2)}m · 原创概念剖面，非施工节点图。`,11);
 return shell(s,{height:630,title:lang==='en'?'Chiting house section':'迟庭 · 同模型住宅剖面',lang});
}

/** A fixed-camera geometric perspective, not a WebGL scene or a generated photograph. */
export function perspectiveSVG(roomId,lang='zh',raw=false){
 const c=M.cameras.find(c=>c.roomId===roomId)||M.cameras[0],pos=[c.position[0],c.position[1],c.eyeHeight],dx=c.target[0]-pos[0],dy=c.target[1]-pos[1],len=Math.hypot(dx,dy),forward=[dx/len,dy/len],right=[-forward[1],forward[0]],focal=1200/(2*Math.tan(c.fov*Math.PI/360)),faces=[];
 let sourceId='';
 const cam=p=>{const v=[p[0]-pos[0],p[1]-pos[1],p[2]-pos[2]];return [v[0]*right[0]+v[1]*right[1],v[2],v[0]*forward[0]+v[1]*forward[1]];};
 const add=(pts,fill,stroke='#8e8778',width=.7)=>{let p=pts.map(cam),out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],aIn=a[2]>=.12,bIn=b[2]>=.12;if(aIn)out.push(a);if(aIn!==bIn){const t=(.12-a[2])/(b[2]-a[2]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}if(out.length<3)return;faces.push({sourceId,points:out,fill,depth:out.reduce((s,p)=>s+p[2],0)/out.length,svg:`<path d="${path(out.map(p=>[600+focal*p[0]/p[2],365-focal*p[1]/p[2]]))}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`});};
 const shade=(color,factor)=>'#'+color.slice(1).match(/../g).map(hex=>Math.round(Math.min(255,parseInt(hex,16)*factor)).toString(16).padStart(2,'0')).join('');
 const cube=(x,y,w,d,h,color='#c8b08a',z=0,rotation=0,pivot=[x+w/2,y+d/2])=>{
  if(w<=0||d<=0||h<=0)return;const angle=rotation*Math.PI/180,rotate=p=>[pivot[0]+(p[0]-pivot[0])*Math.cos(angle)-(p[1]-pivot[1])*Math.sin(angle),pivot[1]+(p[0]-pivot[0])*Math.sin(angle)+(p[1]-pivot[1])*Math.cos(angle),p[2]],face=(points,factor)=>add(points.map(rotate),shade(color,factor));
  face([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],1.06);face([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],.9);face([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],.95);face([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],1);face([[x,y,z],[x,y+d,z],[x,y+d,z+h],[x,y,z+h]],1.03);
 };
 const cylinder=(cx,cy,rx,ry,h,z,color)=>{const ring=Array.from({length:20},(_,i)=>[cx+rx*Math.cos(i*Math.PI/10),cy+ry*Math.sin(i*Math.PI/10)]);add(ring.map(p=>[...p,z+h]),shade(color,1.05));for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];add([[...a,z],[...b,z],[...b,z+h],[...a,z+h]],shade(color,.88+.12*(1+Math.cos(i*Math.PI/10))/2));}};
 for(const z of M.zones){sourceId=z.id;for(const p of z.polygons)add(p.map(p=>[...p,0]),z.outdoor?'#d6decb':'#e2d6bd','#c6bda8',.4);}
 for(const zone of M.zones.filter(zone=>!zone.outdoor)){sourceId='ceiling:'+zone.id;for(const polygon of zone.polygons)add(polygon.map(point=>[...point,M.ceilingHeight]),'#f1ecdf','#e6dfce',0);}
 // Split each wall at openings and retain the actual sill/head, avoiding invented windows.
 for(const w of M.walls){const len=distance(w.a,w.b),op=M.openings.filter(o=>o.wallId===w.id),cuts=[0,len,...op.flatMap(o=>[distance(w.a,o.a),distance(w.a,o.b)])].sort((a,b)=>a-b),pt=(t,z)=>[w.a[0]+(w.b[0]-w.a[0])*t/len,w.a[1]+(w.b[1]-w.a[1])*t/len,z];for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1];if(b-a<.001)continue;const mid=(a+b)/2,o=op.find(o=>mid>=Math.min(distance(w.a,o.a),distance(w.a,o.b))-.001&&mid<=Math.max(distance(w.a,o.a),distance(w.a,o.b))+.001),H=w.height;sourceId=o?.id||w.id;const face=(z0,z1,col,start=a,end=b)=>{if(z1>z0)add([pt(start,z0),pt(end,z0),pt(end,z1),pt(start,z1)],col);};if(o){if(o.sill>0)face(0,o.sill,'#e9e3d6');face(o.head,H,'#ede7db');if(o.type==='window'||o.operation==='sliding'){const frame=.035;face(o.sill,o.sill+frame,'#8c9e93');face(o.head-frame,o.head,'#8c9e93');face(o.sill,o.head,'#8c9e93',a,a+frame);face(o.sill,o.head,'#8c9e93',b-frame,b);}else if(o.type==='door')face(0,o.head,'#d4bf9b');}else face(0,H,Math.abs(w.a[0]-w.b[0])<.01?'#e7dfcf':'#f2ede3');}}
 for(const f of M.furniture){sourceId=f.id;const r=furnitureRect(f);if(!r)continue;const h=f.height,z=f.baseHeight||0,cx=r.x+r.w/2,cy=r.y+r.d/2;
  if(f.type==='tree'){cylinder(cx,cy,r.w/2,r.d/2,h*.55,z,'#a2a07d');cylinder(cx,cy,f.canopyRadius,f.canopyRadius,h*.6,z+h*.4,'#abb997');continue;}
  if(/rug|deck/.test(f.type)){add([[r.x,r.y,z+h],[r.x+r.w,r.y,z+h],[r.x+r.w,r.y+r.d,z+h],[r.x,r.y+r.d,z+h]],f.type==='rug'?'#ded8c6':'#cbb898');continue;}
  if(/bed/.test(f.type)){cube(r.x,r.y,r.w,r.d,h*.44,'#c8b08a',z);cube(r.x+.02,r.y+.02,r.w-.04,r.d-.04,h*.36,'#eee7d8',z+h*.44);cube(r.x+r.w*.08,r.y+r.d*.06,r.w*.36,r.d*.17,h*.2,'#f6f0e4',z+h*.8);cube(r.x+r.w*.56,r.y+r.d*.06,r.w*.36,r.d*.17,h*.2,'#f6f0e4',z+h*.8);}
  else if(f.type==='sofa'){cube(r.x,r.y,r.w,r.d,h*.52,'#e1d8c6',z);cube(r.x,r.y,r.w,Math.min(.2,r.d*.24),h*.48,'#e5ddce',z+h*.52);}
  else if(/desk|table|tea/.test(f.type)){const top=Math.min(.07,h*.2);if(f.shape==='ellipse'){cylinder(cx,cy,r.w/2,r.d/2,top,z+h-top,'#d9c19a');cylinder(cx,cy,.1,.1,h-top,z,'#c2a77c');}else{cube(r.x,r.y,r.w,r.d,top,'#d9c19a',z+h-top);for(const [x,y]of [[r.x+.06,r.y+.06],[r.x+r.w-.1,r.y+.06],[r.x+.06,r.y+r.d-.1],[r.x+r.w-.1,r.y+r.d-.1]])cube(x,y,.05,.05,h-top,'#c8b08a',z);}}
  else if(f.type==='chair'){const seat=h*.55,rotation=f.rotation||0,pivot=[cx,cy];cube(r.x,r.y,r.w,r.d,seat,'#ded6c2',z,rotation,pivot);cube(r.x,r.y,r.w,Math.min(.09,r.d*.2),h-seat,'#e4dcca',z+seat,rotation,pivot);}
  else cube(r.x,r.y,r.w,r.d,h,/equipment|speaker|monitor|hob/.test(f.type)?'#8c9188':/shower|wc|basin|sink/.test(f.type)?'#e6e9e1':'#d7c29e',z);
 }
 const caption=lang==='en'?'Horizontal geometric lens · hinged doors closed; plan shows opening sweeps · glazing shown as frames.':'水平几何镜头 · 平开门关闭，平面显示开启范围 · 玻璃以框线示意';
 if(raw)return {faces,focal,width:1200,height:750,cameraId:c.id,eyeHeight:c.eyeHeight,targetHeight:c.targetHeight,doorState:'closed'};
 faces.sort((a,b)=>b.depth-a.depth);return shell(rect(0,0,1200,750,'#f4f0e7','none')+faces.map(f=>f.svg).join('')+rect(0,714,1200,36,'#f4f0e7','none')+text(30,737,caption,12,'#958b79'),{width:1200,height:750,title:loc(M.zones.find(z=>z.id===roomId).label,lang)+' · '+c.id+' '+caption,lang});
}
