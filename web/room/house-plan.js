import {SPATIAL_MODEL} from './spatial-model.js';
import {planSVG} from './spatial-drawings.js';
export const HOUSE_PLAN_GEOMETRY=SPATIAL_MODEL.zones;

/** One shared model; native keyboard control remains available in every plan. */
export function createHousePlan(container,{onSelect=()=>{},language='zh',selected='living',layer='furniture'}={}){
 if(!container?.replaceChildren)throw new TypeError('A plan container is required.');
 let lang=language==='en'?'en':'zh',current=HOUSE_PLAN_GEOMETRY.some(z=>z.id===selected)?selected:'living',currentLayer=layer;
 function render(){container.innerHTML=planSVG({selected:current,lang,layer:currentLayer});const svg=container.querySelector('svg');svg.classList.add('house-plan-svg');svg.setAttribute('role','group');const style=document.createElementNS('http://www.w3.org/2000/svg','style');style.textContent='.house-zone{cursor:pointer}.house-zone:focus{outline:none}.house-zone:focus-visible .hp-zone-hit{stroke:#637d4d;stroke-width:4}.house-zone:hover .hp-zone-hit{stroke:#ad9673;stroke-width:2}.house-zone.is-selected .hp-zone-hit{fill:#dfc7a5;stroke:#ad9673;stroke-width:1.5}';svg.prepend(style);select(current);}
 function select(id){if(!HOUSE_PLAN_GEOMETRY.some(z=>z.id===id))return false;current=id;for(const g of container.querySelectorAll('.house-zone')){const active=g.dataset.id===id;g.classList.toggle('is-selected',active);g.setAttribute('aria-pressed',String(active));const p=g.querySelector('.hp-zone-hit');p.setAttribute('fill',active?'#dfc7a5':g.dataset.id==='garden'?'#e0e5d4':g.dataset.id==='bath'?'#e4e7df':'#f0e9dc');}return true;}
 const click=e=>{const g=e.target.closest?.('.house-zone');if(g&&container.contains(g)&&select(g.dataset.id))onSelect(g.dataset.id);};
 const keydown=e=>{const g=e.target.closest?.('.house-zone');if(!g||!container.contains(g))return;const ids=HOUSE_PLAN_GEOMETRY.map(z=>z.id),i=ids.indexOf(g.dataset.id);if(e.key==='Enter'||e.key===' '){e.preventDefault();select(g.dataset.id);onSelect(g.dataset.id);}else if(['ArrowRight','ArrowDown','ArrowLeft','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const j=e.key==='Home'?0:e.key==='End'?ids.length-1:(i+(['ArrowRight','ArrowDown'].includes(e.key)?1:ids.length-1))%ids.length;container.querySelector(`[data-id="${ids[j]}"]`).focus();}};
 container.addEventListener('click',click);container.addEventListener('keydown',keydown);render();
 return {select,setLanguage(value){lang=value==='en'?'en':'zh';render();},setLayer(value){currentLayer=value;render();},destroy(){container.removeEventListener('click',click);container.removeEventListener('keydown',keydown);container.replaceChildren();}};
}
export default createHousePlan;
