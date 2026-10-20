import scene from './scene.svg?raw';
import { safeURL, readPreference, writePreference, selectBooks, validateRoom } from './helpers.js';

const $ = id => document.getElementById(id);
const dict = {
  starchart:['星图','Starchart'],research:['科研','Research'],writing:['文字','Writing'],room:['房间','The Room'],
  title:['给自己，留一间房。','A room of one’s own.'],description:['读几页书，等一壶茶。把时间还给自己。','A few pages. A pot of tea. A little time to yourself.'],
  light:['窗外的光','The light outside'],dawn:['清晨','Dawn'],dusk:['傍晚','Dusk'],night:['夜晚','Night'],
  books:['书架','Books'],tea:['茶桌','Tea'],music:['音乐','Music'],plant:['植物','Plant'],window:['窗外','Window'],lamp:['落地灯','Lamp'],
  explore:['点亮一件小物，走进一段日常。','Choose an object. Stay for a little while.'],reset:['回到初见 ↺','Start anew ↺'],footer:['向外探索，向内生活。','Explore the world. Make room for life.'],back:['返回星图 ↗','Back to Caelum ↗'],retry:['重新加载','Try again'],
  homeTitle:['未来的房间','The Room, someday'],homeFoot:['一间关于未来日常的小小想象。','A small imagining of an everyday life to come.'],
  bookTitle:['书页之间','Between the pages'],bookIntro:['从已有的阅读星图里，取几本书放在手边。','A few books from the existing reading constellation, kept close at hand.'],
  bookLink:['走进阅读星图 ↗','Explore the reading constellation ↗'],noteLink:['更多读书笔记与文字 ↗','More notes and writing ↗'],readingNotes:['书页之外 · 读书笔记','Beyond the pages · Reading notes'],loading:['正在从星图取书…','Bringing a few books from the constellation…'],
  noBooks:['书目暂时没能取回，阅读星图仍在原处。','The books could not be loaded. The constellation is still there.'],
  brew:['为自己泡一壶茶','Make a pot of tea'],brewing:['正在泡茶…','Making tea…'],ready:['茶好了。慢慢喝。','Tea is ready. Take your time.'],again:['再泡一壶','Make another pot'],cancelTea:['结束这次泡茶','End this ritual'],
  ambientStart:['播放轻柔雨声','Play gentle rain'],ambientStop:['暂停雨声','Pause the rain'],ambientDetail:['浏览器实时合成 · 无人声 · 不自动播放','Synthesized in your browser · No voices · Starts only on request'],
  audioError:['这个浏览器暂时无法播放环境声。','Ambient audio is unavailable in this browser.'],
  plantLabel:['今天观察到了什么？','What did you notice today?'],plantPlaceholder:['一片新叶，一点光，或只是今天的心情…','A new leaf, a patch of light, or a passing thought…'],saveNote:['保存这条札记','Save this observation'],notePrivacy:['只保存在当前浏览器，不上传。','Saved in this browser only. Never uploaded.'],noteSaved:['札记已保存在当前浏览器。','Observation saved in this browser.'],noteFailed:['浏览器禁止了本地保存，请先复制札记。','Local saving is blocked. Please copy your observation.'],
  windowTitle:['让光走慢一点','Let the light linger'],windowNote:['窗外没有时钟，只有光的变化。选择一种光，让房间陪你停留。','No clock outside, just the changing light. Choose a time and stay a while.'],
  lampTitle:['留一盏灯','Leave a light on'],lampNote:['读书时，为自己留一小圈温暖。','A small circle of warmth, for a few more pages.'],lampOn:['关掉落地灯','Turn the lamp off'],lampOff:['点亮落地灯','Turn the lamp on'],
  duskCaption:['傍晚 · 日光渐慢','Dusk · The light softens'],nightCaption:['夜晚 · 万物渐静','Night · The world settles'],dawnCaption:['清晨 · 一日将起','Dawn · A day begins'],
  configError:['房间内容暂时无法加载；仍可切换灯光、时间与雨声。','Room content could not load; light, time, and rain still work.'],
  contentError:['部分书目或笔记暂时无法加载，可从下方链接继续阅读。','Some books or notes could not load. Continue through the links below.'],
  resetDone:['光回到傍晚，房间又安静下来。','Back to dusk. The room settles again.']
};
let lang = readPreference('caelum_lang', 'zh') === 'en' ? 'en' : 'zh';
let time = 'dusk', lamp = true, selected = null, data = null, readingCache = null, readingRequest = null;
let renderVersion = 0, teaStep = -1, teaTimers = [], audioContext = null, audioSource = null, audioGain = null;
let audioStarting = false, audioEpoch = 0, plantDraft = readPreference('caelum_room_plant_note');
const tr = key => (dict[key] || [key,key])[lang === 'en' ? 1 : 0];
const localized = value => typeof value === 'string' ? value : value?.[lang] || value?.zh || '';
const say = text => { $('feedback').textContent = text; };
function el(tag, text, className) {
  const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node;
}
function button(text, handler, className = 'action-button') { const b = el('button', text, className); b.type='button';b.addEventListener('click',handler);return b; }
function link(text, href, className = 'panel-link', external = false) {
  const a=el('a',text,className);const url=safeURL(href,location.href);if(url)a.href=url;if(external){a.target='_blank';a.rel='noopener noreferrer';}return a;
}
$('scene-art').innerHTML = scene; // trusted, locally authored SVG; configuration is always rendered as text
$('hotspots').hidden = false;
function translate() {
  document.documentElement.lang=lang==='zh'?'zh-CN':'en';
  document.title=lang==='zh'?'未来的房间 · Caelum':'The Room · Caelum';
  document.querySelectorAll('[data-i18n]').forEach(n=>n.textContent=tr(n.dataset.i18n));
  $('language').textContent=lang==='zh'?'EN':'中';
  $('language').setAttribute('aria-label',lang==='zh'?'Switch to English':'切换到中文');
  $('time-caption').textContent=tr(time+'Caption');
  document.querySelectorAll('.hotspot').forEach(b=>b.setAttribute('aria-label',tr(b.dataset.object)));
  const art=$('scene-art').querySelector('svg');art.setAttribute('role','img');art.setAttribute('aria-label',lang==='zh'?'温暖的等距房间，书架、阅读椅、茶桌、唱片机、植物与窗户。':'A warm isometric room with books, an armchair, tea, a record player, a plant, and a window.');
  if(!$('load-error').hidden)$('load-error-text').textContent=tr('configError');
}
function setTime(value, announce=true) {
  if(!['dawn','dusk','night'].includes(value))return;
  time=value;document.body.dataset.time=time;
  document.querySelectorAll('.time-options button').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.time===time)));
  $('time-caption').textContent=tr(time+'Caption');if(announce)say(tr(time+'Caption'));
}
function clearTea() {teaTimers.forEach(clearTimeout);teaTimers=[];teaStep=-1;document.body.classList.remove('brewing','tea-ready');}
function renderTeaState() {
  const b=$('brew');if(!b)return;
  b.textContent=tr(teaStep===3?'again':teaStep>=0?'brewing':'brew');b.disabled=teaStep>=0&&teaStep<3;
  document.querySelectorAll('.step-list span').forEach((n,i)=>n.classList.toggle('active',i===teaStep||teaStep===3));
  const cancel=$('cancel-tea');if(cancel)cancel.hidden=teaStep<0||teaStep===3;
}
function startTea() {
  clearTea();teaStep=0;document.body.classList.add('brewing');renderTeaState();
  say(localized(data?.tea?.steps?.[0])||tr('brewing'));
  [1,2,3].forEach((step,i)=>teaTimers.push(setTimeout(()=>{
    teaStep=step;
    if(step===3){document.body.classList.remove('brewing');document.body.classList.add('tea-ready');say(tr('ready'));}
    else say(localized(data?.tea?.steps?.[step])||tr('brewing'));
    renderTeaState();
  },(i+1)*1800)));
}
async function toggleAudio() {
  if(audioSource||audioStarting){stopAudio();return;}
  const epoch=++audioEpoch;audioStarting=true;renderAudioState();
  try {
    const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw new Error('No audio');
    if(!audioContext)audioContext=new Context();
    await audioContext.resume();
    if(epoch!==audioEpoch||document.hidden){if(!audioSource)audioContext.suspend().catch(()=>{});return;}
    const buffer=audioContext.createBuffer(1,audioContext.sampleRate*3,audioContext.sampleRate),channel=buffer.getChannelData(0);
    let last=0;for(let i=0;i<channel.length;i++){last=(last+Math.random()*.04-.02)/1.02;channel[i]=last*3.5;}
    const source=audioContext.createBufferSource();source.buffer=buffer;source.loop=true;
    const lowPass=audioContext.createBiquadFilter();lowPass.type='lowpass';lowPass.frequency.value=1100;
    const gain=audioContext.createGain();gain.gain.setValueAtTime(0,audioContext.currentTime);gain.gain.linearRampToValueAtTime(.25,audioContext.currentTime+.7);
    source.connect(lowPass);lowPass.connect(gain);gain.connect(audioContext.destination);audioSource=source;audioGain=gain;source.start();say(tr('ambientStart'));
  } catch {say(tr('audioError'));}
  finally {audioStarting=false;renderAudioState();}
}
function stopAudio() {
  audioEpoch++;audioStarting=false;
  if(audioSource){audioSource.stop();audioSource.disconnect();audioSource=null;audioGain?.disconnect();audioGain=null;}
  if(audioContext?.state==='running')audioContext.suspend().catch(()=>{});
  renderAudioState();
}
function renderAudioState(){const b=$('ambient');if(b){b.textContent=tr(audioSource?'ambientStop':'ambientStart');b.disabled=audioStarting;b.setAttribute('aria-pressed',String(!!audioSource));}}
async function fetchJSON(path) {
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),10000);
  try {
    const response=await fetch(new URL(path,new URL(import.meta.env.BASE_URL,location.origin)),{signal:controller.signal});
    if(!response.ok)throw new Error('HTTP '+response.status);
    return await response.json();
  } finally {clearTimeout(timeout);}
}
async function loadConfig() {
  $('retry').disabled=true;
  try {data=validateRoom(await fetchJSON('data/room.json'));$('load-error').hidden=true;renderPanel();}
  catch {$('load-error').hidden=false;$('load-error-text').textContent=tr('configError');renderPanel();}
  finally {$('retry').disabled=false;}
}
async function readBooks(){
  if(readingCache)return readingCache;
  if(!readingRequest)readingRequest=Promise.allSettled([fetchJSON('data/graph.json'),fetchJSON('data/articles.json')]).then(([g,a])=>{
    const result={graph:g.status==='fulfilled'?g.value:null,articles:a.status==='fulfilled'&&Array.isArray(a.value)?a.value:[],partial:g.status==='rejected'||a.status==='rejected'};
    if(!result.partial)readingCache=result;return result;
  }).finally(()=>{readingRequest=null;});
  return readingRequest;
}
function panelHeading(title,kicker) {const panel=$('panel');panel.replaceChildren();$('panel-kicker').textContent=kicker;const h=el('h2',title);h.id='content-title';panel.append(h);return panel;}
async function renderPanel() {
  const version=++renderVersion;
  document.querySelectorAll('[data-object]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.object===selected)));
  if(!selected){
    const p=panelHeading(tr('homeTitle'),'THE ART OF SLOW LIVING');
    p.append(el('p',localized(data?.intro)||tr('description')));
    const quote=el('p',localized(data?.quote)||(lang==='zh'?'在很大的世界里，\n安放很小的自己。':'A small place of your own,\nin a very big world.'),'panel-quote');quote.style.whiteSpace='pre-line';p.append(quote,el('p',tr('homeFoot'),'panel-foot'));return;
  }
  if(selected==='books'){
    const p=panelHeading(tr('bookTitle'),'01 / BOOKS & WORDS');p.append(el('p',tr('bookIntro')));
    const loading=el('p',tr('loading'),'panel-loading');loading.setAttribute('role','status');p.append(loading);
    const result=await readBooks();if(version!==renderVersion)return;loading.remove();
    const books=selectBooks(result.graph,data?.reading);
    if(!books.length)p.append(el('p',tr('noBooks')));
    const list=el('ul',null,'panel-list');books.forEach((b,i)=>{const li=el('li');li.append(link(String(i+1).padStart(2,'0')+'　'+b.title,'./#sec-map',''),el('small',b.author||''));list.append(li);});p.append(list,link(tr('bookLink'),'./#sec-map'));
    const articles=result.articles.filter(a=>/读书|阅读/.test(a.category||'')).slice(0,2);
    if(articles.length){p.append(el('p',tr('readingNotes'),'panel-foot'));const notes=el('ul',null,'panel-list');articles.forEach(a=>{const url=safeURL(a.url);if(url){const li=el('li');li.append(link(a.title,url,'',true));notes.append(li);}});p.append(notes);}
    p.append(link(tr('noteLink'),'./#sec-essays'));if(result.partial)p.append(el('p',tr('contentError'),'panel-foot'));
  }else if(selected==='tea'){
    const p=panelHeading(localized(data?.tea?.title)||tr('tea'),'02 / THE TEA RITUAL');p.append(el('p',localized(data?.tea?.note)||tr('description')));
    const steps=el('div',null,'step-list');(data?.tea?.steps||[{zh:'温杯',en:'Warm'},{zh:'注水',en:'Steep'},{zh:'分茶',en:'Pour'}]).slice(0,3).forEach((step,i)=>{const s=el('span');s.append(el('b',String(i+1).padStart(2,'0')),document.createTextNode(localized(step)));steps.append(s);});p.append(steps);
    const brew=button(tr('brew'),startTea);brew.id='brew';p.append(brew);const cancel=button(tr('cancelTea'),()=>{clearTea();renderTeaState();say(tr('resetDone'));},'secondary-button');cancel.id='cancel-tea';p.append(cancel);renderTeaState();
  }else if(selected==='music'){
    const p=panelHeading(lang==='zh'?'听见安静':'Listen to the quiet','03 / SOUND & SILENCE');p.append(el('p',localized(data?.music?.note)||tr('description')));
    const b=button(tr('ambientStart'),toggleAudio);b.id='ambient';p.append(b,el('p',tr('ambientDetail'),'panel-foot'));renderAudioState();
    const list=el('ul',null,'panel-list');(Array.isArray(data?.music?.playlist)?data.music.playlist:[]).forEach(item=>{const url=safeURL(item?.url);if(url){const li=el('li');li.append(link(localized(item.title),url,'',true));list.append(li);}});p.append(list);
  }else if(selected==='plant'){
    const p=panelHeading(localized(data?.plant?.name)||tr('plant'),'04 / GROWING, SLOWLY');p.append(el('p',localized(data?.plant?.note)||tr('description')));
    const label=el('label',tr('plantLabel'),'note-label');label.htmlFor='plant-note';const input=el('textarea',null,'plant-note');input.id='plant-note';input.maxLength=2000;input.placeholder=tr('plantPlaceholder');input.value=plantDraft;input.addEventListener('input',()=>{plantDraft=input.value;});
    p.append(label,input,button(tr('saveNote'),()=>say(tr(writePreference('caelum_room_plant_note',input.value)?'noteSaved':'noteFailed'))),el('p',tr('notePrivacy'),'panel-foot'));
  }else if(selected==='window'){
    const p=panelHeading(tr('windowTitle'),'05 / A CHANGE OF LIGHT');p.append(el('p',tr('windowNote')));
    ['dawn','dusk','night'].forEach(t=>{const b=button(tr(t),()=>{setTime(t);renderPanel();});b.setAttribute('aria-pressed',String(t===time));p.append(b);});
  }else if(selected==='lamp'){
    const p=panelHeading(tr('lampTitle'),'06 / A POOL OF WARMTH');p.append(el('p',tr('lampNote')));const b=button(tr(lamp?'lampOn':'lampOff'),()=>{lamp=!lamp;document.body.dataset.lamp=lamp?'on':'off';renderPanel();say(tr(lamp?'lampOff':'lampOn'));});b.setAttribute('aria-pressed',String(lamp));p.append(b);
  }
}
function chooseObject(object){selected=object;if(object==='window')setTime(['dusk','night','dawn'][(['dusk','night','dawn'].indexOf(time)+1)%3]);if(object==='lamp'){lamp=!lamp;document.body.dataset.lamp=lamp?'on':'off';}renderPanel();}
document.querySelectorAll('[data-object]').forEach(b=>b.addEventListener('click',()=>chooseObject(b.dataset.object)));
document.querySelectorAll('.time-options button').forEach(b=>b.addEventListener('click',()=>{setTime(b.dataset.time);if(selected==='window')renderPanel();}));
$('language').addEventListener('click',()=>{lang=lang==='zh'?'en':'zh';writePreference('caelum_lang',lang);translate();renderPanel();say('');});
$('retry').addEventListener('click',()=>{readingCache=null;loadConfig();});
$('reset').addEventListener('click',()=>{clearTea();stopAudio();lamp=true;document.body.dataset.lamp='on';setTime('dusk',false);selected=null;renderPanel();say(tr('resetDone'));});
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('is-hidden',document.hidden);if(document.hidden)stopAudio();});
window.addEventListener('pagehide',()=>{clearTea();stopAudio();audioContext?.close().catch(()=>{});audioContext=null;});
translate();renderPanel();loadConfig();
