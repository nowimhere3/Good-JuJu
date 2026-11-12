export const DIRECTIONS=[['ltr','Left → Right'],['rtl','Right → Left'],['ttb','Top → Bottom'],['btt','Bottom → Top'],['tl-br','Top-left → Bottom-right'],['tr-bl','Top-right → Bottom-left'],['bl-tr','Bottom-left → Top-right'],['br-tl','Bottom-right → Top-left']];
export const DEFAULT_DURATION=1100;
export const EFFECTS=[['light','Light Sparkle'],['classic','Classic Sparkle'],['super','Super Sparkle'],['stardust','Stardust Trail'],['prismatic','Prismatic Wave'],['comet','Comet Shower']];
export const VIEW_MODES=['normal','enlarged','remember'];
export function normalizeDuration(value){const n=Number(value);return Number.isFinite(n)&&n>=.5&&n<=3.5?Math.round(n*10)*100:DEFAULT_DURATION;}
function normalizeSettings(value={}){return {effect:EFFECTS.some(([id])=>id===value.effect)||value.effect==='random'?value.effect:'classic',direction:DIRECTIONS.some(([id])=>id===value.direction)||value.direction==='random'?value.direction:'ltr',duration:normalizeDuration(value.duration/1000),defaultView:VIEW_MODES.includes(value.defaultView)?value.defaultView:'remember'};}
export function getRevealSettings(){
  try{const saved=JSON.parse(localStorage.getItem('vortex-preferences-v2')||'null');if(saved?.version===2)return normalizeSettings(saved);return normalizeSettings({direction:localStorage.getItem('vortex-reveal-direction'),duration:normalizeDuration(localStorage.getItem('vortex-reveal-seconds'))});}catch{return normalizeSettings();}
}
export function saveRevealSettings(draft){const value=normalizeSettings(draft);localStorage.setItem('vortex-preferences-v2',JSON.stringify({version:2,...value}));return value;}
export function getLastView(){try{return localStorage.getItem('vortex-last-view')==='enlarged'?'enlarged':'normal';}catch{return 'normal';}}
export function rememberView(mode){try{localStorage.setItem('vortex-last-view',mode);}catch{/* Viewing still works when preference storage is unavailable. */}}
const independentRandom=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32;
export function resolveEffect(value,random=independentRandom){return value==='random'?EFFECTS[Math.min(5,Math.floor(random()*6))][0]:EFFECTS.some(([id])=>id===value)?value:'classic';}
export function resolveDirection(value,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/2**32){return value==='random'?DIRECTIONS[Math.min(7,Math.floor(random()*8))][0]:DIRECTIONS.some(([id])=>id===value)?value:'ltr';}
export function revealGeometry(width,height,direction){
  const vectors={ltr:[1,0],rtl:[-1,0],ttb:[0,1],btt:[0,-1],'tl-br':[1,1],'tr-bl':[-1,1],'bl-tr':[1,-1],'br-tl':[-1,-1]};
  let [nx,ny]=vectors[direction]||vectors.ltr;const norm=Math.hypot(nx,ny);nx/=norm;ny/=norm;
  const tx=-ny,ty=nx,span=Math.hypot(width,height)*2;
  const dots=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>x*nx+y*ny),min=Math.min(...dots)-1,max=Math.max(...dots)+1;
  const centerDot=width/2*nx+height/2*ny;
  function boundary(threshold){const x=width/2+nx*(threshold-centerDot),y=height/2+ny*(threshold-centerDot);const a=[x+tx*span,y+ty*span],b=[x-tx*span,y-ty*span];return {clip:`polygon(${[a,b,[b[0]+nx*span,b[1]+ny*span],[a[0]+nx*span,a[1]+ny*span]].map(p=>p.map(n=>`${n.toFixed(3)}px`).join(' ')).join(', ')})`,transform:`translate(${x-span}px, ${y-17}px) rotate(${Math.atan2(ty,tx)*180/Math.PI}deg)`};}
  return {from:boundary(min),to:boundary(max),lineWidth:span*2};
}
