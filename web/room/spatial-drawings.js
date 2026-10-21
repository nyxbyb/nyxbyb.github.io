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
 if(layer==='cameras'||mini){for(const c of M.cameras.filter(c=>!mini||c.id==='C-'+selected)){const p=c.position,t=c.target,dx=t[0]-p[0],dy=t[1]-p[1],len=Math.hypot(dx,dy),d=[dx/len,dy/len],r=[-d[1],d[0]],spread=Math.tan((c.fov||65)*Math.PI/360)*1.6,tip=P(p),left=P([p[0]+d[0]*1.6+r[0]*spread,p[1]+d[1]*1.6+r[1]*spread]),right=P([p[0]+d[0]*1.6-r[0]*spread,p[1]+d[1]*1.6-r[1]*spread]);s+=`<path d="${path([tip,left,right])}" fill="#8b9b7c" fill-opacity=".14" stroke="#7b8b6c" stroke-width="1" pointer-events="none"/><circle cx="${tip[0]}" cy="${tip[1]}" r="4" fill="#687c58" pointer-events="none"/>`;if(!mini)s+=text(tip[0]+7,tip[1]-7,c.id||'C',11,'#637855');}}
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
 const c=M.cameras.find(c=>c.id===roomId)||M.cameras.find(c=>c.roomId===roomId)||M.cameras[0],pos=[c.position[0],c.position[1],c.eyeHeight],dx=c.target[0]-pos[0],dy=c.target[1]-pos[1],len=Math.hypot(dx,dy),forward=[dx/len,dy/len],right=[-forward[1],forward[0]],focal=1200/(2*Math.tan(c.fov*Math.PI/360)),faces=[];
 let sourceId='';
 const cam=p=>{const v=[p[0]-pos[0],p[1]-pos[1],p[2]-pos[2]];return [v[0]*right[0]+v[1]*right[1],v[2],v[0]*forward[0]+v[1]*forward[1]];};
 const add=(pts,fill,stroke='#8e8778',width=.7)=>{let p=pts.map(cam),out=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],aIn=a[2]>=.12,bIn=b[2]>=.12;if(aIn)out.push(a);if(aIn!==bIn){const t=(.12-a[2])/(b[2]-a[2]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}if(out.length<3)return;faces.push({sourceId,points:out,fill,depth:out.reduce((s,p)=>s+p[2],0)/out.length,svg:`<path d="${path(out.map(p=>[600+focal*p[0]/p[2],365-focal*p[1]/p[2]]))}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`});};
 const shade=(color,factor)=>'#'+color.slice(1).match(/../g).map(hex=>Math.round(Math.min(255,parseInt(hex,16)*factor)).toString(16).padStart(2,'0')).join('');
 const cube=(x,y,w,d,h,color='#c8b08a',z=0,rotation=0,pivot=[x+w/2,y+d/2])=>{
  if(w<=0||d<=0||h<=0)return;const angle=rotation*Math.PI/180,rotate=p=>[pivot[0]+(p[0]-pivot[0])*Math.cos(angle)-(p[1]-pivot[1])*Math.sin(angle),pivot[1]+(p[0]-pivot[0])*Math.sin(angle)+(p[1]-pivot[1])*Math.cos(angle),p[2]],face=(points,factor)=>add(points.map(rotate),shade(color,factor));
  face([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],1.06);face([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],.9);face([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],.95);face([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],1);face([[x,y,z],[x,y+d,z],[x,y+d,z+h],[x,y,z+h]],1.03);
 };
 const cylinder=(cx,cy,rx,ry,h,z,color)=>{const ring=Array.from({length:20},(_,i)=>[cx+rx*Math.cos(i*Math.PI/10),cy+ry*Math.sin(i*Math.PI/10)]);add(ring.map(p=>[...p,z+h]),shade(color,1.05));for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];add([[...a,z],[...b,z],[...b,z+h],[...a,z+h]],shade(color,.88+.12*(1+Math.cos(i*Math.PI/10))/2));}};
 sourceId='estate-ground';const eb=M.estate.bounds;add([[eb.x,eb.y,-.02],[eb.x+eb.w,eb.y,-.02],[eb.x+eb.w,eb.y+eb.d,-.02],[eb.x,eb.y+eb.d,-.02]],'#dce2d3');
 for(const z of M.zones){sourceId=z.id;for(const p of z.polygons)add(p.map(p=>[...p,0]),z.outdoor?'#d6decb':'#e2d6bd','#c6bda8',.4);}
 for(const zone of M.zones.filter(zone=>!zone.outdoor)){sourceId='ceiling:'+zone.id;for(const polygon of zone.polygons)add(polygon.map(point=>[...point,M.ceilingHeight]),'#f1ecdf','#e6dfce',0);}
 // Split each wall at openings and retain the actual sill/head, avoiding invented windows.
 for(const w of M.walls){const len=distance(w.a,w.b),op=M.openings.filter(o=>o.wallId===w.id),cuts=[0,len,...op.flatMap(o=>[distance(w.a,o.a),distance(w.a,o.b)])].sort((a,b)=>a-b),half=w.id===M.courtyardBoundary.wallId?w.thickness/2:0,pt=(t,z,offset=0)=>[w.a[0]+(w.b[0]-w.a[0])*t/len,w.a[1]+(w.b[1]-w.a[1])*t/len+offset,z];for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1];if(b-a<.001)continue;const mid=(a+b)/2,o=op.find(o=>mid>=Math.min(distance(w.a,o.a),distance(w.a,o.b))-.001&&mid<=Math.max(distance(w.a,o.a),distance(w.a,o.b))+.001),H=w.height;sourceId=o?.id||w.id;const face=(z0,z1,col,start=a,end=b)=>{if(z1>z0)for(const offset of half?[-half,half]:[0])add([pt(start,z0,offset),pt(end,z0,offset),pt(end,z1,offset),pt(start,z1,offset)],col);};if(o){if(o.sill>0)face(0,o.sill,'#e9e3d6');face(o.head,H,'#ede7db');if(o.type==='window'||o.operation==='sliding'){const frame=.035;face(o.sill,o.sill+frame,'#8c9e93');face(o.head-frame,o.head,'#8c9e93');face(o.sill,o.head,'#8c9e93',a,a+frame);face(o.sill,o.head,'#8c9e93',b-frame,b);}else if(o.type==='door')face(0,o.head,'#d4bf9b');if(half){sourceId=o.id+':reveal';add([pt(a,o.sill,-half),pt(a,o.sill,half),pt(a,o.head,half),pt(a,o.head,-half)],'#c6b49a');add([pt(b,o.sill,-half),pt(b,o.sill,half),pt(b,o.head,half),pt(b,o.head,-half)],'#c6b49a');add([pt(a,o.sill,-half),pt(b,o.sill,-half),pt(b,o.sill,half),pt(a,o.sill,half)],'#d5c2a5');add([pt(a,o.head,-half),pt(b,o.head,-half),pt(b,o.head,half),pt(a,o.head,half)],'#d8c8ae');}}else face(0,H,Math.abs(w.a[0]-w.b[0])<.01?'#e7dfcf':'#f2ede3');}}
 const cw=M.walls.find(w=>w.id===M.courtyardBoundary.wallId),roof=M.courtyardBoundary.roofEdge;sourceId='B-W03:eaves';cube(cw.a[0],cw.a[1]-cw.thickness/2,distance(cw.a,cw.b),cw.thickness+roof.projection,roof.top-roof.soffit,'#e1d9c9',roof.soffit);
 for(const boundary of M.estate.boundaries){sourceId=boundary.id;const len=distance(boundary.a,boundary.b),holes=boundary.openings||(boundary.opening?[boundary.opening]:[]),cuts=holes.map(o=>[distance(boundary.a,o.a),distance(boundary.a,o.b)]).sort((a,b)=>a[0]-b[0]),at=t=>[boundary.a[0]+(boundary.b[0]-boundary.a[0])*t/len,boundary.a[1]+(boundary.b[1]-boundary.a[1])*t/len];let cursor=0;for(const [start,end]of[...cuts,[len,len]]){if(start>cursor){const a=at(cursor),b=at(start),t=boundary.kind==='privacy-wall'?.12:.18,color=boundary.kind==='privacy-wall'?'#d8d0bd':'#aab69a';cube(Math.min(a[0],b[0])-t/2,Math.min(a[1],b[1])-t/2,Math.max(t,Math.abs(b[0]-a[0])),Math.max(t,Math.abs(b[1]-a[1])),boundary.height,color);}cursor=end;}}
 for(const f of M.furniture){sourceId=f.id;const r=furnitureRect(f);if(!r)continue;const h=f.height,z=f.baseHeight||0,cx=r.x+r.w/2,cy=r.y+r.d/2;
  if(f.type==='tree'){cylinder(cx,cy,r.w/2,r.d/2,h*.55,z,'#a2a07d');cylinder(cx,cy,f.canopyRadius,f.canopyRadius,h*.6,z+h*.4,'#abb997');continue;}
  if(/rug|deck/.test(f.type)){add([[r.x,r.y,z+h],[r.x+r.w,r.y,z+h],[r.x+r.w,r.y+r.d,z+h],[r.x,r.y+r.d,z+h]],f.type==='rug'?'#ded8c6':'#cbb898');continue;}
  if(/bed/.test(f.type)){cube(r.x,r.y,r.w,r.d,h*.44,'#c8b08a',z);cube(r.x+.02,r.y+.02,r.w-.04,r.d-.04,h*.36,'#eee7d8',z+h*.44);cube(r.x+r.w*.08,r.y+r.d*.06,r.w*.36,r.d*.17,h*.2,'#f6f0e4',z+h*.8);cube(r.x+r.w*.56,r.y+r.d*.06,r.w*.36,r.d*.17,h*.2,'#f6f0e4',z+h*.8);}
  else if(f.type==='sofa'){cube(r.x,r.y,r.w,r.d,h*.52,'#e1d8c6',z);cube(r.x,r.y,r.w,Math.min(.2,r.d*.24),h*.48,'#e5ddce',z+h*.52);}
  else if(/counter/.test(f.type))cube(r.x,r.y,r.w,r.d,h,'#d7c29e',z);
  else if(f.type==='easel'){for(const x of[r.x+.04,r.x+r.w-.08])cube(x,r.y+.12,.04,.05,h,'#ad9571',z);cube(cx-.025,r.y+r.d-.08,.05,.05,h*.75,'#ad9571',z);cube(r.x,r.y+.1,r.w,.09,.04,'#bfa47b',z+h*.36);add([[r.x+.04,r.y+.14,z+h*.38],[r.x+r.w-.04,r.y+.14,z+h*.38],[r.x+r.w-.04,r.y+.27,z+h*.93],[r.x+.04,r.y+.27,z+h*.93]],'#ece5d4');}
  else if(f.type==='drying-rack'){for(const x of[r.x+.015,r.x+r.w-.045])for(const y of[r.y+.015,r.y+r.d-.045])cube(x,y,.03,.03,h,'#acaa91',z);for(let level=.2;level<h;level+=.25)cube(r.x,r.y,r.w,r.d,.022,'#c5bea7',z+level);}
  else if(f.type==='floor-lamp'){cylinder(cx,cy,r.w/2,r.d/2,.03,z,'#817f6e');cylinder(cx,cy,.012,.012,h-.24,z+.03,'#8b8876');cylinder(cx,cy,r.w/2,r.d/2,.21,z+h-.21,'#e6d7af');}
  else if(/kettle|insulated-server|waste-bowl/.test(f.type))cylinder(cx,cy,r.w/2,r.d/2,h,z,/waste/.test(f.type)?'#d6cbb4':'#a6aa9b');
  else if(/tray/.test(f.type))cube(r.x,r.y,r.w,r.d,h,'#d7c5a4',z);
  else if(/desk|table|tea/.test(f.type)){const top=Math.min(.07,h*.2);if(f.shape==='ellipse'){cylinder(cx,cy,r.w/2,r.d/2,top,z+h-top,'#d9c19a');cylinder(cx,cy,.1,.1,h-top,z,'#c2a77c');}else{cube(r.x,r.y,r.w,r.d,top,'#d9c19a',z+h-top);for(const [x,y]of [[r.x+.06,r.y+.06],[r.x+r.w-.1,r.y+.06],[r.x+.06,r.y+r.d-.1],[r.x+r.w-.1,r.y+r.d-.1]])cube(x,y,.05,.05,h-top,'#c8b08a',z);}}
  else if(f.type==='chair'){const seat=h*.55,rotation=f.rotation||0,pivot=[cx,cy];cube(r.x,r.y,r.w,r.d,seat,'#ded6c2',z,rotation,pivot);cube(r.x,r.y,r.w,Math.min(.09,r.d*.2),h-seat,'#e4dcca',z+seat,rotation,pivot);}
  else cube(r.x,r.y,r.w,r.d,h,/equipment|speaker|monitor|hob/.test(f.type)?'#8c9188':/shower|wc|basin|sink/.test(f.type)?'#e6e9e1':'#d7c29e',z);
 }
 for(const point of M.tea.points.filter(p=>p.kind==='lighting'&&p.fixture)){sourceId=point.id;const[x,y,z]=point.position,f=point.fixture;if(f.shape==='pendant'){cylinder(x,y,f.diameter/2,f.diameter/2,f.height,z-f.height/2,'#e4d7b8');cylinder(x,y,.006,.006,M.ceilingHeight-z-f.height/2,z+f.height/2,'#9c9783');}else cube(x-f.length/2,y-f.depth/2,f.length,f.depth,f.height,'#eee0ba',z-f.height/2);}
 const caption=lang==='en'?'Horizontal geometric lens · hinged doors closed; plan shows opening sweeps · glazing shown as frames.':'水平几何镜头 · 平开门关闭，平面显示开启范围 · 玻璃以框线示意';
 if(raw)return {faces,focal,width:1200,height:750,cameraId:c.id,eyeHeight:c.eyeHeight,targetHeight:c.targetHeight,doorState:'closed'};
 faces.sort((a,b)=>b.depth-a.depth);return shell(rect(0,0,1200,750,'#f4f0e7','none')+faces.map(f=>f.svg).join('')+rect(0,714,1200,36,'#f4f0e7','none')+text(30,737,caption,12,'#958b79'),{width:1200,height:750,title:loc(M.zones.find(z=>z.id===c.roomId).label,lang)+' · '+c.id+' '+caption,lang});
}

