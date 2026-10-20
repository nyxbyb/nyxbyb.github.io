import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// A tap belongs to one pointer for its entire gesture. Pinches and cancelled
// drags must never activate an object when either finger is lifted.
export function createObjectTapGesture() {
  const pointers=new Set();let candidate=null,blocked=false;
  return {
    get active(){return pointers.size>0;},
    down(event){
      if(event.button!==0)return;
      pointers.add(event.pointerId);
      if(pointers.size===1&&!blocked)candidate={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
      else {candidate=null;blocked=true;}
    },
    move(event){if(candidate?.id===event.pointerId&&Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)>6)candidate.moved=true;},
    up(event){
      if(!pointers.delete(event.pointerId))return false;
      const tap=!blocked&&candidate?.id===event.pointerId&&!candidate.moved&&Math.hypot(event.clientX-candidate.x,event.clientY-candidate.y)<=6;
      candidate=null;if(!pointers.size)blocked=false;
      return !!tap;
    },
    cancel(event){pointers.delete(event.pointerId);candidate=null;blocked=pointers.size>0;},
    leave(){candidate=null;},
  };
}

// An authored interior, in metres. No remote models, textures, fonts, or audio.
// Content, keyboard navigation, and persistence belong to room.js.
export async function createRoom(container, options = {}) {
  if (!(container instanceof HTMLElement)) throw new Error('A room container is required.');
  const { onObjectSelect, onReady, onError } = options;
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reducedMotion = options.reducedMotion ?? media.matches;
  const mobile = matchMedia('(max-width: 760px)').matches;
  const resources = new Set(), geometries = new Map(), interactive = [];
  let renderer, controls, observer, frame = 0, disposed = false, paused = false;
  let dirty = true, moving = false, inFrame = false, transition = null, tea = false, selected = null;
  let currentTime = 'dusk', lampOn = true, elapsed = 0, lastFrame = 0;
  let randomSeed = 76321;
  const random = () => { randomSeed = (1664525 * randomSeed + 1013904223) >>> 0; return randomSeed / 4294967296; };
  const keep = value => { resources.add(value); return value; };
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#a8a193');
  scene.fog = new THREE.Fog('#a8a193', 15, 33);
  const camera = new THREE.PerspectiveCamera(mobile ? 69 : 57, 1, .08, 60);
  const world = new THREE.Group(); scene.add(world);
  const anchors = {};
  const v = (x,y,z) => new THREE.Vector3(x,y,z);
  const homes = {
    home: { position: [0.35,1.76,5.65], target: [-.12,1.52,-1.4] },
    books: { position: [-.3,1.72,2.9], target: [-3.8,1.65,-1.05] },
    tea: { position: [1.25,1.52,3.45], target: [-.05,.64,.8] },
    music: { position: [.7,1.6,1.75], target: [2.9,1.05,-2.8] },
    plant: { position: [-.25,1.68,1.9], target: [-2.6,1.23,-2.9] },
    window: { position: [.1,1.75,1.3], target: [.1,1.8,-4.3] },
    lamp: { position: [-.25,1.7,3.4], target: [-2.95,1.28,.1] },
  };
  function group(id, position = [0,0,0], rotation = 0, parent = world) {
    const g = new THREE.Group(); g.position.set(...position); g.rotation.y = rotation; parent.add(g);
    if (id) { g.userData.objectId = id; interactive.push(g); }
    return g;
  }
  function geometry(key, factory) { if (!geometries.has(key)) geometries.set(key, keep(factory())); return geometries.get(key); }
  function mesh(geo, material, position, parent = world, shadow = true) {
    const m = new THREE.Mesh(geo, material); m.position.set(...position); m.castShadow = shadow; m.receiveShadow = true; parent.add(m); return m;
  }
  function box(w,h,d,material,position,parent=world,radius=0) {
    const key = `box:${w}:${h}:${d}:${radius}`;
    return mesh(geometry(key,()=>radius ? new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/2,h/2,d/2)*.95) : new THREE.BoxGeometry(w,h,d)),material,position,parent);
  }
  function sphere(rx,ry,rz,material,position,parent=world) {
    const m=mesh(geometry('sphere',()=>new THREE.SphereGeometry(1,24,16)),material,position,parent);m.scale.set(rx,ry,rz);return m;
  }
  function cylinder(top,bottom,height,material,position,parent=world,segments=24) {
    return mesh(geometry(`cylinder:${top}:${bottom}:${height}:${segments}`,()=>new THREE.CylinderGeometry(top,bottom,height,segments)),material,position,parent);
  }
  function tube(points,radius,material,parent=world) {
    const curve=new THREE.CatmullRomCurve3(points.map(p=>v(...p)));
    return mesh(keep(new THREE.TubeGeometry(curve,Math.max(8,points.length*4),radius,7,false)),material,[0,0,0],parent);
  }
  function texture(size, draw, repeat = null) {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
    const context=canvas.getContext('2d');if(!context)throw new Error('Canvas textures are unavailable.');
    draw(context,size);const t=keep(new THREE.CanvasTexture(canvas));t.colorSpace=THREE.SRGBColorSpace;
    t.anisotropy=4;if(repeat){t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(...repeat);}return t;
  }
  function standard(color,extra={}) { return keep(new THREE.MeshStandardMaterial({color,roughness:.8,...extra})); }
  function basic(color,extra={}) { return keep(new THREE.MeshBasicMaterial({color,...extra})); }
  function grain(ctx,s) {
    ctx.fillStyle='#bc9565';ctx.fillRect(0,0,s,s);
    for(let i=0;i<1300;i++){
      const y=random()*s;ctx.strokeStyle=`rgba(${random()>.4?'81,52,27':'246,225,183'},${.018+random()*.07})`;
      ctx.lineWidth=.3+random()*1.1;ctx.beginPath();ctx.moveTo(0,y);
      for(let x=0;x<=s;x+=32)ctx.lineTo(x,y+Math.sin(x*.012+i)*(.7+random()*2));ctx.stroke();
    }
    for(let i=0;i<8;i++){const y=random()*s,x=random()*s;ctx.strokeStyle='#64462e22';for(let j=0;j<6;j++){ctx.beginPath();ctx.ellipse(x,y,30+j*15,2+j*.9,-.01,0,Math.PI*2);ctx.stroke();}}
  }
  const oakMap=texture(512,grain);
  const floorMap=texture(1024,(ctx,s)=>{
    ctx.fillStyle='#ae8b62';ctx.fillRect(0,0,s,s);const rows=9;
    for(let i=0;i<rows;i++){
      const y=i*s/rows;ctx.fillStyle=`hsl(33 ${22+random()*9}% ${49+random()*8}%)`;ctx.fillRect(0,y,s,s/rows-1.5);
      for(let j=0;j<160;j++){ctx.strokeStyle=`rgba(61,39,20,${.015+random()*.09})`;ctx.beginPath();const yy=y+random()*s/rows;ctx.moveTo(0,yy);ctx.bezierCurveTo(s*.3,yy-2,s*.7,yy+3,s,yy);ctx.stroke();}
      const seam=(i%3)*s/3;ctx.fillStyle='#563f2b55';ctx.fillRect(seam,y,1.5,s/rows);
    }
  },[2.4,2.4]);
  const plasterMap=texture(256,(ctx,s)=>{ctx.fillStyle='#dfd6c4';ctx.fillRect(0,0,s,s);for(let i=0;i<15000;i++){const k=random()>.5?255:92;ctx.fillStyle=`rgba(${k},${k},${k},${random()*.055})`;ctx.fillRect(random()*s,random()*s,1+random()*3,1+random()*3);}},[3,3]);
  const linenMap=texture(256,(ctx,s)=>{ctx.fillStyle='#d4c9b5';ctx.fillRect(0,0,s,s);for(let i=0;i<s;i+=2){ctx.strokeStyle=i%4?'#f2ebd825':'#665b4522';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(i,0);ctx.lineTo(i,s);ctx.moveTo(0,i);ctx.lineTo(s,i);ctx.stroke();}},[3,3]);
  const rugMap=texture(512,(ctx,s)=>{
    ctx.fillStyle='#c1ae89';ctx.fillRect(0,0,s,s);for(let y=0;y<s;y+=4)for(let x=0;x<s;x+=4){ctx.fillStyle=`rgba(${random()>.5?'255,247,221':'76,60,40'},${.08+random()*.16})`;ctx.fillRect(x+(y%8?1:0),y,2,3);}
    ctx.strokeStyle='#77654455';ctx.lineWidth=3;for(const inset of [16,24,35])ctx.strokeRect(inset,inset,s-inset*2,s-inset*2);
  });
  const ceramicMap=texture(256,(ctx,s)=>{ctx.fillStyle='#cbc2a9';ctx.fillRect(0,0,s,s);for(let i=0;i<2500;i++){ctx.fillStyle=`rgba(77,65,43,${.1+random()*.2})`;const r=.2+random()*.7;ctx.beginPath();ctx.arc(random()*s,random()*s,r,0,7);ctx.fill();}});
  const wood=standard('#d7b283',{map:oakMap,roughness:.54,bumpMap:oakMap,bumpScale:.014});
  const darkWood=standard('#6b513a',{map:oakMap,roughness:.56});
  const floorMat=standard('#d0b48f',{map:floorMap,roughness:.63,bumpMap:floorMap,bumpScale:.018});
  const plaster=standard('#f0e8d9',{map:plasterMap,bumpMap:plasterMap,bumpScale:.014});
  const linen=standard('#e3dccb',{map:linenMap,bumpMap:linenMap,bumpScale:.012});
  const moss=standard('#6b7058',{map:linenMap,roughness:.95});
  const throwMat=standard('#a69b86',{map:linenMap,side:THREE.DoubleSide});
  const ceramic=standard('#ddd1b6',{map:ceramicMap,roughness:.46});
  const blackCeramic=standard('#494838',{map:ceramicMap,roughness:.4});
  const brass=standard('#96743a',{metalness:.7,roughness:.34});
  const black=standard('#272925',{roughness:.72});
  const dark=standard('#4b4234',{roughness:1});
  const paper=standard('#f0e3c6',{roughness:.93});
  const leafMat=standard('#5a6850',{roughness:.77,side:THREE.DoubleSide});
  const stemMat=standard('#514832',{roughness:.95});
  const glowing=standard('#ffedc6',{emissive:'#ffc986',emissiveIntensity:.35,roughness:.9});

  // Room envelope surrounds the observer; the floor and ceiling never become a dollhouse plinth.
  box(13,.14,15,floorMat,[0,-.085,1.8]);
  box(.2,3.85,11,plaster,[-4.55,1.86,.95]);
  box(.2,3.85,7.6,plaster,[4.55,1.86,-.8]);
  box(1.75,3.85,.2,plaster,[-3.67,1.86,-4.3]);
  box(1.75,3.85,.2,plaster,[3.67,1.86,-4.3]);
  box(5.6,.72,.2,plaster,[0,.29,-4.3]);
  box(5.6,.48,.2,plaster,[0,3.57,-4.3]);
  box(9.1,.12,11.4,wood,[0,3.85,.7]);
  // Exposed ceiling perimeter and joinery provide scale and depth.
  for(const x of [-4.32,4.32]){box(.18,.19,10.3,wood,[x,3.58,.6]);box(.06,.12,10.3,darkWood,[x,3.73,.6]);}
  box(8.7,.19,.2,wood,[0,3.58,-4.02]);
  box(8.8,.11,.06,wood,[0,.08,-4.12]);box(.06,.11,10,wood,[-4.42,.08,.8]);box(.06,.11,8,wood,[4.42,.08,-.7]);

  const landscapeCanvas=document.createElement('canvas');landscapeCanvas.width=1536;landscapeCanvas.height=768;
  const landscapeCtx=landscapeCanvas.getContext('2d');
  const landscapeMap=keep(new THREE.CanvasTexture(landscapeCanvas));landscapeMap.colorSpace=THREE.SRGBColorSpace;
  function drawLandscape(mode) {
    const ctx=landscapeCtx,w=1536,h=768;let seed=173;
    const r=()=>{seed=(seed*16807)%2147483647;return(seed-1)/2147483646;};
    const palette=mode==='night'?['#0c192c','#233348','#626b75','#d2c69c']:mode==='dawn'?['#aebdc1','#ead4bd','#e8c89b','#fff0c4']:['#809098','#dbb695','#edbb83','#fff1be'];
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,palette[0]);sky.addColorStop(.57,palette[1]);sky.addColorStop(1,palette[2]);ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    const sunX=mode==='dawn'?410:1120,sunY=mode==='night'?155:330;
    const halo=ctx.createRadialGradient(sunX,sunY,2,sunX,sunY,180);halo.addColorStop(0,mode==='night'?'#dfe8ef55':'#ffdca568');halo.addColorStop(1,'#ffdca500');ctx.fillStyle=halo;ctx.fillRect(sunX-180,sunY-180,360,360);
    ctx.fillStyle=palette[3];ctx.beginPath();ctx.arc(sunX,sunY,mode==='night'?20:24,0,Math.PI*2);ctx.fill();
    if(mode==='night'){for(let i=0;i<90;i++){ctx.fillStyle=`rgba(233,235,219,${.2+r()*.6})`;ctx.beginPath();ctx.arc(r()*w,r()*350,r()*.9+.5,0,7);ctx.fill();}}
    else for(let i=0;i<25;i++){const x=r()*w,y=55+r()*230;ctx.fillStyle=`rgba(244,221,190,${.07+r()*.12})`;ctx.beginPath();ctx.ellipse(x,y,40+r()*115,2+r()*8,-.05,0,7);ctx.fill();}
    const colors=mode==='night'?['#313e4d','#283a43','#20363b','#172f2f','#112725']:['#848d98','#697d85','#627877','#526e65','#3c5a4b'];
    colors.forEach((color,layer)=>{ctx.fillStyle=color;ctx.beginPath();ctx.moveTo(0,h);for(let x=0;x<=w;x+=15){const y=355+layer*57+Math.sin(x*.005+layer*1.7)*35+Math.sin(x*.013+layer)*12;ctx.lineTo(x,y);}ctx.lineTo(w,h);ctx.closePath();ctx.fill();});
    // A distant forest, drawn as small irregular canopies rather than a flat skyline.
    for(let i=0;i<640;i++){const x=r()*w,y=510+r()*270,s=3+r()*16;ctx.fillStyle=mode==='night'?`rgba(15,35,30,${.35+r()*.3})`:`rgba(${34+Math.floor(r()*28)},${64+Math.floor(r()*26)},${46+Math.floor(r()*22)},.48)`;ctx.beginPath();ctx.ellipse(x,y,s,s*.85,0,0,7);ctx.fill();}
    landscapeMap.needsUpdate=true;
  }
  drawLandscape('dusk');
  const outdoors=mesh(geometry('landscape',()=>new THREE.PlaneGeometry(15,7.5)),basic('#ffffff',{map:landscapeMap,toneMapped:false}),[0,2.1,-7],world,false);
  // Window is a physical opening, including its deep sill and dark inner gasket.
  const windowGroup=group('window');anchors.window=v(.15,2,-4.1);
  box(5.78,.14,.4,wood,[0,.72,-4.18],windowGroup);box(5.78,.14,.34,wood,[0,3.4,-4.18],windowGroup);
  for(const x of [-2.84,2.84])box(.14,2.75,.34,wood,[x,2.03,-4.18],windowGroup);
  for(const x of [-2.71,2.71])box(.035,2.55,.08,darkWood,[x,2.03,-4.08],windowGroup);
  for(const y of [.79,3.28])box(5.44,.035,.08,darkWood,[0,y,-4.08],windowGroup);
  mesh(geometry('window-hit-area',()=>new THREE.PlaneGeometry(5.4,2.46)),basic('#ffffff',{transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}),[0,2.03,-4.06],windowGroup,false);
  box(5.9,.12,.78,wood,[0,.65,-3.98],windowGroup,.025);
  box(5.45,.42,.42,wood,[0,.28,-4.02],windowGroup,.015);
  for(let x=-1.82;x<=1.82;x+=1.82){box(1.78,.32,.025,wood,[x,.29,-3.79],windowGroup,.012);box(.12,.018,.025,brass,[x,.38,-3.77],windowGroup);}

  // One shadow light. Practical lights do not allocate additional shadow maps.
  const skyLight=new THREE.HemisphereLight('#dce2df','#b39974',1.7);scene.add(skyLight);
  const fillLight=new THREE.AmbientLight('#e7d9c0',.52);scene.add(fillLight);
  const sun=new THREE.DirectionalLight('#ffdcaa',3.1);sun.position.set(3.8,3.4,-6.8);sun.target.position.set(-2,0,2.8);sun.castShadow=true;
  sun.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);sun.shadow.camera.left=-7;sun.shadow.camera.right=7;sun.shadow.camera.top=7;sun.shadow.camera.bottom=-7;sun.shadow.camera.near=.5;sun.shadow.camera.far=24;sun.shadow.bias=-.0003;sun.shadow.normalBias=.035;sun.shadow.radius=3;scene.add(sun,sun.target);
  const lampLight=new THREE.PointLight('#ffd297',15,7,2);lampLight.position.set(-3.07,1.75,.35);scene.add(lampLight);
  const pendantLight=new THREE.PointLight('#ffdaaa',17,9,2);pendantLight.position.set(.35,2.78,.5);scene.add(pendantLight);
  const cabinetLight=new THREE.PointLight('#ffcf8d',6,4,2);cabinetLight.position.set(3.05,1.3,-2.65);scene.add(cabinetLight);

  function lathe(profile,material,position,parent=world,scale=1) {
    const geo=keep(new THREE.LatheGeometry(profile.map(p=>new THREE.Vector2(...p)),24));const m=mesh(geo,material,position,parent);m.scale.setScalar(scale);return m;
  }
  function vase(position,parent=world,scale=1,material=ceramic) {
    return lathe([[0,0],[.12,0],[.16,.04],[.2,.2],[.16,.34],[.09,.42],[.085,.47],[.11,.49]],material,position,parent,scale);
  }
  function bookStack(position,parent=world,count=3) {
    for(let i=0;i<count;i++){const book=box(.46-i*.025,.045,.31,standard(['#7d8067','#baab8b','#8d7963','#555e54'][i%4]),[position[0],position[1]+i*.05,position[2]],parent,.004);book.rotation.y=(i-1)*.08;box(.42-i*.025,.031,.014,paper,[position[0],position[1]+i*.05,position[2]+.158],parent);}
  }
  // A recessed, floor-to-ceiling library, instanced books keep the mobile draw budget small.
  const library=group('books',[-4.1,0,-1.35],Math.PI/2);anchors.books=v(-3.85,1.65,-.95);
  box(5.25,3.42,.09,darkWood,[0,1.71,-.18],library);
  for(const x of [-2.64,-.88,.88,2.64])box(.08,3.56,.57,wood,[x,1.78,.05],library,.01);
  for(const y of [.13,.79,1.44,2.09,2.74,3.4])box(5.3,.065,.6,wood,[0,y,.07],library,.009);
  for(let x=-1.76;x<=1.76;x+=1.76){box(1.7,.58,.09,wood,[x,.45,.31],library,.015);box(.18,.018,.032,brass,[x,.64,.374],library);}
  const bookBody=new THREE.InstancedMesh(geometry('unit-box',()=>new THREE.BoxGeometry(1,1,1)),standard('#ffffff',{roughness:.94}),126);
  bookBody.castShadow=true;bookBody.receiveShadow=true;library.add(bookBody);
  const pages=new THREE.InstancedMesh(geometries.get('unit-box'),paper,126);pages.receiveShadow=true;library.add(pages);
  const bands=new THREE.InstancedMesh(geometries.get('unit-box'),standard('#b8a77d',{roughness:.8}),252);library.add(bands);
  const dummy=new THREE.Object3D(),bookColors=['#cebb98','#8c8169','#5f6a61','#454e48','#a99b80','#a18b6c','#d5c7ad','#776a59','#6a7775'];
  let bi=0;
  for(let shelf=0;shelf<4;shelf++)for(let section=0;section<3;section++){
    let x=-2.56+section*1.76;const base=.83+shelf*.65;
    const amount=(shelf===1&&section===1)||(shelf===3&&section===2)?6:11;
    for(let i=0;i<amount&&bi<126;i++){
      const width=.075+random()*.048,height=.36+random()*.19,depth=.29+random()*.065;const tilt=i===amount-1?-.12:0;
      dummy.position.set(x+width/2,base+height/2,.12);dummy.rotation.set(0,0,tilt);dummy.scale.set(width,height,depth);dummy.updateMatrix();bookBody.setMatrixAt(bi,dummy.matrix);bookBody.setColorAt(bi,new THREE.Color(bookColors[Math.floor(random()*bookColors.length)]));
      dummy.position.set(x+width/2,base+height-.009,.12);dummy.scale.set(width*.76,.006,depth*.86);dummy.updateMatrix();pages.setMatrixAt(bi,dummy.matrix);
      // Fine gilt rules sit on coloured spines; pages remain visible along the top.
      dummy.position.z=.12+depth/2+.004;
      for(let j=0;j<2;j++){dummy.position.y=base+height*(j?.83:.18);dummy.scale.set(width*.6,.008,.006);dummy.updateMatrix();bands.setMatrixAt(bi*2+j,dummy.matrix);}
      x+=width+.017;bi++;
    }
    if(amount===6){vase([x+.24,base,.12],library,.72);if(section===1)bookStack([x+.66,base+.035,.14],library,2);}
  }
  bookBody.count=pages.count=bi;bands.count=bi*2;bookBody.instanceMatrix.needsUpdate=true;pages.instanceMatrix.needsUpdate=true;bands.instanceMatrix.needsUpdate=true;
  vase([1.55,2.775,.1],library,.68,blackCeramic);vase([-1.45,2.125,.14],library,.65);bookStack([2.0,1.48,.12],library,3);

  // Contact shadows are broad, inexpensive soft gradients, complementing real window shadows.
  const shadowTexture=texture(128,(ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,2,s/2,s/2,s/2);g.addColorStop(0,'rgba(30,24,15,.35)');g.addColorStop(.55,'rgba(30,24,15,.16)');g.addColorStop(1,'rgba(30,24,15,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);});
  const shadowMaterial=basic('#ffffff',{map:shadowTexture,transparent:true,depthWrite:false,toneMapped:false});
  function contact(x,z,sx,sz){const m=mesh(geometry('contact',()=>new THREE.PlaneGeometry(1,1)),shadowMaterial,[x,.004,z],world,false);m.rotation.x=-Math.PI/2;m.scale.set(sx,sz,1);}
  contact(-2.35,.75,2.6,2.8);contact(2.7,.8,3.6,3.8);contact(0,.9,3,2.3);contact(-2.8,-3.1,1.5,1.3);
  box(5.3,.025,4.1,standard('#d1c2a4',{map:rugMap,roughness:1}),[.05,.02,1.2],world,.02);
  // Fringed rug edge: one instanced draw.
  const fringes=new THREE.InstancedMesh(geometry('fringe',()=>new THREE.CylinderGeometry(.003,.003,.12,4)),standard('#c3b18d'),96);world.add(fringes);
  for(let i=0;i<96;i++){dummy.position.set(-2.5+(i%48)*.108,.035,i<48?-.9:3.29);dummy.rotation.set(Math.PI/2,0,(random()-.5)*.3);dummy.scale.set(1,1,1);dummy.updateMatrix();fringes.setMatrixAt(i,dummy.matrix);}

  const reading=group('books',[-2.35,0,.75],.27);
  for(const x of [-.57,.57])for(const z of [-.45,.49]){const leg=box(.067,.6,.08,darkWood,[x,.32,z],reading,.018);leg.rotation.z=x<0?.12:-.12;leg.rotation.x=z<0?-.12:.12;}
  box(1.18,.12,1.08,darkWood,[0,.55,.02],reading,.04);
  box(1.08,.26,1.02,linen,[0,.74,.04],reading,.13);
  const chairBack=box(1.08,.95,.23,linen,[0,1.16,-.43],reading,.12);chairBack.rotation.x=-.13;
  for(const x of [-.64,.64]){box(.085,.62,.09,darkWood,[x,.83,-.41],reading,.02);box(.085,.48,.09,darkWood,[x,.78,.44],reading,.02);box(.12,.075,1.18,wood,[x,1.03,.01],reading,.035);}
  const chairPillow=box(.61,.42,.17,moss,[.13,1.08,-.21],reading,.08);chairPillow.rotation.set(-.2,0,-.14);
  const sofa=group(null,[2.6,0,1.05],-.63);
  for(const x of [-.98,.98])for(const z of [-.43,.43])cylinder(.045,.035,.22,darkWood,[x,.15,z],sofa,12);
  box(2.35,.31,1.05,linen,[0,.44,0],sofa,.13);
  box(2.3,.75,.23,linen,[0,.95,-.48],sofa,.12);
  for(const x of [-1.13,1.13])box(.24,.58,1.05,linen,[x,.77,0],sofa,.12);
  for(const x of [-.55,.55])box(1.04,.23,.9,linen,[x,.7,.035],sofa,.11);
  for(const [x,color]of[[-.68,moss],[.57,throwMat]]){const p=box(.54,.49,.18,color,[x,1.02,-.25],sofa,.1);p.rotation.set(-.18,0,x*.15);}
  const blanketGeo=keep(new THREE.PlaneGeometry(.7,1.5,14,24));
  const blanketPos=blanketGeo.attributes.position;
  for(let i=0;i<blanketPos.count;i++){
    const x=blanketPos.getX(i),t=(blanketPos.getY(i)+.75)/1.5;
    // A continuous cloth strip lies across the seat, then bends over its front edge.
    const fold=THREE.MathUtils.smoothstep(t,.54,.8);
    const y=.846-fold*.65+Math.sin(x*37+t*5)*.012;
    const z=-.39+Math.min(t/.66,1)*1.02+fold*.045+Math.sin(x*37)*.012*fold;
    blanketPos.setXYZ(i,x+.56,y,z);
  }
  blanketGeo.computeVertexNormals();mesh(blanketGeo,throwMat,[0,0,0],sofa,false);

  // Organic oak tea table with a ceramic tea service.
  const teaGroup=group('tea',[-.15,0,.85]);anchors.tea=v(-.15,.88,.85);
  const tableShape=new THREE.Shape();tableShape.moveTo(-1.05,-.3);tableShape.bezierCurveTo(-1.2,.15,-.68,.66,-.03,.65);tableShape.bezierCurveTo(.63,.65,1.16,.36,1.12,-.14);tableShape.bezierCurveTo(1.04,-.7,.36,-.73,-.3,-.64);tableShape.bezierCurveTo(-.67,-.59,-.94,-.53,-1.05,-.3);
  const tableGeo=keep(new THREE.ExtrudeGeometry(tableShape,{depth:.09,bevelEnabled:true,bevelThickness:.035,bevelSize:.035,bevelSegments:3,curveSegments:30}));
  const tableTop=mesh(tableGeo,wood,[0,.64,0],teaGroup);tableTop.rotation.x=-Math.PI/2;
  for(const [x,z]of[[-.65,-.16],[.66,-.07],[.1,.32]])cylinder(.17,.2,.54,wood,[x,.3,z],teaGroup);
  const tray=cylinder(.46,.46,.024,darkWood,[-.22,.775,.06],teaGroup,48);tray.scale.z=.7;
  const pot=group(null,[-.32,.794,.04],0,teaGroup);
  lathe([[0,0],[.1,0],[.16,.06],[.175,.15],[.14,.23],[.09,.25]],ceramic,[0,0,0],pot);
  cylinder(.105,.105,.023,ceramic,[0,.263,0],pot);sphere(.033,.025,.033,darkWood,[0,.29,0],pot);
  tube([[.11,.09,0],[.21,.12,0],[.27,.2,0],[.3,.21,0]],.033,ceramic,pot);
  const handle=mesh(geometry('pot-handle',()=>new THREE.TorusGeometry(.12,.025,8,32,Math.PI*1.5)),ceramic,[-.15,.14,0],pot);handle.rotation.z=Math.PI*.25;
  for(const [x,z]of[[.16,.22],[.43,.03]]){lathe([[.055,0],[.061,.015],[.077,.09],[.072,.105],[.064,.102],[.054,.02]],ceramic,[x,.755,z],teaGroup);const water=mesh(geometry('tea-liquid',()=>new THREE.CircleGeometry(.061,24)),standard('#674429',{roughness:.2}),[x,.851,z],teaGroup);water.rotation.x=-Math.PI/2;}
  bookStack([.53,.765,-.29],teaGroup,2);vase([.62,.865,-.28],teaGroup,.4,blackCeramic);
  const steamTexture=texture(64,(ctx,s)=>{const g=ctx.createRadialGradient(s/2,s/2,0,s/2,s/2,s/2);g.addColorStop(0,'rgba(252,249,231,.23)');g.addColorStop(1,'rgba(252,249,231,0)');ctx.fillStyle=g;ctx.fillRect(0,0,s,s);});
  const steam=[];
  for(let i=0;i<4;i++){const mat=keep(new THREE.SpriteMaterial({map:steamTexture,transparent:true,opacity:0,depthWrite:false}));const s=new THREE.Sprite(mat);s.position.set(-.32,1.16,.04);s.scale.set(.16,.5,1);s.userData.phase=i*.22;teaGroup.add(s);steam.push(s);}

  // Hi-fi corner: open record storage, a proper turntable, two driver speakers.
  const music=group('music',[3.05,0,-2.94],-.08);anchors.music=v(3.0,1.02,-2.65);
  for(const x of [-.82,.82])for(const z of [-.23,.23])cylinder(.028,.02,.19,darkWood,[x,.12,z],music,12);
  box(1.9,.07,.72,wood,[0,.25,0],music,.014);box(1.9,.07,.72,wood,[0,.95,0],music,.018);
  for(const x of [-.92,.05,.92])box(.055,.67,.7,wood,[x,.6,0],music,.009);
  box(.81,.62,.04,wood,[.48,.6,.33],music,.008);box(.13,.015,.025,brass,[.45,.8,.36],music);
  const records=new THREE.InstancedMesh(geometry('record',()=>new THREE.BoxGeometry(.028,.5,.52)),standard('#c1ae89'),23);records.castShadow=true;music.add(records);
  for(let i=0;i<23;i++){dummy.position.set(-.83+i*.034,.55,.015);dummy.rotation.set(0,0,i>18?-.12:0);dummy.scale.set(1,.87+random()*.13,1);dummy.updateMatrix();records.setMatrixAt(i,dummy.matrix);records.setColorAt(i,new THREE.Color(bookColors[i%bookColors.length]));}
  box(.68,.065,.42,darkWood,[.03,1.025,.02],music,.025);
  const vinyl=cylinder(.225,.225,.013,black,[-.055,1.071,.02],music,48);cylinder(.065,.065,.015,standard('#c0a375'),[-.055,1.082,.02],music,32);cylinder(.008,.008,.034,brass,[-.055,1.099,.02],music,12);
  for(let i=0;i<4;i++){const ring=mesh(geometry(`vinyl-ring${i}`,()=>new THREE.TorusGeometry(.09+i*.03,.001,3,48)),standard('#57574d'),[-.055,1.08,.02],music,false);ring.rotation.x=Math.PI/2;}
  tube([[.29,1.1,-.1],[.24,1.12,-.06],[.12,1.12,.16]],.012,brass,music);box(.045,.018,.05,black,[.12,1.11,.16],music,.004);
  for(const x of [-.7,.71]){box(.3,.5,.28,darkWood,[x,1.24,.02],music,.018);box(.265,.46,.016,black,[x,1.24,.171],music,.012);for(const [y,r]of[[1.13,.085],[1.37,.045]]){const cone=cylinder(r,r,.022,standard('#34372e'),[x,y,.19],music,32);cone.rotation.x=Math.PI/2;const rim=mesh(geometry(`driver:${r}`,()=>new THREE.TorusGeometry(r+.006,.008,8,32)),brass,[x,y,.206],music);}}
  // Artwork uses a generated ink landscape, never an external image or font.
  const artMap=texture(512,(ctx,s)=>{ctx.fillStyle='#d9cbb0';ctx.fillRect(0,0,s,s);for(let k=0;k<4;k++){ctx.fillStyle=`rgba(70,78,64,${.12+k*.08})`;ctx.beginPath();ctx.moveTo(0,s);for(let x=0;x<=s;x+=8)ctx.lineTo(x,s*.47+k*40+Math.sin(x*.012+k)*36+Math.sin(x*.038+k)*8);ctx.lineTo(s,s);ctx.fill();}ctx.fillStyle='#b17d4c';ctx.beginPath();ctx.arc(370,150,28,0,7);ctx.fill();});
  box(1.55,1.14,.055,darkWood,[3.15,2.25,-4.08]);const art=mesh(geometry('art',()=>new THREE.PlaneGeometry(1.42,1.01)),standard('#ffffff',{map:artMap,roughness:1}),[3.15,2.25,-4.045]);

  // Detailed paper lantern and reading lamp with warm but limited practical illumination.
  const lamp=group('lamp',[-3.05,0,.15]);anchors.lamp=v(-3.05,1.62,.15);
  cylinder(.21,.24,.045,darkWood,[0,.025,0],lamp);cylinder(.022,.025,1.65,brass,[0,.86,0],lamp,16);
  cylinder(.24,.34,.46,glowing,[0,1.77,0],lamp,48);cylinder(.242,.242,.014,darkWood,[0,2.006,0],lamp,48);cylinder(.344,.344,.012,darkWood,[0,1.54,0],lamp,48);
  // Fine vertical linen grain is visible on the shade, including its rolled edges.
  glowing.map=linenMap;const pendant=group(null,[.35,0,.5]);
  cylinder(.007,.007,.6,black,[0,3.49,0],pendant,8);sphere(.46,.39,.46,glowing,[0,2.85,0],pendant);
  for(let i=1;i<10;i++){const a=-Math.PI/2+i*Math.PI/10,y=2.85+Math.sin(a)*.39,r=Math.cos(a)*.461;const rib=mesh(geometry(`paper-rib${i}`,()=>new THREE.TorusGeometry(r,.0024,4,48)),standard('#a99b7b',{transparent:true,opacity:.32}),[0,y,0],pendant,false);rib.rotation.x=Math.PI/2;}
  for(const y of [2.47,3.23]){const ring=mesh(geometry('lantern-rim',()=>new THREE.TorusGeometry(.105,.007,6,32)),darkWood,[0,y,0],pendant);ring.rotation.x=Math.PI/2;}

  const leafGeometry=(()=>{const shape=new THREE.Shape();shape.moveTo(0,0);shape.bezierCurveTo(-.3,.21,-.2,.65,0,1);shape.bezierCurveTo(.22,.72,.28,.2,0,0);const geo=new THREE.ShapeGeometry(shape,8);const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(p.getY(i)*Math.PI)*.12+Math.abs(p.getX(i))*.14);geo.computeVertexNormals();return keep(geo);})();
  function tree(position,size,id='plant') {
    const g=group(id,position);const potProfile=[[0,0],[.23,0],[.28,.05],[.31,.5],[.29,.6],[.25,.61],[.25,.53]];
    lathe(potProfile,ceramic,[0,0,0],g,size);cylinder(.25*size,.25*size,.015,dark,[0,.54*size,0],g);
    tube([[0,.5*size,0],[.02*size,1.1*size,.03*size],[-.04*size,1.8*size,0],[.03*size,2.4*size,-.02*size]],.026*size,stemMat,g);
    const leaves=new THREE.InstancedMesh(leafGeometry,leafMat,mobile?74:105);leaves.castShadow=!mobile;leaves.receiveShadow=true;g.add(leaves);
    let n=0;
    for(let b=0;b<14;b++){
      const angle=b*2.399,h=(1.1+b*.075)*size,length=(.45+random()*.3)*size;
      const end=[Math.cos(angle)*length,h+.25*size,Math.sin(angle)*length];
      tube([[0,h-.25*size,0],[end[0]*.5,h,end[2]*.5],end],.009*size,stemMat,g);
      for(let j=0;j<8&&n<leaves.count;j++){
        const t=.35+j*.09;dummy.position.set(end[0]*t+(random()-.5)*.25*size,h-.15*size+t*.4*size,end[2]*t+(random()-.5)*.25*size);dummy.rotation.set((random()-.5)*1.6,angle+(random()-.5),(.5-random())*1.8);dummy.scale.set((.23+random()*.14)*size,(.28+random()*.2)*size,1);dummy.updateMatrix();leaves.setMatrixAt(n++,dummy.matrix);
      }
    }
    leaves.count=n;return g;
  }
  tree([-2.62,0,-3.12],1);anchors.plant=v(-2.62,1.55,-3.12);
  tree([3.98,0,-1.25],.68);
  // A low foreground pot and a few considered objects make it a lived-in place.
  tree([-3.8,0,2.2],.42);
  vase([-1.95,.72,-3.91],world,.58,blackCeramic);bookStack([1.68,.75,-3.9],world,3);vase([2.25,.73,-3.88],world,.63);
  const sideTable=group(null,[-3.35,0,1.65]);cylinder(.32,.35,.06,wood,[0,.48,0],sideTable,48);cylinder(.095,.13,.45,wood,[0,.23,0],sideTable);vase([0,.52,0],sideTable,.4,blackCeramic);

  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),tapGesture=createObjectTapGesture();let hovered=null;
  function pick(event) {
    const bounds=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-bounds.left)/bounds.width*2-1,-(event.clientY-bounds.top)/bounds.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObject(world,true)[0];if(!hit)return null;
    let object=hit.object;while(object&&!object.userData.objectId)object=object.parent;
    return object?.userData.objectId||null;
  }
  function onPointerDown(event){tapGesture.down(event);}
  function onPointerMove(event){tapGesture.move(event);if(tapGesture.active)return;const hit=pick(event);if(hit!==hovered){hovered=hit;renderer.domElement.style.cursor=hit?'pointer':'grab';}}
  function onPointerUp(event){if(!tapGesture.up(event))return;const id=pick(event);if(id){selected=id;onObjectSelect?.(id);invalidate();}}
  function onPointerCancel(event){tapGesture.cancel(event);}
  function onPointerLeave(){tapGesture.leave();hovered=null;if(renderer)renderer.domElement.style.cursor='grab';}
  function onKeyDown(event){
    if(event.altKey||event.ctrlKey||event.metaKey)return;
    if(event.key==='Home'){event.preventDefault();focus('home');return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','_'].includes(event.key))return;
    event.preventDefault();transition=null;
    const spherical=new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    if(event.key==='ArrowLeft')spherical.theta-=.065;
    if(event.key==='ArrowRight')spherical.theta+=.065;
    if(event.key==='ArrowUp')spherical.phi-=.045;
    if(event.key==='ArrowDown')spherical.phi+=.045;
    if(event.key==='+'||event.key==='=')spherical.radius*=.92;
    if(event.key==='-'||event.key==='_')spherical.radius*=1.08;
    spherical.theta=THREE.MathUtils.clamp(spherical.theta,controls.minAzimuthAngle,controls.maxAzimuthAngle);
    spherical.phi=THREE.MathUtils.clamp(spherical.phi,controls.minPolarAngle,controls.maxPolarAngle);
    spherical.radius=THREE.MathUtils.clamp(spherical.radius,controls.minDistance,controls.maxDistance);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));controls.update();invalidate();
  }
  function projectObjects(){const result={};for(const[id,point]of Object.entries(anchors)){const p=point.clone().project(camera);result[id]={x:(p.x+1)/2,y:(1-p.y)/2,visible:p.z<1&&Math.abs(p.x)<1&&Math.abs(p.y)<1};}return result;}
  function focus(id='home',instant=false){const target=homes[id==='reading'?'books':id==='view'?'window':id]||homes.home;selected=id==='home'?null:id;
    transition={start:performance.now(),from:camera.position.clone(),fromTarget:controls.target.clone(),to:v(...target.position),toTarget:v(...target.target),duration:instant||reducedMotion?0:1100};invalidate();
  }
  function setTime(mode){if(!['dawn','dusk','night'].includes(mode))return;currentTime=mode;drawLandscape(mode);
    const night=mode==='night',dawn=mode==='dawn';skyLight.color.set(night?'#8da6c0':dawn?'#d8ded5':'#e3dfd0');skyLight.intensity=night?.47:1.7;
    fillLight.intensity=night?.2:.52;sun.intensity=night?.14:dawn?2.1:3.1;sun.color.set(night?'#a6bfdc':dawn?'#fff0d0':'#ffdaa4');sun.position.set(dawn?-3.3:3.8,night?5:3.4,-6.8);
    pendantLight.intensity=night?23:17;cabinetLight.intensity=night?8:5;lampLight.intensity=lampOn?(night?22:15):0;glowing.emissiveIntensity=night?.75:.35;
    scene.background.set(night?'#242c30':'#a8a193');scene.fog.color.copy(scene.background);invalidate();
  }
  function setLamp(value){lampOn=!!value;lampLight.intensity=lampOn?(currentTime==='night'?22:15):0;invalidate();}
  function setStyle(style){const palettes={oak:['#d7b283','#6b513a','#f0e8d9','#e3dccb'],walnut:['#9c7959','#493b2d','#e5dace','#cec3ac'],plaster:['#d2c3a7','#857457','#f5f0e5','#e9e3d6']};const p=palettes[style]||palettes.oak;wood.color.set(p[0]);darkWood.color.set(p[1]);plaster.color.set(p[2]);linen.color.set(p[3]);invalidate();}
  function setTeaState(phase){tea=phase===true||phase==='brewing'||phase==='ready'||(typeof phase==='number'&&phase>=0);steam.forEach(s=>s.material.opacity=tea?.45:0);invalidate();}
  function resize(){if(disposed||!renderer)return;const width=Math.max(1,container.clientWidth),height=Math.max(1,container.clientHeight);camera.aspect=width/height;camera.fov=width<650?69:57;camera.updateProjectionMatrix();renderer.setSize(width,height,false);invalidate();}
  function invalidate(){dirty=true;if(!frame&&!inFrame&&!paused&&!disposed)frame=requestAnimationFrame(render);}
  function render(now){frame=0;if(disposed||paused)return;inFrame=true;const delta=lastFrame?Math.min((now-lastFrame)/1000,.05):0;lastFrame=now;elapsed+=delta;
    if(transition){const p=transition.duration?Math.min(1,(now-transition.start)/transition.duration):1,e=p*p*(3-2*p);camera.position.lerpVectors(transition.from,transition.to,e);controls.target.lerpVectors(transition.fromTarget,transition.toTarget,e);dirty=true;if(p===1)transition=null;}
    const damping=controls.update();
    if(tea&&!reducedMotion){steam.forEach(s=>{const phase=(elapsed*.23+s.userData.phase)%1;s.position.y=.99+phase*.6;s.position.x=-.32+Math.sin(phase*6+s.userData.phase)*.055;s.material.opacity=Math.sin(phase*Math.PI)*.37;});dirty=true;}
    if(dirty||damping){renderer.render(scene,camera);options.onViewChange?.(projectObjects());dirty=false;}
    inFrame=false;if(transition||damping||moving||(tea&&!reducedMotion))frame=requestAnimationFrame(render);
  }
  function setPaused(value){paused=!!value;if(paused){if(frame)cancelAnimationFrame(frame);frame=0;lastFrame=0;}else invalidate();}
  function onVisibility(){setPaused(document.hidden);}
  function onMotion(event){reducedMotion=event.matches;controls.enableDamping=!reducedMotion;invalidate();}
  function contextLost(event){event.preventDefault();setPaused(true);destroy();onError?.(new Error('The room graphics context was lost.'));}
  function destroy(){if(disposed)return;disposed=true;if(frame)cancelAnimationFrame(frame);observer?.disconnect();controls?.dispose();document.removeEventListener('visibilitychange',onVisibility);media.removeEventListener?.('change',onMotion);
    if(renderer){const canvas=renderer.domElement;canvas.removeEventListener('pointerdown',onPointerDown);canvas.removeEventListener('pointermove',onPointerMove);canvas.removeEventListener('pointerup',onPointerUp);canvas.removeEventListener('pointercancel',onPointerCancel);canvas.removeEventListener('pointerleave',onPointerLeave);canvas.removeEventListener('keydown',onKeyDown);canvas.removeEventListener('webglcontextlost',contextLost);canvas.remove();}
    scene.traverse(object=>{if(object.isInstancedMesh)object.dispose();if(object.isLight&&object.shadow)object.shadow.dispose();});
    for(const resource of resources)resource.dispose?.();resources.clear();renderer?.dispose();scene.clear();
  }
  try {
    renderer=new THREE.WebGLRenderer({antialias:!mobile,alpha:false,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,mobile?1.4:1.7));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.13;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
    renderer.domElement.className='room-world-canvas';renderer.domElement.style.cssText='display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab';renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('role','group');renderer.domElement.setAttribute('aria-label','三维房间 · 3D room. 方向键环顾，+ / − 缩放，Home 回到初见。Arrow keys look around; + / − zoom; Home resets the view.');container.append(renderer.domElement);
    controls=new OrbitControls(camera,renderer.domElement);controls.enablePan=false;controls.enableDamping=!reducedMotion;controls.dampingFactor=.075;controls.rotateSpeed=.35;controls.zoomSpeed=.55;
    controls.minDistance=2;controls.maxDistance=9;controls.minPolarAngle=1.06;controls.maxPolarAngle=1.68;controls.minAzimuthAngle=-1.05;controls.maxAzimuthAngle=1.05;
    controls.addEventListener('start',()=>{moving=true;transition=null;invalidate();});controls.addEventListener('end',()=>{moving=false;invalidate();});controls.addEventListener('change',invalidate);
    renderer.domElement.addEventListener('pointerdown',onPointerDown);renderer.domElement.addEventListener('pointermove',onPointerMove);renderer.domElement.addEventListener('pointerup',onPointerUp);renderer.domElement.addEventListener('pointercancel',onPointerCancel);renderer.domElement.addEventListener('pointerleave',onPointerLeave);renderer.domElement.addEventListener('keydown',onKeyDown);renderer.domElement.addEventListener('webglcontextlost',contextLost);
    document.addEventListener('visibilitychange',onVisibility);media.addEventListener?.('change',onMotion);
    observer=new ResizeObserver(resize);observer.observe(container);camera.position.set(...homes.home.position);controls.target.set(...homes.home.target);controls.update();resize();setTime('dusk');
    await renderer.compileAsync(scene,camera);if(disposed)throw new Error('Room initialization was cancelled.');renderer.render(scene,camera);onReady?.();invalidate();
    return {setTime,setLamp,setStyle,setMaterial:setStyle,setTeaState,focus,reset:()=>focus('home'),setPaused,destroy,getAnchors:projectObjects};
  } catch(error){destroy();throw error;}
}
