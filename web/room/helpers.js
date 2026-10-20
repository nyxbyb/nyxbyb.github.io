export function safeURL(value, base = 'https://nyxbyb.github.io/web/') {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(String(value), base);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}
export function readPreference(key, fallback = '') {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem(key, value); return true; } catch { return false; }
}
export function selectBooks(graph, reading = {}) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes.filter(n => n?.type === 'book' && typeof n.title === 'string') : [];
  const titles = Array.isArray(reading.titles) ? reading.titles : [];
  const chosen = titles.map(title => nodes.find(n => n.title === title)).filter(Boolean);
  const limit = Math.min(6, Math.max(1, Number(reading.limit) || 3));
  return [...new Map([...chosen, ...nodes.filter(n => ['read', 'fav'].includes(n.status))].map(n => [n.title, n])).values()].slice(0, limit);
}
export function validateRoom(data) {
  if (!data || typeof data !== 'object' || data.version !== 1 || !data.intro || !data.tea || !Array.isArray(data.tea.steps) || !data.plant || !data.music) throw new Error('Invalid room configuration');
  return data;
}

export function validateHouse(data) {
  const ids=['living','study','bedroom','kitchen','flex','reserve','bath','entry','garden'];
  const fail=()=>{throw new Error('Invalid house configuration');};
  const bilingual=value=>value&&typeof value==='object'&&['zh','en'].every(lang=>typeof value[lang]==='string'&&value[lang].length<=6000);
  const lists=value=>value&&['zh','en'].every(lang=>Array.isArray(value[lang])&&value[lang].length<=12&&value[lang].every(item=>typeof item==='string'&&item.length<=2000));
  if(!data||data.version!==1||!Array.isArray(data.rooms)||data.rooms.length!==ids.length||new Set(data.rooms.map(room=>room?.id)).size!==ids.length)fail();
  for(const room of data.rooms){
    if(!room||!ids.includes(room.id)||!Number.isFinite(room.area)||room.area<=0||room.area>1000||!['public','private','service','outdoor'].includes(room.zone))fail();
    for(const key of ['label','subtitle','narrative','dimensions'])if(!bilingual(room[key]))fail();
    if(!lists(room.materials)||!lists(room.practical))fail();
  }
  const a=data.assumptions;
  if(!a||!['grossFloorArea','netProgramArea','wallAndServiceAllowance','courtyardArea','enclosedRooms'].every(key=>Number.isFinite(a[key])&&a[key]>=0))fail();
  const net=data.rooms.filter(room=>room.zone!=='outdoor').reduce((sum,room)=>sum+room.area,0);
  const outdoor=data.rooms.filter(room=>room.zone==='outdoor').reduce((sum,room)=>sum+room.area,0);
  if(Math.abs(net-a.netProgramArea)>1e-6||Math.abs(outdoor-a.courtyardArea)>1e-6||Math.abs(a.grossFloorArea-a.netProgramArea-a.wallAndServiceAllowance)>1e-6)fail();
  return data;
}