// Additional REV.03 sheets remain derived from the same metre model.
const wrapped=(value,x,y,width=32,size=12,color='#777b68',leading=19)=>{
 const chunks=String(value).match(new RegExp(`.{1,${width}}`,'gu'))||[''];
 return chunks.map((chunk,i)=>text(x,y+i*leading,chunk,size,color)).join('');
};
function solidSegments(a,b,holes=[]){
 const len=distance(a,b),at=t=>[a[0]+(b[0]-a[0])*t/len,a[1]+(b[1]-a[1])*t/len],cuts=holes.map(o=>[distance(a,o.a),distance(a,o.b)]).sort((a,b)=>a[0]-b[0]),result=[];let t=0;
 for(const[start,end]of[...cuts,[len,len]]){if(start>t+1e-7)result.push([at(t),at(start)]);t=Math.max(t,end);}return result;
}
const pointColor=kind=>({lighting:'#b29752',power:'#ad7755',switch:'#ad7755',data:'#7a8867',supply:'#6d9295',drain:'#6d9295',scent:'#9a86a0'}[kind]||'#849075');
const teaClip=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],p=[-dx,dx,-dy,dy],q=[a[0],10-a[0],a[1]-5.6,10.5-a[1]];let lo=0,hi=1;for(let i=0;i<4;i++){if(Math.abs(p[i])<1e-9){if(q[i]<0)return null;}else{const t=q[i]/p[i];if(p[i]<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return [[a[0]+dx*lo,a[1]+dy*lo],[a[0]+dx*hi,a[1]+dy*hi]];};

export function teaDetailSVG(lang='zh',layer='ritual'){
 if(typeof layer==='object')layer=layer.layer||'ritual';
 const t=M.tea,u=55,P=p=>[70+p[0]*u,170+(p[1]-5.6)*u],title=lang==='en'?{ritual:'Tea · seated brewing and reset',services:'Tea · lighting, power and water',audio:'Tea · listening and solitude'}[layer]:{ritual:'茶室 · 坐下冲泡与归位',services:'茶室 · 灯光、插座与给排水',audio:'茶室 · 听音与独处'}[layer];
 let s=header(title||(lang==='en'?'Tea study':'茶室深化'),'T-01 / '+layer.toUpperCase(),lang==='en'?'Coordinates and codes share the core model; functional positions, not construction specifications.':'坐标与编号读取核心模型；点位是功能预留，不是施工电气或排水规格。',lang);
 s+='<defs><clipPath id="tea-clip"><rect x="55" y="153" width="582" height="309"/></clipPath></defs><g clip-path="url(#tea-clip)">';
 for(const polygon of M.zones.find(z=>z.id==='living').polygons)s+=`<path d="${path(polygon.map(P))}" fill="#eee4d2" stroke="none"/>`;
 for(const r of M.routes.filter(r=>r.id==='R02'))for(let i=1;i<r.points.length;i++){const segment=teaClip(r.points[i-1],r.points[i]);if(segment)s+=line(P(segment[0]),P(segment[1]),'#8a9b7c',r.width*u,'stroke-opacity=".14"');}
 for(const f of [...M.furniture.filter(f=>f.roomId==='living')].sort((a,b)=>(a.type==='rug'?0:1)-(b.type==='rug'?0:1))){const r=f.rect,[x,y]=P([r.x,r.y]),w=r.w*u,h=r.d*u,fill=/speaker|kettle|scent/.test(f.type)?'#9b9f8c':/sofa|chair/.test(f.type)?'#e1d8c5':'#d4bd98';s+=`<g data-tea-furniture="${esc(f.id)}">`;s+=f.shape==='ellipse'?`<ellipse cx="${x+w/2}" cy="${y+h/2}" rx="${w/2}" ry="${h/2}" fill="${fill}" stroke="#b5a181"/>`:rect(x,y,w,h,fill,'#b5a181');if(['F-L10','F-L04','F-L11','F-L12'].includes(f.id))s+=text(x+w/2,y+h/2+3,f.id,9,'#83765e','text-anchor="middle"');s+='</g>';}
 for(const wall of M.walls)for(const[a,b]of solidSegments(wall.a,wall.b,M.openings.filter(o=>o.wallId===wall.id))){const segment=teaClip(a,b);if(segment)s+=line(P(segment[0]),P(segment[1]),'#746c5c',wall.kind==='exterior'?4:2.5,`data-tea-wall="${wall.id}"`);}
 for(const o of M.openings.filter(o=>o.connects.includes('living')&&o.type!=='passage'))s+=line(P(o.a),P(o.b),o.type==='window'||o.operation==='sliding'?'#71958d':'#aa9070',1.5);
 if(layer==='ritual'){
  for(const r of t.routes)s+=`<polyline data-tea-route="${r.id}" points="${r.points.map(p=>P(p).join(',')).join(' ')}" fill="none" stroke="${r.kind==='hot-service'?'#bb8854':'#6e9895'}" stroke-width="2" marker-end="url(#route-arrow)"/>`;
  for(const station of t.stations){const[x,y]=P(station.position);s+=`<circle cx="${x}" cy="${y}" r="9" fill="#f8f5ee" stroke="#a88b5a"/>`+text(x,y+3,station.id.slice(-2),9,'#94774c','text-anchor="middle"');}
 }else if(layer==='services'){
  for(const[p,index]of t.points.map((p,i)=>[p,i])){const[x,y]=P(p.position),offset={TP02:[-48,23],TN01:[5,23],TC01:[-33,37],TL02:[-10,63],TP01:[-10,45],TP03:[10,23],TW01:[-20,47],TW02:[-20,64]}[p.id]||[10,index%2?23:20],color=pointColor(p.kind),label=[x+offset[0],y+offset[1]];s+=`<circle data-tea-point="${p.id}" cx="${x}" cy="${y}" r="3.5" fill="${color}"/>`+line([x,y],[label[0]-2,label[1]-3],color,.6)+text(label[0],label[1],p.id,9,color);}
 }else{
  s+=`<path d="${path(t.listening.triangle.map(P))}" fill="#bfc6ae" fill-opacity=".25" stroke="#7f916e" stroke-width="1.4"/>`;const p=P(t.listening.seatPosition);s+=`<circle cx="${p[0]}" cy="${p[1]}" r="6" fill="#788d62"/>`+text(p[0],p[1]-14,lang==='en'?'MAIN SEAT':'主听位',10,'#6d8059','text-anchor="middle"');for(const point of t.points.filter(p=>['TA01','TL03'].includes(p.id))){const p=P(point.position);s+=`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${pointColor(point.kind)}"/>`+text(p[0]+9,p[1]-5,point.id,10);}
 }
 s+='</g>';
 s+=text(70,497,lang==='en'?'Counter 2.55 × 0.60 × 0.90 m · table Ø1.20 / H0.68 m · working aisle 1.20 m':'茶柜2.55×0.60×0.90m · 茶桌Ø1.20 / H0.68m · 柜前工作带1.20m',12);
 const list=layer==='services'?t.points:layer==='audio'?[{id:'A01',label:{zh:'约60°试听起点',en:'An approximately 60° trial'},description:t.listening.description},{id:'SC01',label:t.scent.label,description:t.scent.description}]:t.stations;
 let y=163;for(const row of list){s+=text(680,y,row.id+' · '+loc(row.label,lang),13,'#697858');const description=loc(row.description,lang),limit=layer==='services'?(lang==='en'?44:24):(lang==='en'?100:62),short=description.length>limit?description.slice(0,limit)+'…':description;s+=wrapped(short,680,y+20,lang==='en'?46:26,11,'#8a8d77',17);y+=layer==='services'?43:layer==='audio'?180:78;}
 s+=wrapped(lang==='en'?'The kettle remains on the counter; brew seated using the covered insulated server. TR01 marks a 0.55 m standing interval, not the complete vessel journey. Main circulation uses the gallery.':'柜上烧水，保温小壶送茶桌，坐下干泡。TR01的0.55m标人员局部站位间隔，不是器具全程；主通行借回廊绕过茶湾。',70,550,lang==='en'?84:49,12,'#858a72',21);
 s+=wrapped(lang==='en'?'Wet / hot services, load, protection and acoustic performance remain to be verified. Scent is optional and closed during tea.':'给排水、负荷、防护与声学仍待专业核验；香气可选，泡茶时关闭收起。',70,657,lang==='en'?106:66,11,'#a09c89',18);
 return shell(s,{height:720,title,lang});
}

export function teaCabinetSVG(lang='zh'){
 const c=M.furniture.find(f=>f.id===M.tea.counterId),r=c.rect,u=240,ox=85,base=458,X=x=>ox+(x-r.x)*u,Z=z=>base-z*u;
 let s=header(lang==='en'?'Tea cabinet · wash / brew / store':'茶水柜 · 洗、沏与归位','T-02 / REV.03',lang==='en'?'Front elevation facing north; modules and tabletop fixtures read directly from the model.':'向北看的柜体正立面；分格与台面器物直接读取同一模型。',lang);
 s+=rect(ox,Z(c.height),r.w*u,c.height*u,'#d6c19d','#a6916e');
 for(const unit of M.tea.storage){const x=X(unit.rect.x),w=unit.rect.w*u,y=Z(unit.baseHeight+unit.height);s+=rect(x,y,w,unit.height*u,'#d6c19d','#a6916e');let z=unit.baseHeight;for(const h of unit.drawerHeights||[]){z+=h;s+=line([x,Z(z)],[x+w,Z(z)],'#ad9774',.9);}for(const h of unit.shelves||[])s+=line([x,Z(unit.baseHeight+h)],[x+w,Z(unit.baseHeight+h)],'#ad9774',.9);if(unit.thermalBreak)s+=line([x,Z(unit.baseHeight)],[x,Z(unit.baseHeight+unit.height)],'#829e92',3);s+=text(x+w/2,base+25,unit.id,12,'#827256','text-anchor="middle"')+text(x+w/2,base+46,loc(unit.label,lang),lang==='en'?9:11,'#827256','text-anchor="middle"');}
 s+=rect(ox,Z(c.height),r.w*u,.04*u,'#ece5d6','#b5a68c')+rect(ox,Z(.08),r.w*u,.08*u,'#aa987b','none');
 for(const f of M.furniture.filter(f=>f.parentId===c.id)){const x=X(f.rect.x),y=Z(f.baseHeight+f.height);s+=rect(x,y,f.rect.w*u,f.height*u,/kettle/.test(f.type)?'#8e9588':'#dce0d3','#879782')+text(x+f.rect.w*u/2,y-10,f.id,10,'#7d8c71','text-anchor="middle"');}
 for(const p of M.tea.points.filter(p=>['TP01','TP03','TW01','TW02'].includes(p.id))){const x=X(p.position[0]),y=Z(p.position[2]);s+=`<circle cx="${x}" cy="${y}" r="5" fill="#f5f1e5" stroke="${pointColor(p.kind)}"/>`+text(x+10,y+4,p.id,10,pointColor(p.kind));}
 s+=line([ox,base+80],[ox+r.w*u,base+80],'#b2a48b',.8)+text(ox+r.w*u/2,base+72,'2.55 m',13,'#95846a','text-anchor="middle"');
 s+=text(765,175,lang==='en'?'A working cabinet, not a shallow shelf':'真正操作柜，而非浅书架',16,'#707c61')+wrapped(lang==='en'?'600 mm counter depth. 900 mm top. Accessible sink services at ST01; cups in ST02; heat-zone trays in ST03; sealed dry tea at the eastern ST04 with a thermal partition.':'柜深600mm，台高900mm。ST01水槽检修，ST02杯具，ST03壶下托盘耗材，ST04最东隔热密封干茶。',765,205,lang==='en'?33:18,12,'#858b75',21);
 s+=wrapped(lang==='en'?'Dry tea is not stored below the kettle. Real tins, temperature and moisture must be checked. Drawer travel is a study, not an order for fabrication.':'干茶不放烧水壶下。实际茶盒、温湿度与抽屉行程仍须试用和深化，不能据此直接下单定制。',765,378,lang==='en'?33:18,12,'#858b75',21);
 s+=wrapped(lang==='en'?'Scent has its own closed compartment in western F-L08, away from tea and audio. Remove the passive tray before tea.':'香品在西端F-L08独立闭合格，与干茶、音响分开；泡茶前收起无明火扩香盘。',85,615,lang==='en'?103:64,12,'#8d8f7b',21);
 return shell(s,{height:720,title:lang==='en'?'Tea-cabinet elevation':'迟庭 · 茶水柜深化立面',lang});
}

export function courtyardBoundarySVG(lang='zh'){
 const b=M.courtyardBoundary,w=M.walls.find(w=>w.id===b.wallId),openings=M.openings.filter(o=>b.openingIds.includes(o.id)),u=80,len=distance(w.a,w.b),roof=b.roofEdge,base=425;
 let s=header(lang==='en'?'One boundary · interior and courtyard':'同一面墙 · 室内与庭院对照','B-01 / W03',lang==='en'?'One set of openings, sill heights, piers, wall depth and roof edge.':'一组固定开口、窗台、实垛、墙厚与檐口；不能随影像视角另造墙体。',lang);
 for(const[panel,ox]of[[0,45],[1,555]]){const reverse=panel===0;s+=text(ox,158,lang==='en'?(reverse?'INSIDE · LOOKING SOUTH':'COURTYARD · LOOKING NORTH'):(reverse?'室内向南看 · 镜像':'庭院向北看 · 同一外墙'),13,'#737f64');s+=rect(ox,base-w.height*u,len*u,w.height*u,'#e8dfcf','#a89b82')+rect(ox,base-roof.top*u,len*u,(roof.top-roof.soffit)*u,'#beb59f','#9d947e');for(const o of openings){const left=reverse?len-Math.max(o.a[0],o.b[0]):Math.min(o.a[0],o.b[0]),x=ox+left*u,width=distance(o.a,o.b)*u;s+=rect(x,base-o.head*u,width,(o.head-o.sill)*u,'#dce5d7','#8b9d90')+text(x+width/2,base-o.head*u-10,o.id,12,'#74876c','text-anchor="middle"')+text(x+width/2,base+26,`${distance(o.a,o.b).toFixed(2)}m / ${o.sill.toFixed(2)}–${o.head.toFixed(2)}m`,10,'#8e8e78','text-anchor="middle"');}s+=line([ox,base+49],[ox+len*u,base+49],'#afa28b',.8)+text(ox+len*u/2,base+43,'W03 · 6.00 m',11,'#9b8b71','text-anchor="middle"');}
 const sx=115,sy=649,detail=150,inner=-w.thickness/2,outer=w.thickness/2,xx=y=>sx+(y-inner)*detail,zz=z=>sy-(z-2.3)*detail;
 s+=text(80,527,lang==='en'?'ENLARGED HEAD / EAVE SECTION':'窗头与檐口放大关系',12,'#768166')+rect(xx(inner),zz(2.7),w.thickness*detail,.2*detail,'#c2b69d','#a08e70')+rect(xx(inner),zz(roof.top),(w.thickness+roof.projection)*detail,(roof.top-roof.soffit)*detail,'#bdb39b','#998b70')+line([xx(0),zz(2.3)],[xx(0),zz(2.5)],'#799c97',2)+line([xx(outer),zz(2.45)],[xx(outer+roof.projection),zz(2.45)],'#8e9c82',.8);
 s+=text(300,560,lang==='en'?'Wall 0.24 m · head 2.50 m':'墙厚0.24m · 窗门头2.50m',12)+text(300,583,lang==='en'?'Soffit 2.70 m · roof top 2.90 m':'檐底2.70m · 檐顶2.90m',12)+text(300,606,lang==='en'?'Projection 0.45 m from external face':'自外墙面挑出0.45m',12);
 s+=wrapped(lang==='en'?'The 0.15 m pier between V06 and D09 stays fixed. The 0.15 m sill is not replaced by a tall exterior sill. No invented mountain view. Roof structure and drainage await development.':'V06与D09间0.15m实垛固定；窗台始终0.15m，不在外观中抬成高窗台。视野不假设远山；屋檐受力、防水、排水待深化。',620,535,lang==='en'?48:27,12,'#858b75',21);
 return shell(s,{height:730,title:loc(b.label,lang),lang});
}

export function estateSVG(lang='zh',phase='all'){
 const e=M.estate,u=15,P=p=>[70+(p[0]-e.bounds.x)*u,140+(p[1]-e.bounds.y)*u],stage=phase==='all'?3:Math.max(1,Number(String(phase).replace('phase-',''))||1),order=id=>e.phases.find(p=>p.id===id)?.order||1;
 let s=header(lang==='en'?'Garden home · a phased hypothetical parcel':'园居总图 · 分期的假想地块','S-01 / REV.03',lang==='en'?'Hypothetical 1,190 m² parcel, not actual land, a survey or an access approval.':'1190㎡是假想用地，不是真实土地、测绘结果或获批出入口。核心200㎡与新增72㎡分开核算。',lang);
 const[a,b]=[P([e.bounds.x,e.bounds.y]),P([e.bounds.x+e.bounds.w,e.bounds.y+e.bounds.d])];s+=rect(a[0],a[1],b[0]-a[0],b[1]-a[1],'#e6eadc','#b4bda3')+rect(b[0]+3,165,28,420,'#d9d8ce','none')+text(b[0]+17,620,lang==='en'?'ACCESS*':'假想接路面*',10,'#8e907e','text-anchor="middle"');
 const programs=[...e.program].sort((a,b)=>(a.id==='pool-deck'?-1:0)-(b.id==='pool-deck'?-1:0));
 for(const p of programs){const active=order(p.phase)<=stage,r=p.rect,[x,y]=P([r.x,r.y]),fill=p.id==='pool'?'#bdd7d4':p.id==='pool-deck'?'#d8c7a7':p.id==='core'?'#ded1b8':p.id==='arrival'?'#d8d6c9':'#cdd4bc';s+=`<g data-estate-program="${esc(p.id)}" opacity="${active?1:.26}"${active?'':' stroke-dasharray="4 3"'}>`;if(p.polygons){for(const polygon of p.polygons)s+=`<path d="${path(polygon.map(P))}" fill="${fill}" stroke="#9eaa8a"/>`;}else s+=rect(x,y,r.w*u,r.d*u,fill,'#9eaa8a');if(p.id!=='pool-deck'){const short=lang==='zh'?{core:'主宅',studio:'画室',gym:'健身',media:'影音','wing-service':'更衣/设备',pool:'泳池',arrival:'露天停车'}[p.id]:{core:'CORE',studio:'ART',gym:'GYM',media:'MEDIA','wing-service':'SERVICE',pool:'POOL',arrival:'PARK'}[p.id];s+=text(x+r.w*u/2,y+r.d*u/2-3,short||p.id,p.id==='studio'?9:11,'#657357','text-anchor="middle"')+text(x+r.w*u/2,y+r.d*u/2+13,p.area+' m²',9,'#899278','text-anchor="middle"');}s+='</g>';}
 const inner=M.zones.find(z=>z.id==='garden');for(const p of inner.polygons)s+=`<path d="${path(p.map(P))}" fill="#dce4cc" stroke="#a0b08e"/>`;
 for(const p of e.planting){const[x,y]=P(p.position);s+=`<circle cx="${x}" cy="${y}" r="${p.canopyRadius*u}" fill="#a8b890" fill-opacity=".45" stroke="#92a47a"/>`+text(x,y+3,p.id,9,'#70865c','text-anchor="middle"');}
 for(const path of e.paths){const active=order(path.phase)<=stage;s+=`<polyline points="${path.points.map(p=>P(p).join(',')).join(' ')}" fill="none" stroke="#f5f1e6" stroke-width="${path.width*u}" stroke-opacity="${active?.85:.25}"/><polyline points="${path.points.map(p=>P(p).join(',')).join(' ')}" fill="none" stroke="#a39c84" stroke-dasharray="3 3" stroke-width=".8" stroke-opacity="${active?1:.3}"/>`;}
 for(const w of e.wing.walls)for(const[a,b]of solidSegments(w.a,w.b,e.wing.openings.filter(o=>o.wallId===w.id)))s+=line(P(a),P(b),'#7d896d',stage>=2?1.8:.7,stage<2?'stroke-dasharray="3 3" opacity=".35"':'');
 for(const o of e.wing.openings){s+=line(P(o.a),P(o.b),o.type.includes('window')?'#739995':'#b29c74',1.1)+text(P(o.a)[0]+5,P(o.a)[1]-4,o.id,7,'#7a866a');}
 for(const f of e.wing.furniture){const r=f.rect,[x,y]=P([r.x,r.y]);s+=rect(x,y,r.w*u,r.d*u,'#b4bba7','#9da68e',`opacity="${stage>=2?.65:.2}"`);}
 for(const boundary of e.boundaries){const holes=boundary.openings||(boundary.opening?[boundary.opening]:[]);for(const[a,b]of solidSegments(boundary.a,boundary.b,holes))s+=line(P(a),P(b),boundary.kind==='privacy-wall'?'#8c8773':'#92a181',boundary.kind==='privacy-wall'?3:2);for(const o of holes)s+=line(P(o.a),P(o.b),'#a68c64',1,'stroke-dasharray="2 2"')+text(P(o.a)[0]+5,P(o.a)[1]-5,o.id,8,'#9a865e');}
 const pool=e.poolSafety,r=pool.rect,poolLines=[[[r.x,r.y],[r.x+r.w,r.y]],[[r.x+r.w,r.y],[r.x+r.w,r.y+r.d]],[[r.x,r.y+r.d],[r.x+r.w,r.y+r.d]],[[r.x,r.y],[r.x,r.y+r.d]]];for(const[i,[a,b]]of poolLines.entries())for(const[p,q]of solidSegments(a,b,i===0?[pool.gate]:[]))s+=line(P(p),P(q),'#6b9091',1.8,stage<3?'opacity=".3" stroke-dasharray="3 3"':'');s+=line(P(pool.gate.a),P(pool.gate.b),'#b88d59',2)+text(P(pool.gate.a)[0],P(pool.gate.a)[1]-7,'PG01',9,'#9b7f56');
 s+=text(650,156,lang==='en'?'AREA LEDGER · KEPT SEPARATE':'面积账本 · 各自核算',15,'#6e7e5e');const lines=lang==='en'?['1,190 m² hypothetical land','Core 200 gross / 166 net','Later wing +72 gross / +60 net','Full horizon 272 gross / 226 net','Outdoors: court 30 / pool 36 / deck 54 m²']:['1190㎡ 假想土地','主宅 200建面 / 166净功能','后期翼房 +72建面 / +60净功能','完整远景 272建面 / 226净功能','室外另列：内庭30 / 池水36 / 池畔54㎡'];lines.forEach((l,i)=>s+=text(650,185+i*23,l,12,'#889078'));
 let y=329;for(const p of e.phases){const active=order(p.id)<=stage;s+=text(650,y,(active?'● ':'○ ')+loc(p.label,lang),13,active?'#6f825d':'#a6aa98')+wrapped(loc(p.description,lang),650,y+22,lang==='en'?48:29,11,'#909780',18);y+=99;}
 s+=wrapped(lang==='en'?'Gate EG02 → core D01. Gym → ED04 changing → ED02 → PG01 pool. Media seating is never a wet shortcut. Pool has its own four-sided fence and self-closing / latching gate.':'EG02步行归家→D01；健身→ED04更衣→ED02→PG01池门。湿脚不穿影音座位。泳池自身四边围界与自闭自锁门，不能借地界墙替代。',650,643,lang==='en'?48:29,11,'#7f8b70',18);
 s+=text(70,704,lang==='en'?'Solid = this phase or earlier · pale dashed = future reservation · north/site unconfirmed':'实线深色=本期及之前；浅色虚线=后期预留。朝向与实际基地均待确认。',11,'#91967f');
 return shell(s,{height:755,title:loc(e.label,lang),lang});
}
